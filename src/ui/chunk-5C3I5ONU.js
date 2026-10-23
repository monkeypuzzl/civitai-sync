import {
  galleryClickSlot,
  originQuery,
  readHistoryBag,
  tileHref
} from "./chunk-FK7RTYYB.js";
import {
  completeAuthoredParams,
  formatUrl,
  getRoute,
  parseUrl,
  pushState,
  replaceState
} from "./chunk-K4YW4PKR.js";
import {
  normalizeMediaId
} from "./chunk-GOKE7NMO.js";

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
  if (!idFound && (hasMore || pending)) return "wait";
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
function shouldLoadFocusPrefix(focus, { loading, hasMore, idFound } = {}) {
  if (!focus || loading || !hasMore) return false;
  if (idFound) return false;
  return true;
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
  resolveFocusId,
  nextGalleryPage,
  packedFocusScrollTop,
  originBagForHop,
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
