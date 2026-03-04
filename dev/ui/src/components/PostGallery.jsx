import { PostCard } from './PostCard.jsx';

export function PostGallery ({ items, onItemClick, sentinelRef, loading, search }) {
  if (!items.length && !loading) {
    return (
      <div class="empty-state">
        <h2>No posts found</h2>
        <p>Try adjusting your filters or search query.</p>
      </div>
    );
  }

  return (
    <>
      <div class="gallery-grid">
        {items.map((item, i) => (
          <PostCard key={item.id} item={item} onClick={() => onItemClick(i)} search={search} />
        ))}
      </div>
      <div ref={sentinelRef} class="gallery-sentinel" />
      {loading && (
        <div class="loading-bar"><div class="spinner" /></div>
      )}
    </>
  );
}
