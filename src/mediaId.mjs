// Shared media-item identity.
//
// The *normalized media-item id* is the single id-space for "the media item"
// across the whole Explorer: the index (`mediaItems[].id`), the override
// store (`src/overrides.mjs`), the reaction API, and Phase 3's `select=<id>`
// URL value all key on it. Keeping the function here (a leaf module) lets
// `overrides.mjs` reuse it without taking a dependency on the index.
// The filename helper lives in portableFileSegment.mjs so this module stays
// free of Node builtins. The Explorer bundle imports normalizeMediaId.

// The normalized id is the Civitai blob id with a trailing container suffix
// stripped. Civitai's media IDs gained `.jpeg`/`.mp4` suffixes around v5.1.0
// (see changelog.md). A mesh `output[].id` can end in `.glb`. Stripping makes
// the same media item dedupable across the generation `mediaId` form (string,
// sometimes with an extension) and the post `image.id` form (number), and
// keeps the media-page URL free of a file extension. A suffix that appears
// only on a sibling file (an FBX variant, a thumb) is not in this list.
// The UI copy lives in dev/ui/src/lib/format.js and must stay identical.

export const MEDIA_FILE_EXTS = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'mp4', 'webm', 'wav', 'mp3', 'flac', 'ogg', 'glb'];

export function normalizeMediaId (id) {
  const s = String(id ?? '');
  const dotIdx = s.lastIndexOf('.');
  if (dotIdx === -1) return s;
  const ext = s.slice(dotIdx + 1).toLowerCase();
  if (MEDIA_FILE_EXTS.includes(ext)) return s.slice(0, dotIdx);
  return s;
}
