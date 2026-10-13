/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// Posted-media identity helpers (Post ∪ Comic).
//
// Leaf 1: sourceName stripping + slot extractors.
// Leaf 3: exact generation-data recipe (INDEX entries, not raw JSON).
// This module must not top-level-import serverIndex or generations.

import { paramsPixels } from './mediaAspect.mjs';
import { normalizeMediaId } from './mediaId.mjs';

const CORE_FIELDS = [
  'prompt',
  'negativePrompt',
  'seed',
  'sampler',
  'versionIds',
  'loraWeights'
];

const OPTIONAL_FIELDS = [
  'steps',
  'cfgScale',
  'clipSkip',
  'width',
  'height'
];

const RECIPE_FIELDS = [...CORE_FIELDS, ...OPTIONAL_FIELDS];

export function postedSourceName (name) {
  const cut = String(name || '').split('?')[0];
  const stripped = cut.replace(/^\/+/, '');
  return stripped === '' ? null : stripped;
}

export function postedMatchAt (mediaRow) {
  const t = mediaRow?.createdAt;
  return typeof t === 'string' && t !== '' ? t : null;
}

export function postedSlotsFromPost (postEntry) {
  if (!Array.isArray(postEntry?.media)) return [];
  return postEntry.media.map(m => ({
    imageId: m.imageId,
    sourceName: m.sourceName ?? null,
    thumbnailPath: m.thumbnailPath,
    meta: m.meta ?? null,
    postedAt: postedMatchAt(m),
    container: 'post',
    containerId: postEntry.id
  }));
}

export function postedSlotsFromComic (comicEntry) {
  if (!Array.isArray(comicEntry?.media)) return [];
  return comicEntry.media
    .filter(m => m && m.role !== 'cover' && m.role !== 'hero')
    .map(m => ({
      imageId: m.imageId,
      sourceName: m.sourceName ?? null,
      thumbnailPath: m.thumbnailPath,
      meta: m.meta ?? null,
      postedAt: postedMatchAt(m),
      container: 'comic',
      containerId: comicEntry.id
    }));
}

function finiteNumber (v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function numericVersionId (v) {
  const n = finiteNumber(v);
  if (n == null || n === 0) return null;
  return n;
}

function round4 (n) {
  return Math.round(Number(n) * 1e4) / 1e4;
}

function trimText (v) {
  return v == null ? '' : String(v).trim();
}

function normalizeSampler (s) {
  const v = String(s ?? '').trim().toLowerCase();
  if (v === '' || v === 'undefined' || v === 'none') return '';
  return v;
}

function isCheckpointResource (r) {
  const t = r?.type ?? r?.modelType;
  return String(t || '').toLowerCase() === 'checkpoint';
}

function pixelsFromMeta (meta) {
  const w = finiteNumber(meta.width);
  const h = finiteNumber(meta.height);
  if (w && h && w > 0 && h > 0) return { width: w, height: h };
  const size = meta.Size;
  if (typeof size !== 'string' || !size) return null;
  const parts = size.split(/[x×X]/);
  if (parts.length < 2) return null;
  const width = parseInt(parts[0].trim(), 10);
  const height = parseInt(parts[1].trim(), 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function resourceRowsFromMeta (meta) {
  const cr = meta?.civitaiResources;
  if (Array.isArray(cr) && cr.length) return cr;
  const sibling = meta?.resources;
  if (Array.isArray(sibling) && sibling.length) return sibling;
  return [];
}

function versionIdsFromMetaRows (rows) {
  const ids = [];
  for (const r of rows) {
    const id = numericVersionId(r?.modelVersionId);
    if (id != null) ids.push(id);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function loraWeightsFromMetaRows (rows) {
  const byId = new Map();
  for (const r of rows) {
    if (!r || isCheckpointResource(r)) continue;
    const id = numericVersionId(r.modelVersionId);
    if (id == null) continue;
    const w = finiteNumber(r.weight ?? r.strength);
    if (w == null) continue;
    byId.set(id, round4(w));
  }
  return [...byId.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, w]) => ({ id, w }));
}

function versionIdsFromGen (entry) {
  const ids = [];
  const ck = numericVersionId(entry?.checkpoint?.versionId);
  if (ck != null) ids.push(ck);
  for (const r of Array.isArray(entry?.resources) ? entry.resources : []) {
    const id = numericVersionId(r?.versionId);
    if (id != null) ids.push(id);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function loraWeightsFromGen (entry) {
  const byId = new Map();
  for (const r of Array.isArray(entry?.resources) ? entry.resources : []) {
    if (!r || isCheckpointResource(r)) continue;
    const id = numericVersionId(r.versionId);
    if (id == null) continue;
    const w = finiteNumber(r.strength);
    if (w == null) continue;
    byId.set(id, round4(w));
  }
  return [...byId.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, w]) => ({ id, w }));
}

function finishRecipe ({
  prompt,
  negativePrompt,
  seed,
  sampler,
  steps,
  cfgScale,
  clipSkip,
  width,
  height,
  versionIds,
  loraWeights
}) {
  const seedN = finiteNumber(seed);
  if (seedN == null) return null;
  const promptText = trimText(prompt);
  const ids = Array.isArray(versionIds) ? versionIds : [];
  if (!promptText && ids.length === 0) return null;

  const recipe = {
    prompt: promptText,
    negativePrompt: trimText(negativePrompt),
    seed: seedN,
    sampler: normalizeSampler(sampler),
    versionIds: ids,
    loraWeights: Array.isArray(loraWeights) ? loraWeights : []
  };

  const stepsN = finiteNumber(steps);
  if (stepsN != null && stepsN !== 0) recipe.steps = stepsN;
  const cfgN = finiteNumber(cfgScale);
  if (cfgN != null && cfgN !== 0) recipe.cfgScale = cfgN;
  const clipN = finiteNumber(clipSkip);
  if (clipN != null && clipN !== 0) recipe.clipSkip = clipN;
  const w = finiteNumber(width);
  const h = finiteNumber(height);
  if (w && h && w > 0 && h > 0) {
    recipe.width = w;
    recipe.height = h;
  }
  return recipe;
}

export function generationDataRecipeFromMeta (meta) {
  if (!meta || typeof meta !== 'object') return null;
  const rows = resourceRowsFromMeta(meta);
  const px = pixelsFromMeta(meta);
  return finishRecipe({
    prompt: meta.prompt ?? meta.Prompt,
    negativePrompt: meta.negativePrompt ?? meta['Negative prompt'],
    seed: meta.seed ?? meta.Seed,
    sampler: meta.sampler ?? meta.Sampler,
    steps: meta.steps ?? meta.Steps,
    cfgScale: meta.cfgScale ?? meta['CFG scale'],
    clipSkip: meta.clipSkip ?? meta['Clip skip'],
    width: px?.width,
    height: px?.height,
    versionIds: versionIdsFromMetaRows(rows),
    loraWeights: loraWeightsFromMetaRows(rows)
  });
}

export function generationDataRecipeFromGen (entry, mediaRow) {
  if (!entry || typeof entry !== 'object') return null;
  const px = paramsPixels(entry.params);
  return finishRecipe({
    prompt: entry.prompt,
    negativePrompt: entry.negativePrompt,
    seed: mediaRow?.seed,
    sampler: entry.params?.sampler,
    steps: entry.params?.steps,
    cfgScale: entry.params?.cfgScale,
    clipSkip: entry.params?.clipSkip,
    width: px?.width,
    height: px?.height,
    versionIds: versionIdsFromGen(entry),
    loraWeights: loraWeightsFromGen(entry)
  });
}

export function recipeKey (recipe) {
  if (!recipe || typeof recipe !== 'object') return '';
  const ordered = {};
  for (const k of RECIPE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(recipe, k)) ordered[k] = recipe[k];
  }
  return JSON.stringify(ordered);
}

function coreKey (recipe) {
  if (!recipe || typeof recipe !== 'object') return '';
  const ordered = {};
  for (const k of CORE_FIELDS) ordered[k] = recipe[k];
  return JSON.stringify(ordered);
}

function optionalsMatch (a, b) {
  for (const k of OPTIONAL_FIELDS) {
    const av = a[k];
    const bv = b[k];
    if (av == null || bv == null) continue;
    if (av !== bv) return false;
  }
  return true;
}

export function buildGenerationRecipeIndex (generations) {
  const map = new Map();
  for (const gen of Array.isArray(generations) ? generations : []) {
    if (!Array.isArray(gen?.media)) continue;
    for (const m of gen.media) {
      const recipe = generationDataRecipeFromGen(gen, m);
      if (!recipe) continue;
      const mediaId = normalizeMediaId(m.mediaId);
      if (!mediaId) continue;
      const key = coreKey(recipe);
      const list = map.get(key);
      const row = { mediaId, createdAt: gen.createdAt || '', recipe };
      if (list) list.push(row);
      else map.set(key, [row]);
    }
  }
  return map;
}

export function matchRecipe (meta, postedAt, recipeIndex) {
  if (!recipeIndex) return null;
  const recipe = generationDataRecipeFromMeta(meta);
  if (!recipe) return null;
  const hits = recipeIndex.get(coreKey(recipe));
  if (!hits?.length) return null;
  const pairwise = hits.filter(h => optionalsMatch(recipe, h.recipe));
  const bounded = (postedAt == null || postedAt === '')
    ? pairwise
    : pairwise.filter(h => (h.createdAt || '') <= postedAt);
  const ids = new Set();
  for (const h of bounded) {
    if (h?.mediaId) ids.add(h.mediaId);
  }
  if (ids.size !== 1) return null;
  return ids.values().next().value;
}
