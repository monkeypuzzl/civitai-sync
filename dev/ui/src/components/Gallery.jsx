import { GalleryItem } from './GalleryItem.jsx';

export function Gallery ({ items, onItemClick, sentinelRef, loading, hasMore, search }) {
  if (!items.length && !loading) {
    return (
      <div class="empty-state">
        <h2>No results</h2>
        <p>Try adjusting your filters or search query.</p>
      </div>
    );
  }

  return (
    <>
      <div class="gallery-grid">
        {items.map((item, i) => (
          <GalleryItem key={item.id} item={item} onClick={() => onItemClick(i)} search={search} />
        ))}
      </div>
      <div ref={sentinelRef} class="gallery-sentinel" />
      {loading && (
        <div class="loading-bar"><div class="spinner" /></div>
      )}
    </>
  );
}
