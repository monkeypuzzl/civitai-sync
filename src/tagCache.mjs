// Per-account cache of content-tag id → name resolutions.
//
// Post images arrive from `post.getInfinite` carrying numeric `tagIds`
// only (auto-generated content tags — see api-contract.md → "Note on
// tags"). The Explorer's `tag=<name>` filter needs human-readable names,
// so unknown ids are resolved once via tRPC `tag.getById` and remembered
// here. The cache is per-account (`<CONFIG.dataPath>/tag-cache/`),
// populated lazily after downloads, and survives process restarts as an
// NDJSON file.
//
// Shape deliberately mirrors `src/modelVersionCache.mjs` (factory +
// default singleton, append-only NDJSON, dedup-on-load, injectable
// `fetcher` so node:test can stub without monkey-patching ESM exports).
// It is intentionally *simpler* than the model-version cache:
//
//   - **No tombstones / no refresh policy.** Tag deletion is benign: an
//     id that can't be resolved just stays absent, and the UI falls back
//     to displaying `tag-<id>` (see explorer-url-protocol.md § Tag-name
//     cache). There is no 90-day permanence or 30-day re-check because a
//     resolved name effectively never changes.
//
// Record shape:
//   { tagId: number, name: string, fetchedAt: ISO }

import fs from 'node:fs';
import { readFile, writeFile } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { getTag } from './civitaiApi.mjs';
import { runAsBackground } from './requestScheduler.mjs';

export const CACHE_VERSION = 1;

// ---------------------------------------------------------------------------
// Factory.
//
// `options.dataPath` may be a string OR a getter property — the default
// singleton uses a getter so it live-binds to `CONFIG.dataPath`.
//
// `options.fetcher` is the function used to resolve an unknown id from
// upstream. Defaults to `getTag` from `src/civitaiApi.mjs`; tests inject a
// stub (ESM exports can't be redefined via `mock.method`).
//
// `options.now` is an injectable clock (defaults to `Date.now`).

export function createTagCache (options) {
  function getDataPath () { return options.dataPath; }
  function cacheDir () { return `${getDataPath()}/tag-cache`; }
  function ndjsonPath () { return `${cacheDir()}/tags.ndjson`; }

  const fetcher = options.fetcher || getTag;
  const now = options.now || Date.now;

  /** @type {Map<number, { tagId: number, name: string, fetchedAt: string }>} */
  let entries = new Map();
  let loaded = false;
  let loadingPromise = null;
  let appendCount = 0;

  // --- NDJSON I/O ---

  function parseNdjson (text) {
    const byId = new Map();
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const record = JSON.parse(line);
        if (record && typeof record.tagId === 'number' && typeof record.name === 'string') {
          byId.set(record.tagId, record);
        }
      } catch { /* skip malformed line */ }
    }
    return byId;
  }

  async function readCacheFile () {
    try {
      const text = await readFile(ndjsonPath());
      return parseNdjson(text);
    } catch {
      return new Map();
    }
  }

  async function appendNdjsonLines (records) {
    if (!records.length) return;
    const text = records.map(r => JSON.stringify(r)).join('\n') + '\n';
    if (!fs.existsSync(cacheDir())) {
      await fs.promises.mkdir(cacheDir(), { recursive: true });
    }
    await fs.promises.appendFile(ndjsonPath(), text, 'utf-8');
  }

  async function rewriteNdjson (records) {
    const text = records.length ? records.map(r => JSON.stringify(r)).join('\n') + '\n' : '';
    await writeFile(ndjsonPath(), text);
  }

  // --- Public methods ---

  /**
   * Idempotent: loads the cache file once. Concurrent first-time callers
   * share a single in-flight promise so duplicate reads cannot race.
   */
  async function ensureLoaded () {
    if (loaded) return;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      entries = await readCacheFile();
      loaded = true;
    })().catch(err => {
      loadingPromise = null;
      throw err;
    });
    return loadingPromise;
  }

  /** Resolve a tag id to its name, or null when not (yet) cached. */
  function get (tagId) {
    const r = entries.get(Number(tagId));
    return r ? r.name : null;
  }

  function has (tagId) { return entries.has(Number(tagId)); }
  function size () { return entries.size; }

  /** Iterate every record (read-only). Used by tests and diagnostics. */
  function* values () { yield* entries.values(); }

  /**
   * The subset of `tagIds` not yet cached. Deduped and coerced to numbers;
   * non-numeric ids are dropped (they are not resolvable via tag.getById).
   */
  function getMissing (tagIds) {
    const seen = new Set();
    const out = [];
    for (const raw of tagIds || []) {
      const id = Number(raw);
      if (!Number.isFinite(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      if (!entries.has(id)) out.push(id);
    }
    return out;
  }

  /** Record a resolved id → name. Append-only; last write wins on load. */
  async function upsert (tagId, name) {
    const id = Number(tagId);
    if (!Number.isFinite(id) || typeof name !== 'string' || !name) return null;
    const record = { tagId: id, name, fetchedAt: new Date(now()).toISOString() };
    entries.set(id, record);
    await appendNdjsonLines([record]);
    appendCount++;
    return record;
  }

  /**
   * Resolve the ids in `tagIds` that aren't cached yet. Sequential fetch
   * Calls run one at a time as background work. A `notFound` response
   * leaves the id unresolved (no tombstone); other errors flow into
   * `report.errors`. Optional `onProgress({ index, total, currentId,
   * status })` fires after each fetch (status: 'cached' | 'unresolved' |
   * 'error').
   *
   * @param {{ tagIds: (number|string)[], secretKey?: string,
   *   signal?: AbortSignal, onProgress?: (info: object) => void }} args
   */
  async function fetchMissing ({ tagIds, secretKey, signal, onProgress }) {
    await ensureLoaded();
    const targets = getMissing(tagIds);
    const total = targets.length;
    const report = { total, fetched: 0, unresolved: 0, errors: [], aborted: false };

    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) { report.aborted = true; break; }

      const id = targets[i];

      let response;
      try {
        response = await runAsBackground(() => fetcher({ id, secretKey, signal }));
      } catch (err) {
        report.errors.push({ id, error: err.message });
        if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'error' });
        continue;
      }

      if (response && response.notFound) {
        report.unresolved++;
        if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'unresolved' });
      } else if (response && response.error) {
        report.errors.push({ id, error: response.error });
        if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'error' });
      } else if (response && typeof response.name === 'string') {
        await upsert(id, response.name);
        report.fetched++;
        if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'cached' });
      } else {
        report.errors.push({ id, error: 'unexpected response shape' });
        if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'error' });
      }
    }

    return report;
  }

  /**
   * Rewrite the NDJSON file from the deduped in-memory map so it doesn't
   * grow unboundedly across sessions. Skips work when no appends were made.
   */
  async function compact () {
    if (!loaded || appendCount === 0) return;
    await rewriteNdjson([...entries.values()]);
    appendCount = 0;
  }

  return {
    ensureLoaded,
    get,
    has,
    size,
    values,
    getMissing,
    upsert,
    fetchMissing,
    compact
  };
}

// ---------------------------------------------------------------------------
// Default singleton: lazy, live-bound to `CONFIG.dataPath`.

let _defaultCache = null;

function defaultCache () {
  if (!_defaultCache) {
    _defaultCache = createTagCache({
      get dataPath () { return CONFIG.dataPath; }
    });
  }
  return _defaultCache;
}

/**
 * Test-only: drops the default singleton so the next accessor rebuilds it.
 * Mirrors `_resetDefaultModelVersionCacheForTest`. Used by integration
 * tests that mutate `CONFIG.dataPath`.
 */
export function _resetDefaultTagCacheForTest () { _defaultCache = null; }

// Drop the loaded cache and the ndjson. The next read starts empty.
export async function clearTagCache () {
  _defaultCache = null;
  const file = `${CONFIG.dataPath}/tag-cache/tags.ndjson`;
  await fs.promises.unlink(file).catch(() => {});
}

// Backwards-compatible named exports — runtime callers go through these.
export async function ensureTagCacheLoaded () { return defaultCache().ensureLoaded(); }
export function getTagNameFromCache (id) { return defaultCache().get(id); }

/**
 * Resolve a content-tag id to a DISPLAY string: the cached name, or the
 * `tag-<id>` fallback when it isn't (yet) resolved (explorer-url-protocol.md
 * § Tag-name cache). Phase 3 built the cache + projection but shipped no
 * formatter to avoid an unused export; Phase 4's media-item gallery is the
 * first surface that renders raw content tag ids, so the helper lands now with
 * a real consumer. `cache` is injectable (anything exposing `get(id) → name |
 * null`) so the fallback contract is unit-testable without the singleton.
 */
export function formatTagName (tagId, cache = defaultCache()) {
  const name = cache.get(tagId);
  return name != null ? name : `tag-${tagId}`;
}
export function getMissingTagIds (ids) { return defaultCache().getMissing(ids); }
export async function fetchMissingTagNames (args) { return defaultCache().fetchMissing(args); }
export async function compactTagCache () { return defaultCache().compact(); }
