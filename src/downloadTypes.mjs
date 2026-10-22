import { CONFIG } from './cli.mjs';
import { setConfig, setConfigParam } from './config.mjs';

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
export async function rememberGenerationReactions (list) {
  await setConfigParam('generationReactions', normalizeGenerationReactions(list));
}

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

export async function rememberComicDownload (mode) {
  if (mode !== 'latest' && mode !== 'all') return;
  await setConfigParam('comicDownload', mode);
}

export async function rememberModel3dDownload (mode) {
  if (mode !== 'latest' && mode !== 'all') return;
  await setConfigParam('model3dDownload', mode);
}

// A missing stored run matches incoming Latest. Any other incoming value is ignored.
function sameStoredMode (stored, incoming) {
  if (incoming === 'latest') return stored == null || stored === 'latest';
  return stored === incoming;
}

function arraysMatch (left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

// Diff for POST /api/download/modes. Null means the file already matches.
export function downloadModePatch (current, body) {
  const source = body && typeof body === 'object' ? body : {};
  const stored = current && typeof current === 'object' ? current : {};
  const patch = {};

  const generation = source.generationDownload;
  if (generation === 'latest' || generation === 'all' || generation === 'reactions') {
    if (!sameStoredMode(stored.generationDownload, generation)) {
      patch.generationDownload = generation;
    }
  }

  if (Array.isArray(source.generationReactions)) {
    const next = normalizeGenerationReactions(source.generationReactions);
    const raw = Array.isArray(stored.generationReactions) ? stored.generationReactions : [];
    if (!arraysMatch(next, raw)) patch.generationReactions = next;
  }

  for (const key of ['postDownload', 'comicDownload', 'model3dDownload']) {
    const incoming = source[key];
    if (incoming !== 'latest' && incoming !== 'all') continue;
    if (!sameStoredMode(stored[key], incoming)) patch[key] = incoming;
  }

  return Object.keys(patch).length ? patch : null;
}

export async function applyDownloadModes (body) {
  const patch = downloadModePatch(CONFIG, body);
  if (!patch) return { ok: true };
  await setConfig(patch);
  return { ok: true };
}

// A clean All portion becomes Latest. Favorited, Liked, and a portion that
// stopped or reported errors stay as they were.
export function portionModeAfter (remembered, outcome) {
  const errors = outcome && outcome.errors;
  const clean = outcome && outcome.status === 'complete' && (errors || 0) === 0;
  if (!clean) return remembered ?? null;
  if (remembered === 'all' || remembered === 'reactions') return 'latest';
  return remembered ?? null;
}

export async function settleRememberedMode (type, remembered, outcome) {
  const next = portionModeAfter(remembered, outcome);
  if (next !== 'latest' || (remembered !== 'all' && remembered !== 'reactions')) return next;
  if (type === 'generations') await setConfigParam('generationDownload', 'latest');
  else if (type === 'posts') await rememberPostDownload('latest');
  else if (type === 'comics') await rememberComicDownload('latest');
  else if (type === 'model3ds') await rememberModel3dDownload('latest');
  return next;
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
