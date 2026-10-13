import { useState, useLayoutEffect, useRef, useMemo } from 'preact/hooks';
import { layoutJustified, packedViewTop, shouldHoldWidow, visibleWindow } from '../lib/justified-layout.js';

// Window a justified-row gallery into a visible-range + overscan slice.
// Packing is memoized on items / groups / measured width / cols / gap /
// headerHeight / hasMore — not on every scroll. Scroll/resize stay rAF-throttled;
// the gallery lives in the page (window listeners), not a nested scroller.
//
// cols and gap come from --gallery-cols / --gallery-gap on `.gallery-window`
// so breakpoints stay in CSS. Cell coordinates come from layoutJustified
// over produced-pixel ratios (1 when width/height are missing).

const FALLBACK_COLUMNS = 6;
const FALLBACK_GAP = 8;
const FALLBACK_HEADER = 40;
const STARTER_END = 48;
const EMPTY_ITEMS = [];

function itemRatio (item) {
  const m = item && item.media && item.media[0];
  const w = Number(m && m.width);
  const h = Number(m && m.height);
  return (w > 0 && h > 0) ? w / h : 1;
}

function readCssMetrics (windowEl) {
  const cs = getComputedStyle(windowEl);
  const cols = parseFloat(cs.getPropertyValue('--gallery-cols')) || FALLBACK_COLUMNS;
  const gap = parseFloat(cs.getPropertyValue('--gallery-gap')) || FALLBACK_GAP;
  return { cols, gap };
}

export function useVirtualGallery ({ items, groupsMeta, hasMore }) {
  const containerRef = useRef(null);
  const list = Array.isArray(items) ? items : EMPTY_ITEMS;
  const count = list.length;
  const grouped = Array.isArray(groupsMeta) && groupsMeta.length > 0;
  const holdWidow = shouldHoldWidow({
    itemCount: list.length,
    hasMore: !!hasMore,
    groups: grouped ? groupsMeta : undefined
  });

  const [viewport, setViewport] = useState(() => ({
    containerWidth: 0,
    cols: FALLBACK_COLUMNS,
    gap: FALLBACK_GAP,
    headerHeight: grouped ? FALLBACK_HEADER : 0,
    viewTop: 0,
    viewHeight: 0
  }));

  const layout = useMemo(() => {
    const { containerWidth, gap, cols, headerHeight } = viewport;
    if (containerWidth <= 0) return { positions: [], headers: [], height: 0 };
    const targetRowHeight = (containerWidth - gap * (cols - 1)) / cols;
    if (targetRowHeight <= 0) return { positions: [], headers: [], height: 0 };
    const packItems = list.map((item, index) => ({ index, ratio: itemRatio(item) }));
    return layoutJustified(packItems, {
      containerWidth,
      gap,
      targetRowHeight,
      groups: grouped ? groupsMeta : undefined,
      headerHeight: grouped ? headerHeight : 0,
      holdWidow
    });
  }, [list, groupsMeta, grouped, viewport.containerWidth, viewport.gap, viewport.cols, viewport.headerHeight, hasMore, holdWidow]);

  const metrics = useMemo(() => {
    const { containerWidth, gap, cols, viewTop, viewHeight } = viewport;
    if (containerWidth <= 0) {
      return {
        startIndex: 0,
        endIndex: Math.min(count, STARTER_END),
        topPad: 0,
        bottomPad: 0,
        originY: 0,
        sliceHeight: 0
      };
    }
    const targetRowHeight = (containerWidth - gap * (cols - 1)) / cols;
    return visibleWindow(layout, {
      viewTop,
      viewHeight,
      overscanPx: 3 * targetRowHeight
    });
  }, [layout, viewport.containerWidth, viewport.gap, viewport.cols, viewport.viewTop, viewport.viewHeight, count]);

  // Layout effect so the first paint is packed: a 0-height masonry would
  // leave the infinite-scroll sentinel in view (rootMargin 400px) and
  // chain-load pages before measure.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;

    function measure () {
      raf = 0;
      const { cols, gap } = readCssMetrics(el);
      const masonry = el.querySelector('.gallery-masonry');
      const containerWidth = masonry ? masonry.clientWidth : el.clientWidth;
      let headerHeight = 0;
      if (grouped) {
        const headers = el.querySelectorAll('.gallery-group-header');
        let sticky = null;
        for (const node of headers) {
          if (!node.classList.contains('gallery-masonry-header')) {
            sticky = node;
            break;
          }
        }
        headerHeight = sticky ? Math.round(sticky.getBoundingClientRect().height) : FALLBACK_HEADER;
      }
      // Measure from `.gallery-window`, not masonry/pads. Those shift when
      // topPad grows and would collapse viewTop on the next frame (crawl).
      const viewTop = Math.round(packedViewTop(el.getBoundingClientRect().top, headerHeight));
      const viewHeight = window.innerHeight;
      setViewport((prev) => {
        const next = { containerWidth, cols, gap, headerHeight, viewTop, viewHeight };
        if (
          prev.containerWidth === next.containerWidth &&
          prev.cols === next.cols &&
          prev.gap === next.gap &&
          prev.headerHeight === next.headerHeight &&
          prev.viewTop === next.viewTop &&
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
    if (ro) ro.observe(el);
    measure();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [list, groupsMeta, grouped, count]);

  return { containerRef, ...metrics, layout, measured: viewport.containerWidth > 0 };
}
