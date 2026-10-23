// Civitai browsing-level labels for Image/Post/Comic records.
// Labelling: getBrowsingLevelLabel in browsingLevel.constants.ts /
// packages/civitai-shared/src/browsing-levels.ts — direct table, else the
// most severe bit in a composite (Blocked > XXX > X > R > PG-13 > PG),
// else '?'. Do not import civitai-src.
//
// The body lives here so the release zip can load it. That zip ships src/
// and does not ship dev/. dev/ui/src/lib/browsing-level.js re-exports these
// names, and esbuild bundles this module. T-lockstep asserts that re-export
// still reads WIRE.browsingLevel.

export { browsingLevelOf } from './civitaiWire.mjs';

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

// Scanner ladder names stored as content tags. Mildest first. The media
// page omits these from tag chips and prints the browsing-level label in
// Rating. The Tags picker lists the same names in a Rating block, using
// these labels. Blocked is a browsing-level label, not a ladder name.
const RATING_TAG_LADDER = [
  ['pg', 'PG'],
  ['pg-13', 'PG-13'],
  ['r', 'R'],
  ['x', 'X'],
  ['xxx', 'XXX']
];

const RATING_TAG_NAMES = new Set(RATING_TAG_LADDER.map(([name]) => name));
const RATING_TAG_LABEL_BY_NAME = new Map(RATING_TAG_LADDER);
const RATING_TAG_RANK_BY_NAME = new Map(RATING_TAG_LADDER.map(([name], index) => [name, index]));

function ratingTagKey (name) {
  return String(name ?? '').trim().toLowerCase();
}

export function isRatingTagName (name) {
  return RATING_TAG_NAMES.has(ratingTagKey(name));
}

export function ratingTagLabel (name) {
  return RATING_TAG_LABEL_BY_NAME.get(ratingTagKey(name)) ?? null;
}

export function ratingTagRank (name) {
  const rank = RATING_TAG_RANK_BY_NAME.get(ratingTagKey(name));
  return rank == null ? null : rank;
}

const RATING_TOKEN_BY_LABEL = new Map(RATING_TAG_LADDER.map(([token, label]) => [label, token]));

// Ladder token for a browsing-level bit, using the same label as the media
// page. Unrated and Blocked are not tokens.
export function ratingTokenForLevel (value) {
  return RATING_TOKEN_BY_LABEL.get(browsingLevelLabel(value)) ?? null;
}

export function tagsWithoutRating (tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter(tag => {
    const name = typeof tag === 'string' ? tag : tag?.name;
    return !isRatingTagName(name);
  });
}
