import { CONFIG } from './cli.mjs';
import { setConfigParam } from './config.mjs';

// Display labels for the reactions a generation download can request.
// Key order is the canonical order of `generationReactions`. Disliked is
// not a download choice.
export const DOWNLOAD_TYPES_MOD = {
  'favorite': 'favorited', // ♥️
  'feedback:liked': 'liked' // 👍
};

const GENERATION_DOWNLOAD_VALUES = {
  latest: 'latest',
  'missing-all': 'all',
  'missing-tags': 'reactions'
};

export function normalizeGenerationReactions (source) {
  const list = Array.isArray(source) ? source : [];
  return Object.keys(DOWNLOAD_TYPES_MOD).filter(type => list.includes(type));
}

export function getDownloadTypes () {
  return normalizeGenerationReactions(CONFIG.generationReactions)
    .map(type => DOWNLOAD_TYPES_MOD[type]);
}

// Feed tags for one generation run. Latest and All send none. A reaction
// run sends `generationReactions`. `downloadMedia` does not change the list.
export function generationDownloadTags (mode) {
  if (mode !== 'missing-tags') return [];
  return normalizeGenerationReactions(CONFIG.generationReactions);
}

// Writes the remembered generation run. Any other mode writes nothing.
export async function rememberGenerationDownload (mode) {
  const value = GENERATION_DOWNLOAD_VALUES[mode];
  if (!value) return;
  await setConfigParam('generationDownload', value);
}

// Writes the remembered posts run. Any other mode writes nothing.
export async function rememberPostDownload (mode) {
  if (mode !== 'latest' && mode !== 'all') return;
  await setConfigParam('postDownload', mode);
}

const REACTION_MENU_LABELS = {
  favorite: 'Favorited',
  'feedback:liked': 'Liked'
};

// Generations menu row for the stored reactions. An empty list, Disliked,
// and `all` produce no row. Both reactions read Favorited/Liked.
export function generationMenuChoice (reactions) {
  const list = normalizeGenerationReactions(reactions);
  if (!list.length) return null;
  return {
    value: 'missing-tags',
    label: list.map(type => REACTION_MENU_LABELS[type]).join('/')
  };
}
