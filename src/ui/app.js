import {
  exportsBadgeKind
} from "./chunk-EQQ33LMY.js";
import {
  loadUiPrefs
} from "./chunk-OGIDMYFE.js";
import {
  activateOriginTab
} from "./chunk-7EKUSVIB.js";
import {
  CORPUS_CHANGE_EVENT,
  navTabActive,
  navTabHref,
  visibleNavTabs
} from "./chunk-XWICPOXM.js";
import {
  bumpOwnModelsRevision
} from "./chunk-HMX5XSAI.js";
import {
  getRoute,
  navigate,
  pushState,
  subscribe
} from "./chunk-Z6L3MMX7.js";
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
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/lib/download-mark.js
var NONE = Object.freeze({ kind: "none", title: "" });
var SPINNERS = Object.freeze({
  generations: Object.freeze({ kind: "spinner", title: "Downloading generations" }),
  posts: Object.freeze({ kind: "spinner", title: "Downloading posts" }),
  comics: Object.freeze({ kind: "spinner", title: "Downloading comics" }),
  model3ds: Object.freeze({ kind: "spinner", title: "Downloading 3D" }),
  other: Object.freeze({ kind: "spinner", title: "Download in progress" })
});
var DOWNLOAD_TYPES = /* @__PURE__ */ new Set(["generations", "posts", "comics", "model3ds"]);
var IGNORED = /* @__PURE__ */ new Set(["model-cache", "exports", "own-models"]);
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
  if (event.type === "connected") {
    if (!event.active) return prior.kind === "none" ? prior : NONE;
    return unchanged(prior, spinnerFor(event.downloadType));
  }
  if (event.final && DOWNLOAD_TYPES.has(event.type)) {
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
    /* @__PURE__ */ u("div", { class: "nav-tabs", children: tabs.map((tab) => {
      const active = navTabActive(tab.id, r, tabOpts);
      return /* @__PURE__ */ u(
        "a",
        {
          class: "nav-tab",
          href: navTabHref(tab.id, r, tabOpts),
          "aria-current": active ? "page" : void 0,
          onClick: (e) => go(e, tab.id),
          children: [
            tab.label,
            tab.id === "download" && /* @__PURE__ */ u(DownloadTabMark, {}),
            tab.id === "exports" && exportsBadge === "spinner" && /* @__PURE__ */ u("span", { class: "nav-badge nav-badge-spinner", title: "Sync in progress" }),
            tab.id === "exports" && exportsBadge === "dot" && /* @__PURE__ */ u("span", { class: "nav-badge nav-badge-dot", title: "An export needs attention" })
          ]
        },
        tab.id
      );
    }) }),
    username && /* @__PURE__ */ u("div", { class: "nav-username", children: username })
  ] });
}
function DownloadTabMark() {
  const [mark, setMark] = d(getDownloadMark);
  y(() => {
    setMark(getDownloadMark());
    return subscribeDownloadMark(setMark);
  }, []);
  if (mark.kind !== "spinner") return null;
  return /* @__PURE__ */ u("span", { class: "nav-badge nav-badge-spinner", title: mark.title });
}

// dev/ui/src/lib/view-ready.js
function viewWaitsForStickyPrefs(chunkKey) {
  return chunkKey === "generations" || chunkKey === "posts" || chunkKey === "comics";
}

// dev/ui/src/app.jsx
var VIEW_LOADERS = {
  overview: () => import("./OverviewView-2HZYZRZN.js").then((m) => m.OverviewView),
  generations: () => import("./GenerationsView-GS7RYHNC.js").then((m) => m.GenerationsView),
  generation: () => import("./BatchDetailView-ISZ2EBIP.js").then((m) => m.BatchDetailView),
  posts: () => import("./PostsView-6DONIEZU.js").then((m) => m.PostsView),
  post: () => import("./PostDetailView-MKARRG7I.js").then((m) => m.PostDetailView),
  comics: () => import("./ComicsView-VR2NRFUW.js").then((m) => m.ComicsView),
  comic: () => import("./ComicDetailView-YVDDDEDK.js").then((m) => m.ComicDetailView),
  model3ds: () => import("./Model3dsView-CY2LXODQ.js").then((m) => m.Model3dsView),
  exports: () => import("./ExportsView-36FGDYNG.js").then((m) => m.ExportsView),
  models: () => import("./ModelsView-OCOD5IQC.js").then((m) => m.ModelsView),
  media: () => import("./MediaDetail-IGWN67Y4.js").then((m) => m.MediaDetailView),
  download: () => import("./DownloadView-MAVLBZ3Z.js").then((m) => m.DownloadView)
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
