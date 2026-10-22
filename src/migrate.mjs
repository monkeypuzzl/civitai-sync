/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import { mkdirp } from 'mkdirp';
import { dirname } from 'node:path';
import { stat as fsStat, lstat as fsLstat, link as fsLink } from 'node:fs/promises';
import { setConfigParam, removeConfigParam, setConfig, DEFAULT_CONFIG } from './config.mjs';
import { normalizeGenerationReactions } from './downloadTypes.mjs';
import { generationsMediaDir, generationFilepath, getGenerationDates, getGenerationIdsByDate, getGeneration, mediaFilepath } from './generations.mjs';
import { getPostDates, postsDataDir, POST_DRAFTS_DIR } from './posts.mjs';
import { extractInputDescriptors, saveInputMedia } from './inputMedia.mjs';
import { postedGenerationView } from './checkpointResolution.mjs';
import { CONFIG, CURRENT_VERSION } from './cli.mjs';
import { fileExists, listDirectory, listDirectories, isDate, rename, unlink, copyFile, removeDirectoryIfEmpty, writeFile, readFile } from './utils.mjs';
import { backfillContentHashes } from './contentHashBackfill.mjs';
import { waitForExplorerIdle, parkIfExplorerBusy } from './explorerIdle.mjs';
import { loadPrepMarks, prepMarks, savePrepMarks, liveMarkKey } from './prepMarks.mjs';
import { migrateStoredExportQueries } from './exports.mjs';
import { flushFetchMiss } from './fetchMiss.mjs';

// Frozen historical tag-directory names. `migrateDirectoryLayout` (the v4→v5
// layout move) used to read these from `generations.mjs`'s live
// `MEDIA_DIRECTORIES`, but the Exports cutover removes that symbol (Exports
// plan ruling 2). Inlining the snapshot here keeps the v4→v5 path working for
// any v4.x install that auto-updates directly to the Exports version, with no
// dependency on the post-cutover layout. This is a historical constant — it
// must NEVER track the live config.
const LEGACY_MEDIA_DIRS = ['all', 'favorite', 'liked', 'disliked'];

export async function migrateDirectoryLayout () {
  // Skip if already migrated
  if (CONFIG.dataPath || !CONFIG.generationsDataPath) {
    return;
  }

  const oldDataPath = CONFIG.generationsDataPath;
  const oldMediaPath = CONFIG.generationsMediaPath || oldDataPath;

  console.log('Migrating directory layout, please wait...');

  const failures = [];

  // Migrate data directory: move date dirs into generations/ subfolder
  const newDataGenerationsDir = `${oldDataPath}/generations`;
  await mkdirp(newDataGenerationsDir);

  const dataEntries = await listDirectory(oldDataPath);
  for (const entry of dataEntries) {
    if (isDate(entry)) {
      try {
        await rename(`${oldDataPath}/${entry}`, `${newDataGenerationsDir}/${entry}`);
      } catch (error) {
        failures.push({ entry, error });
      }
    }
  }

  // Migrate media directory: move type dirs and legacy date dirs into generations/ subfolder
  const newMediaGenerationsDir = `${oldMediaPath}/generations`;
  await mkdirp(newMediaGenerationsDir);

  const KNOWN_MEDIA_DIRS = LEGACY_MEDIA_DIRS;
  const mediaEntries = await listDirectory(oldMediaPath);
  for (const entry of mediaEntries) {
    if (KNOWN_MEDIA_DIRS.includes(entry) || isDate(entry)) {
      try {
        await rename(`${oldMediaPath}/${entry}`, `${newMediaGenerationsDir}/${entry}`);
      } catch (error) {
        failures.push({ entry, error });
      }
    }
  }

  if (failures.length) {
    for (const { entry, error } of failures) {
      console.error(`  Could not move ${entry}: ${error.message}`);
    }
    throw new Error(`Migration incomplete: ${failures.length} directories could not be moved. Please close any programs accessing these directories and restart.`);
  }

  // Update config to new schema
  await setConfigParam('dataPath', oldDataPath);
  await setConfigParam('mediaPath', oldMediaPath);
  await setConfigParam('username', DEFAULT_CONFIG.username);
  await removeConfigParam('generationsDataPath');
  await removeConfigParam('generationsMediaPath');
}

// =========================================================================
// Exports layout cutover (one-time, idempotent) — Exports plan C2
// =========================================================================
//
// The Exports feature re-bases the media tree onto an honest canonical store
// (`media/generations/<date>/`) and turns the legacy favorite/liked/disliked
// tag directories into seeded exports under `media/exports/<slug>/`. This
// migration moves an existing install onto that shape ONCE, at first launch of
// the Exports version, inside the CLI's "Updating…" pause.
//
// This is the roadmap's first DESTRUCTIVE migration, so the safety rulings are
// non-negotiable (Exports plan ruling 5):
//   - Every step recomputes "what should be on disk" from the CURRENT disk
//     state, never from a transaction log. An interrupted run converges on
//     re-run, and a second run with nothing to do performs ZERO file ops.
//   - The canonical store is never unlinked while it is the only copy — bytes
//     are moved (rename) into the canonical store before any duplicate is
//     dropped, so a crash at any point leaves the data recoverable.
//   - It runs only via the gated, version-checked `migrate()` flow below; there
//     is no other entry point that auto-runs it. The maintainer runs it on the
//     real corpus only after a `data/` + `media/` backup.
//
// End state, per file that lived under media/generations/{favorite,liked,
// disliked}/<date>/:
//   - the single real copy lives in the canonical store media/generations/<date>/
//   - a HARD LINK to it (copy fallback where hard links aren't supported) lives
//     at media/exports/<slug>/generations/<date>/
//   - the legacy tag directory is removed
// and media/generations/all/<date>/* is flattened up to media/generations/<date>/.
// Unknown entries (sidecar directories, stray files) relocate with the date
// folder; they are never unlinked.

// The three legacy tag dirs → their seeded export. Fixed name + slug; the
// record written by `seedLegacyExport` mirrors `createExport`'s shape in
// src/exports.mjs (EXPORT_VERSION 1).
const LEGACY_EXPORTS = [
  { dir: 'favorite', slug: 'favorite', name: 'Favorite', tag: 'favorite' },
  { dir: 'liked', slug: 'liked', name: 'Liked', tag: 'feedback:liked' },
  { dir: 'disliked', slug: 'disliked', name: 'Disliked', tag: 'feedback:disliked' }
];

// Hard-link → copy fallback codes (cross-volume / unsupported fs), mirroring
// the Exports capability probe in src/exports.mjs.
const LINK_FALLBACK_CODES = new Set(['EXDEV', 'EPERM', 'ENOSYS', 'EOPNOTSUPP']);

async function sameInode (a, b) {
  try {
    const [sa, sb] = await Promise.all([fsStat(a), fsStat(b)]);
    return sa.ino === sb.ino && sa.dev === sb.dev;
  } catch {
    return false;
  }
}

// Hard-link src → dest, falling back to a byte copy where hard links aren't
// supported. Returns true when a hard link was made (inode shared), false when
// the destination is a copy.
async function linkInto (src, dest) {
  try {
    await fsLink(src, dest);
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') return true;       // already linked — idempotent
    if (LINK_FALLBACK_CODES.has(error?.code)) {
      await copyFile(src, dest);
      return false;
    }
    throw error;
  }
}

async function lstatKind (p) {
  try {
    const st = await fsLstat(p);
    if (st.isDirectory()) return 'dir';
    if (st.isFile()) return 'file';
    if (st.isSymbolicLink()) return 'symlink';
    return 'other';
  } catch {
    return 'missing';
  }
}

// Relocate src → dest. Dest-wins on a clash (files: drop src; directories:
// merge children then drop the empty source). Returns true when dest did not
// exist and src was renamed onto it. Never unlinks dest, and never unlinks a
// source directory (unlink is EISDIR there). The media tree is a user-chosen
// path other tools also write into — unknown entries are payload, not junk.
async function relocateEntry (src, dest) {
  const srcKind = await lstatKind(src);
  if (srcKind === 'missing') return false;

  const destKind = await lstatKind(dest);

  if (destKind === 'missing') {
    await mkdirp(dirname(dest));
    await rename(src, dest);
    return true;
  }

  if (srcKind === 'dir' && destKind === 'dir') {
    const children = await listDirectory(src, { withFileTypes: true });
    for (const child of children) {
      await relocateEntry(`${src}/${child.name}`, `${dest}/${child.name}`);
    }
    await removeDirectoryIfEmpty(src);
    return false;
  }

  if (srcKind !== 'dir') {
    await unlink(src);
  }
  return false;
}

// Copy src onto dest, dest-wins on a file clash, directories merge. Used to
// keep tag-dir sidecar trees co-located with the export projection before
// the source is relocated into the canonical store.
async function mergeCopy (src, dest) {
  const srcKind = await lstatKind(src);
  if (srcKind === 'missing') return;

  if (srcKind === 'dir') {
    await mkdirp(dest);
    const children = await listDirectory(src, { withFileTypes: true });
    for (const child of children) {
      await mergeCopy(`${src}/${child.name}`, `${dest}/${child.name}`);
    }
    return;
  }

  if ((await lstatKind(dest)) === 'missing') {
    await mkdirp(dirname(dest));
    await copyFile(src, dest);
  }
}

// Place one legacy tag-dir file into the new layout: ensure the canonical
// store holds the single real copy, make the export entry a hard link to it,
// then drop the duplicate source. Idempotent — a converged file is a no-op.
async function placeTagFile (src, canonical, dest, report) {
  // 1. Ensure the canonical store has this file. If it is absent — the
  //    download-filter exception, where the user downloaded only this reaction
  //    so the file never entered the canonical store — MOVE the only copy in.
  //    A cheap rename: no byte copy, the data is never duplicated or at risk.
  if (!(await fileExists(canonical))) {
    if (!(await fileExists(src))) return;            // nothing here (already migrated)
    await mkdirp(dirname(canonical));
    await rename(src, canonical);
    report.canonicalPopulated++;
  }

  // 2. Ensure the export entry is a hard link to the canonical file.
  const destExists = await fileExists(dest);
  if (destExists && await sameInode(dest, canonical)) {
    // Already converged — only drop a leftover source copy.
    if (await fileExists(src)) await unlink(src);
    return;
  }
  if (destExists) await unlink(dest);               // a stale copy (wrong inode)
  await mkdirp(dirname(dest));
  if (await linkInto(canonical, dest)) report.hardlinked++;
  report.relocated++;

  // 3. Drop the now-duplicate source copy (reclaims the duplicated bytes).
  if (await fileExists(src)) await unlink(src);
}

// Flatten media/generations/all/<date>/* up to media/generations/<date>/*.
// Every directory entry is payload (files, sidecar dirs like DigiKam
// `.comments/`, stray non-date dirs, symlinks) — relocate, never delete.
// Merges into any existing dest; on a clash the already-present dest wins
// (safe re-run). Directories merge children rather than being unlinked.
async function flattenCanonical (allDir, mediaGen, report) {
  const dateDirs = await listDirectories(allDir);
  for (const date of dateDirs) {
    if (!isDate(date)) continue;
    const srcDateDir = `${allDir}/${date}`;
    const destDateDir = `${mediaGen}/${date}`;
    const entries = await listDirectory(srcDateDir, { withFileTypes: true });
    for (const ent of entries) {
      if (await relocateEntry(`${srcDateDir}/${ent.name}`, `${destDateDir}/${ent.name}`)) {
        report.flattened++;
      }
    }
    await removeDirectoryIfEmpty(srcDateDir);
  }
  // Leftovers under all/ (non-date dirs, stray files, a date dir that
  // still held payload) move up as units.
  const leftover = await listDirectory(allDir, { withFileTypes: true });
  for (const ent of leftover) {
    if (await relocateEntry(`${allDir}/${ent.name}`, `${mediaGen}/${ent.name}`)) {
      report.flattened++;
    }
  }
  await removeDirectoryIfEmpty(allDir);
}

async function relocateTagDir (tagDir, mediaGen, exportGenRoot, report) {
  const dateDirs = await listDirectories(tagDir);
  for (const date of dateDirs) {
    const srcDateDir = `${tagDir}/${date}`;
    const canonicalDateDir = `${mediaGen}/${date}`;
    const exportDateDir = `${exportGenRoot}/${date}`;
    const entries = await listDirectory(srcDateDir, { withFileTypes: true });
    for (const ent of entries) {
      const src = `${srcDateDir}/${ent.name}`;
      if (ent.isDirectory()) {
        // Sidecar tree: copy into the export (co-located with the projection)
        // then relocate into the canonical store (next to the images).
        await mergeCopy(src, `${exportDateDir}/${ent.name}`);
        await relocateEntry(src, `${canonicalDateDir}/${ent.name}`);
        continue;
      }
      await placeTagFile(
        src,
        `${canonicalDateDir}/${ent.name}`,
        `${exportDateDir}/${ent.name}`,
        report
      );
    }
    await removeDirectoryIfEmpty(srcDateDir);
  }
  if (await removeDirectoryIfEmpty(tagDir)) report.dirsRemoved++;
}

function exportFilePath (slug) {
  return `${CONFIG.dataPath}/exports/${slug}.json`;
}

// Write data/exports/<slug>.json for a seeded legacy export, mirroring the
// createExport record shape in src/exports.mjs (EXPORT_VERSION 1). Idempotent:
// an existing definition is left untouched (never clobbers a user edit or
// resets timestamps on re-run).
async function seedLegacyExport (le) {
  const filepath = exportFilePath(le.slug);
  if (await fileExists(filepath)) return false;
  const record = {
    _version: 1,
    name: le.name,
    type: 'smart',
    query: { reaction: le.tag },
    path: `media/exports/${le.slug}`,
    linkMode: 'auto',
    createdAt: new Date().toISOString(),
    lastSyncedAt: null,
    lastSyncedItemCount: 0
  };
  await writeFile(filepath, record);
  return true;
}

// The destructive cutover migration. Returns a per-op report so a test can
// assert that a second run over already-migrated fixtures performs ZERO ops.
export async function migrateExportsLayout () {
  const report = {
    flattened: 0,
    canonicalPopulated: 0,
    relocated: 0,
    hardlinked: 0,
    seeded: 0,
    dirsRemoved: 0
  };

  const mediaGen = generationsMediaDir();             // <mediaPath>/generations
  const exportsBase = `${CONFIG.mediaPath}/exports`;

  const allDir = `${mediaGen}/all`;
  const allPresent = await fileExists(allDir);

  const tagDirsPresent = [];
  for (const le of LEGACY_EXPORTS) {
    if (await fileExists(`${mediaGen}/${le.dir}`)) tagDirsPresent.push(le);
  }

  const configTags = Array.isArray(CONFIG.generationMediaTypes) ? CONFIG.generationMediaTypes : [];
  const toSeed = LEGACY_EXPORTS.filter(le =>
    tagDirsPresent.includes(le) || configTags.includes(le.tag)
  );

  // Show the "Updating…" pause only when there is real file work to do — a
  // fresh install (canonical store only, no tag dirs) converges silently with
  // no dialog.
  if (allPresent || tagDirsPresent.length) {
    console.log('Updating media library, please wait...');
  }

  // 1. Flatten the canonical store.
  if (allPresent) {
    await flattenCanonical(allDir, mediaGen, report);
  }

  // 2-4. Relocate each tag dir into its export, populating the canonical store
  //      for the download-filter exception and converting copies → hard links.
  for (const le of tagDirsPresent) {
    await relocateTagDir(`${mediaGen}/${le.dir}`, mediaGen, `${exportsBase}/${le.slug}/generations`, report);
  }

  // 5. Seed an export definition for each prior non-'all' selection.
  for (const le of toSeed) {
    if (await seedLegacyExport(le)) report.seeded++;
  }

  // 6. The version stamp written by migrate() after this returns is the
  //    run-once sentinel.
  return report;
}

// =========================================================================
// Suppressed-cover prune (one-time, idempotent) — Phase 5a audio (D3)
// =========================================================================
//
// ACE-Step audio generations (`aceStepAudio`, workflow `txt2music`) can run as
// a multi-step workflow whose intermediate steps are flagged
// `metadata.suppressOutput === true` — the album-cover `imageGen` step and the
// `chatCompletion` lyric step. Before Phase 5a, getGeneratedMediaInfo
// enumerated those suppressed steps, so the album cover was downloaded as a
// standalone image and indexed as a phantom gallery item. Phase 5a's D1
// classifier now SKIPS suppressed steps, so those covers are already dropped
// from the index — but the already-downloaded cover files still sit on disk as
// harmless orphans. This migration removes them so already-downloaded audio
// reaches parity with newly-downloaded audio (which never writes a cover file).
//
// This is the roadmap's SECOND (and last) destructive migration, so the safety
// rulings are non-negotiable (Phase 5a plan ruling 5):
//   - Ordering: the D1 suppressOutput-skip MUST already be live (it is — D1 is
//     committed) before this prune runs, which is why migrate() calls it AFTER
//     migrateExportsLayout. Pruning files the classifier still enumerated would
//     leave the index referencing deleted files; because the skip landed first,
//     the covers are already orphaned (absent from the index, present on disk),
//     so this prune only removes orphans.
//   - It targets ONLY the output ids of suppressed steps. Legitimate images
//     always live in NON-suppressed steps, so they are never touched, and the
//     audio `.mp3`/`.mp4` itself lives in the (non-suppressed) `aceStepAudio`
//     step and is never touched.
//   - Every decision is recomputed from the immutable generation JSON, never
//     from a log. A missing file is a no-op; a second run performs ZERO file
//     ops (asserted via a tree snapshot in tests/suppressed-cover-migration).
//   - It runs only via the gated, version-checked migrate() flow below; there
//     is no other auto-run entry point. The maintainer runs it on the real
//     corpus only after a `data/` + `media/` backup.
//   - Gated when `excludeImages === true` or `downloadMedia === false`
//     (data-only installs have no media on disk) and date-bounded to the
//     ACE-Step launch window so the large pre-audio corpus is never walked.

// ACE-Step audio (the only workflow that emits suppressed covers) launched on
// Civitai ~2026-06. Date-dir names are `YYYY-MM-DD`, which compare
// lexicographically as chronologically, so a string `>=` test bounds the scan
// to the launch window and skips the (much larger) pre-audio corpus — the same
// fromDate-threshold shape the historical video-filename migration used. A
// too-late threshold would merely leave a harmless on-disk orphan (the cover is
// already absent from the index), so the bound is the launch month.
const SUPPRESSED_COVER_PRUNE_FROM_DATE = '2026-06-01';

// Re-read each in-range generation and unlink the canonical file of any
// suppressed-step output. Returns a per-op report so a test can assert that a
// second run over an already-pruned corpus performs ZERO file ops.
export async function migrateSuppressedCovers () {
  const report = { pruned: 0 };

  // Data-only installs keep no media on disk — nothing to prune. The first
  // run of this version still has `excludeImages`; a later run has
  // `downloadMedia: false`.
  if (CONFIG.excludeImages === true || CONFIG.downloadMedia === false) {
    return report;
  }

  const dates = await getGenerationDates();

  for (const date of dates) {
    // Date-bound: skip everything before the ACE-Step launch window so the
    // pre-audio corpus is never read.
    if (date < SUPPRESSED_COVER_PRUNE_FROM_DATE) {
      continue;
    }

    const ids = await getGenerationIdsByDate(date);

    for (const id of ids) {
      const generation = await getGeneration(date, id);

      if (!generation || !Array.isArray(generation.steps)) {
        continue;
      }

      for (const step of generation.steps) {
        if (step?.metadata?.suppressOutput !== true) {
          continue;
        }

        // Canonical-first enumeration, mirroring getGeneratedMediaInfo: a
        // suppressed step's outputs live under `output` (canonical) or the
        // legacy `images` alias Civitai dual-emits during the rollout.
        const items = step.output ?? step.images;

        if (!Array.isArray(items)) {
          continue;
        }

        for (const item of items) {
          if (!item || typeof item !== 'object' || !item.id) {
            continue;
          }

          // Rebuild the exact canonical path the cover was saved under —
          // mediaFilepath single-sources the flat layout and preserves the
          // extension carried in the media-item id. A missing file is a no-op,
          // so a non-media suppressed step (the `chatCompletion` lyric step)
          // and a second run both prune nothing.
          const filepath = mediaFilepath({
            date,
            generationId: generation.id,
            mediaId: item.id,
            seed: item.seed
          });

          if (await fileExists(filepath)) {
            await unlink(filepath);
            report.pruned++;
          }
        }
      }
    }
  }

  return report;
}

const LIVE_INPUT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function createdAtInLiveWindow (iso, nowMs) {
  if (typeof iso !== 'string' || !iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t >= nowMs - LIVE_INPUT_WINDOW_MS;
}

function addInputReport (report, result) {
  report.saved += result.saved;
  report.reused += result.reused;
  report.skipped += result.skipped;
}

// Version-gated capture of still-live input blobs (now − 30 days).
// Idempotent: saveInputMedia reuses an existing inputs/ file and does not
// re-fetch. Additive: never unlinks. Fail-soft 404s via saveInputMedia.
// `now` is injectable so tests can pin the window without wall-clock flake.
async function liveFileFresh (filepath) {
  let st;
  try { st = await fsStat(filepath); } catch { return { fresh: false, mtimeMs: null }; }
  const gate = parkIfExplorerBusy();
  if (gate) await gate;
  const key = liveMarkKey(filepath);
  const prev = key ? prepMarks().live[key] : undefined;
  if (prev != null && prev === st.mtimeMs) return { fresh: true, mtimeMs: st.mtimeMs, key };
  return { fresh: false, mtimeMs: st.mtimeMs, key };
}

function rememberLive (key, mtimeMs) {
  if (!key || mtimeMs == null) return;
  prepMarks().live[key] = mtimeMs;
}

export async function migrateCaptureLiveInputs ({ now = () => new Date() } = {}) {
  const report = { saved: 0, reused: 0, skipped: 0 };
  try {

  if (CONFIG.excludeImages === true || CONFIG.downloadMedia === false) {
    return report;
  }

  await loadPrepMarks();
  const nowMs = now().getTime();
  const windowStartDay = new Date(nowMs - LIVE_INPUT_WINDOW_MS).toISOString().slice(0, 10);

  const dates = await getGenerationDates();
  for (const date of dates) {
    // Generation storage is createdAt-keyed; dirs before the window cannot
    // hold an in-window createdAt.
    if (date < windowStartDay) continue;
    const ids = await getGenerationIdsByDate(date);
    for (const id of ids) {
      const filepath = generationFilepath({ id, createdAt: `${date}T12:00:00.000Z` });
      const seen = await liveFileFresh(filepath);
      if (seen.fresh) continue;
      await waitForExplorerIdle();
      const generation = await getGeneration(date, id);
      if (!generation) continue;
      if (!createdAtInLiveWindow(generation.createdAt, nowMs)) {
        rememberLive(seen.key, seen.mtimeMs);
        continue;
      }
      const descriptors = extractInputDescriptors(generation, 'generation');
      addInputReport(report, await saveInputMedia(descriptors, { recall: 'auto' }));
      rememberLive(seen.key, seen.mtimeMs);
    }
  }

  async function capturePostDir (dir) {
    if (!(await fileExists(dir))) return;
    const files = await listDirectory(dir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    for (const file of jsonFiles) {
      const filepath = `${dir}/${file}`;
      const seen = await liveFileFresh(filepath);
      if (seen.fresh) continue;
      await waitForExplorerIdle();
      let post;
      try {
        post = JSON.parse(await readFile(filepath));
      } catch {
        continue;
      }
      const images = Array.isArray(post?.images) ? post.images : [];
      for (const image of images) {
        if (!createdAtInLiveWindow(image?.createdAt, nowMs)) continue;
        const descriptors = extractInputDescriptors(postedGenerationView(image).meta || image, 'post-image');
        addInputReport(report, await saveInputMedia(descriptors, { recall: 'auto' }));
      }
      rememberLive(seen.key, seen.mtimeMs);
    }
  }

  const postDates = await getPostDates();
  for (const date of postDates) {
    await capturePostDir(`${postsDataDir()}/${date}`);
  }
  // Drafts live in the dateless bucket (`posts/drafts/`), not a publishedAt
  // date dir. Image createdAt still gates the 30-day window.
  await capturePostDir(`${postsDataDir()}/${POST_DRAFTS_DIR}`);

  // Comics: if data/comics is absent this is a no-op. Do not invent a
  // comics reader — Phase 5b walks references through extractInputDescriptors.

  await savePrepMarks();
  return report;
  } finally {
    await flushFetchMiss();
  }
}

const OLD_DOWNLOAD_KEYS = ['excludeImages', 'generationMediaTypes', 'generationDataTypes'];

function hasOwn (key) {
  return Object.prototype.hasOwnProperty.call(CONFIG, key);
}

// Rewrites the download config. The export seed must already have read
// `generationMediaTypes` (including `feedback:disliked`). Does not invent
// `generationDownload` or `postDownload`. A second call on an already
// rewritten file writes nothing. An old key still present is derived again.
export async function migrateDownloadChoices () {
  const oldPresent = OLD_DOWNLOAD_KEYS.some(hasOwn);
  const newPresent = hasOwn('downloadMedia') && hasOwn('generationReactions');
  if (newPresent && !oldPresent) return;

  const dataOnly = CONFIG.excludeImages === true;
  const source = dataOnly
    ? (Array.isArray(CONFIG.generationDataTypes) ? CONFIG.generationDataTypes : [])
    : (Array.isArray(CONFIG.generationMediaTypes) ? CONFIG.generationMediaTypes : []);

  await setConfig({
    downloadMedia: !dataOnly,
    generationReactions: normalizeGenerationReactions(source)
  });

  for (const key of OLD_DOWNLOAD_KEYS) {
    if (hasOwn(key)) await removeConfigParam(key);
  }
}

export async function migrate () {
  await migrateDirectoryLayout();

  const versionMatches = CONFIG.version === CURRENT_VERSION;

  if (!versionMatches) {
    // One-time Exports layout cutover (Exports plan C2). Runs AFTER
    // migrateDirectoryLayout so a v4.x install reaches the v5 `all/<date>` layout
    // before this flattens it. Reads only `generationMediaTypes` plus on-disk
    // favorite/liked/disliked dirs — before migrateDownloadChoices deletes
    // those keys. Version-gated + run-once via the stamp below.
    await migrateExportsLayout();

    // One-time suppressed-cover prune (Phase 5a D3). Ordered AFTER
    // migrateExportsLayout so it runs on the final flat canonical layout, gated by
    // the same version check (the stamp below is the run-once sentinel). The D1
    // suppressOutput-skip is already live, so the covers this removes are on-disk
    // orphans the index no longer references. This run still has `excludeImages`.
    await migrateSuppressedCovers();

    // Live-window input capture (input-media leaf 3). Same version gate as
    // the stamp below; re-running on a later bump re-attempts the then-current
    // 30-day window. Additive, never unlinks.
    await migrateCaptureLiveInputs();
    await backfillContentHashes({ force: true });
    await migrateStoredExportQueries();
  }

  // Also when the version stamp already matches. The early return above
  // must not skip this rewrite.
  await migrateDownloadChoices();

  if (!versionMatches) {
    await setConfigParam('version', CURRENT_VERSION);
  }
}
