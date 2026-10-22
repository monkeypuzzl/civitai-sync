// Gallery restore payload for origin-tab / Back. Not a URL key.
// y is tile-top / viewport height, clamped to [0, 1] — not scrollY.

function clamp01 (n) {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

export function captureFocus ({ id, index, tileTop, viewHeight, firstId, lastId }) {
  const vh = viewHeight;
  const y = !vh ? 0 : clamp01(tileTop / vh);
  return { id, y, index, firstId, lastId };
}

export function targetTileTop (y, viewHeight) {
  return y * viewHeight;
}

export function pagesToLoad (index, pageSize = 50) {
  return Math.max(1, Math.ceil((index + 1) / pageSize));
}

export function resolveFocusId (items, focus) {
  if (!focus) return null;
  const byString = new Map();
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

export function focusPhase ({ focus, itemCount, hasMore, idFound, pending = false }) {
  if (!focus) return 'absent';
  const index = Number(focus.index);
  const count = Number(itemCount) || 0;
  // A short prefix waits while another page is coming (hasMore) or the page
  // counter has moved ahead of the items already appended (pending). A
  // landmark hit in that short prefix is not a place.
  const prefixShort = Number.isFinite(index) && count <= index;
  if (prefixShort && (pending || hasMore)) return 'wait';
  if (idFound) return 'place';
  if (!idFound && (hasMore || pending)) return 'wait';
  return 'drop';
}

// One step, and only after the current page is in the list. Callers pass
// the committed page; two calls in one turn both return that page + 1.
export function nextGalleryPage (page, { loading = false, totalPages = 1, appliedPage = 0 } = {}) {
  const p = Number(page) || 0;
  if (loading) return p;
  if (p >= totalPages) return p;
  if (p > appliedPage) return p;
  return p + 1;
}

export function packedFocusScrollTop ({ masonryDocTop, originY, tileY, y, viewHeight }) {
  const ratio = typeof y === 'number' ? y : 0;
  const top = (Number(masonryDocTop) || 0) - (Number(originY) || 0) + (Number(tileY) || 0) - targetTileTop(ratio, Number(viewHeight) || 0);
  return Math.max(0, top);
}

// Member / stepper hop: copy focus and optionally anchorSlot. Same focus
// object (not a new id). Never list / mediaList / originHref.
export function originBagForHop (bag, { anchorSlot, keepAnchor = true } = {}) {
  const out = {};
  if (bag && bag.focus != null) out.focus = bag.focus;
  const anchor = arguments.length > 1 && arguments[1] && Object.prototype.hasOwnProperty.call(arguments[1], 'anchorSlot')
    ? anchorSlot
    : (keepAnchor && bag ? bag.anchorSlot : undefined);
  if (anchor != null && anchor !== '') out.anchorSlot = anchor;
  return out;
}
