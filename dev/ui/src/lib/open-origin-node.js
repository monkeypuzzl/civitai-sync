// Gallery → node hop. Tile hrefs carry origin query (from, granularity,
// facets, sort, group, q, title, slot). Left-click authors that query
// (keys the href omitted are cleared). history.state keeps focus and the
// stepper's anchorSlot — list / mediaList / originPage are not the walk.

import { captureFocus, focusPhase, originBagForHop, resolveFocusId, targetTileTop } from './gallery-focus.js';
import { galleryClickSlot, originQuery, tileHref } from './media-href.js';
import { readHistoryBag } from './origin-page.js';
import { getRoute, pushState, replaceState } from './router.js';
import { completeAuthoredParams, formatUrl, parseUrl } from './url-state.js';
import { normalizeMediaId } from './format.js';

export function originNodeHref (item, {
  grain,
  originView,
  params,
  slot,
  index,
  groupsMeta
} = {}) {
  const path = tileHref(item, { grain });
  const href = path && String(path).startsWith('/') ? path : `/${path || ''}`;
  const parsed = parseUrl(href);
  const groupBy = params && params.groupBy;
  const resolvedSlot = slot != null && slot !== ''
    ? slot
    : galleryClickSlot(item, href, { grain, index, groupsMeta, groupBy });
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

export function stampGalleryFocus (focus) {
  replaceState({}, { focus });
}

export function dropGalleryFocus () {
  replaceState({}, { focus: null });
}

export function readHistoryFocus () {
  try {
    const s = typeof history === 'undefined' ? null : history.state;
    if (s == null || typeof s !== 'object' || Array.isArray(s)) return null;
    return s.focus || null;
  } catch {
    return null;
  }
}

export function shouldLoadFocusPrefix (focus, { loading, itemCount, hasMore } = {}) {
  if (!focus || loading || !hasMore) return false;
  const index = Number(focus.index);
  if (!Number.isFinite(index)) return false;
  return itemCount <= index;
}

export function openOriginNode (e, { href, bag } = {}) {
  if (!e) return;
  if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.button !== 0) return;
  if (!href) return;
  e.preventDefault();
  e.stopPropagation();
  const path = String(href).startsWith('/') ? href : `/${href}`;
  const parsed = parseUrl(path);
  const current = getRoute();
  pushState({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: completeAuthoredParams(current.params, parsed.params)
  }, bag);
}

export function activateOriginTile (e, item, index, landmarks, ctx) {
  const tile = e && e.currentTarget;
  const rect = tile && typeof tile.getBoundingClientRect === 'function'
    ? tile.getBoundingClientRect()
    : { top: 0 };
  const focus = captureFocus({
    id: item && item.id,
    index,
    tileTop: rect.top,
    viewHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
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

export function memberMediaHref (mediaId, params, {
  slot,
  dropSlot,
  originView,
  slotInUrl,
  granularity
} = {}) {
  const id = normalizeMediaId(mediaId);
  if (!id) return '';
  // Page scope wins — container URLs never carry from after quiet omit.
  const from = (originView != null && originView !== '')
    ? originView
    : (params && params.from);
  if (!from) return `/media/${encodeURIComponent(id)}`;
  let resolvedSlot = null;
  if (!dropSlot && slotInUrl !== false) {
    resolvedSlot = slot != null && slot !== ''
      ? slot
      : (params && params.slot);
  }
  if (slotInUrl === false) resolvedSlot = null;
  const path = `/media/${encodeURIComponent(id)}`;
  const grain = granularity != null && granularity !== ''
    ? granularity
    : (params && params.granularity);
  return formatUrl({
    view: 'media',
    entityId: id,
    modelTrail: null,
    params: originQuery(params, from, {
      granularity: grain,
      slot: resolvedSlot,
      path
    })
  });
}

/**
 * Inputs hop. Input-only → from=imports only. Produced → keep the current
 * origin query and omit slot (first slot for that id).
 */
export function relatedOriginHref (target, routeParams) {
  const id = target && target.id != null ? normalizeMediaId(target.id) : '';
  if (!id) return '';
  if (target.inputOnly) {
    return formatUrl({
      view: 'media',
      entityId: id,
      modelTrail: null,
      params: { from: 'imports' }
    });
  }
  const from = routeParams && routeParams.from;
  if (!from) return `/media/${encodeURIComponent(id)}`;
  const path = `/media/${encodeURIComponent(id)}`;
  return formatUrl({
    view: 'media',
    entityId: id,
    modelTrail: null,
    params: originQuery(routeParams, from, {
      granularity: routeParams.granularity,
      slot: null,
      path
    })
  });
}

/**
 * Used in… consumer hop. Keep the origin query only when that consumer
 * belongs to the current container type. `models` and `imports` are not
 * compatible. Never writes `usedIn` (`originQuery` already drops it).
 */
export function usedInConsumerHref (tile, routeParams, originScope) {
  const id = tile && tile.id != null ? normalizeMediaId(tile.id) : '';
  if (!id) return '';
  const from = (routeParams && routeParams.from) || originScope || '';
  const compatible = (from === 'generations' && tile.hasGeneration)
    || (from === 'posts' && tile.hasPost)
    || (from === 'comics' && tile.hasComic);
  if (!compatible) return `/media/${encodeURIComponent(id)}`;
  const path = `/media/${encodeURIComponent(id)}`;
  return formatUrl({
    view: 'media',
    entityId: id,
    modelTrail: null,
    params: originQuery(routeParams, from, {
      granularity: routeParams && routeParams.granularity,
      slot: null,
      path
    })
  });
}

/**
 * Stepper hop onto a sibling outside the walk: keep the origin query, drop
 * `slot` from the URL, and write `anchorSlot` into history.state (the in-walk
 * slot just left). Further hops while detached keep that same token.
 * In-walk siblings use openOriginNode with their own slot instead.
 */
export function openStepperSibling (e, href, { leaveSlot, placement } = {}) {
  const bag = readHistoryBag();
  let nextBag;
  if (placement === 'detached') {
    nextBag = originBagForHop(bag);
  } else if (leaveSlot) {
    nextBag = originBagForHop(bag, { anchorSlot: leaveSlot });
  } else {
    nextBag = originBagForHop(bag, { keepAnchor: false });
  }
  openOriginNode(e, { href, bag: nextBag });
}

export function readHistoryAnchorSlot () {
  const bag = readHistoryBag();
  return bag.anchorSlot != null && bag.anchorSlot !== '' ? bag.anchorSlot : null;
}

export function openPreservingOriginBag (e, href) {
  openOriginNode(e, { href, bag: originBagForHop(readHistoryBag()) });
}

export function findFocusElement (root, id) {
  if (!root || id == null) return null;
  const want = String(id);
  const nodes = root.querySelectorAll('[data-focus-id]');
  for (const n of nodes) {
    if (n.getAttribute('data-focus-id') === want) return n;
  }
  return null;
}

export function scrollFocusIntoView (el, focus) {
  if (!el || !focus) return;
  const y = typeof focus.y === 'number' ? focus.y : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const rect = el.getBoundingClientRect();
  window.scrollBy(0, rect.top - targetTileTop(y, vh));
}

/**
 * Gallery restore. Returns true when focus was consumed (scrolled or
 * dropped) or absent. Returns false when still waiting (unmeasured,
 * prefix short, or cell not mounted). packedSeek(id, focus) may scroll
 * using packed coordinates so the virtual window can mount the cell;
 * the caller may invoke it on each layout until the cell appears.
 */
export function consumeGalleryFocus ({ root, items, hasMore, pending = false, packedSeek, measured = true } = {}) {
  const focus = readHistoryFocus();
  if (!focus) return true;
  if (measured === false) return false;
  const itemCount = Array.isArray(items) ? items.length : 0;
  const id = resolveFocusId(items, focus);
  const phase = focusPhase({ focus, itemCount, hasMore, idFound: id != null, pending });
  if (phase === 'wait') return false;
  if (phase === 'drop') {
    dropGalleryFocus();
    return true;
  }
  // place
  const el = findFocusElement(root, id);
  if (el) {
    if (el.getBoundingClientRect().height < 1) return false;
    scrollFocusIntoView(el, focus);
    dropGalleryFocus();
    return true;
  }
  if (typeof packedSeek === 'function') {
    packedSeek(id, focus);
    return false;
  }
  return false;
}
