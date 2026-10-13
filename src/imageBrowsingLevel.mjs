// Image-grain browsing level for the media page.
//
// A post or comic root is the bitwise OR of its children. The rating that
// belongs on one picture is the bit on that image row (post images[]) or
// on the comic panel's nested image. Container roots are not read.

import { browsingLevelOf } from './civitaiWire.mjs';
import { normalizeMediaId } from './mediaId.mjs';

function finiteLevel (record) {
  const level = browsingLevelOf(record);
  if (level == null || level === '') return undefined;
  const n = Number(level);
  return Number.isFinite(n) ? n : undefined;
}

function levelOfRow (record) {
  const level = finiteLevel(record);
  return level === undefined ? null : level;
}

function postImageLevel (post, want, indexInPost) {
  if (!post || !Array.isArray(post.images)) return undefined;
  for (const img of post.images) {
    if (!img || normalizeMediaId(img.id) !== want) continue;
    return levelOfRow(img);
  }
  // A published generation keeps its blob id. The post image id differs;
  // the container ref's 1-based slot is that row.
  const slot = Number(indexInPost);
  if (!Number.isInteger(slot) || slot < 1 || slot > post.images.length) return undefined;
  const img = post.images[slot - 1];
  if (!img) return undefined;
  return levelOfRow(img);
}

function panelMatches (panel, want) {
  const ids = [panel.imageId, panel.image && panel.image.id];
  if (panel.id != null) ids.push(`comic-panel:${panel.id}`);
  return ids.some(id => id != null && normalizeMediaId(id) === want);
}

function comicPanelLevel (comic, want, panelId) {
  const chapters = comic && Array.isArray(comic.chapters) ? comic.chapters : [];
  for (const chapter of chapters) {
    const panels = chapter && Array.isArray(chapter.panels) ? chapter.panels : [];
    for (const panel of panels) {
      if (!panel || !panelMatches(panel, want)) continue;
      return levelOfRow(panel.image);
    }
  }
  if (panelId == null) return undefined;
  for (const chapter of chapters) {
    const panels = chapter && Array.isArray(chapter.panels) ? chapter.panels : [];
    for (const panel of panels) {
      if (!panel || String(panel.id) !== String(panelId)) continue;
      return levelOfRow(panel.image);
    }
  }
  return undefined;
}

function asPost (entry) {
  if (entry && Object.prototype.hasOwnProperty.call(entry, 'doc')) {
    return { doc: entry.doc, indexInPost: entry.indexInPost };
  }
  return { doc: entry, indexInPost: undefined };
}

function asComic (entry) {
  if (entry && Object.prototype.hasOwnProperty.call(entry, 'doc')) {
    return { doc: entry.doc, panelId: entry.panelId };
  }
  return { doc: entry, panelId: undefined };
}

// `posts` / `comics` are saved documents, or `{ doc, indexInPost }` /
// `{ doc, panelId }` when the page id is a generation blob id. The first
// matching image row wins. An id match wins over the slot. A numeric level
// (including 0) stops the walk. A matching row with no bit returns null
// and does not fall through. No matching row returns null.
export function imageBrowsingLevel ({ mediaId, posts, comics } = {}) {
  const want = normalizeMediaId(mediaId);
  if (!want) return null;
  for (const entry of posts || []) {
    const { doc, indexInPost } = asPost(entry);
    const level = postImageLevel(doc, want, indexInPost);
    if (level !== undefined) return level;
  }
  for (const entry of comics || []) {
    const { doc, panelId } = asComic(entry);
    const level = comicPanelLevel(doc, want, panelId);
    if (level !== undefined) return level;
  }
  return null;
}
