import {
  VIEW_PARAM_KEYS,
  formatUrl,
  originMembershipKind,
  parseUrl,
  replaceState
} from "./chunk-K4YW4PKR.js";
import {
  normalizeMediaId
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/lib/media-href.js
var UNFILTERED_VIEWS = /* @__PURE__ */ new Set(["generations", "posts", "comics", "model3ds"]);
var UNFILTERED_SKIP = /* @__PURE__ */ new Set(["from", "slot", "generation", "engagement"]);
var UNFILTERED_SEARCH = /* @__PURE__ */ new Set(["generations", "posts", "comics"]);
function mediaHref(id) {
  return `/media/${normalizeMediaId(id)}`;
}
function canonicalMediaRouteId(routeSegment, indexId) {
  const source = indexId != null && indexId !== "" ? indexId : routeSegment;
  const canonical = normalizeMediaId(source);
  if (!canonical) return null;
  if (String(routeSegment ?? "") === canonical) return null;
  return canonical;
}
function onlyMediaId(item) {
  const media = item && Array.isArray(item.media) ? item.media : [];
  if (media.length !== 1) return null;
  const first = media[0];
  return first && first.mediaId != null ? first.mediaId : null;
}
function isEmptyParam(v) {
  if (v == null) return true;
  if (v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}
function tileHref(item, { grain } = {}) {
  const g = grain || "media";
  if (g === "post") return `/posts/${item.id}`;
  if (g === "comic") return `/comics/${item.id}`;
  if (g === "batch") {
    const media = item && Array.isArray(item.media) ? item.media : [];
    if (media.length > 1) return `/generations/${item.id}`;
    const only = onlyMediaId(item);
    return mediaHref(only);
  }
  const id = item && item.id != null && item.id !== "" ? item.id : onlyMediaId(item);
  return mediaHref(id);
}
function galleryClickSlot(item, path, { grain, index, groupsMeta, groupBy } = {}) {
  if (!path || !String(path).startsWith("/media/")) return null;
  const g = grain || "media";
  if (g === "batch" || g === "post" || g === "comic") {
    if (item && item.id != null && item.id !== "") return `c:${item.id}:0`;
    return null;
  }
  if (!groupBy || !Array.isArray(groupsMeta) || index == null) return null;
  const i = Number(index);
  if (!Number.isFinite(i)) return null;
  const group = groupsMeta.find((gr) => i >= gr.offset && i < gr.offset + gr.count);
  if (!group) return null;
  return `g:${group.key}:${i - group.offset}`;
}
function isContainerNodePath(path) {
  return typeof path === "string" && /^\/(posts|generations|comics|model3ds)\//.test(path);
}
function originQuery(galleryParams, originView, { granularity, slot, path } = {}) {
  const src = galleryParams || {};
  const out = {};
  for (const key of Object.keys(src)) {
    if (key === "select" || key === "generation" || key === "origin" || key === "usedIn") continue;
    const v = src[key];
    if (isEmptyParam(v)) continue;
    out[key] = v;
  }
  if (originView) out.from = originView;
  if (granularity != null && granularity !== "" && granularity !== "models") {
    out.granularity = granularity;
  }
  if (slot != null && slot !== "") out.slot = slot;
  else delete out.slot;
  if (out.sort === "date:desc") delete out.sort;
  if (out.groupBy == null || out.groupBy === "" || out.groupBy === "none") {
    delete out.groupBy;
    delete out.groupSort;
  } else if (out.groupSort === "count:desc") {
    delete out.groupSort;
  }
  if (out.granularity == null || out.granularity === "" || out.granularity === "media") {
    delete out.granularity;
  }
  if (isContainerNodePath(path)) {
    delete out.from;
    delete out.granularity;
  }
  return out;
}
function originFetchQuery(routeParams) {
  const src = routeParams || {};
  return originQuery(src, src.from || null, {
    granularity: src.granularity,
    slot: src.slot
  });
}
function containerResetQuery(_kind) {
  return {};
}
var MEMBERSHIP_VIEW = {
  generation: "generations",
  post: "posts",
  comic: "comics"
};
function membershipContainerHref(kind, id, routeParams, origin) {
  if (id == null || id === "") return "";
  const view = MEMBERSHIP_VIEW[kind];
  if (!view) return "";
  const entityId = String(id);
  const from = routeParams && routeParams.from;
  const scope = from != null && String(from) !== "" ? String(from) : origin && origin.scope || "";
  const params = originMembershipKind(scope) === kind ? originQuery(routeParams, null, { path: `/${view}/${entityId}` }) : containerResetQuery(kind);
  return formatUrl({
    view,
    entityId,
    modelTrail: null,
    params
  });
}
function filterValuePresent(key, value) {
  if (key === "mine") return value === "1" || value === "true" || value === true;
  if (value == null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}
function containerFilterKeyActive(view, key, value) {
  if (!UNFILTERED_VIEWS.has(view)) return false;
  if (UNFILTERED_SKIP.has(key)) return false;
  if (key === "q") return UNFILTERED_SEARCH.has(view) && filterValuePresent(key, value);
  const keys = VIEW_PARAM_KEYS[view];
  if (!keys || !keys.has(key)) return false;
  return filterValuePresent(key, value);
}
function containerHasActiveFilter(view, params) {
  if (!UNFILTERED_VIEWS.has(view)) return false;
  const src = params || {};
  const keys = VIEW_PARAM_KEYS[view];
  if (keys) {
    for (const key of keys) {
      if (containerFilterKeyActive(view, key, src[key])) return true;
    }
  }
  return containerFilterKeyActive(view, "q", src.q);
}
function containerUnfilteredHref(view, id, params) {
  if (id == null || id === "") return "";
  if (!containerHasActiveFilter(view, params)) return "";
  return `/${view}/${encodeURIComponent(String(id))}`;
}
function modelsOriginQuery(versionId, { sort, familyId } = {}) {
  const out = { from: "models" };
  if (versionId != null && versionId !== "") out.models = `version.${encodeURIComponent(String(versionId))}`;
  else if (familyId != null && familyId !== "") out.models = `family.${encodeURIComponent(String(familyId))}`;
  if (sort != null && sort !== "" && sort !== "date:desc") out.sort = String(sort);
  return out;
}

// dev/ui/src/lib/origin-page.js
var HISTORY_BAG_KEYS = ["list", "mediaList", "originHref", "focus", "originPage", "anchorSlot"];
var STRIP_SIBLING = /* @__PURE__ */ new Set(["generation", "select"]);
function siblingParams(routeParams) {
  const out = { ...routeParams || {} };
  for (const key of STRIP_SIBLING) delete out[key];
  return out;
}
function originNeighbourPath(id, view) {
  if (id == null || id === "") return "";
  const enc = encodeURIComponent(String(id));
  if (view === "generations") return `/generations/${enc}`;
  if (view === "posts") return `/posts/${enc}`;
  if (view === "comics") return `/comics/${enc}`;
  if (view === "model3ds") return `/model3ds/${enc}`;
  return `/media/${enc}`;
}
function quietSlotPatch({ urlSlot, origin } = {}) {
  if (!origin || origin.placement === "fallback") return null;
  const url = urlSlot == null || urlSlot === "" ? "" : String(urlSlot);
  if (origin.slotInUrl && origin.slot != null && origin.slot !== "" && url !== String(origin.slot)) {
    return { slot: String(origin.slot) };
  }
  if (!origin.slotInUrl && url) return { slot: null };
  return null;
}
function originNeighbourParams(routeParams, origin, { slot, slotInUrl, path } = {}) {
  if (origin && origin.placement === "fallback") {
    const scope = origin.scope;
    return scope ? { from: scope } : {};
  }
  const base = siblingParams(routeParams);
  const resolvedSlot = slotInUrl && slot != null && slot !== "" ? slot : null;
  const from = base.from || null;
  return originQuery(base, from, {
    granularity: base.granularity,
    slot: resolvedSlot,
    path
  });
}
function originNeighbourHref({
  id,
  slot,
  slotInUrl,
  view,
  routeParams,
  origin
} = {}) {
  if (id == null || id === "") return "";
  const path = originNeighbourPath(id, view);
  if (!path) return "";
  const parsed = parseUrl(path);
  return formatUrl({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: originNeighbourParams(routeParams, origin, { slot, slotInUrl, path })
  });
}
function readHistoryBag() {
  try {
    const s = typeof history === "undefined" ? null : history.state;
    if (s == null || typeof s !== "object" || Array.isArray(s)) {
      return {};
    }
    const out = {};
    for (const key of HISTORY_BAG_KEYS) {
      if (s[key] !== void 0) out[key] = s[key];
    }
    return out;
  } catch {
    return {};
  }
}
function originSiblingArrows(origin) {
  const prevOn = origin != null && origin.prevId != null && origin.prevId !== "";
  const nextOn = origin != null && origin.nextId != null && origin.nextId !== "";
  return {
    prev: { enabled: prevOn, title: prevOn ? "Previous" : "[Start]" },
    next: { enabled: nextOn, title: nextOn ? "Next" : "[End]" }
  };
}
function replaceOriginNeighbour({
  id,
  slot,
  slotInUrl,
  view,
  routeParams,
  origin
} = {}) {
  if (id == null || id === "") return;
  const path = originNeighbourPath(id, view);
  if (!path) return;
  const parsed = parseUrl(path);
  const bag = readHistoryBag();
  const opts = {};
  if (bag.focus != null) opts.focus = bag.focus;
  if (origin && origin.placement === "fallback") opts.anchorSlot = null;
  else if (bag.anchorSlot != null) opts.anchorSlot = bag.anchorSlot;
  replaceState({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: originNeighbourParams(routeParams, origin, { slot, slotInUrl, path })
  }, opts);
}

export {
  canonicalMediaRouteId,
  tileHref,
  galleryClickSlot,
  originQuery,
  originFetchQuery,
  membershipContainerHref,
  containerFilterKeyActive,
  containerHasActiveFilter,
  containerUnfilteredHref,
  modelsOriginQuery,
  originNeighbourPath,
  quietSlotPatch,
  originNeighbourParams,
  originNeighbourHref,
  readHistoryBag,
  originSiblingArrows,
  replaceOriginNeighbour
};
