import {
  exportsBadgeKind
} from "./chunk-YGDMMQ62.js";
import {
  loadUiPrefs
} from "./chunk-XSOBLT75.js";
import {
  invalidateDetailCache
} from "./chunk-4Z26PAQ4.js";
import {
  activateOriginTab
} from "./chunk-SNTDJ2GX.js";
import {
  bumpOwnModelsRevision
} from "./chunk-UASMX4HS.js";
import "./chunk-JB7JSPAG.js";
import {
  noteSettleFrame,
  subscribeIndexEpoch
} from "./chunk-TI5I7VA3.js";
import {
  CORPUS_CHANGE_EVENT,
  getRoute,
  navTabActive,
  navTabHref,
  navigate,
  pushState,
  subscribe,
  visibleNavTabs
} from "./chunk-CPLX52FD.js";
import {
  J,
  connectProgress,
  d,
  getConfig,
  getStats,
  k,
  listExports,
  refreshUser,
  routeTitleSpec,
  u,
  useDocumentTitle,
  y
} from "./chunk-OGIWOTNU.js";

// dev/ui/src/lib/download-mark.js
var NONE = Object.freeze({ kind: "none", title: "" });
var WAITING = Object.freeze({ kind: "waiting", title: "Auto download on" });
var SPINNERS = Object.freeze({
  generations: Object.freeze({ kind: "spinner", title: "Downloading generations" }),
  posts: Object.freeze({ kind: "spinner", title: "Downloading posts" }),
  comics: Object.freeze({ kind: "spinner", title: "Downloading comics" }),
  model3ds: Object.freeze({ kind: "spinner", title: "Downloading 3D" }),
  other: Object.freeze({ kind: "spinner", title: "Download in progress" })
});
var DOWNLOAD_TYPES = /* @__PURE__ */ new Set(["generations", "posts", "comics", "model3ds"]);
var IGNORED = /* @__PURE__ */ new Set(["model-cache", "exports", "own-models", "tag-cache"]);
function spinnerFor(type) {
  return SPINNERS[type] || SPINNERS.other;
}
function unchanged(prev, next) {
  return prev.kind === next.kind && prev.title === next.title ? prev : next;
}
function nextDownloadMark(prev, event) {
  const prior = prev && prev.kind ? prev : NONE;
  if (!event || typeof event !== "object") return prior;
  if (IGNORED.has(event.type)) return prior;
  if (event.type === "auto") {
    if (event.phase === "waiting") return unchanged(prior, WAITING);
    if (prior.kind === "spinner") return prior;
    return prior.kind === "none" ? prior : NONE;
  }
  if (event.type === "connected") {
    if (event.active) return unchanged(prior, spinnerFor(event.downloadType));
    if (event.auto && event.auto.phase === "waiting") return unchanged(prior, WAITING);
    return prior.kind === "none" ? prior : NONE;
  }
  if (event.final && DOWNLOAD_TYPES.has(event.type)) {
    const pending = event.queue && Array.isArray(event.queue.pending) ? event.queue.pending : [];
    if (pending.length > 0) return prior;
    return prior.kind === "none" ? prior : NONE;
  }
  if (event.status === "downloading" && DOWNLOAD_TYPES.has(event.type)) {
    return unchanged(prior, spinnerFor(event.type));
  }
  return prior;
}
var current = NONE;
var listeners = /* @__PURE__ */ new Set();
function getDownloadMark() {
  return current;
}
function subscribeDownloadMark(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function noteDownloadEvent(event) {
  const next = nextDownloadMark(current, event);
  if (next === current) return;
  current = next;
  for (const fn of listeners) fn(current);
}

// dev/ui/src/lib/library-preparation.js
var LIBRARY_PREP_DWELL_MS = 1e3;
var LIBRARY_PREP_TEXT = "Preparing the library\u2026";
var PHASE_SUFFIX = Object.freeze({
  files: "checking files",
  exports: "checking exports",
  models: "checking models",
  index: "updating index"
});
var IDLE = Object.freeze({ active: false, since: null, phase: null });
function libraryPreparationSentence(phase) {
  const suffix = PHASE_SUFFIX[phase];
  return suffix ? `${LIBRARY_PREP_TEXT} ${suffix}` : LIBRARY_PREP_TEXT;
}
function nextLibraryPreparation(state2, { preparation, phase, downloadKind, now } = {}) {
  const prev = state2 && state2.active ? state2 : IDLE;
  let active = prev.active;
  let since = prev.since;
  let nextPhase = prev.phase ?? null;
  if (preparation === true) {
    active = true;
    if (since == null) since = now;
    if (phase !== void 0) nextPhase = PHASE_SUFFIX[phase] ? phase : null;
  } else if (preparation === false) {
    active = false;
    since = null;
    nextPhase = null;
  }
  const elapsed = since == null ? 0 : now - since;
  const text2 = active && downloadKind !== "spinner" && since != null && elapsed >= LIBRARY_PREP_DWELL_MS ? libraryPreparationSentence(nextPhase) : "";
  return {
    state: { active, since, phase: nextPhase },
    text: text2
  };
}
var state = IDLE;
var text = "";
var timer = null;
var listeners2 = /* @__PURE__ */ new Set();
function emit(nextText) {
  if (nextText === text) return;
  text = nextText;
  for (const fn of [...listeners2]) fn(text);
}
function clearTimer() {
  if (timer == null) return;
  clearTimeout(timer);
  timer = null;
}
function armTimer(downloadKind) {
  clearTimer();
  if (!state.active || state.since == null || downloadKind === "spinner") return;
  const wait = LIBRARY_PREP_DWELL_MS - (Date.now() - state.since);
  if (wait <= 0) return;
  timer = setTimeout(() => {
    timer = null;
    noteLibraryPreparation(
      { type: "preparation", active: true },
      getDownloadMark().kind
    );
  }, wait);
}
function noteLibraryPreparation(event, downloadKind, now = Date.now()) {
  let preparation;
  let phase;
  if (event && event.type === "preparation" && typeof event.active === "boolean") {
    preparation = event.active;
    if ("phase" in event) phase = event.phase;
  } else if (event && event.type === "connected" && typeof event.preparation === "boolean") {
    preparation = event.preparation;
    if ("phase" in event) phase = event.phase;
  }
  const next = nextLibraryPreparation(state, { preparation, phase, downloadKind, now });
  state = next.state;
  armTimer(downloadKind);
  emit(next.text);
}
function getLibraryPreparationText() {
  return text;
}
function subscribeLibraryPreparation(fn) {
  listeners2.add(fn);
  return () => {
    listeners2.delete(fn);
  };
}

// dev/ui/src/components/Nav.jsx
var ORIGIN_TABS = /* @__PURE__ */ new Set(["generations", "posts", "comics", "models"]);
function asRoute(route) {
  if (typeof route === "string") return { view: route, entityId: null, params: {} };
  return route || { view: "overview", entityId: null, params: {} };
}
function historyBag() {
  try {
    const s = history.state;
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}
function Nav({
  route,
  username,
  exportsBadge = "none",
  stats = null,
  statsStatus = "loading",
  mediaScope = null,
  modelReturn = null
}) {
  const r = asRoute(route);
  const hist = historyBag();
  const downloadMark = useDownloadMarkState();
  const tabs = visibleNavTabs({ stats, status: statsStatus, route: r, mediaScope });
  const tabOpts = { modelReturn, mediaScope };
  function go(e, tabId) {
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
    const from = r.params && r.params.from || mediaScope;
    const originReturn = r.view === "media" && from === tabId || r.view === tabId && entityId != null;
    if (originReturn) {
      activateOriginTab(tabId, r, {
        modelReturn,
        mediaScope,
        focus: hist.focus != null ? hist.focus : void 0
      });
      return;
    }
    navigate(tabId, { focus: null });
  }
  return /* @__PURE__ */ u("nav", { class: "nav", children: [
    /* @__PURE__ */ u("div", { class: "nav-logo", children: [
      /* @__PURE__ */ u("span", { class: "civit", children: "civit" }),
      /* @__PURE__ */ u("span", { class: "ai", children: "ai" }),
      /* @__PURE__ */ u("span", { class: "sync", children: "-sync" })
    ] }),
    /* @__PURE__ */ u("div", { class: "nav-cluster", children: [
      /* @__PURE__ */ u("div", { class: "nav-tabs", children: tabs.map((tab) => {
        const active = navTabActive(tab.id, r, tabOpts);
        return /* @__PURE__ */ u(
          "a",
          {
            class: "nav-tab",
            href: navTabHref(tab.id, r, tabOpts),
            "aria-current": active ? "page" : void 0,
            title: tab.id === "download" && downloadMark.kind === "waiting" ? downloadMark.title : void 0,
            onClick: (e) => go(e, tab.id),
            children: [
              tab.label,
              tab.id === "download" && /* @__PURE__ */ u(DownloadTabMark, { mark: downloadMark }),
              tab.id === "exports" && exportsBadge === "spinner" && /* @__PURE__ */ u("span", { class: "nav-badge nav-badge-spinner", title: "Sync in progress" }),
              tab.id === "exports" && exportsBadge === "dot" && /* @__PURE__ */ u("span", { class: "nav-badge nav-badge-dot", title: "An export needs attention" })
            ]
          },
          tab.id
        );
      }) }),
      /* @__PURE__ */ u(LibraryPreparationLine, {})
    ] }),
    username && /* @__PURE__ */ u("div", { class: "nav-username", children: username })
  ] });
}
function LibraryPreparationLine() {
  const [text2, setText] = d(getLibraryPreparationText);
  y(() => {
    setText(getLibraryPreparationText());
    return subscribeLibraryPreparation(setText);
  }, []);
  if (!text2) return null;
  return /* @__PURE__ */ u("p", { class: "library-prep", "aria-live": "polite", children: text2 });
}
function useDownloadMarkState() {
  const [mark, setMark] = d(getDownloadMark);
  y(() => {
    setMark(getDownloadMark());
    return subscribeDownloadMark(setMark);
  }, []);
  return mark;
}
function DownloadTabMark({ mark }) {
  if (!mark || mark.kind !== "spinner") return null;
  return /* @__PURE__ */ u("span", { class: "nav-badge nav-badge-spinner", title: mark.title });
}

// dev/ui/src/lib/view-ready.js
function viewWaitsForStickyPrefs(chunkKey) {
  return chunkKey === "generations" || chunkKey === "posts" || chunkKey === "comics";
}

// dev/ui/src/app.jsx
var VIEW_LOADERS = {
  overview: () => import("./OverviewView-OUSJZBXO.js").then((m) => m.OverviewView),
  generations: () => import("./GenerationsView-FVTDRRY7.js").then((m) => m.GenerationsView),
  generation: () => import("./BatchDetailView-KCS2I7LK.js").then((m) => m.BatchDetailView),
  posts: () => import("./PostsView-VGGZ5EBK.js").then((m) => m.PostsView),
  post: () => import("./PostDetailView-BZ5DNN6W.js").then((m) => m.PostDetailView),
  comics: () => import("./ComicsView-3FUHH3RX.js").then((m) => m.ComicsView),
  comic: () => import("./ComicDetailView-SFWTXUNC.js").then((m) => m.ComicDetailView),
  model3ds: () => import("./Model3dsView-BGSKCJKK.js").then((m) => m.Model3dsView),
  exports: () => import("./ExportsView-N3PGXAAM.js").then((m) => m.ExportsView),
  models: () => import("./ModelsView-R25NFPW3.js").then((m) => m.ModelsView),
  media: () => import("./MediaDetail-67TNUNN3.js").then((m) => m.MediaDetailView),
  download: () => import("./DownloadView-DDESP4ZQ.js").then((m) => m.DownloadView)
};
var resolvedChunks = /* @__PURE__ */ new Map();
var inflightChunks = /* @__PURE__ */ new Map();
function viewChunkKey(route) {
  const view = route?.view;
  const entityId = route?.entityId;
  if (view === "generations") return entityId ? "generation" : "generations";
  if (view === "posts") return entityId ? "post" : "posts";
  if (view === "comics") return entityId ? "comic" : "comics";
  if (view === "model3ds") return "model3ds";
  if (view === "exports" || view === "models" || view === "media" || view === "download") return view;
  return "overview";
}
function loadViewChunk(key) {
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
function useViewChunk(key) {
  const [shown, setShown] = d(() => ({
    key,
    Component: resolvedChunks.get(key) || null
  }));
  y(() => {
    let stale = false;
    const ready = resolvedChunks.get(key);
    if (ready) {
      setShown((prev) => prev.key === key && prev.Component === ready ? prev : { key, Component: ready });
      return void 0;
    }
    setShown({ key, Component: null });
    loadViewChunk(key).then((Component) => {
      if (!stale) setShown({ key, Component });
    }).catch(() => {
    });
    return () => {
      stale = true;
    };
  }, [key]);
  if (shown.key !== key) return resolvedChunks.get(key) || null;
  return shown.Component;
}
function renderView(Component, route, { onMediaOriginScope, onModelReturn } = {}) {
  const { view, entityId, viewWasUnknown, unknownView } = route;
  const key = viewChunkKey(route);
  if (key === "overview") {
    if (view === "resources-redirect") {
      return /* @__PURE__ */ u(
        Component,
        {
          viewWasUnknown: true,
          unknownView: "/resources/* (folded into /models)"
        }
      );
    }
    if (view !== "overview") {
      return /* @__PURE__ */ u(Component, { viewWasUnknown: true, unknownView: view });
    }
    return /* @__PURE__ */ u(
      Component,
      {
        viewWasUnknown,
        unknownView: viewWasUnknown ? unknownView : view
      }
    );
  }
  if (key === "generation") return /* @__PURE__ */ u(Component, { batchId: entityId, params: route.params });
  if (key === "post") return /* @__PURE__ */ u(Component, { postId: entityId, params: route.params });
  if (key === "comic") return /* @__PURE__ */ u(Component, { comicId: entityId, params: route.params });
  if (key === "model3ds") return /* @__PURE__ */ u(Component, { entityId, params: route.params });
  if (key === "models") return /* @__PURE__ */ u(Component, { entityId });
  if (key === "media") {
    return /* @__PURE__ */ u(
      Component,
      {
        entityId,
        params: route.params,
        onOriginScope: onMediaOriginScope,
        onModelReturn
      }
    );
  }
  return /* @__PURE__ */ u(Component, {});
}
function useExportsBadge(view) {
  const [badge, setBadge] = d("none");
  y(() => {
    let cancelled = false;
    function refresh() {
      listExports().then(({ exports = [] }) => {
        if (cancelled) return;
        const kind = exportsBadgeKind(exports);
        if (kind === "syncing") setBadge("spinner");
        else if (kind === "dot") setBadge("dot");
        else setBadge("none");
      }).catch(() => {
      });
    }
    refresh();
    window.addEventListener("exportschange", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("exportschange", refresh);
    };
  }, [view]);
  return badge;
}
function useCorpusStats(view) {
  const [stats, setStats] = d(null);
  const [status, setStatus] = d("loading");
  y(() => {
    let cancelled = false;
    function refresh() {
      getStats().then((s) => {
        if (!cancelled) {
          setStats(s);
          setStatus("ready");
        }
      }).catch(() => {
        if (!cancelled) setStatus("error");
      });
    }
    refresh();
    window.addEventListener(CORPUS_CHANGE_EVENT, refresh);
    function onVis() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener(CORPUS_CHANGE_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [view]);
  y(() => {
    let cancelled = false;
    const disconnect = connectProgress((event) => {
      if (cancelled) return;
      noteDownloadEvent(event);
      noteSettleFrame(event);
      noteLibraryPreparation(event, getDownloadMark().kind);
      if (event.type === "own-models" && event.status === "ready") {
        bumpOwnModelsRevision();
      }
      if (event.type === "exports" && event.event === "reconciled") {
        try {
          window.dispatchEvent(new Event("exportschange"));
        } catch {
        }
      }
      if (event.final) {
        getStats().then((s) => {
          if (!cancelled) {
            setStats(s);
            setStatus("ready");
          }
        }).catch(() => {
          if (!cancelled) setStatus("error");
        });
      }
    });
    return () => {
      cancelled = true;
      disconnect();
    };
  }, []);
  return { stats, status };
}
function App() {
  const [route, setRoute] = d(getRoute);
  const [username, setUsername] = d("");
  const [prefsStatus, setPrefsStatus] = d("loading");
  const [mediaOriginScope, setMediaOriginScope] = d(null);
  const [modelReturn, setModelReturn] = d(null);
  const exportsBadge = useExportsBadge(route.view);
  const { stats, status: statsStatus } = useCorpusStats(route.view);
  const chunkKey = viewChunkKey(route);
  const ViewComponent = useViewChunk(chunkKey);
  const viewReady = !!ViewComponent && (!viewWaitsForStickyPrefs(chunkKey) || prefsStatus === "ready");
  useDocumentTitle(viewReady ? null : routeTitleSpec(route));
  y(() => {
    const update = () => setRoute(getRoute());
    return subscribe(update);
  }, []);
  y(() => subscribeIndexEpoch(() => {
    invalidateDetailCache();
  }), []);
  y(() => {
    if (route.view !== "media") {
      setMediaOriginScope(null);
      setModelReturn(null);
    }
  }, [route.view]);
  y(() => {
    let cancelled = false;
    getConfig().then((cfg) => {
      if (!cancelled && cfg.username) setUsername(cfg.username);
    }).catch(() => {
    });
    refreshUser().then((r) => {
      if (!cancelled && r.username) setUsername(r.username);
    }).catch(() => {
    });
    loadUiPrefs().then(() => {
      if (!cancelled) setPrefsStatus("ready");
    }).catch(() => {
      if (!cancelled) setPrefsStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return /* @__PURE__ */ u(k, { children: [
    /* @__PURE__ */ u(
      Nav,
      {
        route,
        username,
        exportsBadge,
        stats,
        statsStatus,
        mediaScope: mediaOriginScope,
        modelReturn
      }
    ),
    viewReady ? renderView(ViewComponent, route, {
      onMediaOriginScope: setMediaOriginScope,
      onModelReturn: setModelReturn
    }) : null
  ] });
}
J(/* @__PURE__ */ u(App, {}), document.getElementById("app"));
