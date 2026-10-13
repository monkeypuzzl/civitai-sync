// Container-internal member walk (media page meta). Last file does not wrap
// to another job. Cover/hero are not reading-order panels.

import { normalizeMediaId } from './format.js';

/**
 * Position of `currentId` in a container member list.
 * Adjacent ids that normalize equal are one step, so `{i} of {n}` matches
 * the arrows. `index` is 0-based in that fold. `prevId` / `nextId` are null
 * at the ends (no wrap). Returns null when the current id is not in the list.
 */
export function memberCursor (ids, currentId) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const current = normalizeMediaId(currentId);
  if (!current) return null;
  const folded = [];
  for (const raw of ids) {
    const id = normalizeMediaId(raw);
    if (folded.length > 0 && folded[folded.length - 1] === id) continue;
    folded.push(id);
  }
  const index = folded.findIndex(id => id === current);
  if (index < 0) return null;
  const n = folded.length;
  return {
    index,
    n,
    prevId: index > 0 ? folded[index - 1] : null,
    nextId: index < n - 1 ? folded[index + 1] : null
  };
}

/**
 * Rewrite container member ids through a canonical-id lookup.
 * Posted / comic Image ids are often numeric while the media page id is
 * the generation blob they joined onto (`getMediaItemById` alias).
 */
export function mapMemberIdsToCanonical (ids, canonicalIdFor) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  for (const raw of ids) {
    const n = normalizeMediaId(raw);
    if (!n) continue;
    const mapped = canonicalIdFor ? canonicalIdFor(n) : n;
    out.push(normalizeMediaId(mapped) || n);
  }
  return out;
}

function panelSelectId (m) {
  if (!m) return '';
  if (m.mediaId != null && m.mediaId !== '') return String(m.mediaId);
  if (m.panelMediaId) return String(m.panelMediaId);
  if (m.imageId != null) return normalizeMediaId(m.imageId);
  if (m.panelId != null) return `comic-panel:${m.panelId}`;
  return '';
}

/**
 * Reading-order panel ids from a comic index entry. Skips cover/hero.
 * Chapter position then panel `index`, matching the comic page.
 */
export function comicReadingIds (comic) {
  if (!comic || !Array.isArray(comic.media)) return [];
  const chapters = Array.isArray(comic.chapters)
    ? comic.chapters
      .filter(ch => ch && ch.id != null)
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];
  const panels = comic.media.filter(m => m && m.role !== 'cover' && m.role !== 'hero');
  const out = [];
  function pushPanel (m) {
    const id = panelSelectId(m);
    if (id) out.push(id);
  }
  if (chapters.length === 0) {
    panels
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .forEach(pushPanel);
    return out;
  }
  for (const ch of chapters) {
    panels
      .filter(m => m.chapterId === ch.id)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .forEach(pushPanel);
  }
  return out;
}
