import { memo } from 'preact/compat';
import { useLayoutEffect } from 'preact/hooks';
import { MediaTile } from './MediaTile.jsx';
import { useVirtualGallery } from '../hooks/useVirtualGallery.js';
import { consumeGalleryFocus } from '../lib/open-origin-node.js';
import { packedFocusScrollTop } from '../lib/gallery-focus.js';

// Windowed justified gallery: only visible+overscan tiles are mounted.
// Group headers in the pack sit at layout.headers Y; the sticky current
// group stays in flow above the pads. The IntersectionObserver sentinel
// (passed in) still drives `loadMore`; virtualization governs only what
// is mounted.
function GalleryInner ({ items, groupsMeta, onItemActivate, selectedIds, sentinelRef, search, loading, hasMore, pending = false, hrefFor, grain }) {
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

  useLayoutEffect(() => {
    if (!measured || !packed) return;
    consumeGalleryFocus({
      root: containerRef.current,
      items,
      hasMore,
      pending,
      packedSeek (id, focus) {
        const idx = Array.isArray(items) ? items.findIndex(it => it && String(it.id) === String(id)) : -1;
        const pos = layout && Array.isArray(layout.positions)
          ? layout.positions.find(p => p.index === idx)
          : null;
        const masonry = containerRef.current && containerRef.current.querySelector('.gallery-masonry');
        if (!pos || !masonry) return;
        const masonryDocTop = masonry.getBoundingClientRect().top + window.scrollY;
        const y = typeof focus.y === 'number' ? focus.y : 0;
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
    return (
      <div class="empty-state">
        <h2>No results</h2>
        <p>Try adjusting your filters or search query.</p>
      </div>
    );
  }

  const start = Math.max(0, Math.min(startIndex, count));
  let end = Math.max(start, Math.min(endIndex, count));
  // Prefer packed boxes. Without a layout (containerWidth still 0) skip
  // tiles and let ResizeObserver fire — do not mount a starter 48.
  if (!packed) end = start;

  const currentGroup = grouped
    ? groupsMeta.find(g => start >= g.offset && start < g.offset + g.count)
    : null;

  const origin = originY || 0;
  const posMap = [];
  if (packed) {
    for (const p of layout.positions) posMap[p.index] = p;
  }

  const masonryHeaders = grouped && packed
    ? (layout.headers || []).filter(h => {
      const fromHeader = Number(h.offset);
      const offset = Number.isFinite(fromHeader)
        ? fromHeader
        : (groupsMeta.find(g => (g.key || '_') === (h.key || '_')) || {}).offset;
      return offset > start && offset < end;
    })
    : [];

  const cells = [];
  for (let i = start; i < end; i++) {
    const pos = posMap[i];
    if (!pos) continue;
    const item = items[i];
    cells.push(
      <div
        class="gallery-cell"
        key={item.id}
        data-focus-id={item.id}
        style={{
          left: pos.x,
          top: pos.y - origin,
          width: pos.w,
          height: pos.h
        }}
      >
        <MediaTile
          item={item}
          grain={grain}
          href={hrefFor ? hrefFor(item, i) : undefined}
          selected={selectedIds ? selectedIds.has(item.id) : false}
          onActivate={onItemActivate ? (e, it) => {
            onItemActivate(e, it, i, {
              firstId: items[start]?.id,
              lastId: items[Math.max(start, end - 1)]?.id
            });
          } : undefined}
          search={search}
        />
      </div>
    );
  }

  return (
    <div class="gallery-window" ref={containerRef}>
      {currentGroup && (
        <h2 class="gallery-group-header">
          {currentGroup.label} <span class="gallery-group-count">{currentGroup.count}</span>
        </h2>
      )}
      <div class="gallery-pad" style={{ height: topPad }} aria-hidden="true" />
      <div class="gallery-masonry" style={{ height: packed ? sliceHeight : 0 }}>
        {masonryHeaders.map(h => (
          <h2
            class="gallery-group-header gallery-masonry-header"
            key={`h-${h.key || '_'}`}
            style={{
              top: h.y - origin,
              height: h.h,
              left: 0,
              right: 0
            }}
          >
            {h.label} <span class="gallery-group-count">{h.count}</span>
          </h2>
        ))}
        {cells}
      </div>
      <div class="gallery-pad" style={{ height: bottomPad }} aria-hidden="true" />
      {measured && (packed || (hasMore && items.length > 0))
        ? <div ref={sentinelRef} class="gallery-sentinel" />
        : null}
    </div>
  );
}

export const Gallery = memo(GalleryInner);
