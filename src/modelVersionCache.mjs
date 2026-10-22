// Per-account cache of model-version metadata (REST-shaped responses).
//
// The Explorer's authoritative source for model identity (model line name,
// version name, type, baseModel, trainedWords, stats, …) is resolved via
// `resolveModelVersion` in `src/civitaiApi.mjs` (REST first, tRPC fallback
// for file-less `ExternalGeneration` versions). Saved generation/post JSON
// contains a partial subset (`decomposeResource` extracts a fallback), but
// the resolved response is richer and forward-compatible.
//
// This cache is the runtime container for those responses. It's per-account
// (lives under `<CONFIG.dataPath>/model-cache/`), populated lazily, and
// survives process restarts as an NDJSON file.
//
// Shape mirrors `src/serverIndex.mjs`'s factory pattern: a `createCache`
// factory plus a default singleton bound to the current `CONFIG.dataPath`.
// Tests instantiate fresh caches against tmp dirs; runtime uses the
// singleton.
//
// --- Record states ----------------------------------------------------------
//
//   Hit (had data, has data now):
//     { id, notFound: false, data: <REST response>,
//       fetchedAt, lastCheckedAt }
//
//   Hit-with-recent-failure (had data, last refresh got 404; data preserved):
//     { id, notFound: false, data: <last-known REST response>,
//       fetchedAt, lastCheckedAt, firstFailedAt, lastFailedAt,
//       permanent? (true after 90d of consistent 404s) }
//
//   Tombstone (never had data; first observed as 404):
//     { id, notFound: true, data: null,
//       firstSeenAt, lastCheckedAt,
//       permanent? (true after 90d) }
//
// --- Refresh policy ---------------------------------------------------------
//
//   - Hits: refresh every REFRESH_AGE_MS (30d). On 200 → updated record.
//     On 404 → preserve data, set firstFailedAt (if not already set) and
//     lastFailedAt; mark permanent if firstFailedAt is older than 90d.
//   - Tombstones: re-check every REFRESH_AGE_MS (30d). On 404 → update
//     lastCheckedAt. After 90d of consistent failure → mark permanent.
//   - Permanent records (either kind) → never refreshed, even with `force`.
//     Their data (or non-data) is final from this cache's perspective.
//   - 404 → 200 transition: a tombstone becomes a fresh hit; a hit-with-
//     recent-failure clears its failure timestamps.
//
// --- Persistence ------------------------------------------------------------
//
// Append-only NDJSON; dedup on load (last write wins). The `compact()`
// method rewrites the file to drop superseded lines on shutdown.
//
// Migration: records written by an earlier version of this module had only
// `fetchedAt` and `notFound`. On load, missing timestamps are inferred from
// `fetchedAt` (treated as `firstSeenAt` and `lastCheckedAt` for tombstones).

import fs from 'node:fs';
import { readFile, writeFile } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { resolveModelVersion } from './civitaiApi.mjs';
import { runAsBackground } from './requestScheduler.mjs';

export const CACHE_VERSION = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A record reaches `permanent: true` after this much time of consistent 404s. */
export const PERMANENT_AGE_MS = 90 * DAY_MS;

/** Default age beyond which a non-permanent record is due for refresh. */
export const DEFAULT_REFRESH_AGE_MS = 30 * DAY_MS;

// ---------------------------------------------------------------------------
// Factory.
//
// `options.dataPath` may be a string OR a getter property — the default
// singleton uses a getter so it live-binds to `CONFIG.dataPath` without
// re-construction on config change.
//
// `options.fetcher` populates the cache via the unified resolver. Defaults
// to `resolveModelVersion` from `src/civitaiApi.mjs` (REST → tRPC).
// Tests inject a stub here; runtime uses the default. ESM exports can't be
// redefined via `mock.method`, so a constructor-injected dependency is the
// right shape under node:test.
//
// `options.now` is an injectable clock (unit-test seam). Defaults to
// `Date.now`. Used by every staleness / permanence calculation so tests can
// drive deterministic age boundaries.

export function createModelVersionCache (options) {
  function getDataPath () { return options.dataPath; }
  function cacheDir () { return `${getDataPath()}/model-cache`; }
  function ndjsonPath () { return `${cacheDir()}/versions.ndjson`; }

  const fetcher = options.fetcher || resolveModelVersion;
  const now = options.now || Date.now;

  /** @type {Map<number|string, object>} */
  let entries = new Map();
  let loaded = false;
  let loadingPromise = null;
  let appendCount = 0;

  // --- NDJSON I/O ---

  function migrateLegacyRecord (r) {
    // Records written by CACHE_VERSION 1 only had `id`, `fetchedAt`,
    // `notFound`, `data`. Backfill the new timestamps so refresh policy
    // works without forcing a full re-fetch on first upgrade.
    if (r.lastCheckedAt) return r; // already migrated or new shape
    if (r.notFound) {
      return { ...r, firstSeenAt: r.fetchedAt, lastCheckedAt: r.fetchedAt };
    }
    return { ...r, lastCheckedAt: r.fetchedAt };
  }

  function parseNdjson (text) {
    const byId = new Map();
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const record = JSON.parse(line);
        if (record && (typeof record.id === 'number' || typeof record.id === 'string')) {
          byId.set(record.id, migrateLegacyRecord(record));
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
    const filepath = ndjsonPath();
    if (!fs.existsSync(`${getDataPath()}/model-cache`)) {
      await fs.promises.mkdir(`${getDataPath()}/model-cache`, { recursive: true });
    }
    await fs.promises.appendFile(filepath, text, 'utf-8');
  }

  async function rewriteNdjson (records) {
    const text = records.length ? records.map(r => JSON.stringify(r)).join('\n') + '\n' : '';
    await writeFile(ndjsonPath(), text);
  }

  // --- Internal mutation primitives ---

  async function persist (record) {
    entries.set(record.id, record);
    await appendNdjsonLines([record]);
    appendCount++;
  }

  // --- Public methods ---

  /**
   * Idempotent: loads the cache file once. Concurrent first-time callers
   * share a single in-flight promise so duplicate file reads cannot race.
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

  function get (id) { return entries.get(id) ?? null; }
  function has (id) { return entries.has(id); }
  function size () { return entries.size; }

  /** Iterate every record (read-only). Used by tests and diagnostics. */
  function* values () { yield* entries.values(); }

  /**
   * Returns the subset of `versionIds` not in the cache. Useful for the
   * discovery flow: walk the index, pass the resulting list here to learn
   * what still needs fetching.
   */
  function getMissing (versionIds) {
    return [...new Set(versionIds)].filter(id => !entries.has(id));
  }

  /**
   * Returns the ids of all NON-permanent records whose most recent check
   * is older than `maxAgeMs`. Used by the auto-refresh flow to decide
   * which existing entries to re-fetch alongside any new (missing) ones.
   *
   * @param {number} [maxAgeMs] — defaults to DEFAULT_REFRESH_AGE_MS (30d)
   */
  function getDueForRefresh (maxAgeMs = DEFAULT_REFRESH_AGE_MS) {
    const cutoff = now() - maxAgeMs;
    const ids = [];
    for (const r of entries.values()) {
      if (r.permanent) continue;
      const t = new Date(r.lastCheckedAt || r.fetchedAt || r.firstSeenAt).getTime();
      if (t < cutoff) ids.push(r.id);
    }
    return ids;
  }

  /**
   * Returns the ids of every NON-permanent record. Used by the manual
   * "Refresh model metadata" button to force a full re-fetch (force=true
   * still respects the permanence rule — permanent records remain final).
   */
  function getRefreshable () {
    const ids = [];
    for (const r of entries.values()) {
      if (!r.permanent) ids.push(r.id);
    }
    return ids;
  }

  /**
   * Cache a successful REST response. Replaces any existing record (hit,
   * tombstone, or hit-with-recent-failure) since 200 means upstream has
   * the data.
   */
  async function recordSuccess (id, data) {
    const ts = new Date(now()).toISOString();
    const record = {
      id,
      notFound: false,
      data,
      fetchedAt: ts,
      lastCheckedAt: ts
      // Note: any prior firstFailedAt/lastFailedAt/permanent fields are
      // intentionally dropped — a successful fetch resets the failure
      // history.
    };
    await persist(record);
    return record;
  }

  /**
   * Record a 404 from upstream. Three branches:
   *
   *   1. No prior record → new tombstone.
   *   2. Existing tombstone → update lastCheckedAt; mark permanent if
   *      firstSeenAt is older than 90d.
   *   3. Existing successful record → preserve data; set firstFailedAt
   *      (if not already) and lastFailedAt; mark permanent if firstFailedAt
   *      is older than 90d. The data field stays populated.
   */
  async function recordFailure (id) {
    const ts = new Date(now()).toISOString();
    const tsMs = now();
    const existing = entries.get(id);

    if (!existing) {
      const record = {
        id,
        notFound: true,
        data: null,
        firstSeenAt: ts,
        lastCheckedAt: ts
      };
      await persist(record);
      return record;
    }

    if (existing.notFound) {
      const firstSeenMs = new Date(existing.firstSeenAt).getTime();
      const isPermanent = existing.permanent || (tsMs - firstSeenMs >= PERMANENT_AGE_MS);
      const record = {
        ...existing,
        lastCheckedAt: ts,
        ...(isPermanent ? { permanent: true } : {})
      };
      await persist(record);
      return record;
    }

    // Existing successful record (had data) just got a 404. Preserve data.
    const firstFailedAt = existing.firstFailedAt || ts;
    const firstFailedMs = new Date(firstFailedAt).getTime();
    const isPermanent = existing.permanent || (tsMs - firstFailedMs >= PERMANENT_AGE_MS);
    const record = {
      ...existing,
      lastCheckedAt: ts,
      lastFailedAt: ts,
      firstFailedAt,
      ...(isPermanent ? { permanent: true } : {})
    };
    await persist(record);
    return record;
  }

  /**
   * Mark a version as missing on the server (HTTP 404). Public surface
   * preserved from CACHE_VERSION 1 for backwards compatibility; delegates
   * to `recordFailure`.
   */
  async function markMissing (id) { return recordFailure(id); }

  /**
   * Cache a successful REST response. Public surface preserved from
   * CACHE_VERSION 1; delegates to `recordSuccess`.
   */
  async function upsertHit (id, data) { return recordSuccess(id, data); }

  /**
   * Discover and fetch model-version records.
   *
   * Default mode: only fetch ids not already cached. Sequential fetch
   * Calls run one at a time as background work. A 404 produces (or
   * updates) a tombstone via `recordFailure`; non-404 errors flow into
   * `report.errors`.
   *
   * `force: true`: ignore the cache-hit check and re-fetch every id in
   * `versionIds`. Permanent records are still skipped — once permanent,
   * the record's state is final.
   *
   * Optional `onProgress({ index, total, currentId, status })` is invoked
   * after each fetch (status: 'cached' | 'tombstoned' | 'preserved' |
   * 'error').
   *
   * @param {{
   *   versionIds: (number|string)[],
   *   secretKey: string,
   *   signal?: AbortSignal,
   *   onProgress?: (info: object) => void,
   *   force?: boolean
   * }} args
   * @returns {Promise<{
   *   total: number,
   *   fetched: number,
   *   tombstoned: number,
   *   preserved: number,
   *   skippedPermanent: number,
   *   errors: object[],
   *   aborted: boolean
   * }>}
   */
  async function fetchMissing ({ versionIds, secretKey, signal, onProgress, force = false }) {
    await ensureLoaded();

    // Build the work list.
    let targets;
    if (force) {
      // Force-refresh ignores the cache-hit check, but still skips
      // permanents (they are, by definition, final).
      const unique = [...new Set(versionIds)];
      targets = unique.filter(id => !(entries.get(id)?.permanent));
    } else {
      targets = getMissing(versionIds);
    }

    const total = targets.length;
    const report = {
      total,
      fetched: 0,
      tombstoned: 0,
      preserved: 0,
      skippedPermanent: 0,
      errors: [],
      aborted: false
    };

    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) {
        report.aborted = true;
        break;
      }

      const id = targets[i];
      // Permanent check is first (might have changed between target
      // construction and now if another flow updated the cache).
      if (entries.get(id)?.permanent) {
        report.skippedPermanent++;
        if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'permanent-skip' });
        continue;
      }

      let response;
      try {
        response = await runAsBackground(() => fetcher({ id, secretKey, signal }));
      } catch (err) {
        report.errors.push({ id, error: err.message });
        if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'error' });
        continue;
      }

      if (response && response.notFound) {
        const before = entries.get(id);
        await recordFailure(id);
        if (before && !before.notFound) {
          // Had data; data was preserved.
          report.preserved++;
          if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'preserved' });
        } else {
          report.tombstoned++;
          if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'tombstoned' });
        }
      } else if (response && response.error) {
        report.errors.push({ id, error: response.error });
        if (onProgress) onProgress({ index: i + 1, total, currentId: id, status: 'error' });
      } else if (response && typeof response === 'object') {
        await recordSuccess(id, response);
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
   * Rewrite the NDJSON file from the deduped in-memory map. Drops
   * superseded lines so the file doesn't grow unboundedly across many
   * sessions. Skips work when no appends were made in this session.
   */
  async function compact () {
    if (!loaded || appendCount === 0) return;
    await rewriteNdjson([...entries.values()]);
    appendCount = 0;
  }

  /**
   * Diagnostic counts for the Settings UI. Walks `entries` once.
   */
  function getStatusSnapshot () {
    let totalCached = 0;
    let totalTombstones = 0;
    let totalPermanent = 0;
    let lastFetchedAtMs = 0;
    let lastCheckedAtMs = 0;
    for (const r of entries.values()) {
      if (r.notFound) totalTombstones++;
      else totalCached++;
      if (r.permanent) totalPermanent++;
      // `lastFetchedAt` = most recent successful fetch. Tombstones have no
      // fetchedAt, so they don't count here.
      if (r.fetchedAt) {
        const t = new Date(r.fetchedAt).getTime();
        if (t > lastFetchedAtMs) lastFetchedAtMs = t;
      }
      // `lastCheckedAt` = most recent fetch attempt of any kind, including
      // tombstone re-checks.
      const cTs = new Date(r.lastCheckedAt || r.fetchedAt || r.firstSeenAt || 0).getTime();
      if (cTs > lastCheckedAtMs) lastCheckedAtMs = cTs;
    }
    return {
      totalRecords: entries.size,
      totalCached,
      totalTombstones,
      totalPermanent,
      lastFetchedAt: lastFetchedAtMs ? new Date(lastFetchedAtMs).toISOString() : null,
      lastCheckedAt: lastCheckedAtMs ? new Date(lastCheckedAtMs).toISOString() : null
    };
  }

  return {
    get,
    has,
    size,
    values,
    getMissing,
    getDueForRefresh,
    getRefreshable,
    upsertHit,
    markMissing,
    recordSuccess,
    recordFailure,
    fetchMissing,
    ensureLoaded,
    compact,
    getStatusSnapshot
  };
}

// ---------------------------------------------------------------------------
// Default singleton: lazy, live-bound to `CONFIG.dataPath`.

let _defaultCache = null;

function defaultCache () {
  if (!_defaultCache) {
    _defaultCache = createModelVersionCache({
      get dataPath () { return CONFIG.dataPath; }
    });
  }
  return _defaultCache;
}

/**
 * Test-only: drops the default singleton so the next `defaultCache()`
 * call rebuilds it. Used by integration tests that mutate `CONFIG.dataPath`.
 */
export function _resetDefaultModelVersionCacheForTest () { _defaultCache = null; }

// Drop the loaded cache and the ndjson. The next read starts empty.
export async function clearModelVersionCache () {
  _defaultCache = null;
  const file = `${CONFIG.dataPath}/model-cache/versions.ndjson`;
  await fs.promises.unlink(file).catch(() => {});
}

// Backwards-compatible named exports — runtime callers go through these.
export async function ensureModelVersionCacheLoaded () { return defaultCache().ensureLoaded(); }
export function getModelVersionFromCache (id) { return defaultCache().get(id); }
export function hasModelVersionInCache (id) { return defaultCache().has(id); }
export function getMissingModelVersionIds (ids) { return defaultCache().getMissing(ids); }
export function getModelVersionsDueForRefresh (maxAgeMs) { return defaultCache().getDueForRefresh(maxAgeMs); }
export function getRefreshableModelVersions () { return defaultCache().getRefreshable(); }
export function getModelCacheStatus () { return defaultCache().getStatusSnapshot(); }
export async function fetchMissingModelVersions (args) { return defaultCache().fetchMissing(args); }
export async function compactModelVersionCache () { return defaultCache().compact(); }
