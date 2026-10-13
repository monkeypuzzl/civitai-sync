// Local-canonical reaction overrides.
//
// Owns `${CONFIG.dataPath}/overrides/annotations.json` — a per-account file
// recording the media-items whose local reaction state (favorite / liked /
// disliked) has *diverged* from what Civitai currently reports. Only diverged
// media-items appear in the file; most accounts that never edit a reaction
// have no file at all.
//
// Keyed by the NORMALIZED media-item id (see `src/mediaId.mjs`), identical to
// the index's `mediaItems[].id`. This module imports `normalizeMediaId` from
// that leaf module — never from the index — so it stays free of any index
// dependency (the dependency DAG is `mediaId ← utils ← overrides ←
// generations ← serverIndex`).
//
// The downloaded JSON in `data/generations/<date>/<id>.json` is never mutated
// by an Explorer edit; the override file is the single source of truth for a
// diverged media-item at read time, and it is preserved across re-downloads.
//
// This module performs NO on-disk projection of reactions (export folders,
// tag-dir copies). That is owned entirely by the Exports plan; this module's
// only filesystem effect is the override file itself.

import { readFile, writeFile } from './utils.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import { CONFIG } from './cli.mjs';

const OVERRIDES_VERSION = 1;

// Module-level cache. `media` is keyed by normalized media-item id. The
// reserved sibling top-level keys (posts / comics / chapters) are not written
// by this plan, but any present on disk are preserved verbatim through a
// load → write round-trip so an older bundle never drops a newer plan's data.
let _overrides = { _version: OVERRIDES_VERSION, media: {} };
let _loaded = false;

function overridesPath () {
  return `${CONFIG.dataPath}/overrides/annotations.json`;
}

// Coerce an arbitrary reactions-ish object into the canonical shape. The
// override stores the FULL local reaction state for a media-item, not a
// per-field delta — matching the "local becomes canonical for that
// media-item" rule.
function normalizeReactions (r) {
  return {
    favorite: r?.favorite === true,
    feedback: (r?.feedback === 'liked' || r?.feedback === 'disliked') ? r.feedback : null
  };
}

// Idempotent. Reads the override file once into the in-memory cache. A
// missing or malformed file is treated as an empty store (never an error and
// never a wipe of an existing on-disk file — we only land here when read /
// parse failed). On an unexpected (higher) `_version`, operate on `media`
// rather than discarding: a newer bundle's data must survive an older bundle
// touching the file.
export async function loadOverrides () {
  if (_loaded) return _overrides;

  try {
    const text = await readFile(overridesPath());
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      _overrides = parsed;
      if (!_overrides.media || typeof _overrides.media !== 'object') {
        _overrides.media = {};
      }
      if (typeof _overrides._version !== 'number') {
        _overrides._version = OVERRIDES_VERSION;
      }
    }
  } catch {
    _overrides = { _version: OVERRIDES_VERSION, media: {} };
  }

  _loaded = true;
  return _overrides;
}

async function persist () {
  await writeFile(overridesPath(), JSON.stringify(_overrides, null, 2));
}

// Synchronous read of the in-memory cache. Returns the stored canonical
// reaction state for a media-item, or null when server state is canonical.
// Callers that need a populated cache must have awaited loadOverrides()
// first (the index does this in ensureLoaded()/rebuild(); the reaction API
// does it transitively via the loaded index). An un-loaded cache safely
// reports "no override" rather than throwing.
export function getMediaOverride (mediaItemId) {
  const id = normalizeMediaId(mediaItemId);
  return _overrides.media[id] || null;
}

export async function setMediaOverride (mediaItemId, reactions) {
  await loadOverrides();
  const id = normalizeMediaId(mediaItemId);
  _overrides.media[id] = {
    ...normalizeReactions(reactions),
    updatedAt: new Date().toISOString()
  };
  await persist();
  return _overrides.media[id];
}

export async function clearMediaOverride (mediaItemId) {
  await loadOverrides();
  const id = normalizeMediaId(mediaItemId);
  if (id in _overrides.media) {
    delete _overrides.media[id];
    await persist();
  }
}

export function hasOverride (mediaItemId) {
  const id = normalizeMediaId(mediaItemId);
  return _overrides.media[id] != null;
}

// Move an Image-id override onto the canonical generation blob id after a
// posted-identity join. Favorite unions. Conflicting feedback keeps the
// canonical (generation) value. Unknown top-level file keys are preserved
// because persist writes the loaded object.
export async function remapMediaOverride (fromId, canonicalId) {
  await loadOverrides();
  const from = normalizeMediaId(fromId);
  const canonical = normalizeMediaId(canonicalId);
  if (!from || !canonical || from === canonical) return;

  const media = _overrides.media;
  const fromRec = media[from];
  if (!fromRec) return;
  const canonRec = media[canonical];

  const fromNorm = normalizeReactions(fromRec);
  const canonNorm = canonRec ? normalizeReactions(canonRec) : { favorite: false, feedback: null };
  const favorite = fromNorm.favorite || canonNorm.favorite;
  let feedback = canonNorm.feedback || fromNorm.feedback || null;
  if (fromNorm.feedback && canonNorm.feedback && fromNorm.feedback !== canonNorm.feedback) {
    feedback = canonNorm.feedback;
  }

  const base = (canonRec && typeof canonRec === 'object' && !Array.isArray(canonRec))
    ? { ...canonRec }
    : {};
  media[canonical] = {
    ...base,
    favorite,
    feedback,
    updatedAt: new Date().toISOString()
  };
  delete media[from];
  await persist();
}

// Read the server's reactions for a media-item out of the per-output tag
// block of the downloaded generation JSON.
//
// CANONICAL-FIRST: audio and all newer-shape generations carry their
// reactions under `metadata.output`, not the legacy `metadata.images`; the
// rollout dual-emits both. Reading `metadata.output ?? metadata.images` is
// therefore mandatory — `images`-only reads make audio/newer-shape reactions
// invisible (the favourite export would silently miss them).
//
// NORMALIZE-MATCHED: the JSON tag block is keyed by the RAW media id (e.g.
// `89328095.jpeg`); the argument is the NORMALIZED id. Match on
// `normalizeMediaId(key) === normalizedId`.
export function readServerReactions (generation, normalizedId) {
  const target = normalizeMediaId(normalizedId);
  const steps = Array.isArray(generation?.steps) ? generation.steps : [];

  for (const step of steps) {
    const metadata = step?.metadata;
    if (!metadata) continue;

    const tagBlock = metadata.output ?? metadata.images;
    if (!tagBlock || typeof tagBlock !== 'object') continue;

    for (const key of Object.keys(tagBlock)) {
      if (normalizeMediaId(key) === target) {
        return normalizeReactions(tagBlock[key]);
      }
    }
  }

  return { favorite: false, feedback: null };
}

// Render canonical reactions as the workflow-tag array the index entry and
// the gallery indicators consume (e.g. ["favorite", "feedback:liked"]).
// Sorted to match getGeneratedMediaInfo's sorted tag output.
export function reactionsToTags (reactions) {
  const r = normalizeReactions(reactions);
  const tags = [];
  if (r.favorite) tags.push('favorite');
  if (r.feedback === 'liked') tags.push('feedback:liked');
  else if (r.feedback === 'disliked') tags.push('feedback:disliked');
  return tags.sort();
}

// Reaction-state equality (favorite + feedback only; `updatedAt` and any
// other fields are ignored). Underpins the write-time rule that clears an
// override once a media-item is toggled back to the server's state.
export function reactionsEqual (a, b) {
  const na = normalizeReactions(a);
  const nb = normalizeReactions(b);
  return na.favorite === nb.favorite && na.feedback === nb.feedback;
}
