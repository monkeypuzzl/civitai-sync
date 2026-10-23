import { useState, useEffect } from 'preact/hooks';
import { navigate, pushState } from '../lib/router.js';
import { visibleNavTabs, navTabActive, navTabHref } from '../lib/nav-tabs.js';
import { activateOriginTab } from '../lib/nav-activate.js';
import { getDownloadMark, subscribeDownloadMark } from '../lib/download-mark.js';
import { getLibraryPreparationText, subscribeLibraryPreparation } from '../lib/library-preparation.js';

const ORIGIN_TABS = new Set(['generations', 'posts', 'comics', 'models']);

function asRoute (route) {
  if (typeof route === 'string') return { view: route, entityId: null, params: {} };
  return route || { view: 'overview', entityId: null, params: {} };
}

function historyBag () {
  try {
    const s = history.state;
    return s && typeof s === 'object' ? s : {};
  } catch {
    return {};
  }
}

// `exportsBadge` ∈ 'none' | 'spinner' (a bulk sync is running) | 'dot' (an
// export is Pending or Error). It rides on the Exports tab so the signal is
// visible from any view without opening the list.
//
// Corpus tabs (Generations / Posts / Comics / Models) are derived from
// GET /api/stats — see visibleNavTabs. Overview / Exports / Download are
// always offered. The Download spinner is a leaf subscribed to
// download-mark; it is not a prop from App.
export function Nav ({
  route,
  username,
  exportsBadge = 'none',
  stats = null,
  statsStatus = 'loading',
  mediaScope = null,
  modelReturn = null,
  nodeNotice = null
}) {
  const r = asRoute(route);
  const hist = historyBag();
  const downloadMark = useDownloadMarkState();
  const tabs = visibleNavTabs({ stats, status: statsStatus, route: r, mediaScope });
  const tabOpts = { modelReturn, mediaScope };

  function go (e, tabId) {
    e.preventDefault();
    if (!ORIGIN_TABS.has(tabId)) {
      navigate(tabId, { focus: null });
      return;
    }

    const entityId = r.entityId == null ? null : r.entityId;
    if (entityId == null && r.view === tabId) {
      pushState({ view: tabId, entityId: null, params: {} }, { focus: null });
      return;
    }

    const from = (r.params && r.params.from) || mediaScope;
    const originReturn =
      (r.view === 'media' && from === tabId) ||
      (r.view === tabId && entityId != null);
    if (originReturn) {
      activateOriginTab(tabId, r, {
        modelReturn,
        mediaScope,
        focus: hist.focus != null ? hist.focus : undefined
      });
      return;
    }

    navigate(tabId, { focus: null });
  }

  return (
    <nav class="nav">
      <div class="nav-logo">
        <span class="civit">civit</span><span class="ai">ai</span>
        <span class="sync">-sync</span>
      </div>
      <div class="nav-cluster">
        <div class="nav-tabs">
          {tabs.map(tab => {
            const active = navTabActive(tab.id, r, tabOpts);
            return (
            <a
              key={tab.id}
              class="nav-tab"
              href={navTabHref(tab.id, r, tabOpts)}
              aria-current={active ? 'page' : undefined}
              title={tab.id === 'download' && downloadMark.kind === 'waiting' ? downloadMark.title : undefined}
              onClick={e => go(e, tab.id)}
            >
              {tab.label}
              {tab.id === 'download' && <DownloadTabMark mark={downloadMark} />}
              {tab.id === 'exports' && exportsBadge === 'spinner' && (
                <span class="nav-badge nav-badge-spinner" title="Sync in progress" />
              )}
              {tab.id === 'exports' && exportsBadge === 'dot' && (
                <span class="nav-badge nav-badge-dot" title="An export needs attention" />
              )}
            </a>
            );
          })}
        </div>
        <LibraryPreparationLine />
        <NodeNoticeLine notice={nodeNotice} />
      </div>
      {username && <div class="nav-username">{username}</div>}
    </nav>
  );
}

function NodeNoticeLine ({ notice }) {
  if (!notice || !notice.current) return null;
  return (
    <p class="node-notice">
      Node {notice.current}. Tested on Node {notice.supported} and newer.
    </p>
  );
}

function LibraryPreparationLine () {
  const [text, setText] = useState(getLibraryPreparationText);
  useEffect(() => {
    setText(getLibraryPreparationText());
    return subscribeLibraryPreparation(setText);
  }, []);
  if (!text) return null;
  return <p class="library-prep" aria-live="polite">{text}</p>;
}

function useDownloadMarkState () {
  const [mark, setMark] = useState(getDownloadMark);
  useEffect(() => {
    setMark(getDownloadMark());
    return subscribeDownloadMark(setMark);
  }, []);
  return mark;
}

function DownloadTabMark ({ mark }) {
  if (!mark || mark.kind !== 'spinner') return null;
  return <span class="nav-badge nav-badge-spinner" title={mark.title} />;
}
