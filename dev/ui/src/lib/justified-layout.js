// Greedy Flickr-style justified rows. Pure: no DOM.
// Completed rows flush to containerWidth; remainder pixels go to the
// last item of a filled row. The last row of a terminal pack is
// unstretched (ragged right). While holdWidow is set, the last packed
// slice omits that incomplete row (and the gap before it) so a later
// append can birth it fill-flushed. Group slices pack independently so
// a row never straddles a header.

function resolveRatio (ratio) {
  const r = Number(ratio);
  return Number.isFinite(r) && r > 0 ? r : 1;
}

function integerFillWidths (ratios, available, rowH) {
  const n = ratios.length;
  const widths = new Array(n);
  let used = 0;
  for (let i = 0; i < n - 1; i++) {
    widths[i] = Math.max(1, Math.round(rowH * ratios[i]));
    used += widths[i];
  }
  widths[n - 1] = available - used;
  if (widths[n - 1] < 1) {
    let deficit = 1 - widths[n - 1];
    widths[n - 1] = 1;
    for (let i = n - 2; i >= 0 && deficit > 0; i--) {
      const steal = Math.min(deficit, Math.max(0, widths[i] - 1));
      widths[i] -= steal;
      deficit -= steal;
    }
  }
  return widths;
}

function packRows (slice, { containerWidth, gap, targetRowHeight, startY, positions, holdWidow }) {
  let y = startY;
  const row = [];
  // Bottom of the last fill:true row, captured after flush(true) and
  // before the between-row gap. Widow y already includes that gap.
  let yAfterCompletedRow = null;
  let lastFill = true;
  let lastFlushCount = 0;

  const flush = (fill) => {
    const n = row.length;
    if (!n) return;
    const ratios = row.map((it) => it.ratio);
    const gaps = gap * Math.max(0, n - 1);
    const available = containerWidth - gaps;
    let rowH;
    let widths;
    if (fill) {
      const sumRatio = ratios.reduce((s, r) => s + r, 0);
      const scale = (targetRowHeight * sumRatio) > 0
        ? available / (targetRowHeight * sumRatio)
        : 1;
      rowH = Math.round(targetRowHeight * scale) || 1;
      widths = integerFillWidths(ratios, available, rowH);
    } else {
      rowH = Math.round(targetRowHeight) || 1;
      if (n === 1 && rowH * ratios[0] > containerWidth) {
        widths = [containerWidth];
        rowH = Math.round(containerWidth / ratios[0]) || 1;
      } else {
        widths = ratios.map((r) => Math.max(1, Math.round(rowH * r)));
        const total = widths.reduce((s, w) => s + w, 0);
        if (total + gaps > containerWidth) {
          widths[n - 1] = Math.max(1, widths[n - 1] - (total + gaps - containerWidth));
        }
      }
    }
    let x = 0;
    for (let i = 0; i < n; i++) {
      positions.push({
        index: row[i].index,
        x,
        y,
        w: widths[i],
        h: rowH
      });
      x += widths[i] + gap;
    }
    y += rowH;
    lastFill = fill;
    lastFlushCount = n;
    if (fill) yAfterCompletedRow = y;
    row.length = 0;
  };

  for (const item of slice) {
    const ratio = resolveRatio(item.ratio);
    const n = row.length;
    let sumRatio = 0;
    for (let i = 0; i < n; i++) sumRatio += row[i].ratio;
    const projected = targetRowHeight * (sumRatio + ratio) + gap * n;
    if (n > 0 && projected > containerWidth) {
      flush(true);
      y += gap;
    }
    row.push({ index: item.index, ratio });
  }
  flush(false);

  let held = 0;
  if (holdWidow && lastFill === false && lastFlushCount > 0) {
    positions.length -= lastFlushCount;
    y = yAfterCompletedRow != null ? yAfterCompletedRow : startY;
    held = lastFlushCount;
  }
  return { y, held };
}

/**
 * Hold the last incomplete row while the last packed slice may still
 * receive items. Terminal result sets and finished groups do not hold
 * (their last row is already the ragged end).
 *
 * @param {{ itemCount: number, hasMore?: boolean, groups?: { offset: number, count: number }[] }} opts
 * @returns {boolean}
 */
export function shouldHoldWidow ({ itemCount, hasMore, groups } = {}) {
  if (!hasMore) return false;
  const list = Array.isArray(groups) ? groups : [];
  if (!list.length) return true;
  const n = Number(itemCount);
  let last = null;
  for (const g of list) {
    const offset = Number(g?.offset);
    if (Number.isFinite(offset) && offset < n) last = g;
  }
  if (!last) return false;
  const offset = Number(last.offset);
  const count = Number(last.count);
  const sliceEnd = offset + (Number.isFinite(count) && count > 0 ? count : 0);
  return n < sliceEnd;
}

/**
 * @param {{ index: number, ratio?: number }[]} items
 * @param {{ containerWidth: number, gap: number, targetRowHeight: number, groups?: { key?: string, label?: string, count: number, offset: number }[], headerHeight?: number, holdWidow?: boolean }} opts
 * @returns {{ positions: { index: number, x: number, y: number, w: number, h: number }[], headers: { key: string, label: string, count: number, offset: number, y: number, h: number }[], height: number, held: number }}
 */
export function layoutJustified (items, {
  containerWidth,
  gap = 0,
  targetRowHeight,
  groups,
  headerHeight = 0,
  holdWidow = false
} = {}) {
  const empty = { positions: [], headers: [], height: 0, held: 0 };
  if (!(containerWidth > 0) || !(targetRowHeight > 0)) return empty;
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return empty;

  const positions = [];
  const headers = [];

  const packOpts = { containerWidth, gap, targetRowHeight, positions };

  const grouped = Array.isArray(groups) && groups.length > 0;
  if (!grouped) {
    const packed = packRows(list, { ...packOpts, startY: 0, holdWidow: !!holdWidow });
    return { positions, headers, height: packed.y, held: packed.held };
  }

  let lastPackedGroup = -1;
  for (let i = 0; i < groups.length; i++) {
    const offset = Number(groups[i]?.offset);
    if (Number.isFinite(offset) && offset < list.length) lastPackedGroup = i;
  }

  let y = 0;
  let packed = false;
  let held = 0;
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const offset = Number(g?.offset);
    if (!Number.isFinite(offset) || offset >= list.length) continue;
    const count = Number(g?.count);
    const end = Math.min(
      list.length,
      offset + (Number.isFinite(count) && count > 0 ? count : 0)
    );
    const slice = list.slice(offset, end);
    if (!slice.length) continue;

    const holdThis = !!holdWidow && gi === lastPackedGroup;
    const yBeforeHeader = y;
    const posBefore = positions.length;
    let pushedHeader = false;

    if (offset > 0) {
      if (packed) y += gap;
      const h = headerHeight > 0 ? headerHeight : 0;
      headers.push({
        key: g.key,
        label: g.label,
        count: g.count,
        offset,
        y,
        h
      });
      y += h + gap;
      pushedHeader = true;
    }
    const packedSlice = packRows(slice, { ...packOpts, startY: y, holdWidow: holdThis });
    y = packedSlice.y;
    if (holdThis) held = packedSlice.held;

    if (holdThis && positions.length === posBefore && pushedHeader) {
      headers.pop();
      y = yBeforeHeader;
    } else {
      packed = true;
    }
  }

  return { positions, headers, height: packed ? y : 0, held };
}

function lowerBound (n, pred) {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pred(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function intersects (y, h, rangeStart, rangeEnd) {
  return y < rangeEnd && (y + h) > rangeStart;
}

/**
 * Distance the packed origin has travelled above the viewport.
 * Packed Y=0 sits at gallery-window.top + in-flow sticky header height.
 * Do not measure from `.gallery-masonry` or `.gallery-pad` — those move
 * when topPad changes and feed back into viewTop (scroll crawl).
 *
 * @param {number} galleryWindowTop getBoundingClientRect().top of `.gallery-window`
 * @param {number} [headerHeight=0] in-flow sticky current-group header
 * @returns {number}
 */
export function packedViewTop (galleryWindowTop, headerHeight = 0) {
  const top = Number(galleryWindowTop);
  const header = Number(headerHeight);
  if (!Number.isFinite(top)) return 0;
  const h = Number.isFinite(header) && header > 0 ? header : 0;
  return Math.max(0, -(top + h));
}

/**
 * Y-window over item boxes only. Group headers are painted by Gallery from
 * layout.headers using the start/end index rule; folding them into originY
 * left a blank band when overscan reached a header that is not mounted
 * (offset === start, sticky currentGroup covers it).
 *
 * @param {{ positions?: { index: number, y: number, h: number }[], height?: number }} layout
 * @param {{ viewTop: number, viewHeight: number, overscanPx?: number }} opts
 */
export function visibleWindow (layout, { viewTop = 0, viewHeight = 0, overscanPx = 0 } = {}) {
  const zeros = {
    startIndex: 0,
    endIndex: 0,
    topPad: 0,
    bottomPad: 0,
    originY: 0,
    sliceHeight: 0
  };
  const positions = layout?.positions || [];
  const height = layout?.height || 0;
  if (!positions.length) {
    return height > 0
      ? { ...zeros, bottomPad: height }
      : zeros;
  }

  const rangeStart = viewTop - (overscanPx || 0);
  const rangeEnd = viewTop + viewHeight + (overscanPx || 0);

  const i0 = lowerBound(positions.length, (i) => positions[i].y + positions[i].h > rangeStart);
  const i1 = lowerBound(positions.length, (i) => positions[i].y >= rangeEnd);

  let startIndex = 0;
  let endIndex = 0;
  let originY = Infinity;
  let maxBottom = -Infinity;
  let found = false;

  for (let i = i0; i < i1; i++) {
    const p = positions[i];
    if (!intersects(p.y, p.h, rangeStart, rangeEnd)) continue;
    if (!found) {
      startIndex = p.index;
      found = true;
    }
    endIndex = p.index + 1;
    if (p.y < originY) originY = p.y;
    const bottom = p.y + p.h;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  if (!found || originY === Infinity) {
    const origin = height > 0
      ? Math.max(0, Math.min(height, viewTop))
      : 0;
    return {
      startIndex: 0,
      endIndex: 0,
      originY: origin,
      sliceHeight: 0,
      topPad: origin,
      bottomPad: height - origin
    };
  }

  const sliceHeight = maxBottom - originY;
  const topPad = originY;
  const bottomPad = height - (originY + sliceHeight);
  return { startIndex, endIndex, topPad, bottomPad, originY, sliceHeight };
}
