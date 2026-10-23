import {
  consumeGalleryFocus,
  findFocusElement
} from "./chunk-5C3I5ONU.js";
import {
  A,
  T,
  _2 as _,
  d
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/lib/card-window.js
var CARD_INFO_ESTIMATE_PX = 88;
var CARD_HEADER_FALLBACK_PX = 40;
var CARD_OVERSCAN_ROWS = 2;
var CARD_STRIDE_CORRECTIONS = 2;
function cardStride({ colWidth, aspect, infoPx, gap }) {
  const ratio = Number(aspect) > 0 ? Number(aspect) : 1;
  const thumb = (Number(colWidth) || 0) / ratio;
  return thumb + (Number(infoPx) || 0) + (Number(gap) || 0);
}
function contentY(index, cols, stride, groups, headerPx) {
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
function cardFocusTop({ index, cols, stride, groups, headerPx, gridDocTop, y, viewHeight }) {
  const ratio = typeof y === "number" ? y : 0;
  const vh = Number(viewHeight) || 0;
  return Math.max(0, (Number(gridDocTop) || 0) + contentY(index, cols, stride, groups, headerPx) - ratio * vh);
}
function totalContentHeight(count, cols, stride, groups, headerPx) {
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
function findGroupedRange(count, cols, stride, groups, headerPx, rangeTop, rangeBottom) {
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
function groupedRenderedSpan(start, end, cols, stride, groups, headerPx) {
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
function cardWindow({ count, cols, stride, scrollY, gridDocTop, viewHeight, overscanRows, groups, headerPx }) {
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
    const { start: start2, end: end2 } = findGroupedRange(n, c, s, groups, h, rangeTop, rangeBottom);
    if (end2 <= start2) return { start: 0, end: 0, topPad: 0, bottomPad: totalContentHeight(n, c, s, groups, h) };
    const yStart = contentY(start2, c, s, groups, h);
    const topPad2 = Math.max(0, yStart - h);
    const rendered = groupedRenderedSpan(start2, end2, c, s, groups, h);
    const total = totalContentHeight(n, c, s, groups, h);
    const bottomPad2 = Math.max(0, total - topPad2 - rendered);
    return { start: start2, end: end2, topPad: topPad2, bottomPad: bottomPad2 };
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

// dev/ui/src/hooks/useCardWindow.js
var FALLBACK_COLUMNS = 6;
var FALLBACK_GAP = 8;
var STARTER_END = 24;
var EMPTY_ITEMS = [];
function readCssMetrics(gridEl) {
  if (!gridEl) return { cols: FALLBACK_COLUMNS, gap: FALLBACK_GAP };
  const cs = getComputedStyle(gridEl);
  const cols = parseFloat(cs.getPropertyValue("--gallery-cols")) || FALLBACK_COLUMNS;
  const gap = parseFloat(cs.getPropertyValue("--gallery-gap")) || FALLBACK_GAP;
  return { cols, gap };
}
function measureStride(rootEl, gap) {
  if (!rootEl) return null;
  const cards = rootEl.querySelectorAll(".post-card");
  if (!cards.length) return null;
  let sum = 0;
  let n = 0;
  for (const card of cards) {
    const h = card.offsetHeight;
    if (h > 0) {
      sum += h;
      n += 1;
    }
  }
  if (!n) return null;
  return sum / n + (Number(gap) || 0);
}
function contentDocTop(root) {
  if (!root) return 0;
  const pad = root.querySelector(".gallery-pad");
  if (pad) return pad.getBoundingClientRect().top + window.scrollY;
  const grid = root.querySelector(".gallery-grid");
  if (grid) return grid.getBoundingClientRect().top + window.scrollY;
  return root.getBoundingClientRect().top + window.scrollY;
}
function useCardWindow({ items, groupsMeta, hasMore, loading, pending = false }) {
  const rootRef = A(null);
  const gridRef = A(null);
  const list = Array.isArray(items) ? items : EMPTY_ITEMS;
  const count = list.length;
  const groups = Array.isArray(groupsMeta) && groupsMeta.length > 0 ? groupsMeta : null;
  const grouped = !!groups;
  const [viewport, setViewport] = d(() => ({
    cols: FALLBACK_COLUMNS,
    gap: FALLBACK_GAP,
    colWidth: 0,
    headerPx: grouped ? CARD_HEADER_FALLBACK_PX : 0,
    scrollY: 0,
    gridDocTop: 0,
    viewHeight: typeof window !== "undefined" ? window.innerHeight : 0
  }));
  const [strideOverride, setStrideOverride] = d(null);
  const correctionsRef = A({ id: null, count: 0 });
  const stride = T(() => {
    if (strideOverride != null && strideOverride > 0) return strideOverride;
    if (viewport.colWidth <= 0) return 0;
    return cardStride({
      colWidth: viewport.colWidth,
      aspect: 1,
      infoPx: CARD_INFO_ESTIMATE_PX,
      gap: viewport.gap
    });
  }, [viewport.colWidth, viewport.gap, strideOverride]);
  const windowMetrics = T(() => {
    if (viewport.colWidth <= 0 || stride <= 0) {
      return {
        start: 0,
        end: Math.min(count, STARTER_END),
        topPad: 0,
        bottomPad: 0
      };
    }
    return cardWindow({
      count,
      cols: viewport.cols,
      stride,
      scrollY: viewport.scrollY,
      gridDocTop: viewport.gridDocTop,
      viewHeight: viewport.viewHeight,
      overscanRows: CARD_OVERSCAN_ROWS,
      groups: groups || void 0,
      headerPx: viewport.headerPx
    });
  }, [count, viewport.cols, stride, viewport.scrollY, viewport.gridDocTop, viewport.viewHeight, viewport.headerPx, groups]);
  const groupLayout = T(() => {
    const { start, end, topPad, bottomPad } = windowMetrics;
    if (!grouped) {
      return {
        start,
        end,
        topPad,
        bottomPad,
        sections: null,
        outerTopPad: topPad,
        outerBottomPad: bottomPad
      };
    }
    const c = Math.max(1, viewport.cols);
    const s = Math.max(1, stride || 1);
    const h = viewport.headerPx || CARD_HEADER_FALLBACK_PX;
    const sections = [];
    let outerTopPad = 0;
    let first = true;
    for (const g of groups) {
      const offset = Number(g.offset) || 0;
      const gCount = Number(g.count) || 0;
      if (end <= offset) break;
      if (start >= offset + gCount) {
        outerTopPad += h + Math.ceil(gCount / c) * s;
        continue;
      }
      const gStart = Math.max(start, offset);
      const gEnd = Math.min(end, offset + gCount);
      const innerPad = first ? Math.floor((gStart - offset) / c) * s : 0;
      first = false;
      sections.push({ group: g, start: gStart, end: gEnd, innerPad });
    }
    const total = groups.reduce((sum, g) => {
      return sum + h + Math.ceil((Number(g.count) || 0) / c) * s;
    }, 0);
    let rendered = 0;
    for (const sec of sections) {
      rendered += h + sec.innerPad;
      const off = Number(sec.group.offset) || 0;
      const rows = Math.floor((sec.end - 1 - off) / c) - Math.floor((sec.start - off) / c) + 1;
      rendered += Math.max(0, rows) * s;
    }
    return {
      start,
      end,
      topPad,
      bottomPad,
      sections,
      outerTopPad,
      outerBottomPad: Math.max(0, total - outerTopPad - rendered)
    };
  }, [grouped, groups, windowMetrics, viewport.cols, viewport.headerPx, stride]);
  _(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    function measure() {
      raf = 0;
      const grid = gridRef.current || root.querySelector(".gallery-grid");
      const { cols, gap } = readCssMetrics(grid);
      const colWidth = grid && grid.clientWidth > 0 ? (grid.clientWidth - gap * (cols - 1)) / cols : 0;
      let headerPx = grouped ? CARD_HEADER_FALLBACK_PX : 0;
      if (grouped) {
        const header = root.querySelector(".gallery-group-header");
        if (header) {
          headerPx = Math.round(header.getBoundingClientRect().height) || CARD_HEADER_FALLBACK_PX;
        }
      }
      const gridDocTop = contentDocTop(root);
      setViewport((prev) => {
        const next = {
          cols,
          gap,
          colWidth,
          headerPx,
          scrollY: window.scrollY,
          gridDocTop,
          viewHeight: window.innerHeight
        };
        if (prev.cols === next.cols && prev.gap === next.gap && prev.colWidth === next.colWidth && prev.headerPx === next.headerPx && prev.scrollY === next.scrollY && prev.gridDocTop === next.gridDocTop && prev.viewHeight === next.viewHeight) {
          return prev;
        }
        return next;
      });
    }
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(onScroll) : null;
    if (ro) ro.observe(root);
    measure();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [list, groupsMeta, grouped, count]);
  _(() => {
    const root = rootRef.current;
    if (!root) return;
    if (loading && list.length === 0) return;
    const headerPx = viewport.headerPx;
    const cols = viewport.cols;
    const gap = viewport.gap;
    consumeGalleryFocus({
      root,
      items: list,
      hasMore,
      pending,
      packedSeek(id, focus) {
        const index = list.findIndex((it) => it && String(it.id) === String(id));
        if (index < 0) return;
        const grid = gridRef.current || root.querySelector(".gallery-grid");
        if (!grid || stride <= 0) return;
        const focusKey = focus && focus.id != null ? String(focus.id) : null;
        if (correctionsRef.current.id !== focusKey) {
          correctionsRef.current = { id: focusKey, count: 0 };
        }
        if (correctionsRef.current.count >= CARD_STRIDE_CORRECTIONS) return;
        const gridDocTop = contentDocTop(root);
        const top = cardFocusTop({
          index,
          cols,
          stride,
          groups: groups || void 0,
          headerPx,
          gridDocTop,
          y: focus.y,
          viewHeight: window.innerHeight
        });
        if (Math.abs(top - window.scrollY) < 1) {
          if (!findFocusElement(root, id) && correctionsRef.current.count < CARD_STRIDE_CORRECTIONS) {
            const measured = measureStride(root, gap);
            if (measured != null && measured > 0) {
              correctionsRef.current.count += 1;
              setStrideOverride(measured);
            }
          }
          return;
        }
        window.scrollTo(0, top);
      }
    });
  }, [list, hasMore, pending, loading, stride, viewport.cols, viewport.headerPx, viewport.gap, groups, groupLayout.start, groupLayout.end]);
  return {
    rootRef,
    gridRef,
    start: groupLayout.start,
    end: groupLayout.end,
    topPad: groupLayout.topPad,
    bottomPad: groupLayout.bottomPad,
    outerTopPad: groupLayout.outerTopPad,
    outerBottomPad: groupLayout.outerBottomPad,
    sections: groupLayout.sections,
    cols: viewport.cols,
    stride,
    headerPx: viewport.headerPx,
    grouped
  };
}

export {
  useCardWindow
};
