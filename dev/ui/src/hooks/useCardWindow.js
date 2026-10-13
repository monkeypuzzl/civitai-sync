import { useState, useLayoutEffect, useRef, useMemo } from 'preact/hooks';
import {
  CARD_HEADER_FALLBACK_PX,
  CARD_INFO_ESTIMATE_PX,
  CARD_OVERSCAN_ROWS,
  CARD_STRIDE_CORRECTIONS,
  cardFocusTop,
  cardStride,
  cardWindow
} from '../lib/card-window.js';
import { consumeGalleryFocus, findFocusElement } from '../lib/open-origin-node.js';

// Shared row window for PostGallery / ComicGallery. Scroll and resize only
// update the visible slice (rAF, no scrollTo). Restore scrolls separately.

const FALLBACK_COLUMNS = 6;
const FALLBACK_GAP = 8;
const STARTER_END = 24;
const EMPTY_ITEMS = [];

function readCssMetrics (gridEl) {
  if (!gridEl) return { cols: FALLBACK_COLUMNS, gap: FALLBACK_GAP };
  const cs = getComputedStyle(gridEl);
  const cols = parseFloat(cs.getPropertyValue('--gallery-cols')) || FALLBACK_COLUMNS;
  const gap = parseFloat(cs.getPropertyValue('--gallery-gap')) || FALLBACK_GAP;
  return { cols, gap };
}

function measureStride (rootEl, gap) {
  if (!rootEl) return null;
  const cards = rootEl.querySelectorAll('.post-card');
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
  return (sum / n) + (Number(gap) || 0);
}

// Document Y of content index 0 — the first pad (or grid when no pad).
function contentDocTop (root) {
  if (!root) return 0;
  const pad = root.querySelector('.gallery-pad');
  if (pad) return pad.getBoundingClientRect().top + window.scrollY;
  const grid = root.querySelector('.gallery-grid');
  if (grid) return grid.getBoundingClientRect().top + window.scrollY;
  return root.getBoundingClientRect().top + window.scrollY;
}

export function useCardWindow ({ items, groupsMeta, hasMore, loading, pending = false }) {
  const rootRef = useRef(null);
  const gridRef = useRef(null);
  const list = Array.isArray(items) ? items : EMPTY_ITEMS;
  const count = list.length;
  const groups = Array.isArray(groupsMeta) && groupsMeta.length > 0 ? groupsMeta : null;
  const grouped = !!groups;

  const [viewport, setViewport] = useState(() => ({
    cols: FALLBACK_COLUMNS,
    gap: FALLBACK_GAP,
    colWidth: 0,
    headerPx: grouped ? CARD_HEADER_FALLBACK_PX : 0,
    scrollY: 0,
    gridDocTop: 0,
    viewHeight: typeof window !== 'undefined' ? window.innerHeight : 0
  }));
  const [strideOverride, setStrideOverride] = useState(null);
  const correctionsRef = useRef({ id: null, count: 0 });

  const stride = useMemo(() => {
    if (strideOverride != null && strideOverride > 0) return strideOverride;
    if (viewport.colWidth <= 0) return 0;
    return cardStride({
      colWidth: viewport.colWidth,
      aspect: 1,
      infoPx: CARD_INFO_ESTIMATE_PX,
      gap: viewport.gap
    });
  }, [viewport.colWidth, viewport.gap, strideOverride]);

  const windowMetrics = useMemo(() => {
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
      groups: groups || undefined,
      headerPx: viewport.headerPx
    });
  }, [count, viewport.cols, stride, viewport.scrollY, viewport.gridDocTop, viewport.viewHeight, viewport.headerPx, groups]);

  const groupLayout = useMemo(() => {
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

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;

    function measure () {
      raf = 0;
      const grid = gridRef.current || root.querySelector('.gallery-grid');
      const { cols, gap } = readCssMetrics(grid);
      const colWidth = grid && grid.clientWidth > 0
        ? (grid.clientWidth - gap * (cols - 1)) / cols
        : 0;
      let headerPx = grouped ? CARD_HEADER_FALLBACK_PX : 0;
      if (grouped) {
        const header = root.querySelector('.gallery-group-header');
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
        if (
          prev.cols === next.cols &&
          prev.gap === next.gap &&
          prev.colWidth === next.colWidth &&
          prev.headerPx === next.headerPx &&
          prev.scrollY === next.scrollY &&
          prev.gridDocTop === next.gridDocTop &&
          prev.viewHeight === next.viewHeight
        ) {
          return prev;
        }
        return next;
      });
    }

    function onScroll () {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(onScroll) : null;
    if (ro) ro.observe(root);
    measure();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [list, groupsMeta, grouped, count]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // The first frame is items=[] and hasMore false (totalPages still 1).
    // Consuming there drops the stamp before the prefix arrives.
    if (loading && list.length === 0) return;
    const headerPx = viewport.headerPx;
    const cols = viewport.cols;
    const gap = viewport.gap;

    consumeGalleryFocus({
      root,
      items: list,
      hasMore,
      pending,
      packedSeek (id, focus) {
        const index = list.findIndex(it => it && String(it.id) === String(id));
        if (index < 0) return;
        const grid = gridRef.current || root.querySelector('.gallery-grid');
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
          groups: groups || undefined,
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
