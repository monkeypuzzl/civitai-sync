// Origin ‹ › neighbours from the detail `origin` payload (prevId / nextId /
// slots / placement). Gallery pagination is unchanged; arrows do not
// accumulate a client window or fetch the next page of 50.

import { originQuery } from './media-href.js';
import { replaceState } from './router.js';
import { formatUrl, parseUrl } from './url-state.js';

const HISTORY_BAG_KEYS = ['list', 'mediaList', 'originHref', 'focus', 'originPage', 'anchorSlot'];
const STRIP_SIBLING = new Set(['generation', 'select']);

function siblingParams (routeParams) {
  const out = { ...(routeParams || {}) };
  for (const key of STRIP_SIBLING) delete out[key];
  return out;
}

/**
 * Neighbour URL for origin ‹ › `<a href>`. Same param merge as replaceToHref
 * (keeps from= + facets; drops generation / select). Path-only input hrefs
 * are the usual case.
 */
export function originSiblingHref (href, routeParams) {
  if (href == null || href === '') return '';
  const parsed = parseUrl(href);
  const from = routeParams && routeParams.from;
  return formatUrl({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: originQuery(siblingParams(routeParams), from || null, {
      granularity: routeParams && routeParams.granularity,
      slot: routeParams && routeParams.slot,
      path: href
    })
  });
}

/**
 * Path for a neighbour id on the current node view.
 */
export function originNeighbourPath (id, view) {
  if (id == null || id === '') return '';
  const enc = encodeURIComponent(String(id));
  if (view === 'generations') return `/generations/${enc}`;
  if (view === 'posts') return `/posts/${enc}`;
  if (view === 'comics') return `/comics/${enc}`;
  if (view === 'model3ds') return `/model3ds/${enc}`;
  return `/media/${enc}`;
}

/**
 * Params for a neighbour hop. Fallback first click writes membership
 * `from=` with an empty query. Otherwise keeps the current origin query,
 * sets `slot` only when `slotInUrl`, and quiets defaults / container keys.
 */
// null means leave the address alone. slot null clears a stale token.
export function quietSlotPatch ({ urlSlot, origin } = {}) {
  if (!origin || origin.placement === 'fallback') return null;
  const url = urlSlot == null || urlSlot === '' ? '' : String(urlSlot);
  if (origin.slotInUrl && origin.slot != null && origin.slot !== '' && url !== String(origin.slot)) {
    return { slot: String(origin.slot) };
  }
  if (!origin.slotInUrl && url) return { slot: null };
  return null;
}

export function originNeighbourParams (routeParams, origin, { slot, slotInUrl, path } = {}) {
  if (origin && origin.placement === 'fallback') {
    const scope = origin.scope;
    return scope ? { from: scope } : {};
  }
  const base = siblingParams(routeParams);
  const resolvedSlot = slotInUrl && slot != null && slot !== '' ? slot : null;
  const from = base.from || null;
  return originQuery(base, from, {
    granularity: base.granularity,
    slot: resolvedSlot,
    path
  });
}

/**
 * Full neighbour href from the detail origin payload.
 */
export function originNeighbourHref ({
  id, slot, slotInUrl, view, routeParams, origin
} = {}) {
  if (id == null || id === '') return '';
  const path = originNeighbourPath(id, view);
  if (!path) return '';
  const parsed = parseUrl(path);
  return formatUrl({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: originNeighbourParams(routeParams, origin, { slot, slotInUrl, path })
  });
}

export function readHistoryBag () {
  try {
    const s = typeof history === 'undefined' ? null : history.state;
    if (s == null || typeof s !== 'object' || Array.isArray(s)) {
      return {};
    }
    const out = {};
    for (const key of HISTORY_BAG_KEYS) {
      if (s[key] !== undefined) out[key] = s[key];
    }
    return out;
  } catch {
    return {};
  }
}

export function historyBagOpts (bag) {
  const out = {};
  if (!bag || typeof bag !== 'object') return out;
  for (const key of HISTORY_BAG_KEYS) {
    if (bag[key] !== undefined) out[key] = bag[key];
  }
  return out;
}

/**
 * Labels for origin ‹ ›. True ends are [Start] / [End] from null neighbours
 * on the detail payload — not a loaded-window tail that still has pages.
 */
export function originSiblingArrows (origin) {
  const prevOn = origin != null && origin.prevId != null && origin.prevId !== '';
  const nextOn = origin != null && origin.nextId != null && origin.nextId !== '';
  return {
    prev: { enabled: prevOn, title: prevOn ? 'Previous' : '[Start]' },
    next: { enabled: nextOn, title: nextOn ? 'Next' : '[End]' }
  };
}

/**
 * replaceState onto a neighbour. Same path with a new slot is still a hop.
 * Keeps focus. Fallback first click clears anchorSlot; other hops keep it
 * (in-walk ignores a stale token; detached may still need it until leave).
 */
export function replaceOriginNeighbour ({
  id, slot, slotInUrl, view, routeParams, origin
} = {}) {
  if (id == null || id === '') return;
  const path = originNeighbourPath(id, view);
  if (!path) return;
  const parsed = parseUrl(path);
  const bag = readHistoryBag();
  const opts = {};
  if (bag.focus != null) opts.focus = bag.focus;
  if (origin && origin.placement === 'fallback') opts.anchorSlot = null;
  else if (bag.anchorSlot != null) opts.anchorSlot = bag.anchorSlot;
  replaceState({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: originNeighbourParams(routeParams, origin, { slot, slotInUrl, path })
  }, opts);
}
