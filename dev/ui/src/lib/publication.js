// Closed Publication taxonomy + Used as input rewrite helpers.
// Lockstep with `src/explorerQuery.mjs` PUBLICATION_TOKENS. The UI bundle
// cannot import `src/*.mjs`, so the tokens and labels live here.
// Posts/Comics omit unposted (`publicationFacet({ unposted: false })`);
// Generations / Exports keep the four-token set.

export const PUBLICATION_OPTIONS = ['published', 'scheduled', 'draft', 'unposted'];

export const PUBLICATION_LABELS = {
  published: 'Published',
  scheduled: 'Scheduled',
  draft: 'Draft',
  unposted: 'Not in a post or comic'
};

// Published 3D gallery. Three status words. Not the post/comic set.
export const MODEL3D_PUBLICATION_LABELS = {
  published: 'Published',
  draft: 'Draft',
  unpublished: 'Unpublished'
};

export function publicationFacet ({ unposted = true } = {}) {
  const options = unposted
    ? PUBLICATION_OPTIONS
    : PUBLICATION_OPTIONS.filter(t => t !== 'unposted');
  return { key: 'publication', kind: 'chips', label: 'Publication', options, optionLabels: PUBLICATION_LABELS };
}

export const PUBLICATION_FACET = publicationFacet();

export const USED_AS_INPUT_FACET = {
  key: 'usedAsInput',
  kind: 'flag',
  label: 'Used as Input'
};

// Legacy inPost bookmark → publication tokens. inPost=1 is any posted
// status (post or comic chapter); inPost=0 is unposted.
export function publicationFromInPost (inPost) {
  if (inPost === true) return ['published', 'scheduled', 'draft'];
  if (inPost === false) return ['unposted'];
  return [];
}

export function effectivePublication (publication, inPost) {
  if (Array.isArray(publication) && publication.length) return publication;
  return publicationFromInPost(inPost);
}

// Leftover `status=` csv (pre-_v=4 / in-flight) as publication tokens.
export function publicationFromStatus (raw) {
  if (raw == null || raw === '') return [];
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}
