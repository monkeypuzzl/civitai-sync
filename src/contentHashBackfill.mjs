/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// Idempotent content-hash backfill. Records `content:<sha256>` for each
// existing generation file, then joins posted files (posts / comic panels)
// onto that generation via `image:<imageId>` when the bytes match, then
// aliases + unlinks `media/inputs/` copies that are byte-identical to a
// generation we already have.
//
// Must not top-level-import serverIndex or generations (DAG). Never unlinks
// anything under generations/, media/posts/, or media/comics/. Only
// media/inputs/ is unlinked.
//
// Not on the Explorer listen path: startServer queues this after bind;
// rebuildIndex awaits it (Settings self-heal). Between files, waits while an
// Explorer request is open (no-op before the server is armed). Unique media ids that already
// have a content: key are not re-hashed. Ids with multiple generation
// occurrences (April ≠ August, same output id, different files) are always
// hashed so each file can gain its own content: key.

import path from 'node:path';
import { stat } from 'node:fs/promises';
import { CONFIG } from './cli.mjs';
import { fileExists, unlink, listFiles } from './utils.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import { inputsMediaDir } from './inputMedia.mjs';
import { remapMediaOverride } from './overrides.mjs';
import {
  loadAliasStore,
  recordAlias,
  persistAliasStore,
  resolveCanonicalId,
  canonicalHasContentKey,
  contentKey,
  imageKey,
  hashFileSha256
} from './mediaIdentity.mjs';
import { waitForExplorerIdle } from './explorerIdle.mjs';

function diskPathFromThumbnail (thumbnailPath) {
  const mediaPath = CONFIG?.mediaPath;
  if (!mediaPath) return null;
  const rel = String(thumbnailPath || '').replace(/^\/media\/?/, '');
  if (!rel) return null;
  return path.join(mediaPath, rel);
}

function idFromInputFilename (name) {
  const base = path.basename(String(name || ''));
  const dot = base.lastIndexOf('.');
  return normalizeMediaId(dot <= 0 ? base : base.slice(0, dot));
}

async function indexFromStore () {
  try {
    const { ensureIndexLoaded, getIndex } = await import('./serverIndex.mjs');
    await ensureIndexLoaded();
    const index = getIndex() || {};
    return {
      generations: index.generations || [],
      posts: index.posts || [],
      comics: index.comics || []
    };
  } catch (ignoreErr) {
    return { generations: [], posts: [], comics: [] };
  }
}

function countOccurrences (gens) {
  const counts = new Map();
  for (const gen of gens || []) {
    if (!Array.isArray(gen.media)) continue;
    for (const m of gen.media) {
      const mediaId = normalizeMediaId(m.mediaId);
      if (!mediaId) continue;
      counts.set(mediaId, (counts.get(mediaId) || 0) + 1);
    }
  }
  return counts;
}

function hasUsableImageId (imageId) {
  return typeof imageId === 'number' || (typeof imageId === 'string' && imageId !== '');
}

// Hash one posted file. On a content: hit, record image:<id> and remap
// overrides onto the canonical blob id. Never unlinks. Returns true when
// an alias was recorded (caller persists).
async function joinPostedFileOnContentHit (filepath, imageId) {
  if (!hasUsableImageId(imageId)) return false;
  if (!filepath || !(await fileExists(filepath))) return false;
  const hex = await hashFileSha256(filepath);
  const canonical = resolveCanonicalId([contentKey(hex)]);
  if (!canonical) return false;
  await recordAlias(canonical, imageKey(imageId), { persist: false });
  await remapMediaOverride(imageId, canonical);
  return true;
}

async function walkPostedMedia (entries, { skipCoverHero = false } = {}) {
  let dirty = false;
  for (const entry of entries || []) {
    if (!Array.isArray(entry.media)) continue;
    for (const m of entry.media) {
      await waitForExplorerIdle();
      try {
        if (!m) continue;
        if (skipCoverHero && (m.role === 'cover' || m.role === 'hero')) continue;
        const filepath = diskPathFromThumbnail(m.thumbnailPath);
        if (await joinPostedFileOnContentHit(filepath, m.imageId)) dirty = true;
      } catch (ignoreErr) {
        // Fail-soft per file. Never unlink the posted file.
      }
    }
  }
  return dirty;
}

// Live savePostMedia / panel saveComicMedia: hash the new file and join
// onto a generation when content: already exists. Fail-soft. Must not
// import serverIndex (DAG).
export async function joinPostedFileIfHashed (filepath, imageId) {
  try {
    await loadAliasStore();
    const dirty = await joinPostedFileOnContentHit(filepath, imageId);
    if (dirty) await persistAliasStore();
  } catch (ignoreErr) {
    // Fail-soft: hash/join must not fail the download.
  }
}

export async function backfillContentHashes ({ generations, posts, comics } = {}) {
  await waitForExplorerIdle();
  await loadAliasStore();
  // Factory tests (createIndexStore, no CONFIG) have no media root — skip.
  if (!CONFIG?.mediaPath) return;

  let gens = generations;
  let postEntries = posts;
  let comicEntries = comics;
  if (gens == null && postEntries == null && comicEntries == null) {
    const fromIndex = await indexFromStore();
    gens = fromIndex.generations;
    postEntries = fromIndex.posts;
    comicEntries = fromIndex.comics;
  } else {
    gens = gens ?? [];
    postEntries = postEntries ?? [];
    comicEntries = comicEntries ?? [];
  }

  const occurrenceCount = countOccurrences(gens);
  let dirty = false;

  for (const gen of gens || []) {
    if (!Array.isArray(gen.media)) continue;
    for (const m of gen.media) {
      await waitForExplorerIdle();
      try {
        const mediaId = normalizeMediaId(m.mediaId);
        if (!mediaId) continue;
        // One job, already keyed: skip the file read. Several jobs, same
        // output id: hash every thumbnail (files may differ).
        if ((occurrenceCount.get(mediaId) || 0) <= 1 && canonicalHasContentKey(mediaId)) continue;
        const filepath = diskPathFromThumbnail(m.thumbnailPath);
        if (!filepath || !(await fileExists(filepath))) continue;
        const hex = await hashFileSha256(filepath);
        if (resolveCanonicalId([contentKey(hex)])) continue;
        await recordAlias(mediaId, contentKey(hex), { persist: false });
        dirty = true;
      } catch (ignoreErr) {
        // Fail-soft per file.
      }
    }
  }

  if (await walkPostedMedia(postEntries)) dirty = true;
  if (await walkPostedMedia(comicEntries, { skipCoverHero: true })) dirty = true;

  const inputsDir = inputsMediaDir();
  const names = await listFiles(inputsDir);
  for (const name of names) {
    await waitForExplorerIdle();
    const filepath = path.join(inputsDir, name);
    try {
      const st = await stat(filepath);
      if (!st.isFile()) continue;
      const hex = await hashFileSha256(filepath);
      const canonical = resolveCanonicalId([contentKey(hex)]);
      if (!canonical) continue;
      const id = idFromInputFilename(name);
      if (id) {
        await recordAlias(canonical, 'blob:' + id, { persist: false });
        dirty = true;
      }
      await unlink(filepath);
    } catch (ignoreErr) {
      // Fail-soft per file. Never unlink generations/ from this walk.
    }
  }

  if (dirty) await persistAliasStore();
}
