// Intra-view grain prune. Same-view View toggles do not run Option F;
// this overlay drops keys that are meaningless on the destination grain.
// Return only keys to spread into updateUrl — keep q / publication / tag /
// reaction / type / scope / When by not touching them. A typed `engagement=`
// is a retired key: media grain clears it so it does not sit on the URL.

const HEART_SORT_FIELDS = new Set([
  'hearts', 'likes', 'dislikes', 'comments', 'collected'
]);
const CONTAINER_GRAINS = new Set(['post', 'comic', 'batch']);

export function pruneGrainParams (grain, state = {}) {
  const overlay = {};
  if (grain === 'media') {
    overlay.engagement = null;
    const field = String(state.sort || '').split(':')[0];
    if (HEART_SORT_FIELDS.has(field)) overlay.sort = 'date:desc';
  } else if (CONTAINER_GRAINS.has(grain)) {
    overlay.select = '';
  }
  return overlay;
}
