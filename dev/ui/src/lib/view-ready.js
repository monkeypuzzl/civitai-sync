// Sticky grain is a Posts / Generations / Comics list fact. Other pages
// mount when their script is loaded.

export function viewWaitsForStickyPrefs (chunkKey) {
  return chunkKey === 'generations' || chunkKey === 'posts' || chunkKey === 'comics';
}
