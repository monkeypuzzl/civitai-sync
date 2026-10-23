import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Nav } from './components/Nav.jsx';
import { getConfig, getStats, listExports, connectProgress, refreshUser } from './api.js';
import { loadUiPrefs } from './lib/sticky-ui.js';
import { getRoute, subscribe } from './lib/router.js';
import { CORPUS_CHANGE_EVENT } from './lib/nav-tabs.js';
import { routeTitleSpec, useDocumentTitle } from './lib/page-title.js';
import { bumpOwnModelsRevision } from './lib/own-models-rev.js';
import { exportsBadgeKind } from './lib/export-status.js';
import { getDownloadMark, noteDownloadEvent } from './lib/download-mark.js';
import { noteSettleFrame, subscribeIndexEpoch } from './lib/index-settle.js';
import { invalidateDetailCache } from './lib/detail-ready.js';
import { noteLibraryPreparation } from './lib/library-preparation.js';
import { viewWaitsForStickyPrefs } from './lib/view-ready.js';

// One module per route kind. Models and media stay one component so a new
// entityId does not fetch another chunk or blank the page.
const VIEW_LOADERS = {
  overview: () => import('./components/OverviewView.jsx').then(m => m.OverviewView),
  generations: () => import('./components/GenerationsView.jsx').then(m => m.GenerationsView),
  generation: () => import('./components/BatchDetailView.jsx').then(m => m.BatchDetailView),
  posts: () => import('./components/PostsView.jsx').then(m => m.PostsView),
  post: () => import('./components/PostDetailView.jsx').then(m => m.PostDetailView),
  comics: () => import('./components/ComicsView.jsx').then(m => m.ComicsView),
  comic: () => import('./components/ComicDetailView.jsx').then(m => m.ComicDetailView),
  model3ds: () => import('./components/Model3dsView.jsx').then(m => m.Model3dsView),
  exports: () => import('./components/ExportsView.jsx').then(m => m.ExportsView),
  models: () => import('./components/ModelsView.jsx').then(m => m.ModelsView),
  media: () => import('./components/MediaDetail.jsx').then(m => m.MediaDetailView),
  download: () => import('./components/DownloadView.jsx').then(m => m.DownloadView)
};

const resolvedChunks = new Map();
const inflightChunks = new Map();

function viewChunkKey (route) {
  const view = route?.view;
  const entityId = route?.entityId;
  if (view === 'generations') return entityId ? 'generation' : 'generations';
  if (view === 'posts') return entityId ? 'post' : 'posts';
  if (view === 'comics') return entityId ? 'comic' : 'comics';
  if (view === 'model3ds') return 'model3ds';
  if (view === 'exports' || view === 'models' || view === 'media' || view === 'download') return view;
  return 'overview';
}

function loadViewChunk (key) {
  const ready = resolvedChunks.get(key);
  if (ready) return Promise.resolve(ready);
  let pending = inflightChunks.get(key);
  if (!pending) {
    pending = VIEW_LOADERS[key]().then((Component) => {
      resolvedChunks.set(key, Component);
      return Component;
    }).finally(() => {
      inflightChunks.delete(key);
    });
    inflightChunks.set(key, pending);
  }
  return pending;
}

function useViewChunk (key) {
  const [shown, setShown] = useState(() => ({
    key,
    Component: resolvedChunks.get(key) || null
  }));

  useEffect(() => {
    let stale = false;
    const ready = resolvedChunks.get(key);
    if (ready) {
      setShown(prev => (
        prev.key === key && prev.Component === ready ? prev : { key, Component: ready }
      ));
      return undefined;
    }
    setShown({ key, Component: null });
    loadViewChunk(key).then((Component) => {
      if (!stale) setShown({ key, Component });
    }).catch(() => {});
    return () => { stale = true; };
  }, [key]);

  if (shown.key !== key) return resolvedChunks.get(key) || null;
  return shown.Component;
}

function renderView (Component, route, { onMediaOriginScope, onModelReturn } = {}) {
  const { view, entityId, viewWasUnknown, unknownView } = route;
  const key = viewChunkKey(route);
  if (key === 'overview') {
    if (view === 'resources-redirect') {
      return (
        <Component
          viewWasUnknown={true}
          unknownView="/resources/* (folded into /models)"
        />
      );
    }
    if (view !== 'overview') {
      return <Component viewWasUnknown unknownView={view} />;
    }
    return (
      <Component
        viewWasUnknown={viewWasUnknown}
        unknownView={viewWasUnknown ? unknownView : view}
      />
    );
  }
  if (key === 'generation') return <Component batchId={entityId} params={route.params} />;
  if (key === 'post') return <Component postId={entityId} params={route.params} />;
  if (key === 'comic') return <Component comicId={entityId} params={route.params} />;
  if (key === 'model3ds') return <Component entityId={entityId} params={route.params} />;
  if (key === 'models') return <Component entityId={entityId} />;
  if (key === 'media') {
    return (
      <Component
        entityId={entityId}
        params={route.params}
        onOriginScope={onMediaOriginScope}
        onModelReturn={onModelReturn}
      />
    );
  }
  return <Component />;
}

// The Exports nav badge. Re-derived from the export statuses on navigation and
// whenever the Exports view announces a change ('exportschange') — never on a
// background timer (drift is read when the list is opened, not polled).
function useExportsBadge (view) {
  const [badge, setBadge] = useState('none');

  useEffect(() => {
    let cancelled = false;
    function refresh () {
      listExports().then(({ exports = [] }) => {
        if (cancelled) return;
        const kind = exportsBadgeKind(exports);
        if (kind === 'syncing') setBadge('spinner');
        else if (kind === 'dot') setBadge('dot');
        else setBadge('none');
      }).catch(() => {});
    }
    refresh();
    window.addEventListener('exportschange', refresh);
    return () => { cancelled = true; window.removeEventListener('exportschange', refresh); };
  }, [view]);

  return badge;
}

// Corpus-derived nav counts. Re-read on navigation, on a 'corpuschange'
// event (Download rebuild), when a download SSE run finishes, and when the
// document becomes visible again (CLI fetch in the same or another window)
// — never on a background timer.
function useCorpusStats (view) {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    function refresh () {
      getStats()
        .then(s => { if (!cancelled) { setStats(s); setStatus('ready'); } })
        .catch(() => { if (!cancelled) setStatus('error'); });
    }
    refresh();
    window.addEventListener(CORPUS_CHANGE_EVENT, refresh);
    function onVis () {
      if (document.visibilityState === 'visible') refresh();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.removeEventListener(CORPUS_CHANGE_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    const disconnect = connectProgress((event) => {
      if (cancelled) return;
      noteDownloadEvent(event);
      noteSettleFrame(event);
      noteLibraryPreparation(event, getDownloadMark().kind);
      if (event.type === 'own-models' && event.status === 'ready') {
        bumpOwnModelsRevision();
      }
      if (event.type === 'exports' && event.event === 'reconciled') {
        try { window.dispatchEvent(new Event('exportschange')); } catch { /* older Event ctor */ }
      }
      if (event.final) {
        getStats()
          .then(s => { if (!cancelled) { setStats(s); setStatus('ready'); } })
          .catch(() => { if (!cancelled) setStatus('error'); });
      }
    });
    return () => { cancelled = true; disconnect(); };
  }, []);

  return { stats, status };
}

function App () {
  const [route, setRoute] = useState(getRoute);
  const [username, setUsername] = useState('');
  const [nodeNotice, setNodeNotice] = useState(null);
  const [prefsStatus, setPrefsStatus] = useState('loading');
  const [mediaOriginScope, setMediaOriginScope] = useState(null);
  const [modelReturn, setModelReturn] = useState(null);
  const exportsBadge = useExportsBadge(route.view);
  const { stats, status: statsStatus } = useCorpusStats(route.view);
  const chunkKey = viewChunkKey(route);
  const ViewComponent = useViewChunk(chunkKey);

  // Gallery lists wait for sticky grain. Other pages mount with their script.
  // Until then App owns the provisional title. Once the view mounts it is the
  // sole writer (child effects run before parent; a null spec does not assign).
  const viewReady = !!ViewComponent && (!viewWaitsForStickyPrefs(chunkKey) || prefsStatus === 'ready');
  useDocumentTitle(viewReady ? null : routeTitleSpec(route));

  useEffect(() => {
    const update = () => setRoute(getRoute());
    return subscribe(update);
  }, []);

  useEffect(() => subscribeIndexEpoch(() => { invalidateDetailCache(); }), []);

  useEffect(() => {
    if (route.view !== 'media') {
      setMediaOriginScope(null);
      setModelReturn(null);
    }
  }, [route.view]);

  useEffect(() => {
    let cancelled = false;
    getConfig()
      .then(cfg => {
        if (cancelled) return;
        if (cfg.username) setUsername(cfg.username);
        setNodeNotice(cfg.nodeNotice || null);
      })
      .catch(() => {});
    // refreshOnce on the server; a missing key or downed Civitai must not
    // clear a username already shown from getConfig.
    refreshUser()
      .then(r => { if (!cancelled && r.username) setUsername(r.username); })
      .catch(() => {});
    // Fail-soft: GET error → empty prefs, still ready. Do not mount the view
    // until grain can resolve (invariant 7 — no Media flash then Batches).
    loadUiPrefs()
      .then(() => { if (!cancelled) setPrefsStatus('ready'); })
      .catch(() => { if (!cancelled) setPrefsStatus('ready'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Nav
        route={route}
        username={username}
        exportsBadge={exportsBadge}
        stats={stats}
        statsStatus={statsStatus}
        mediaScope={mediaOriginScope}
        modelReturn={modelReturn}
        nodeNotice={nodeNotice}
      />
      {viewReady
        ? renderView(ViewComponent, route, {
            onMediaOriginScope: setMediaOriginScope,
            onModelReturn: setModelReturn
          })
        : null}
    </>
  );
}

render(<App />, document.getElementById('app'));
