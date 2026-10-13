import {
  normalizeMediaId
} from "./chunk-INNL2V6Q.js";
import {
  completeAuthoredParams,
  formatUrl,
  getRoute,
  parseUrl,
  pushState,
  replaceState
} from "./chunk-Z6L3MMX7.js";

// dev/ui/src/lib/media-href.js
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
  return typeof path === "string" && /^\/(posts|generations|comics)\//.test(path);
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
function modelsOriginQuery(versionId, { sort, familyId } = {}) {
  const out = { from: "models" };
  if (versionId != null && versionId !== "") out.versionId = String(versionId);
  else if (familyId != null && familyId !== "") out.familyId = String(familyId);
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
  return `/media/${enc}`;
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

// dev/ui/src/lib/gallery-focus.js
function clamp01(n) {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}
function captureFocus({ id, index, tileTop, viewHeight, firstId, lastId }) {
  const vh = viewHeight;
  const y = !vh ? 0 : clamp01(tileTop / vh);
  return { id, y, index, firstId, lastId };
}
function targetTileTop(y, viewHeight) {
  return y * viewHeight;
}
function resolveFocusId(items, focus) {
  if (!focus) return null;
  const byString = /* @__PURE__ */ new Map();
  if (Array.isArray(items)) {
    for (const it of items) {
      if (it && it.id != null) byString.set(String(it.id), it.id);
    }
  }
  if (focus.id != null && byString.has(String(focus.id))) return byString.get(String(focus.id));
  if (focus.firstId != null && byString.has(String(focus.firstId))) return byString.get(String(focus.firstId));
  if (focus.lastId != null && byString.has(String(focus.lastId))) return byString.get(String(focus.lastId));
  return null;
}
function focusPhase({ focus, itemCount, hasMore, idFound, pending = false }) {
  if (!focus) return "absent";
  const index = Number(focus.index);
  const count = Number(itemCount) || 0;
  const prefixShort = Number.isFinite(index) && count <= index;
  if (prefixShort && (pending || hasMore)) return "wait";
  if (idFound) return "place";
  return "drop";
}
function nextGalleryPage(page, { loading = false, totalPages = 1, appliedPage = 0 } = {}) {
  const p = Number(page) || 0;
  if (loading) return p;
  if (p >= totalPages) return p;
  if (p > appliedPage) return p;
  return p + 1;
}
function packedFocusScrollTop({ masonryDocTop, originY, tileY, y, viewHeight }) {
  const ratio = typeof y === "number" ? y : 0;
  const top = (Number(masonryDocTop) || 0) - (Number(originY) || 0) + (Number(tileY) || 0) - targetTileTop(ratio, Number(viewHeight) || 0);
  return Math.max(0, top);
}
function originBagForHop(bag, { anchorSlot, keepAnchor = true } = {}) {
  const out = {};
  if (bag && bag.focus != null) out.focus = bag.focus;
  const anchor = arguments.length > 1 && arguments[1] && Object.prototype.hasOwnProperty.call(arguments[1], "anchorSlot") ? anchorSlot : keepAnchor && bag ? bag.anchorSlot : void 0;
  if (anchor != null && anchor !== "") out.anchorSlot = anchor;
  return out;
}

// dev/ui/src/lib/open-origin-node.js
function originNodeHref(item, {
  grain,
  originView,
  params,
  slot,
  index,
  groupsMeta
} = {}) {
  const path = tileHref(item, { grain });
  const href = path && String(path).startsWith("/") ? path : `/${path || ""}`;
  const parsed = parseUrl(href);
  const groupBy = params && params.groupBy;
  const resolvedSlot = slot != null && slot !== "" ? slot : galleryClickSlot(item, href, { grain, index, groupsMeta, groupBy });
  return formatUrl({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: originQuery(params, originView, {
      granularity: grain,
      slot: resolvedSlot,
      path: href
    })
  });
}
function stampGalleryFocus(focus) {
  replaceState({}, { focus });
}
function dropGalleryFocus() {
  replaceState({}, { focus: null });
}
function readHistoryFocus() {
  try {
    const s = typeof history === "undefined" ? null : history.state;
    if (s == null || typeof s !== "object" || Array.isArray(s)) return null;
    return s.focus || null;
  } catch {
    return null;
  }
}
function shouldLoadFocusPrefix(focus, { loading, itemCount, hasMore } = {}) {
  if (!focus || loading || !hasMore) return false;
  const index = Number(focus.index);
  if (!Number.isFinite(index)) return false;
  return itemCount <= index;
}
function openOriginNode(e, { href, bag } = {}) {
  if (!e) return;
  if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.button !== 0) return;
  if (!href) return;
  e.preventDefault();
  e.stopPropagation();
  const path = String(href).startsWith("/") ? href : `/${href}`;
  const parsed = parseUrl(path);
  const current = getRoute();
  pushState({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: completeAuthoredParams(current.params, parsed.params)
  }, bag);
}
function activateOriginTile(e, item, index, landmarks, ctx) {
  const tile = e && e.currentTarget;
  const rect = tile && typeof tile.getBoundingClientRect === "function" ? tile.getBoundingClientRect() : { top: 0 };
  const focus = captureFocus({
    id: item && item.id,
    index,
    tileTop: rect.top,
    viewHeight: typeof window !== "undefined" ? window.innerHeight : 0,
    firstId: landmarks && landmarks.firstId,
    lastId: landmarks && landmarks.lastId
  });
  stampGalleryFocus(focus);
  const href = originNodeHref(item, {
    grain: ctx && ctx.grain,
    originView: ctx && ctx.originView,
    params: ctx && ctx.params,
    slot: ctx && ctx.slot,
    index,
    groupsMeta: ctx && ctx.groupsMeta
  });
  openOriginNode(e, { href, bag: { focus } });
}
function memberMediaHref(mediaId, params, {
  slot,
  dropSlot,
  originView,
  slotInUrl,
  granularity
} = {}) {
  const id = normalizeMediaId(mediaId);
  if (!id) return "";
  const from = originView != null && originView !== "" ? originView : params && params.from;
  if (!from) return `/media/${encodeURIComponent(id)}`;
  let resolvedSlot = null;
  if (!dropSlot && slotInUrl !== false) {
    resolvedSlot = slot != null && slot !== "" ? slot : params && params.slot;
  }
  if (slotInUrl === false) resolvedSlot = null;
  const path = `/media/${encodeURIComponent(id)}`;
  const grain = granularity != null && granularity !== "" ? granularity : params && params.granularity;
  return formatUrl({
    view: "media",
    entityId: id,
    modelTrail: null,
    params: originQuery(params, from, {
      granularity: grain,
      slot: resolvedSlot,
      path
    })
  });
}
function relatedOriginHref(target, routeParams) {
  const id = target && target.id != null ? normalizeMediaId(target.id) : "";
  if (!id) return "";
  if (target.inputOnly) {
    return formatUrl({
      view: "media",
      entityId: id,
      modelTrail: null,
      params: { from: "imports" }
    });
  }
  const from = routeParams && routeParams.from;
  if (!from) return `/media/${encodeURIComponent(id)}`;
  const path = `/media/${encodeURIComponent(id)}`;
  return formatUrl({
    view: "media",
    entityId: id,
    modelTrail: null,
    params: originQuery(routeParams, from, {
      granularity: routeParams.granularity,
      slot: null,
      path
    })
  });
}
function usedInConsumerHref(tile, routeParams, originScope) {
  const id = tile && tile.id != null ? normalizeMediaId(tile.id) : "";
  if (!id) return "";
  const from = routeParams && routeParams.from || originScope || "";
  const compatible = from === "generations" && tile.hasGeneration || from === "posts" && tile.hasPost || from === "comics" && tile.hasComic;
  if (!compatible) return `/media/${encodeURIComponent(id)}`;
  const path = `/media/${encodeURIComponent(id)}`;
  return formatUrl({
    view: "media",
    entityId: id,
    modelTrail: null,
    params: originQuery(routeParams, from, {
      granularity: routeParams && routeParams.granularity,
      slot: null,
      path
    })
  });
}
function openStepperSibling(e, href, { leaveSlot, placement } = {}) {
  const bag = readHistoryBag();
  let nextBag;
  if (placement === "detached") {
    nextBag = originBagForHop(bag);
  } else if (leaveSlot) {
    nextBag = originBagForHop(bag, { anchorSlot: leaveSlot });
  } else {
    nextBag = originBagForHop(bag, { keepAnchor: false });
  }
  openOriginNode(e, { href, bag: nextBag });
}
function readHistoryAnchorSlot() {
  const bag = readHistoryBag();
  return bag.anchorSlot != null && bag.anchorSlot !== "" ? bag.anchorSlot : null;
}
function openPreservingOriginBag(e, href) {
  openOriginNode(e, { href, bag: originBagForHop(readHistoryBag()) });
}
function findFocusElement(root, id) {
  if (!root || id == null) return null;
  const want = String(id);
  const nodes = root.querySelectorAll("[data-focus-id]");
  for (const n of nodes) {
    if (n.getAttribute("data-focus-id") === want) return n;
  }
  return null;
}
function scrollFocusIntoView(el, focus) {
  if (!el || !focus) return;
  const y = typeof focus.y === "number" ? focus.y : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const rect = el.getBoundingClientRect();
  window.scrollBy(0, rect.top - targetTileTop(y, vh));
}
function consumeGalleryFocus({ root, items, hasMore, pending = false, packedSeek, measured = true } = {}) {
  const focus = readHistoryFocus();
  if (!focus) return true;
  if (measured === false) return false;
  const itemCount = Array.isArray(items) ? items.length : 0;
  const id = resolveFocusId(items, focus);
  const phase = focusPhase({ focus, itemCount, hasMore, idFound: id != null, pending });
  if (phase === "wait") return false;
  if (phase === "drop") {
    dropGalleryFocus();
    return true;
  }
  const el = findFocusElement(root, id);
  if (el) {
    if (el.getBoundingClientRect().height < 1) return false;
    scrollFocusIntoView(el, focus);
    dropGalleryFocus();
    return true;
  }
  if (typeof packedSeek === "function") {
    packedSeek(id, focus);
    return false;
  }
  return false;
}

export {
  nextGalleryPage,
  packedFocusScrollTop,
  originBagForHop,
  canonicalMediaRouteId,
  tileHref,
  originQuery,
  originFetchQuery,
  containerResetQuery,
  modelsOriginQuery,
  originNeighbourPath,
  originNeighbourParams,
  originNeighbourHref,
  readHistoryBag,
  originSiblingArrows,
  replaceOriginNeighbour,
  originNodeHref,
  readHistoryFocus,
  shouldLoadFocusPrefix,
  openOriginNode,
  activateOriginTile,
  memberMediaHref,
  relatedOriginHref,
  usedInConsumerHref,
  openStepperSibling,
  readHistoryAnchorSlot,
  openPreservingOriginBag,
  findFocusElement,
  consumeGalleryFocus
};
