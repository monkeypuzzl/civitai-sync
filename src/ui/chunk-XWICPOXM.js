import {
  formatUrl
} from "./chunk-Z6L3MMX7.js";

// dev/ui/src/lib/nav-tabs.js
var NAV_TABS = [
  { id: "overview", label: "Overview" },
  { id: "generations", label: "Generations" },
  { id: "posts", label: "Posts" },
  { id: "comics", label: "Comics" },
  { id: "model3ds", label: "3D" },
  { id: "models", label: "Models" },
  { id: "exports", label: "Exports" },
  { id: "download", label: "Download" }
];
var ALWAYS = /* @__PURE__ */ new Set(["overview", "exports", "download"]);
var KEEP_WHEN_CURRENT = /* @__PURE__ */ new Set(["generations", "posts", "comics", "model3ds", "models"]);
var ORIGIN_TABS = /* @__PURE__ */ new Set(["generations", "posts", "comics", "model3ds", "models"]);
var ORIGIN_MEMBERSHIP_KIND = {
  generations: "generation",
  posts: "post",
  comics: "comic",
  models: "model"
};
function originMembershipKind(scope) {
  if (scope == null || scope === "") return null;
  return ORIGIN_MEMBERSHIP_KIND[scope] || null;
}
var CORPUS_CHANGE_EVENT = "corpuschange";
function notifyCorpusChange() {
  try {
    window.dispatchEvent(new Event(CORPUS_CHANGE_EVENT));
  } catch {
  }
}
function asRoute(route) {
  if (route == null) return { view: void 0, entityId: null, params: {} };
  if (typeof route === "string") return { view: route, entityId: null, params: {} };
  return {
    view: route.view,
    entityId: route.entityId == null ? null : route.entityId,
    params: route.params || {}
  };
}
function visibleNavTabs({ stats, status, route, mediaScope } = {}) {
  const ids = new Set(ALWAYS);
  const r = asRoute(route);
  if (status === "error") {
    for (const tab of NAV_TABS) ids.add(tab.id);
  } else if (status === "ready") {
    const hasGenerations = Number(stats?.totalGenerations) > 0;
    const hasPosts = Number(stats?.totalPosts) > 0;
    const hasComics = Number(stats?.totalComics) > 0;
    const hasModel3ds = Number(stats?.totalModel3ds) > 0;
    if (hasGenerations) ids.add("generations");
    if (hasPosts) ids.add("posts");
    if (hasComics) ids.add("comics");
    if (hasModel3ds) ids.add("model3ds");
    if (hasGenerations || hasPosts || hasComics || hasModel3ds) ids.add("models");
  }
  if (KEEP_WHEN_CURRENT.has(r.view)) ids.add(r.view);
  if (KEEP_WHEN_CURRENT.has(r.params.from)) ids.add(r.params.from);
  if (mediaScope && KEEP_WHEN_CURRENT.has(mediaScope)) ids.add(mediaScope);
  return NAV_TABS.filter((tab) => ids.has(tab.id));
}
function mediaOriginTab(route, mediaScope) {
  const r = asRoute(route);
  if (r.view !== "media") return null;
  if (r.params.from) return r.params.from;
  if (mediaScope) return mediaScope;
  return null;
}
function navTabActive(tab, route, { mediaScope } = {}) {
  const r = asRoute(route);
  if (r.view === "media") return mediaOriginTab(r, mediaScope) === tab;
  return r.view === tab;
}
function paramsWithoutFrom(params) {
  const out = { ...params || {} };
  delete out.from;
  delete out.usedIn;
  return out;
}
function navTabHref(tab, route, { modelReturn, mediaScope } = {}) {
  const r = asRoute(route);
  if (!ORIGIN_TABS.has(tab)) return `/${tab}`;
  const mediaFrom = mediaOriginTab(r, mediaScope);
  if (tab === "models" && r.view === "media" && mediaFrom === "models") {
    return modelReturn || "/models";
  }
  if (r.entityId == null && r.view === tab) return `/${tab}`;
  const isOriginReturn = r.view === "media" && mediaFrom === tab || r.view === tab && r.entityId != null;
  if (isOriginReturn) {
    const params = paramsWithoutFrom(r.params);
    if (r.view === "generations" && r.entityId != null && tab === "generations") {
      params.granularity = "batch";
    }
    return formatUrl({
      view: tab,
      entityId: null,
      params
    });
  }
  return `/${tab}`;
}

export {
  originMembershipKind,
  CORPUS_CHANGE_EVENT,
  notifyCorpusChange,
  visibleNavTabs,
  navTabActive,
  navTabHref
};
