// src/exports.mjs — Exports module.
// Reactions created the original no-op stubs of notifyReaction*; Phase C1b
// (.cursor/plans/exports_e3b1c7a2.plan.md) replaces those bodies with the real
// reactive on-disk projection. The reaction PATCH handlers in server.mjs call
// these synchronously and ignore the return value, so they stay sync wrappers
// that schedule the (fail-soft, fire-and-forget) reactive sync. Do not delete
// or rename; Exports builds ON this module, it does not recreate it.
//
// `notifyReactionChanged` / `notifyReactionsChanged` consult ONLY the exports
// whose query references a user-editable annotation (favorite / feedback:*) via
// the in-memory dependency map (ruling 4). Metadata-only exports (e.g. model=X)
// are re-evaluated on the download-completion hook (`notifyDownloadCompleted`),
// never on a reaction PATCH. The reactive bodies live in the C1b section below.
export function notifyReactionChanged (normalizedMediaItemId) {
  if (normalizedMediaItemId == null) return;
  scheduleReactiveSync([normalizedMediaItemId]);
}
export function notifyReactionsChanged (normalizedMediaItemIds) {
  if (!Array.isArray(normalizedMediaItemIds) || !normalizedMediaItemIds.length) return;
  scheduleReactiveSync(normalizedMediaItemIds);
}

// =========================================================================
// Phase C1a — Exports module core (pure / storage only)
// =========================================================================
//
// The additive, side-effect-free foundation for the Exports feature
// (.cursor/plans/exports_e3b1c7a2.plan.md, sub-phase C1a). It owns:
//   - per-export persistence at data/exports/<slug>.json (CRUD + atomic write)
//   - collision-safe slug derivation (ruling 6)
//   - query evaluation that REUSES src/explorerQuery.mjs (ruling 1 — never a
//     reimplementation of the facet logic) over the media-item projection
//   - the pure materialiser diff and the pure plan classifier
//   - the filesystem capability probe (injectable fs)
//
// Deliberately NOT here (they are sub-phases C1b/C1c): the side-effecting
// sync engine (link/copy/unlink execution), the /api/exports server routes,
// the real bodies of the notify* hooks above (they stay unwired), and the UI.
//
// The canonical generation store is referenced ONLY through
// `canonicalGenerationMediaDir(date)` (ruling 8) — never the `all/` literal —
// so C2's flatten is a one-line repoint in generations.mjs.

import nodeFs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { CONFIG } from './cli.mjs';
import { writeFile, readFile, fileExists, listFiles, unlink, copyFile, rename, rm } from './utils.mjs';
import { applyFacets, mediaItemToFilterable } from './explorerQuery.mjs';
import { getIndex, getMediaItemById, isProduced } from './serverIndex.mjs';
import { currentOwnModels } from './ownModels.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import { canonicalGenerationMediaDir } from './generations.mjs';
import { inputsMediaDir } from './inputMedia.mjs';
import { comicsMediaDir } from './comics.mjs';

export const EXPORT_VERSION = 2;

// The op-count above which a bulk plan must be confirmed rather than applied
// silently (mirrors the UI's single drift/confirm threshold).
export const PLAN_OP_THRESHOLD = 200;

// --- Storage paths ---------------------------------------------------------
//
// CONFIG is a live binding (mutated by useConfig); read it at call time so a
// test's tmp config is honoured.

function exportsDir () { return `${CONFIG.dataPath}/exports`; }
function exportFilePath (slug) { return `${exportsDir()}/${slug}.json`; }

// --- Collision-safe slug (ruling 6) ---------------------------------------

export function slugify (name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Kebab-case the name; on collision with an already-taken slug append
// `-2`, `-3`, … An all-symbol name kebab-cases to '' and falls back to
// 'export' so a usable directory name always exists.
export function deriveSlug (name, existing = []) {
  const taken = existing instanceof Set ? existing : new Set(existing);
  const base = slugify(name) || 'export';
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// --- Persistable query keys (ruling 4) ------------------------------------
//
// A smart export stores ONLY membership keys (facets + `q`). Presentation
// / session keys are never persistable: `sort`, `groupBy`, `groupSort`,
// `select`, `page`, `granularity`. Do not treat `CONTROL_KEYS` as this
// split — that set is URL write-order and lumps `q` with sort.
// NOTE: the live evaluator + URL protocol use singular CSV keys (`tag`, not
// the stale `tags:[...]` shape in the plan's illustrative JSON), so the
// stored query is a flat params object handed straight to `applyFacets`.

const PERSISTABLE_QUERY_KEYS = new Set([
  'tag', 'reaction', 'type', 'ecosystem', 'model', 'version', 'resourceType', 'resource',
  'aspect', 'dateFrom', 'dateTo', 'cfgMin', 'cfgMax', 'stepsMin', 'stepsMax',
  'status', 'inPost', 'publication', 'usedAsInput', 'q', 'scope',
  'workflow', 'workflowMode', 'mine'
]);

export function sanitizeQuery (query = {}) {
  const out = {};
  for (const [key, value] of Object.entries(query || {})) {
    if (PERSISTABLE_QUERY_KEYS.has(key) && value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

// --- CRUD over data/exports/<slug>.json -----------------------------------

async function listSlugsOnDisk () {
  return (await listFiles(exportsDir()))
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -'.json'.length));
}

async function readExportRecord (slug) {
  const filepath = exportFilePath(slug);
  if (!(await fileExists(filepath))) return null;
  try {
    return JSON.parse(await readFile(filepath));
  } catch {
    return null;
  }
}

export async function readExport (slug) {
  const record = await readExportRecord(slug);
  return record ? { ...record, slug } : null;
}

export async function listExports () {
  const slugs = await listSlugsOnDisk();
  const out = [];
  for (const slug of slugs) {
    const record = await readExportRecord(slug);
    if (record) out.push({ ...record, slug });
  }
  return out;
}

export async function createExport ({ name, query = {}, path: destPath, linkMode = 'auto', type = 'smart', includeInputMedia = false } = {}) {
  if (!name || !String(name).trim()) {
    throw new Error('createExport requires a non-empty name');
  }
  const slug = deriveSlug(name, await listSlugsOnDisk());
  const record = {
    _version: EXPORT_VERSION,
    name: String(name),
    type,
    query: sanitizeQuery(query),
    path: destPath || `media/exports/${slug}`,
    linkMode,
    includeInputMedia: includeInputMedia === true,
    createdAt: new Date().toISOString(),
    lastSyncedAt: null,
    lastSyncedItemCount: 0
  };
  await writeFile(exportFilePath(slug), record);
  return { ...record, slug };
}

// Slug stays stable. The destination is changed with Edit (there is no
// separate Change destination control). Moving off the owned
// `media/exports/<slug>` folder removes that folder before the path field
// is written. A custom folder is left where it is.
export async function updateExport (slug, patch = {}, { fs: injected } = {}) {
  const fs = fsFor(injected);
  return withExportLock(slug, () => applyExportPatch(slug, patch, fs));
}

async function applyExportPatch (slug, patch, fs) {
  const current = await readExportRecord(slug);
  if (!current) return null;
  const record = { ...current, slug };
  const next = { ...current };
  if (patch.name !== undefined) next.name = String(patch.name);
  if (patch.query !== undefined) next.query = sanitizeQuery(patch.query);
  if (patch.linkMode !== undefined) next.linkMode = patch.linkMode;
  if (typeof patch.includeInputMedia === 'boolean') next.includeInputMedia = patch.includeInputMedia;
  if (patch.lastSyncedAt !== undefined) next.lastSyncedAt = patch.lastSyncedAt;
  if (patch.lastSyncedItemCount !== undefined) next.lastSyncedItemCount = patch.lastSyncedItemCount;

  if (patch.path !== undefined) {
    const previous = path.resolve(resolveExportRoot(record));
    const upcoming = path.resolve(resolveExportRoot({ ...record, path: patch.path }));
    if (previous !== upcoming && isOwnedExportRoot(record)) {
      const cleared = await removeOwnedExportTree(previous, fs);
      if (!cleared.ok) return { error: 'incomplete', code: cleared.code || 'EIO' };
    }
    next.path = patch.path;
  }

  await writeFile(exportFilePath(slug), next);
  return { ...next, slug };
}

async function removeExportRecord (slug) {
  const filepath = exportFilePath(slug);
  if (!(await fileExists(filepath))) return false;
  await unlink(filepath);
  return true;
}

// Detach: stop writers, then drop the record. Files stay.
export async function deleteExport (slug) {
  return withRemoval(slug, async () => {
    const removed = await removeExportRecord(slug);
    if (!removed) return { ok: false, error: 'not-found' };
    finishExportRemoval(slug);
    return { ok: true };
  });
}

// --- Query evaluation (reuses explorerQuery — ruling 1) -------------------
//
// Exports filter/materialise MEDIA-ITEMS, so evaluation runs over the index's
// `mediaItems` projection. That projection is flat, whereas explorerQuery's
// facet extractors were written for generation/post ENTRIES. The shape map
// that bridges the two — `mediaItemToFilterable` — was lifted out of this
// module into `src/explorerQuery.mjs` in Phase 4 (ruling 4) so it has a single
// home and the `/api/media` endpoint shares the exact same adapter. The
// filtering logic itself is never reimplemented here.

// One export's membership filter, yielded so a Download POST can run between
// slices. evaluateExport stays the synchronous contract for sync plans.
const RECONCILE_FILTER_BATCH = 400;

function exportFilterCtx (ownModels) {
  return {
    now: Date.now(),
    mediaById: getIndex().mediaById,
    ownModels: ownModels !== undefined ? ownModels : currentOwnModels()
  };
}

function exportSource (mediaItems) {
  return mediaItems || getIndex().mediaItems || [];
}

// Missing includeInputMedia on old JSON is false. Union is identity-keyed:
// each produced member's inputs[].id, resolved from the injected list or
// the live index, skipping unknowns. A produced start-frame stays produced.
function unionExportInputs (produced, source) {
  const byId = new Map();
  for (const mi of source) {
    if (mi?.id != null) byId.set(mi.id, mi);
  }

  const seen = new Set();
  const out = [];
  for (const mi of produced) {
    if (seen.has(mi.id)) continue;
    seen.add(mi.id);
    out.push(mi);
  }
  for (const mi of produced) {
    const inputs = Array.isArray(mi.inputs) ? mi.inputs : [];
    for (const input of inputs) {
      const id = input?.id;
      if (id == null || seen.has(id)) continue;
      const resolved = byId.get(id) || getMediaItemById(id);
      if (!resolved) continue;
      seen.add(id);
      out.push(resolved);
    }
  }
  return out;
}

function producedMatching (items, query, ctx) {
  return applyFacets(items.map(mediaItemToFilterable), query, 'prompt', ctx)
    .map(entry => entry._source);
}

// Returns the desired media-item SET (membership, not an ordered page — so
// `applySort` is intentionally not used). `mediaItems` may be injected for
// unit tests; it defaults to the live override-aware projection.
export function evaluateExport (exportDef, { mediaItems, ownModels } = {}) {
  const source = exportSource(mediaItems);
  const items = source.filter(isProduced);
  const query = sanitizeQuery(exportDef?.query || {});
  const produced = producedMatching(items, query, exportFilterCtx(ownModels));
  if (exportDef?.includeInputMedia !== true) return produced;
  return unionExportInputs(produced, source);
}

export async function evaluateExportInBatches (exportDef, { mediaItems, ownModels } = {}) {
  const source = exportSource(mediaItems);
  const items = source.filter(isProduced);
  const query = sanitizeQuery(exportDef?.query || {});
  const ctx = exportFilterCtx(ownModels);
  const produced = [];
  for (let i = 0; i < items.length; i += RECONCILE_FILTER_BATCH) {
    await new Promise((resolve) => { setImmediate(resolve); });
    produced.push(...producedMatching(items.slice(i, i + RECONCILE_FILTER_BATCH), query, ctx));
  }
  if (exportDef?.includeInputMedia !== true) return produced;
  return unionExportInputs(produced, source);
}

// --- Canonical-store / export path helpers --------------------------------
//
// `exportRelativeKey` is the per-media-item key used to build the desired /
// on-disk sets the diff operates over (the export subtree is split by source
// type per the plan's on-disk layout). `canonicalSourcePath` is the file the
// export hard-links FROM, routed through the ruling-8 helper.

function exportFileName (mediaItem) {
  return path.basename(mediaItem?.mediaPath || mediaItem?.thumbnailPath || '');
}

export function exportRelativeKey (mediaItem) {
  if (!mediaItem) return null;
  const filename = exportFileName(mediaItem);
  if (!filename) return null;
  if (!isProduced(mediaItem)) {
    return `inputs/${filename}`;
  }
  const date = mediaItem.date || '';
  const postRef = mediaItem.containers?.posts?.[0];
  const comicRef = mediaItem.containers?.comics?.[0];
  if (!mediaItem.containers?.generation && postRef) {
    return `posts/${date}/${postRef.id}/${filename}`;
  }
  if (!mediaItem.containers?.generation && comicRef) {
    const chapterFolder = comicRef.chapterFolder;
    if (chapterFolder) {
      return `comics/${date}/${comicRef.id}/${chapterFolder}/${filename}`;
    }
    const thumb = mediaItem.thumbnailPath || '';
    if (thumb.startsWith('/media/')) return thumb.slice('/media/'.length);
  }
  return `generations/${date}/${filename}`;
}

export function canonicalSourcePath (mediaItem) {
  if (mediaItem?.containers?.generation) {
    const filename = exportFileName(mediaItem);
    if (!filename) return null;
    return path.join(canonicalGenerationMediaDir(mediaItem.date || ''), filename);
  }
  const thumb = mediaItem?.thumbnailPath || '';
  if (thumb.startsWith('/media/inputs/')) {
    const filename = path.basename(thumb);
    if (!filename) return null;
    return path.join(inputsMediaDir(), filename);
  }
  const comicRef = mediaItem?.containers?.comics?.[0];
  const postRef = mediaItem?.containers?.posts?.[0];
  if (comicRef && !postRef) {
    const prefix = '/media/comics/';
    if (thumb.startsWith(prefix)) {
      return path.join(comicsMediaDir(), thumb.slice(prefix.length));
    }
  }
  // Post-only produced: keep returning null (do not expand post-only
  // materialisation in this plan).
  return null;
}

// --- Pure materialiser diff -----------------------------------------------
//
// Set arithmetic over file-path keys; no fs side effects. `add` = desired but
// not present; `remove` = present but no longer desired; equal sets → no-op.

function toKeySet (input) {
  if (input instanceof Set) return new Set(input);
  return new Set(Array.isArray(input) ? input : []);
}

export function diff (desired, onDisk) {
  const desiredSet = toKeySet(desired);
  const onDiskSet = toKeySet(onDisk);
  const add = [];
  const remove = [];
  for (const key of desiredSet) if (!onDiskSet.has(key)) add.push(key);
  for (const key of onDiskSet) if (!desiredSet.has(key)) remove.push(key);
  return { add, remove };
}

// --- Pure plan classifier -------------------------------------------------
//
// `confirm` when (copy mode AND bytes are moved) OR (>200 total ops) OR (any
// deletion); else `auto`. `add`/`remove` accept either counts or the diff's
// arrays/sets.

function count (value) {
  if (Array.isArray(value)) return value.length;
  if (value instanceof Set) return value.size;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function classifyPlan ({ mode, add = 0, remove = 0, bytesNeeded = 0 } = {}) {
  const addN = count(add);
  const removeN = count(remove);
  if (mode === 'copy' && count(bytesNeeded) > 0) return 'confirm';
  if (addN + removeN > PLAN_OP_THRESHOLD) return 'confirm';
  if (removeN > 0) return 'confirm';
  return 'auto';
}

// --- Filesystem capability probe ------------------------------------------
//
// Probe a destination: hard-link a tiny tempfile (created in the canonical
// store) into it, then clean both up. Success → 'hardlink'; the cross-volume
// / unsupported-fs error codes → 'copy'. A cloud-sync destination path
// short-circuits to copy + a one-time confirmation (hard links are unreliable
// inside those agents). Cached per session per destination; `fs` and `cache`
// are injectable for tests (default `node:fs/promises` + the session cache).

const CLOUD_SYNC_PATTERN = /Dropbox|iCloud|OneDrive|Google Drive|pCloud/i;
const PROBE_COPY_FALLBACK_CODES = new Set(['EXDEV', 'EPERM', 'ENOSYS', 'EOPNOTSUPP']);
const sessionProbeCache = new Map();

export function isCloudSyncPath (destPath) {
  return CLOUD_SYNC_PATTERN.test(String(destPath || ''));
}

export async function probeDestination (destPath, { fs = nodeFs, cache = sessionProbeCache, canonicalDir } = {}) {
  const key = String(destPath || '');
  if (cache.has(key)) return cache.get(key);

  if (isCloudSyncPath(key)) {
    const cloudResult = { mode: 'copy', requiresConfirmation: true };
    cache.set(key, cloudResult);
    return cloudResult;
  }

  const probeName = `.civsync-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const srcDir = canonicalDir != null ? canonicalDir : canonicalGenerationMediaDir('');
  const srcPath = path.join(srcDir, probeName);
  const destProbe = path.join(key, probeName);

  let result;
  let probeStep = 'library';
  try {
    probeStep = 'library';
    await fs.mkdir(srcDir, { recursive: true });
    probeStep = 'destination';
    await fs.mkdir(key, { recursive: true });
    probeStep = 'library';
    await fs.writeFile(srcPath, '');
    probeStep = 'link';
    await fs.link(srcPath, destProbe);
    result = { mode: 'hardlink', requiresConfirmation: false };
  } catch (error) {
    if (PROBE_COPY_FALLBACK_CODES.has(error?.code)) {
      result = { mode: 'copy', requiresConfirmation: false };
    } else {
      if (probeStep === 'library') tagLibrary(error);
      else tagDestination(error, { op: probeStep === 'link' ? 'link' : 'write' });
      throw error;
    }
  } finally {
    await Promise.resolve(fs.unlink(destProbe)).catch(() => {});
    await Promise.resolve(fs.unlink(srcPath)).catch(() => {});
  }

  cache.set(key, result);
  return result;
}

export function clearProbeCache () {
  sessionProbeCache.clear();
}

// =========================================================================
// Phase C1b — Side-effecting sync engine + reactive wiring
// =========================================================================
//
// Builds the on-disk projection ON the C1a pure core (evaluateExport / diff /
// classifyPlan / probeDestination / exportRelativeKey / canonicalSourcePath),
// none of whose signatures change here. Two callers share ONE materialiser:
//   - reactive  : a handful of changed media-items, silent, link-cheap
//   - bulk      : whole-export diff, plan-gated, background job + SSE
//
// Everything is fail-soft on a missing/offline/full destination (ruling: an
// annotation edit must never break) and idempotent (a re-sync with no real
// drift performs ZERO fs ops — ruling 5). Every canonical-store reference is
// routed through `canonicalSourcePath` → `canonicalGenerationMediaDir`
// (ruling 8) so C2's flatten is a one-line repoint.

// --- Concurrency budget (the shared I/O caps) -----------------------------
//
// Hard links / unlinks / stats are metadata ops and bypass the copy cap.
// Byte-copying ops share ONE global semaphore so a bulk copy can't run
// flat-out across exports. The download path's own copy ops live in
// generations.mjs (`saveGenerationMedia`, out of scope for C1b — C2 wires it
// into this same cap); within Exports the reactive + bulk copy callers share
// `globalCopySemaphore`.

const REACTIVE_LINK_CONCURRENCY = 8;
const BULK_LINK_CONCURRENCY = 8;
const BULK_COPY_CONCURRENCY = 2;
const GLOBAL_COPY_OPS_CAP = 2;

function createSemaphore (max) {
  let active = 0;
  const queue = [];
  async function run (fn) {
    if (active >= max) {
      await new Promise(resolve => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  }
  return { run };
}

const globalCopySemaphore = createSemaphore(GLOBAL_COPY_OPS_CAP);

// --- Injectable fs facade -------------------------------------------------
//
// All side effects route through a small facade so tests can drive link→copy
// fallbacks, fail-soft error codes, and statfs without a real cross-volume
// mount. Byte ops (copyFile/rename/unlink) use the retry-wrapped utils
// helpers; metadata ops use node:fs/promises directly.

const defaultFsFacade = {
  mkdir: (dir) => nodeFs.mkdir(dir, { recursive: true }),
  // The C1a capability probe writes a tiny tempfile before attempting the
  // hard-link, so the facade MUST expose writeFile or any `linkMode: 'auto'`
  // sync throws a TypeError at probe time (not a fail-soft code → it escapes
  // as a 500 and silently breaks the post-download auto-reconcile).
  writeFile: (p, data) => nodeFs.writeFile(p, data),
  link: (src, dest) => nodeFs.link(src, dest),
  copyFile: (src, dest) => copyFile(src, dest),
  rename: (src, dest) => rename(src, dest),
  unlink: (dest) => unlink(dest),
  rm: (target, options) => rm(target, options),
  rmdir: (dir) => nodeFs.rmdir(dir),
  stat: (p) => nodeFs.stat(p),
  lstat: (p) => nodeFs.lstat(p),
  realpath: (p) => nodeFs.realpath(p),
  readdir: (dir) => nodeFs.readdir(dir, { withFileTypes: true }),
  statfs: (p) => nodeFs.statfs(p)
};

function fsFor (injected) {
  return injected ? { ...defaultFsFacade, ...injected } : defaultFsFacade;
}

// Errors that mean "the destination is unavailable, not that the code is
// wrong": an unplugged drive, a deleted/again-offline cloud folder, a full
// disk, a permission revocation. These are caught, the export is marked
// Pending with a structured reason, and the call returns WITHOUT throwing.
const FAIL_SOFT_CODES = new Set(['ENOENT', 'EACCES', 'ENOSPC', 'EIO', 'EPERM']);

// Which side failed. The status sentence is chosen from this, not from the
// Node message (syscall + absolute path). Swallowed ENOENT is not a fault.
function tagLibrary (error) {
  if (error && typeof error === 'object' && !error.exportFault) error.exportFault = 'library';
  return error;
}

function tagDestination (error, { op } = {}) {
  if (!error || typeof error !== 'object' || error.exportFault) return error;
  const code = error.code;
  if (op === 'link' && code === 'EPERM') error.exportFault = 'hardlink';
  else if (code === 'ENOSPC') error.exportFault = 'destination-space';
  else if (code === 'EIO') error.exportFault = 'destination-io';
  else if (code === 'ENOENT') error.exportFault = 'destination-missing';
  else error.exportFault = 'destination-denied';
  return error;
}

// --- Export status store (in-memory) --------------------------------------
//
// The UI surfaces these in C1c (blank | Syncing N/M | Pending | Error). C1b
// is the producer: bulk sets `syncing` then `idle`; cancel + fail-soft +
// drift set `pending`; an unexpected job failure sets `error`.

const statusStore = new Map(); // slug -> { state, reason, drift, jobId, syncedAt }

let reconcileBarrier = null;

// Pauses the startup walk so a test can read status before the walk writes it.
// Production never sets this.
export function __setExportReconcileBarrierForTest (promise) {
  reconcileBarrier = promise;
}

export function __clearExportStatusStoreForTest () {
  statusStore.clear();
}

export function exportStatusPayload (slug) {
  return { ...getExportStatus(slug), checked: statusStore.has(slug) };
}

function setStatus (slug, patch) {
  const current = statusStore.get(slug) || { state: 'idle', reason: null };
  const next = { ...current, ...patch };
  statusStore.set(slug, next);
  return next;
}

export function getExportStatus (slug) {
  return statusStore.get(slug) || { state: 'idle', reason: null };
}

export function listExportStatuses () {
  return Object.fromEntries(statusStore);
}

// --- Per-export serialisation ---------------------------------------------
//
// Within one export only one sync runs at a time (reactive, bulk, reconcile
// all chain through the same lock); across exports they run in parallel up to
// the budget. The chain runs the next task regardless of the prior outcome.

const exportLocks = new Map(); // slug -> tail promise

function withExportLock (slug, fn) {
  const prev = exportLocks.get(slug) || Promise.resolve();
  const run = prev.then(() => fn(), () => fn());
  exportLocks.set(slug, run.then(() => {}, () => {}));
  return run;
}

// Set for the whole removal, before the lock is acquired, so a sync that
// already holds the lock stops at its next file. Cleared inside the lock
// before the lock is released.
const removing = new Set();

function withLiveExport (slug, fn) {
  return withExportLock(slug, async () => {
    if (removing.has(slug)) return { aborted: true };
    const rec = await readExport(slug);
    if (!rec) return { aborted: true };
    return fn(rec);
  });
}

async function withRemoval (slug, fn) {
  removing.add(slug);
  cancelSyncJobsForSlug(slug);
  try {
    return await withExportLock(slug, async () => {
      try {
        const exportDef = await readExport(slug);
        if (!exportDef) return { ok: false, error: 'not-found' };
        return await fn(exportDef);
      } finally {
        removing.delete(slug);
      }
    });
  } catch (error) {
    removing.delete(slug);
    throw error;
  }
}

// --- Path resolution + on-disk walk ---------------------------------------
//
// The stored `path` is mediaPath-rooted: the layout's `media/exports/<slug>`
// means `<CONFIG.mediaPath>/exports/<slug>` (the leading `media/` segment IS
// the media root, mirroring server.mjs's `/media/...` → mediaDir mapping). An
// absolute path is used verbatim; any other relative path resolves under
// mediaPath.

export function resolveExportRoot (exportDef) {
  const raw = exportDef?.path || `media/exports/${exportDef?.slug || ''}`;
  if (path.isAbsolute(raw)) return raw;
  let rel = raw.replace(/^\.?[/\\]/, '');
  if (rel.startsWith('media/') || rel.startsWith('media\\')) {
    rel = rel.slice('media/'.length);
  }
  return path.join(CONFIG.mediaPath, rel);
}

// Walk the export's resolved dir and collect existing relative keys
// (`generations/<date>/<file>` | `posts/<date>/<postId>/<file>`) — the set the
// pure diff operates against. A missing root is an empty set (ENOENT → []);
// other errors propagate so fail-soft can classify them.
async function walkExportKeys (root, { fs = defaultFsFacade } = {}) {
  const keys = [];
  async function walk (dir, prefix) {
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw tagDestination(error);
    }
    for (const ent of entries) {
      const name = ent?.name;
      if (!name || name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${name}` : name;
      const isDir = typeof ent.isDirectory === 'function' && ent.isDirectory();
      if (isDir) {
        await walk(path.join(dir, name), rel);
      } else {
        keys.push(rel);
      }
    }
  }
  await walk(root, '');
  return keys;
}

// --- Mode resolution ------------------------------------------------------

async function resolveModeAndProbe (exportDef, exportRoot, { fs = defaultFsFacade } = {}) {
  const linkMode = exportDef?.linkMode || 'auto';
  if (linkMode === 'hardlink') return { mode: 'hardlink', requiresConfirmation: false };
  if (linkMode === 'copy') return { mode: 'copy', requiresConfirmation: false };
  const probe = await probeDestination(exportRoot, { fs });
  return { mode: probe.mode, requiresConfirmation: probe.requiresConfirmation };
}

// --- Fail-soft wrapper ----------------------------------------------------

async function failSoft (slug, fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (FAIL_SOFT_CODES.has(error?.code)) {
      const reason = { code: error.code, message: error.message };
      if (error.exportFault) reason.fault = error.exportFault;
      setStatus(slug, { state: 'pending', reason });
      return { ok: false, failSoft: true, code: error.code };
    }
    throw error;
  }
}

// --- Size / existence / free-space helpers --------------------------------

async function fileSize (p, fs) {
  try { const st = await fs.stat(p); return st?.size || 0; } catch { return 0; }
}

async function pathExists (p, fs) {
  try { await fs.stat(p); return true; } catch { return false; }
}

// `ENOENT` on the file while the media root is readable: this output was
// never saved (or was deleted). `ENOENT` on the media root itself: the
// canonical store is unavailable — caller fail-softs, same as a missing dest.
async function directoryExists (p, fs) {
  try {
    const st = await fs.stat(p);
    if (typeof st?.isDirectory === 'function') return st.isDirectory();
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw tagLibrary(error);
  }
}

async function canonicalSourceState (src, fs, dirCache) {
  try {
    await fs.stat(src);
    return 'present';
  } catch (error) {
    if (error?.code !== 'ENOENT') throw tagLibrary(error);
    const mediaRoot = CONFIG.mediaPath;
    if (mediaRoot) {
      if (!dirCache.has(mediaRoot)) dirCache.set(mediaRoot, await directoryExists(mediaRoot, fs));
      if (!dirCache.get(mediaRoot)) {
        const err = new Error(`canonical store unavailable: ${mediaRoot}`);
        err.code = 'ENOENT';
        err.exportFault = 'library';
        throw err;
      }
    }
    return 'absent';
  }
}

// Keys already in the export stay even when the source is gone, so a missing
// file is not a remove of the last hard link. A key not yet exported is an
// add only when the source stat succeeds.
async function collectDesiredSources (items, { fs, onDiskSet }) {
  const desiredMap = new Map();
  const dirCache = new Map();
  let skippedNoSource = 0;
  let skippedMissing = 0;
  for (const mediaItem of items) {
    const relKey = exportRelativeKey(mediaItem);
    if (!relKey) continue;
    const src = canonicalSourcePath(mediaItem);
    if (!src) { skippedNoSource++; continue; }
    if (onDiskSet.has(relKey)) {
      desiredMap.set(relKey, src);
      continue;
    }
    const state = await canonicalSourceState(src, fs, dirCache);
    if (state === 'absent') { skippedMissing++; continue; }
    desiredMap.set(relKey, src);
  }
  return { desiredMap, skippedNoSource, skippedMissing };
}

// statfs the nearest existing ancestor (the export root may not exist yet).
async function availableBytesNear (p, fs) {
  let dir = p;
  for (let i = 0; i < 64 && dir; i++) {
    try {
      const st = await fs.statfs(dir);
      const blocks = st.bavail ?? st.bfree;
      if (blocks != null && st.bsize != null) return blocks * st.bsize;
      return null;
    } catch (error) {
      if (error?.code !== 'ENOENT') return null;
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
  return null;
}

function estimateSeconds ({ mode, addCount, removeCount, bytesNeeded }) {
  if (mode === 'copy' && bytesNeeded > 0) {
    return Math.max(1, Math.ceil(bytesNeeded / (80 * 1024 * 1024))); // ~80 MB/s
  }
  return Math.ceil((addCount + removeCount) / 500); // metadata ops are ~free
}

// --- The materialiser: plan -----------------------------------------------
//
// desired set = evaluateExport → each media-item's exportRelativeKey mapped to
// its canonicalSourcePath; on-disk set = walk; diff over keys (the C1a pure
// function). Post-only media-items have no generation canonical source in C1
// (the post canonical store is a separate tree) — they are skipped with a
// warning rather than producing a dangling link.

async function computeSyncPlan (exportDef, { mediaItems, fs = defaultFsFacade } = {}) {
  const exportRoot = resolveExportRoot(exportDef);
  const desired = evaluateExport(exportDef, { mediaItems });
  const onDisk = await walkExportKeys(exportRoot, { fs });
  const { desiredMap, skippedNoSource, skippedMissing } = await collectDesiredSources(desired, {
    fs,
    onDiskSet: new Set(onDisk)
  });
  const { add: addKeys, remove: removeKeys } = diff([...desiredMap.keys()], onDisk);

  const { mode, requiresConfirmation } = await resolveModeAndProbe(exportDef, exportRoot, { fs });

  const sizeByKey = new Map();
  let bytesNeeded = 0;
  if (mode === 'copy') {
    for (const key of addKeys) {
      const sz = await fileSize(desiredMap.get(key), fs);
      sizeByKey.set(key, sz);
      bytesNeeded += sz;
    }
  }

  const classification = classifyPlan({ mode, add: addKeys, remove: removeKeys, bytesNeeded });

  const warnings = [];
  if (skippedNoSource > 0) warnings.push({ code: 'post-only-skipped', count: skippedNoSource });
  if (skippedMissing > 0) warnings.push({ code: 'missing-source', count: skippedMissing });
  if (requiresConfirmation) warnings.push({ code: 'cloud-sync-copy' });

  return {
    exportRoot,
    mode,
    classification,
    addKeys,
    removeKeys,
    desiredMap,
    sizeByKey,
    bytesNeeded,
    desiredCount: desiredMap.size,
    estimatedSeconds: estimateSeconds({ mode, addCount: addKeys.length, removeCount: removeKeys.length, bytesNeeded }),
    warnings
  };
}

// --- The materialiser: apply ----------------------------------------------
//
// `add` → hard-link (or copy per mode) canonicalSourcePath → <root>/<relKey>,
// mkdir -p parents; copies are atomic (tmp → rename) and pass through the
// global copy cap. `remove` → unlink. EEXIST on a link and ENOENT on an unlink
// are absorbed so a re-run after a partial converges (idempotent).

// False: the source is not on disk. Caller skips that key. A missing
// destination still throws (mkdir / link) so fail-soft can mark Pending.
async function linkOrCopy (src, dest, mode, fs, abort) {
  if (abort?.()) return false;
  if (!(await pathExists(src, fs))) return false;
  if (abort?.()) return false;
  try {
    await fs.mkdir(path.dirname(dest));
  } catch (error) {
    throw tagDestination(error);
  }
  if (abort?.()) return false;
  if (mode === 'copy') {
    const tmp = `${dest}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    try {
      await globalCopySemaphore.run(async () => {
        await fs.copyFile(src, tmp);
        await fs.rename(tmp, dest);
      });
    } catch (error) {
      throw tagDestination(error);
    }
  } else {
    try {
      await fs.link(src, dest);
    } catch (error) {
      if (error?.code === 'EEXIST') return true; // already linked — idempotent
      throw tagDestination(error, { op: 'link' });
    }
  }
  return true;
}

async function runOps (keys, sem, worker) {
  await Promise.all(keys.map(key => sem.run(async () => {
    // Yield to the event loop so foreground HTTP traffic interleaves with a
    // large sync (the background-job responsiveness contract).
    await new Promise(resolve => setTimeout(resolve, 0));
    return worker(key);
  })));
}

async function applySyncPlan (exportDef, plan, { fs = defaultFsFacade, job } = {}) {
  const slug = exportDef.slug;
  setStatus(slug, {
    state: 'syncing',
    jobId: job?.id || null,
    reason: null,
    drift: { add: plan.addKeys.length, remove: plan.removeKeys.length }
  });

  const result = { added: 0, removed: 0, copied: 0, bytesDone: 0 };

  const outcome = await failSoft(slug, async () => {
    const sem = createSemaphore(plan.mode === 'copy' ? BULK_COPY_CONCURRENCY : BULK_LINK_CONCURRENCY);

    const abort = () => job?.cancelled || removing.has(slug);
    await runOps(plan.addKeys, sem, async (key) => {
      if (abort()) return;
      const src = plan.desiredMap.get(key);
      const dest = path.join(plan.exportRoot, key);
      const wrote = await linkOrCopy(src, dest, plan.mode, fs, abort);
      if (!wrote) {
        if (job) { job.filesDone++; job.currentPath = key; emitJob(job); }
        return;
      }
      result.added++;
      if (plan.mode === 'copy') {
        result.copied++;
        const sz = plan.sizeByKey.get(key) || 0;
        result.bytesDone += sz;
        if (job) job.bytesDone += sz;
      }
      if (job) { job.filesDone++; job.currentPath = key; emitJob(job); }
    });

    await runOps(plan.removeKeys, sem, async (key) => {
      if (abort()) return;
      const dest = path.join(plan.exportRoot, key);
      try {
        await fs.unlink(dest);
        result.removed++;
      } catch (error) {
        if (error?.code !== 'ENOENT') throw tagDestination(error); // ENOENT: already gone
      }
      if (job) { job.filesDone++; job.currentPath = key; emitJob(job); }
    });

    return result;
  });

  if (!outcome.ok) {
    // fail-soft already marked the export Pending with the structured reason.
    if (job) { job.status = 'error'; job.error = outcome.code; emitJob(job, { force: true }); finalizeJob(job); }
    return { ...result, failSoft: true, code: outcome.code };
  }

  if (removing.has(slug)) {
    if (job && job.status === 'running') {
      job.status = 'cancelled';
      emitJob(job, { force: true });
      finalizeJob(job);
    }
    return { ...result, aborted: true };
  }

  if (job?.cancelled) {
    if (job) { job.status = 'cancelled'; emitJob(job, { force: true }); finalizeJob(job); }
    // Cancel stops scheduling; remaining drift self-heals on the next sync.
    setStatus(slug, { state: 'pending', reason: { code: 'cancelled' }, jobId: null });
    return { ...result, cancelled: true };
  }

  if (job) { job.status = 'done'; emitJob(job, { force: true }); finalizeJob(job); }
  setStatus(slug, { state: 'idle', reason: null, jobId: null, syncedAt: new Date().toISOString() });
  // Already inside the export lock. updateExport would take it again.
  await applyExportPatch(slug, {
    lastSyncedAt: new Date().toISOString(),
    lastSyncedItemCount: plan.desiredCount
  }, fs).catch(() => {});
  return result;
}

// --- Background job registry + SSE bridge ---------------------------------
//
// `POST /api/exports/:id/sync` creates a job synchronously (so the SSE route
// can find it) and defers the apply. Subscribers get the current snapshot
// immediately then every throttled progress tick; closing the tab does not
// stop the job (reopening rediscovers it until it is pruned).

const syncJobs = new Map(); // jobId -> job

function newJobId () {
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createJob (slug, plan) {
  const job = {
    id: newJobId(),
    slug,
    mode: plan.mode,
    status: 'running',
    cancelled: false,
    error: null,
    filesDone: 0,
    filesTotal: plan.addKeys.length + plan.removeKeys.length,
    bytesDone: 0,
    bytesTotal: plan.bytesNeeded,
    currentPath: '',
    startedAt: Date.now(),
    listeners: new Set(),
    _lastEmit: 0
  };
  syncJobs.set(job.id, job);
  return job;
}

function jobSnapshot (job) {
  const elapsed = (Date.now() - job.startedAt) / 1000;
  const ratePerSec = elapsed > 0 ? job.bytesDone / elapsed : 0;
  const remaining = Math.max(0, job.bytesTotal - job.bytesDone);
  const etaSec = ratePerSec > 0 ? remaining / ratePerSec : 0;
  return {
    type: 'export-sync',
    jobId: job.id,
    slug: job.slug,
    status: job.status,
    mode: job.mode,
    filesDone: job.filesDone,
    filesTotal: job.filesTotal,
    bytesDone: job.bytesDone,
    bytesTotal: job.bytesTotal,
    currentPath: job.currentPath,
    ratePerSec,
    etaSec,
    error: job.error || null,
    final: job.status !== 'running'
  };
}

function emitJob (job, { force = false } = {}) {
  const now = Date.now();
  if (!force && now - job._lastEmit < 80) return;
  job._lastEmit = now;
  const snap = jobSnapshot(job);
  for (const listener of job.listeners) {
    try { listener(snap); } catch { /* a dead SSE socket must not break the job */ }
  }
}

function finalizeJob (job) {
  const timer = setTimeout(() => { syncJobs.delete(job.id); }, 5 * 60 * 1000);
  if (timer && typeof timer.unref === 'function') timer.unref();
}

export function getSyncJob (jobId) {
  const job = syncJobs.get(jobId);
  return job ? jobSnapshot(job) : null;
}

export function subscribeSyncJob (jobId, listener) {
  const job = syncJobs.get(jobId);
  if (!job) return null;
  job.listeners.add(listener);
  try { listener(jobSnapshot(job)); } catch { /* ignore */ }
  return () => { job.listeners.delete(listener); };
}

export function cancelSyncJob (jobId) {
  const job = syncJobs.get(jobId);
  if (!job) return { ok: false, status: 404, message: 'Unknown sync job' };
  if (job.status !== 'running') return { ok: true, alreadyFinished: true };
  job.cancelled = true;
  return { ok: true };
}

function cancelSyncJobsForSlug (slug) {
  for (const job of syncJobs.values()) {
    if (job.slug === slug && job.status === 'running') job.cancelled = true;
  }
}

function settleSyncJob (job, out) {
  if (out?.aborted && job.status === 'running') {
    job.status = 'cancelled';
    emitJob(job, { force: true });
    finalizeJob(job);
  }
}

// --- Bulk sync entry points -----------------------------------------------

// Background entry used by the server route. Returns the plan + jobId in
// milliseconds, then applies in the background under the per-export lock.
export async function startBulkSync (slug, { mediaItems, fs = defaultFsFacade, schedule = (fn) => { setTimeout(fn, 0); } } = {}) {
  const exportDef = await readExport(slug);
  if (!exportDef) return { error: 'not-found' };

  const planOutcome = await failSoft(slug, () => computeSyncPlan(exportDef, { mediaItems, fs }));
  if (!planOutcome.ok) return { failSoft: true, code: planOutcome.code };
  const plan = planOutcome.value;

  if (plan.mode === 'copy' && plan.bytesNeeded > 0) {
    const available = await availableBytesNear(plan.exportRoot, fs);
    if (available != null && plan.bytesNeeded > 0.9 * available) {
      setStatus(slug, { state: 'pending', reason: { code: 'insufficient-space' } });
      return { error: 'insufficient-space', bytesNeeded: plan.bytesNeeded, available };
    }
  }

  const job = createJob(slug, plan);
  setStatus(slug, {
    state: 'syncing',
    jobId: job.id,
    reason: null,
    drift: { add: plan.addKeys.length, remove: plan.removeKeys.length }
  });

  schedule(() => {
    withLiveExport(slug, (rec) => {
      plan.exportRoot = resolveExportRoot(rec);
      return applySyncPlan(rec, plan, { fs, job });
    }).then((out) => {
      settleSyncJob(job, out);
    }).catch(() => {
      job.status = 'error';
      emitJob(job, { force: true });
      finalizeJob(job);
    });
  });

  return { jobId: job.id, plan, job };
}

// Awaitable full sync (plan + apply under the lock). Used by tests and any
// caller that wants to block until the projection is current.
export async function syncExportNow (slug, { mediaItems, fs = defaultFsFacade } = {}) {
  const out = await withLiveExport(slug, async (exportDef) => {
    const planOutcome = await failSoft(slug, () => computeSyncPlan(exportDef, { mediaItems, fs }));
    if (!planOutcome.ok) return { failSoft: true, code: planOutcome.code, plan: null };
    const plan = planOutcome.value;
    const job = createJob(slug, plan);
    const result = await applySyncPlan(exportDef, plan, { fs, job });
    return { plan, result, jobId: job.id };
  });
  if (out?.aborted) return { error: 'not-found' };
  return out;
}

// --- Dependency map (annotation → [exportSlug]) ---------------------------
//
// Built from each export's persistable `query.reaction` (a CSV of
// `favorite` / `feedback:*`). A reaction PATCH only carries the changed
// media-item id, not which annotation flipped, so a toggle consults the UNION
// of annotation-referencing exports (still excluding metadata-only ones —
// ruling 4) and re-evaluates each over just the changed items. Rebuilt on
// export create/edit/delete (the server routes invalidate it) and on startup.

let dependencyMap = new Map(); // annotationKey -> Set<slug>
let dependencyMapReady = false;

function isUserEditableAnnotation (tag) {
  return tag === 'favorite' || tag.startsWith('feedback:');
}

export async function rebuildDependencyMap ({ exports } = {}) {
  const list = exports || await listExports();
  const map = new Map();
  for (const exp of list) {
    const tagParam = exp.query?.reaction;
    if (!tagParam) continue;
    const tags = String(tagParam).split(',').map(s => s.trim()).filter(Boolean);
    for (const tag of tags) {
      if (!isUserEditableAnnotation(tag)) continue;
      if (!map.has(tag)) map.set(tag, new Set());
      map.get(tag).add(exp.slug);
    }
  }
  dependencyMap = map;
  dependencyMapReady = true;
  return map;
}

export function invalidateDependencyMap () {
  dependencyMapReady = false;
}

async function ensureDependencyMap () {
  if (!dependencyMapReady) await rebuildDependencyMap();
  return dependencyMap;
}

function annotationDependentSlugs (map) {
  const slugs = new Set();
  for (const set of map.values()) for (const slug of set) slugs.add(slug);
  return slugs;
}

// --- Reactive sync --------------------------------------------------------
//
// Per-export, over ONLY the changed media-items: re-evaluate membership; a
// now-desired item is linked if absent, a no-longer-desired item is unlinked
// if present. Fail-soft per export so one offline destination never blocks the
// others (or the annotation write that triggered this).

function resolveChangedItem (id, mediaItems) {
  const norm = normalizeMediaId(id);
  if (mediaItems) return mediaItems.find(mi => mi.id === norm || mi.id === id) || null;
  return getMediaItemById(id) || null;
}

async function reactiveSyncOne (exportDef, changedItems, { fs = defaultFsFacade } = {}) {
  if (!exportDef || removing.has(exportDef.slug)) return;
  const slug = exportDef.slug;
  const exportRoot = resolveExportRoot(exportDef);

  return failSoft(slug, async () => {
    const { mode } = await resolveModeAndProbe(exportDef, exportRoot, { fs });
    const desiredIds = new Set(
      evaluateExport(exportDef, { mediaItems: changedItems }).map(mi => mi.id)
    );
    const sem = createSemaphore(mode === 'copy' ? BULK_COPY_CONCURRENCY : REACTIVE_LINK_CONCURRENCY);

    await Promise.all(changedItems.map(mediaItem => sem.run(async () => {
      if (removing.has(slug)) return;
      const relKey = exportRelativeKey(mediaItem);
      if (!relKey) return;
      const dest = path.join(exportRoot, relKey);
      const present = await pathExists(dest, fs);
      if (desiredIds.has(mediaItem.id)) {
        const src = canonicalSourcePath(mediaItem);
        if (!src) return; // post-only — no generation canonical source in C1
        if (!present) await linkOrCopy(src, dest, mode, fs, () => removing.has(slug));
      } else if (present) {
        try {
          await fs.unlink(dest);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw tagDestination(error);
        }
      }
    })));
    return null;
  });
}

// Awaitable reactive sync over the changed media-item ids. The fire-and-forget
// wrappers at the top of this module call `scheduleReactiveSync`, which calls
// this and swallows the result; tests call it directly with injected items.
export async function syncReactive (ids, { mediaItems, fs = defaultFsFacade } = {}) {
  const map = await ensureDependencyMap();
  const slugs = annotationDependentSlugs(map);
  if (!slugs.size) return { exports: 0 };

  const changed = (ids || []).map(id => resolveChangedItem(id, mediaItems)).filter(Boolean);
  if (!changed.length) return { exports: 0 };

  let touched = 0;
  for (const slug of slugs) {
    await withLiveExport(slug, (exportDef) => reactiveSyncOne(exportDef, changed, { fs }));
    touched++;
  }
  return { exports: touched };
}

function scheduleReactiveSync (ids) {
  Promise.resolve().then(() => syncReactive(ids)).catch(() => {});
}

// --- Download-completion hook ---------------------------------------------
//
// New downloads only ADD canonical files, so every export (annotation-based
// AND metadata-only, e.g. model=X) may gain matching items. Trivial plans
// (link-mode adds under the threshold) auto-apply; anything that would
// classify as `confirm` (a large or copy-mode operation) is marked Pending
// for the user to confirm, honouring the plan-and-confirm gate.

export function notifyDownloadCompleted () {
  Promise.resolve().then(() => reconcileAndAutoApply()).catch(() => {});
}

async function reconcileAndAutoApply ({ mediaItems, fs = defaultFsFacade } = {}) {
  const list = await listExports();
  for (const exp of list) {
    await withLiveExport(exp.slug, async (rec) => {
      const planOutcome = await failSoft(rec.slug, () => computeSyncPlan(rec, { mediaItems, fs }));
      if (!planOutcome.ok) return;
      const plan = planOutcome.value;
      if (!plan.addKeys.length && !plan.removeKeys.length) {
        setStatus(rec.slug, { state: 'idle', reason: null });
        return;
      }
      if (plan.classification === 'auto') {
        const job = createJob(rec.slug, plan);
        await applySyncPlan(rec, plan, { fs, job });
      } else {
        setStatus(rec.slug, {
          state: 'pending',
          reason: { code: 'drift' },
          drift: { add: plan.addKeys.length, remove: plan.removeKeys.length }
        });
      }
    }).catch(() => {});
  }
}

// --- Startup reconciliation -----------------------------------------------
//
// Recompute drift for every export and mark Pending when the projection no
// longer matches its filter — including the C2 case where the canonical store
// moved under the export (ruling 8): the drift shows as Pending and self-heals
// on the next sync. Non-applying + fail-soft, so a missing drive at boot never
// throws.

export async function reconcileExports ({ mediaItems, fs = defaultFsFacade } = {}) {
  if (reconcileBarrier) {
    const barrier = reconcileBarrier;
    reconcileBarrier = null;
    await barrier;
  }
  await rebuildDependencyMap().catch(() => {});
  const list = await listExports();
  for (const exp of list) {
    // Yield so a page request can run. Do not call the Explorer idle
    // gate: a status GET must not own this walk.
    await new Promise((resolve) => { setImmediate(resolve); });
    await failSoft(exp.slug, async () => {
      const exportRoot = resolveExportRoot(exp);
      const desired = await evaluateExportInBatches(exp, { mediaItems });
      const onDisk = await walkExportKeys(exportRoot, { fs });
      const { desiredMap } = await collectDesiredSources(desired, { fs, onDiskSet: new Set(onDisk) });
      const { add, remove } = diff([...desiredMap.keys()], onDisk);
      if (add.length || remove.length) {
        setStatus(exp.slug, {
          state: 'pending',
          reason: { code: 'drift' },
          drift: { add: add.length, remove: remove.length }
        });
      } else {
        setStatus(exp.slug, { state: 'idle', reason: null });
      }
      return null;
    }).catch(() => { /* fail-soft already recorded a Pending reason */ });
  }
}

// =========================================================================
// Phase C1d — two additive backend gap-fills the UI contract requires
// =========================================================================
//
// C1c surfaced two surfaces the agreed "UI (minimal)" contract needs that the
// C1b backend did not expose. Both are purely additive — they reuse the C1b
// internals (computeSyncPlan / resolveExportRoot / walkExportKeys / failSoft /
// the fs facade) WITHOUT changing any existing signature, and neither performs
// a destructive cutover or touches the canonical store.

// --- sync-dryrun: plan-only sync ------------------------------------------
//
// The contract's "inline plan preview … before Save commits" needs an exact,
// apply-NOTHING plan. C1b's bulk sync applies immediately; this runs the same
// `computeSyncPlan` and returns the same serialisable shape the bulk-sync
// route returns (minus the jobId), but never calls `applySyncPlan`, schedules
// no job, and writes no file. `classification` is the classifyPlan verdict
// already computed inside computeSyncPlan, so the caller decides auto-apply vs
// confirm without re-deriving the threshold. Fail-soft on an offline
// destination (same codes as sync).
export async function planExport (slug, { mediaItems, fs = defaultFsFacade } = {}) {
  const exportDef = await readExport(slug);
  if (!exportDef) return { error: 'not-found' };

  const planOutcome = await failSoft(slug, () => computeSyncPlan(exportDef, { mediaItems, fs }));
  if (!planOutcome.ok) return { failSoft: true, code: planOutcome.code };
  const plan = planOutcome.value;

  return {
    dryRun: true,
    classification: plan.classification, // 'auto' | 'confirm'
    linkMode: plan.mode,                  // 'hardlink' | 'copy'
    add: plan.addKeys.length,
    remove: plan.removeKeys.length,
    bytesNeeded: plan.bytesNeeded,
    estimatedSeconds: plan.estimatedSeconds,
    desiredCount: plan.desiredCount,
    warnings: plan.warnings
  };
}

// --- delete-with-files removal --------------------------------------------
//
// The record is removed only after the filesystem intent is verified.
// An owned `media/exports/<slug>` directory is removed as a tree. A custom
// destination loses this export's files and keeps the directory. A root that
// is the library, or a folder another export still uses, is not touched.
// The destination is edited on the export form. There is no Change destination control.

const EXPORT_SUBTREES = ['generations', 'posts', 'comics', 'inputs'];
const CANONICAL_DIR_NAMES = ['generations', 'posts', 'comics', 'inputs', 'model3ds'];

function finishExportRemoval (slug) {
  invalidateDependencyMap();
  statusStore.delete(slug);
}

function isSafeExportSlug (slug) {
  return typeof slug === 'string' && slug.length > 0
    && !slug.includes('/') && !slug.includes('\\')
    && slug !== '.' && slug !== '..';
}

function isPathInside (child, parent) {
  const rel = path.relative(parent, child);
  if (rel === '') return true;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isOwnedExportRoot (exportDef) {
  if (!isSafeExportSlug(exportDef?.slug) || !CONFIG.mediaPath) return false;
  return path.resolve(resolveExportRoot(exportDef)) === path.resolve(CONFIG.mediaPath, 'exports', exportDef.slug);
}

function isUnsafeRemovalRoot (rootReal) {
  if (!CONFIG.mediaPath) return true;
  const media = path.resolve(CONFIG.mediaPath);
  const exportsParent = path.resolve(media, 'exports');
  // The media root, the exports parent, and anything that contains them.
  // A slug folder under media/exports is the owned tree and is not in this set.
  if (rootReal === media || rootReal === exportsParent) return true;
  if (isPathInside(media, rootReal) && rootReal !== media) return true;

  for (const name of CANONICAL_DIR_NAMES) {
    const dir = path.resolve(media, name);
    if (rootReal === dir || isPathInside(rootReal, dir)) return true;
    if (isPathInside(dir, rootReal) && rootReal !== dir) return true;
  }
  return false;
}

function rootsOverlap (a, b) {
  return a === b || isPathInside(a, b) || isPathInside(b, a);
}

function isMaterialisedExportKey (key) {
  return EXPORT_SUBTREES.some(name => key === name || key.startsWith(`${name}/`));
}

async function classifyRemovalRoot (exportDef, fs, others) {
  if (!isSafeExportSlug(exportDef?.slug)) return { error: 'unsafe-root' };
  const root = path.resolve(resolveExportRoot(exportDef));
  if (isUnsafeRemovalRoot(root)) return { error: 'unsafe-root' };

  let listed;
  try {
    listed = await fs.lstat(root);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { kind: isOwnedExportRoot(exportDef) ? 'owned' : 'custom', root, absent: true };
    }
    return { error: 'incomplete', code: error?.code || 'EIO' };
  }
  if (typeof listed.isSymbolicLink === 'function' && listed.isSymbolicLink()) return { error: 'unsafe-root' };
  if (typeof listed.isDirectory === 'function' && !listed.isDirectory()) return { error: 'unsafe-root' };

  let rootReal = root;
  try {
    if (typeof fs.realpath === 'function') rootReal = path.resolve(await fs.realpath(root));
  } catch (error) {
    if (error?.code !== 'ENOENT') return { error: 'incomplete', code: error?.code || 'EIO' };
  }
  if (isUnsafeRemovalRoot(rootReal)) return { error: 'unsafe-root' };

  for (const other of others || []) {
    if (!other || other.slug === exportDef.slug) continue;
    const otherRoot = path.resolve(resolveExportRoot(other));
    if (rootsOverlap(root, otherRoot)) return { error: 'shared-destination' };
  }
  return { kind: isOwnedExportRoot(exportDef) ? 'owned' : 'custom', root };
}

async function removeOwnedExportTree (root, fs) {
  let removed = 0;
  try {
    removed = (await walkExportKeys(root, { fs })).length;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      return { ok: false, error: 'incomplete', code: error?.code || 'EIO', removed: 0, remaining: 0 };
    }
  }
  try {
    await fs.rm(root, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      return { ok: false, error: 'incomplete', code: error?.code || 'EIO', removed, remaining: removed };
    }
  }
  if (await pathExists(root, fs)) {
    return { ok: false, error: 'incomplete', code: 'EEXIST', removed, remaining: 1 };
  }
  return { ok: true, removed, remaining: 0 };
}

async function listProbeNames (root, fs) {
  let entries;
  try {
    entries = await fs.readdir(root);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const names = [];
  for (const ent of entries) {
    const name = ent?.name;
    if (!name || !name.startsWith('.civsync-probe-')) continue;
    if (typeof ent.isDirectory === 'function' && ent.isDirectory()) continue;
    names.push(name);
  }
  return names;
}

async function removeCustomProjection (root, fs) {
  let removed = 0;
  let keys;
  try {
    keys = await walkExportKeys(root, { fs });
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, removed: 0, remaining: 0 };
    return { ok: false, error: 'incomplete', code: error?.code || 'EIO', removed, remaining: 0 };
  }
  for (const key of keys) {
    if (!isMaterialisedExportKey(key)) continue;
    try {
      await fs.unlink(path.join(root, key));
      removed++;
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      return { ok: false, error: 'incomplete', code: error?.code || 'EIO', removed, remaining: 1 };
    }
  }
  let probes;
  try {
    probes = await listProbeNames(root, fs);
  } catch (error) {
    return { ok: false, error: 'incomplete', code: error?.code || 'EIO', removed, remaining: 1 };
  }
  for (const name of probes) {
    try {
      await fs.unlink(path.join(root, name));
      removed++;
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      return { ok: false, error: 'incomplete', code: error?.code || 'EIO', removed, remaining: 1 };
    }
  }
  for (const sub of EXPORT_SUBTREES) {
    try {
      await pruneDirIfEmpty(path.join(root, sub), fs);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        return { ok: false, error: 'incomplete', code: error?.code || 'EIO', removed, remaining: 1 };
      }
    }
  }
  let left = [];
  try {
    left = (await walkExportKeys(root, { fs })).filter(isMaterialisedExportKey);
    probes = await listProbeNames(root, fs);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      return { ok: false, error: 'incomplete', code: error?.code || 'EIO', removed, remaining: 1 };
    }
    probes = [];
  }
  if (left.length || probes.length) {
    return { ok: false, error: 'incomplete', code: 'EEXIST', removed, remaining: left.length + probes.length };
  }
  return { ok: true, removed, remaining: 0 };
}

async function pruneDirIfEmpty (dir, fs) {
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    throw tagDestination(error);
  }
  let remaining = 0;
  for (const ent of entries) {
    const name = ent?.name;
    if (!name) continue;
    const isDir = typeof ent.isDirectory === 'function' && ent.isDirectory();
    if (isDir) {
      const removed = await pruneDirIfEmpty(path.join(dir, name), fs);
      if (!removed) remaining++;
    } else {
      remaining++;
    }
  }
  if (remaining === 0) {
    try { await fs.rmdir(dir); return true; }
    catch (error) { if (error?.code === 'ENOENT') return true; throw tagDestination(error); }
  }
  return false;
}

// Delete files. The record stays when the folder could not be verified gone.
// Canonical files are never the target: the root is refused when it is the
// library or sits on a canonical tree. Hard links elsewhere keep their inode.
export async function deleteExportWithFiles (slug, { fs: injected } = {}) {
  const fs = fsFor(injected);
  return withRemoval(slug, async (exportDef) => {
    const classified = await classifyRemovalRoot(exportDef, fs, await listExports());
    if (classified.error) {
      return { ok: false, error: classified.error, code: classified.code };
    }
    const outcome = classified.absent
      ? { ok: true, removed: 0, remaining: 0 }
      : classified.kind === 'owned'
        ? await removeOwnedExportTree(classified.root, fs)
        : await removeCustomProjection(classified.root, fs);
    if (!outcome.ok) return outcome;
    await removeExportRecord(slug);
    finishExportRemoval(slug);
    return { ok: true, removed: outcome.removed, remaining: 0 };
  });
}
