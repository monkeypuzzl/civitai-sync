import {
  M,
  MemoMediaTile
} from "./chunk-MY736RCS.js";
import {
  consumeGalleryFocus,
  packedFocusScrollTop
} from "./chunk-DDUI6F2D.js";
import {
  A,
  T,
  _2 as _,
  d,
  u
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/lib/justified-layout.js
function resolveRatio(ratio) {
  const r = Number(ratio);
  return Number.isFinite(r) && r > 0 ? r : 1;
}
function integerFillWidths(ratios, available, rowH) {
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
function packRows(slice, { containerWidth, gap, targetRowHeight, startY, positions, holdWidow }) {
  let y = startY;
  const row = [];
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
      const scale = targetRowHeight * sumRatio > 0 ? available / (targetRowHeight * sumRatio) : 1;
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
function shouldHoldWidow({ itemCount, hasMore, groups } = {}) {
  if (!hasMore) return false;
  const list = Array.isArray(groups) ? groups : [];
  if (!list.length) return true;
  const n = Number(itemCount);
  let last = null;
  for (const g of list) {
    const offset2 = Number(g?.offset);
    if (Number.isFinite(offset2) && offset2 < n) last = g;
  }
  if (!last) return false;
  const offset = Number(last.offset);
  const count = Number(last.count);
  const sliceEnd = offset + (Number.isFinite(count) && count > 0 ? count : 0);
  return n < sliceEnd;
}
function layoutJustified(items, {
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
    const packed2 = packRows(list, { ...packOpts, startY: 0, holdWidow: !!holdWidow });
    return { positions, headers, height: packed2.y, held: packed2.held };
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
function lowerBound(n, pred) {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (pred(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
function intersects(y, h, rangeStart, rangeEnd) {
  return y < rangeEnd && y + h > rangeStart;
}
function packedViewTop(galleryWindowTop, headerHeight = 0) {
  const top = Number(galleryWindowTop);
  const header = Number(headerHeight);
  if (!Number.isFinite(top)) return 0;
  const h = Number.isFinite(header) && header > 0 ? header : 0;
  return Math.max(0, -(top + h));
}
function visibleWindow(layout, { viewTop = 0, viewHeight = 0, overscanPx = 0 } = {}) {
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
    return height > 0 ? { ...zeros, bottomPad: height } : zeros;
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
    const origin = height > 0 ? Math.max(0, Math.min(height, viewTop)) : 0;
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

// dev/ui/src/hooks/useVirtualGallery.js
var FALLBACK_COLUMNS = 6;
var FALLBACK_GAP = 8;
var FALLBACK_HEADER = 40;
var STARTER_END = 48;
var EMPTY_ITEMS = [];
function itemRatio(item) {
  const m = item && item.media && item.media[0];
  const w = Number(m && m.width);
  const h = Number(m && m.height);
  return w > 0 && h > 0 ? w / h : 1;
}
function readCssMetrics(windowEl) {
  const cs = getComputedStyle(windowEl);
  const cols = parseFloat(cs.getPropertyValue("--gallery-cols")) || FALLBACK_COLUMNS;
  const gap = parseFloat(cs.getPropertyValue("--gallery-gap")) || FALLBACK_GAP;
  return { cols, gap };
}
function useVirtualGallery({ items, groupsMeta, hasMore }) {
  const containerRef = A(null);
  const list = Array.isArray(items) ? items : EMPTY_ITEMS;
  const count = list.length;
  const grouped = Array.isArray(groupsMeta) && groupsMeta.length > 0;
  const holdWidow = shouldHoldWidow({
    itemCount: list.length,
    hasMore: !!hasMore,
    groups: grouped ? groupsMeta : void 0
  });
  const [viewport, setViewport] = d(() => ({
    containerWidth: 0,
    cols: FALLBACK_COLUMNS,
    gap: FALLBACK_GAP,
    headerHeight: grouped ? FALLBACK_HEADER : 0,
    viewTop: 0,
    viewHeight: 0
  }));
  const layout = T(() => {
    const { containerWidth, gap, cols, headerHeight } = viewport;
    if (containerWidth <= 0) return { positions: [], headers: [], height: 0 };
    const targetRowHeight = (containerWidth - gap * (cols - 1)) / cols;
    if (targetRowHeight <= 0) return { positions: [], headers: [], height: 0 };
    const packItems = list.map((item, index) => ({ index, ratio: itemRatio(item) }));
    return layoutJustified(packItems, {
      containerWidth,
      gap,
      targetRowHeight,
      groups: grouped ? groupsMeta : void 0,
      headerHeight: grouped ? headerHeight : 0,
      holdWidow
    });
  }, [list, groupsMeta, grouped, viewport.containerWidth, viewport.gap, viewport.cols, viewport.headerHeight, hasMore, holdWidow]);
  const metrics = T(() => {
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
  _(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    function measure() {
      raf = 0;
      const { cols, gap } = readCssMetrics(el);
      const masonry = el.querySelector(".gallery-masonry");
      const containerWidth = masonry ? masonry.clientWidth : el.clientWidth;
      let headerHeight = 0;
      if (grouped) {
        const headers = el.querySelectorAll(".gallery-group-header");
        let sticky = null;
        for (const node of headers) {
          if (!node.classList.contains("gallery-masonry-header")) {
            sticky = node;
            break;
          }
        }
        headerHeight = sticky ? Math.round(sticky.getBoundingClientRect().height) : FALLBACK_HEADER;
      }
      const viewTop = Math.round(packedViewTop(el.getBoundingClientRect().top, headerHeight));
      const viewHeight = window.innerHeight;
      setViewport((prev) => {
        const next = { containerWidth, cols, gap, headerHeight, viewTop, viewHeight };
        if (prev.containerWidth === next.containerWidth && prev.cols === next.cols && prev.gap === next.gap && prev.headerHeight === next.headerHeight && prev.viewTop === next.viewTop && prev.viewHeight === next.viewHeight) {
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
    if (ro) ro.observe(el);
    measure();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [list, groupsMeta, grouped, count]);
  return { containerRef, ...metrics, layout, measured: viewport.containerWidth > 0 };
}

// dev/ui/src/components/Gallery.jsx
function GalleryInner({ items, groupsMeta, onItemActivate, selectedIds, sentinelRef, search, loading, hasMore, pending = false, hrefFor, grain }) {
  const {
    containerRef,
    startIndex,
    endIndex,
    topPad,
    bottomPad,
    originY,
    sliceHeight,
    layout,
    measured
  } = useVirtualGallery({ items, groupsMeta, hasMore });
  const count = items ? items.length : 0;
  const grouped = Array.isArray(groupsMeta) && groupsMeta.length > 0;
  const isEmpty = !items || items.length === 0;
  const packed = layout && Array.isArray(layout.positions) && layout.positions.length > 0;
  _(() => {
    if (!measured || !packed) return;
    consumeGalleryFocus({
      root: containerRef.current,
      items,
      hasMore,
      pending,
      packedSeek(id, focus) {
        const idx = Array.isArray(items) ? items.findIndex((it) => it && String(it.id) === String(id)) : -1;
        const pos = layout && Array.isArray(layout.positions) ? layout.positions.find((p) => p.index === idx) : null;
        const masonry = containerRef.current && containerRef.current.querySelector(".gallery-masonry");
        if (!pos || !masonry) return;
        const masonryDocTop = masonry.getBoundingClientRect().top + window.scrollY;
        const y = typeof focus.y === "number" ? focus.y : 0;
        const top = packedFocusScrollTop({
          masonryDocTop,
          originY: originY || 0,
          tileY: pos.y,
          y,
          viewHeight: window.innerHeight
        });
        if (Math.abs(top - window.scrollY) < 1) return;
        window.scrollTo(0, top);
      }
    });
  }, [measured, packed, items, hasMore, pending, layout, originY, containerRef]);
  if (isEmpty) {
    if (loading) return null;
    return /* @__PURE__ */ u("div", { class: "empty-state", children: [
      /* @__PURE__ */ u("h2", { children: "No results" }),
      /* @__PURE__ */ u("p", { children: "Try adjusting your filters or search query." })
    ] });
  }
  const start = Math.max(0, Math.min(startIndex, count));
  let end = Math.max(start, Math.min(endIndex, count));
  if (!packed) end = start;
  const currentGroup = grouped ? groupsMeta.find((g) => start >= g.offset && start < g.offset + g.count) : null;
  const origin = originY || 0;
  const posMap = [];
  if (packed) {
    for (const p of layout.positions) posMap[p.index] = p;
  }
  const masonryHeaders = grouped && packed ? (layout.headers || []).filter((h) => {
    const fromHeader = Number(h.offset);
    const offset = Number.isFinite(fromHeader) ? fromHeader : (groupsMeta.find((g) => (g.key || "_") === (h.key || "_")) || {}).offset;
    return offset > start && offset < end;
  }) : [];
  const cells = [];
  for (let i = start; i < end; i++) {
    const pos = posMap[i];
    if (!pos) continue;
    const item = items[i];
    cells.push(
      /* @__PURE__ */ u(
        "div",
        {
          class: "gallery-cell",
          "data-focus-id": item.id,
          style: {
            left: pos.x,
            top: pos.y - origin,
            width: pos.w,
            height: pos.h
          },
          children: /* @__PURE__ */ u(
            MemoMediaTile,
            {
              item,
              grain,
              href: hrefFor ? hrefFor(item, i) : void 0,
              selected: selectedIds ? selectedIds.has(item.id) : false,
              onActivate: onItemActivate ? (e, it) => {
                onItemActivate(e, it, i, {
                  firstId: items[start]?.id,
                  lastId: items[Math.max(start, end - 1)]?.id
                });
              } : void 0,
              search
            }
          )
        },
        item.id
      )
    );
  }
  return /* @__PURE__ */ u("div", { class: "gallery-window", ref: containerRef, children: [
    currentGroup && /* @__PURE__ */ u("h2", { class: "gallery-group-header", children: [
      currentGroup.label,
      " ",
      /* @__PURE__ */ u("span", { class: "gallery-group-count", children: currentGroup.count })
    ] }),
    /* @__PURE__ */ u("div", { class: "gallery-pad", style: { height: topPad }, "aria-hidden": "true" }),
    /* @__PURE__ */ u("div", { class: "gallery-masonry", style: { height: packed ? sliceHeight : 0 }, children: [
      masonryHeaders.map((h) => /* @__PURE__ */ u(
        "h2",
        {
          class: "gallery-group-header gallery-masonry-header",
          style: {
            top: h.y - origin,
            height: h.h,
            left: 0,
            right: 0
          },
          children: [
            h.label,
            " ",
            /* @__PURE__ */ u("span", { class: "gallery-group-count", children: h.count })
          ]
        },
        `h-${h.key || "_"}`
      )),
      cells
    ] }),
    /* @__PURE__ */ u("div", { class: "gallery-pad", style: { height: bottomPad }, "aria-hidden": "true" }),
    measured && (packed || hasMore && items.length > 0) ? /* @__PURE__ */ u("div", { ref: sentinelRef, class: "gallery-sentinel" }) : null
  ] });
}
var Gallery = M(GalleryInner);

export {
  Gallery
};
