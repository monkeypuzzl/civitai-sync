import { PostCard } from './PostCard.jsx';
import { useCardWindow } from '../hooks/useCardWindow.js';

// Renders posts flat OR, when `groupsMeta` is present, one sticky-headed
// section per group whose loaded prefix falls in the visible window.
// Mounts only [start, end); pads stand in for the rest.
export function PostGallery ({ items, groupsMeta, onItemActivate, onItemClick, sentinelRef, loading, search, hrefFor, hasMore, pending = false }) {
  const list = items || [];
  const isEmpty = list.length === 0;
  const activate = onItemActivate || (onItemClick
    ? (e, item, index, landmarks) => onItemClick(item, e, index, landmarks)
    : undefined);

  const {
    rootRef,
    gridRef,
    start,
    end,
    outerTopPad,
    outerBottomPad,
    sections,
    grouped
  } = useCardWindow({ items: list, groupsMeta, hasMore, loading, pending });

  if (isEmpty && !loading) {
    return (
      <div class="empty-state">
        <h2>No posts found</h2>
        <p>Try adjusting your filters or search query.</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div ref={rootRef}>
        <div ref={sentinelRef} class="gallery-sentinel" />
        {loading && (
          <div class="loading-bar"><div class="spinner" /></div>
        )}
      </div>
    );
  }

  const landmarks = {
    firstId: list[start]?.id,
    lastId: list[Math.max(start, end - 1)]?.id
  };

  const renderCard = (item, index) => (
    <PostCard
      key={item.id}
      item={item}
      href={hrefFor ? hrefFor(item, index) : undefined}
      onClick={activate ? (e) => {
        activate(e, item, index, landmarks);
      } : undefined}
      search={search}
    />
  );

  return (
    <div ref={rootRef}>
      <div class="gallery-pad" style={{ height: outerTopPad }} aria-hidden="true" />
      {grouped && sections ? (
        sections.map((sec, i) => (
          <section class="gallery-group" key={sec.group.key || '_'}>
            <h2 class="gallery-group-header">
              {sec.group.label} <span class="gallery-group-count">{sec.group.count}</span>
            </h2>
            {sec.innerPad > 0 ? (
              <div class="gallery-pad" style={{ height: sec.innerPad }} aria-hidden="true" />
            ) : null}
            <div class="gallery-grid" ref={i === 0 ? gridRef : undefined}>
              {list.slice(sec.start, sec.end).map((item, j) => renderCard(item, sec.start + j))}
            </div>
          </section>
        ))
      ) : (
        <div class="gallery-grid" ref={gridRef}>
          {list.slice(start, end).map((item, j) => renderCard(item, start + j))}
        </div>
      )}
      <div class="gallery-pad" style={{ height: outerBottomPad }} aria-hidden="true" />
      <div ref={sentinelRef} class="gallery-sentinel" />
      {loading && (
        <div class="loading-bar"><div class="spinner" /></div>
      )}
    </div>
  );
}
