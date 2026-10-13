// Civitai browsing-level labels for Image/Post/Comic records.
// Labelling: getBrowsingLevelLabel in browsingLevel.constants.ts /
// packages/civitai-shared/src/browsing-levels.ts — direct table, else the
// most severe bit in a composite (Blocked > XXX > X > R > PG-13 > PG),
// else '?'. Do not import civitai-src; this is the UI-side port.
//
// browsingLevelOf is the same function as src/civitaiWire.mjs (esbuild
// already bundles src/*.mjs — see SafeRichText / safeHtml). T-lockstep
// asserts the re-export still reads WIRE.browsingLevel.

export { browsingLevelOf } from '../../../../src/civitaiWire.mjs';

export const BROWSING_LEVEL = {
  PG: 1,
  PG13: 2,
  R: 4,
  X: 8,
  XXX: 16,
  Blocked: 32
};

export const BROWSING_LEVEL_LABELS = {
  0: '?',
  [BROWSING_LEVEL.PG]: 'PG',
  [BROWSING_LEVEL.PG13]: 'PG-13',
  [BROWSING_LEVEL.R]: 'R',
  [BROWSING_LEVEL.X]: 'X',
  [BROWSING_LEVEL.XXX]: 'XXX',
  [BROWSING_LEVEL.Blocked]: 'Blocked'
};

const BROWSING_LEVEL_BITS_BY_SEVERITY = [
  BROWSING_LEVEL.Blocked,
  BROWSING_LEVEL.XXX,
  BROWSING_LEVEL.X,
  BROWSING_LEVEL.R,
  BROWSING_LEVEL.PG13,
  BROWSING_LEVEL.PG
];

export function browsingLevelLabel (value) {
  const n = Number(value);
  if (!n) return '?';
  const direct = BROWSING_LEVEL_LABELS[n];
  if (direct) return direct;
  for (const bit of BROWSING_LEVEL_BITS_BY_SEVERITY) {
    if ((n & bit) !== 0) return BROWSING_LEVEL_LABELS[bit];
  }
  return '?';
}

// Scanner ladder names stored as content tags. The media page prints the
// image's browsing-level label in Rating and omits these from tag chips.
// The tag filter still lists them.
const RATING_TAG_NAMES = new Set(['pg', 'pg-13', 'r', 'x', 'xxx']);

export function isRatingTagName (name) {
  return RATING_TAG_NAMES.has(String(name ?? '').trim().toLowerCase());
}

export function tagsWithoutRating (tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter(tag => {
    const name = typeof tag === 'string' ? tag : tag?.name;
    return !isRatingTagName(name);
  });
}
