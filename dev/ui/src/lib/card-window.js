// Row window for post/comic card grids. Stride is estimated; the hook may
// correct it from mounted cards. Groups are full-width header rows.

export const CARD_INFO_ESTIMATE_PX = 88;
export const CARD_HEADER_FALLBACK_PX = 40;
export const CARD_OVERSCAN_ROWS = 2;
export const CARD_STRIDE_CORRECTIONS = 2;

export function cardStride ({ colWidth, aspect, infoPx, gap }) {
  const ratio = Number(aspect) > 0 ? Number(aspect) : 1; // width / height
  const thumb = (Number(colWidth) || 0) / ratio;
  return thumb + (Number(infoPx) || 0) + (Number(gap) || 0);
}

export function contentY (index, cols, stride, groups, headerPx) {
  const c = Math.max(1, Number(cols) || 1);
  const s = Number(stride) || 0;
  const h = Number(headerPx) || 0;
  const idx = Math.max(0, Number(index) || 0);
  if (!Array.isArray(groups) || groups.length === 0) {
    return Math.floor(idx / c) * s;
  }
  let y = 0;
  for (const g of groups) {
    const offset = Number(g.offset) || 0;
    const count = Number(g.count) || 0;
    if (idx >= offset + count) {
      y += h + Math.ceil(count / c) * s;
      continue;
    }
    if (idx >= offset) {
      y += h + Math.floor((idx - offset) / c) * s;
    }
    break;
  }
  return y;
}

export function cardFocusTop ({ index, cols, stride, groups, headerPx, gridDocTop, y, viewHeight }) {
  const ratio = typeof y === 'number' ? y : 0;
  const vh = Number(viewHeight) || 0;
  return Math.max(0, (Number(gridDocTop) || 0) + contentY(index, cols, stride, groups, headerPx) - ratio * vh);
}

function totalContentHeight (count, cols, stride, groups, headerPx) {
  const c = Math.max(1, Number(cols) || 1);
  const s = Math.max(1, Number(stride) || 1);
  const h = Number(headerPx) || 0;
  const n = Number(count) || 0;
  if (!Array.isArray(groups) || groups.length === 0) {
    return Math.ceil(n / c) * s;
  }
  let total = 0;
  for (const g of groups) {
    total += h + Math.ceil((Number(g.count) || 0) / c) * s;
  }
  return total;
}

function findGroupedRange (count, cols, stride, groups, headerPx, rangeTop, rangeBottom) {
  const n = Number(count) || 0;
  const c = Math.max(1, Number(cols) || 1);
  const s = Math.max(1, Number(stride) || 1);
  const h = Number(headerPx) || 0;
  let start = n;
  let end = 0;
  let y = 0;
  for (const g of groups) {
    const offset = Number(g.offset) || 0;
    const gCount = Number(g.count) || 0;
    const rows = Math.ceil(gCount / c);
    const groupEndY = y + h + rows * s;
    if (gCount > 0 && groupEndY > rangeTop && y < rangeBottom) {
      const cardsY = y + h;
      const relTop = rangeTop - cardsY;
      const relBottom = rangeBottom - cardsY;
      let firstRow = relTop <= 0 ? 0 : Math.floor(relTop / s);
      let lastRow = relBottom <= 0 ? -1 : Math.floor((relBottom - 1) / s);
      if (firstRow < 0) firstRow = 0;
      if (lastRow >= rows) lastRow = rows - 1;
      if (lastRow >= firstRow && firstRow < rows) {
        const gStart = Math.min(n, offset + firstRow * c);
        const gEnd = Math.min(n, offset + gCount, offset + (lastRow + 1) * c);
        if (gStart < gEnd) {
          if (gStart < start) start = gStart;
          if (gEnd > end) end = gEnd;
        }
      }
    }
    y = groupEndY;
    if (y >= rangeBottom) break;
  }
  if (start >= n || end <= start) return { start: 0, end: 0 };
  return { start, end };
}

function groupedRenderedSpan (start, end, cols, stride, groups, headerPx) {
  const c = Math.max(1, Number(cols) || 1);
  const s = Math.max(1, Number(stride) || 1);
  const h = Number(headerPx) || 0;
  let span = 0;
  if (!Array.isArray(groups)) return span;
  for (const g of groups) {
    const offset = Number(g.offset) || 0;
    const count = Number(g.count) || 0;
    const gStart = Math.max(start, offset);
    const gEnd = Math.min(end, offset + count);
    if (gEnd <= gStart) continue;
    span += h;
    const firstRow = Math.floor((gStart - offset) / c);
    const lastRow = Math.floor((gEnd - 1 - offset) / c);
    span += (lastRow - firstRow + 1) * s;
  }
  return span;
}

export function cardWindow ({ count, cols, stride, scrollY, gridDocTop, viewHeight, overscanRows, groups, headerPx }) {
  const n = Number(count) || 0;
  if (n === 0) return { start: 0, end: 0, topPad: 0, bottomPad: 0 };

  const c = Math.max(1, Number(cols) || 1);
  const s = Math.max(1, Number(stride) || 1);
  const over = overscanRows ?? CARD_OVERSCAN_ROWS;
  const viewTop = (Number(scrollY) || 0) - (Number(gridDocTop) || 0);
  const vh = Number(viewHeight) || 0;

  if (Array.isArray(groups) && groups.length > 0) {
    const h = Number(headerPx) || 0;
    const rangeTop = Math.max(0, viewTop) - over * s;
    const rangeBottom = Math.max(0, viewTop) + vh + over * s;
    const { start, end } = findGroupedRange(n, c, s, groups, h, rangeTop, rangeBottom);
    if (end <= start) return { start: 0, end: 0, topPad: 0, bottomPad: totalContentHeight(n, c, s, groups, h) };
    const yStart = contentY(start, c, s, groups, h);
    const topPad = Math.max(0, yStart - h);
    const rendered = groupedRenderedSpan(start, end, c, s, groups, h);
    const total = totalContentHeight(n, c, s, groups, h);
    const bottomPad = Math.max(0, total - topPad - rendered);
    return { start, end, topPad, bottomPad };
  }

  const rowAtTop = Math.floor(Math.max(0, viewTop) / s);
  const rowAtBottom = Math.floor(Math.max(0, viewTop + vh - 1) / s);
  const firstRow = Math.max(0, rowAtTop - over);
  const lastRow = Math.min(Math.ceil(n / c) - 1, rowAtBottom + over);
  const start = firstRow * c;
  const end = Math.min(n, (lastRow + 1) * c);
  const topPad = firstRow * s;
  const bottomPad = Math.max(0, (Math.ceil(n / c) - (lastRow + 1)) * s);
  return { start, end, topPad, bottomPad };
}
