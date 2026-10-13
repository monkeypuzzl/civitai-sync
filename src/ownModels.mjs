// Account-published models. One JSON file beside the model-version cache.
// Not part of the media index. Galleries and downloads do not wait on the walk.

import fs from 'node:fs';
import { readFile, writeFile } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { waitForExplorerIdle } from './explorerIdle.mjs';
import { getModelsByUsernamePage } from './civitaiApi.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
export const OWN_MODELS_DUE_MS = DAY_MS;

const AVAILABILITY = new Set(['Public', 'Unsearchable', 'EarlyAccess', 'Private']);
const LISTED = Object.freeze(['open', 'private']);

/** @type {object|null|undefined} undefined = not loaded, null = no file */
let memory = undefined;
let activeAbort = null;

function filePath (dataPath = CONFIG.dataPath) {
  return `${dataPath}/model-cache/own-models.json`;
}

function normalizeVersion (raw) {
  if (!raw || raw.id == null || raw.id === '') return null;
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : '',
    baseModel: typeof raw.baseModel === 'string' ? raw.baseModel : ''
  };
}

function normalizeModel (raw) {
  if (!raw || raw.id == null || raw.id === '') return null;
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;
  const versions = [];
  const seen = new Set();
  for (const v of Array.isArray(raw.modelVersions) ? raw.modelVersions : (raw.versions || [])) {
    const norm = normalizeVersion(v);
    if (!norm || seen.has(norm.id)) continue;
    seen.add(norm.id);
    versions.push(norm);
  }
  const model = {
    id,
    name: typeof raw.name === 'string' && raw.name ? raw.name : `Model ${id}`,
    type: typeof raw.type === 'string' && raw.type ? raw.type : 'Other',
    versions
  };
  if (AVAILABILITY.has(raw.availability)) model.availability = raw.availability;
  return model;
}

function recordIsComplete (record, username) {
  if (!record || record.username !== username) return false;
  const listed = record.listed;
  return Array.isArray(listed) && listed.includes('open') && listed.includes('private');
}

async function walkPass (fetchPage, { username, secretKey, signal, availability }) {
  const collected = [];
  const seenCursors = new Set();
  let cursor = '';
  do {
    if (signal?.aborted) {
      const aborted = new Error('aborted');
      aborted.name = 'AbortError';
      throw aborted;
    }
    if (cursor) {
      if (seenCursors.has(cursor)) break;
      seenCursors.add(cursor);
    }
    await waitForExplorerIdle();
    if (signal?.aborted) {
      const aborted = new Error('aborted');
      aborted.name = 'AbortError';
      throw aborted;
    }
    const page = await fetchPage({
      username,
      cursor,
      secretKey,
      signal,
      ...(availability ? { availability } : {})
    });
    const items = Array.isArray(page?.items) ? page.items : null;
    if (!items) throw new Error('models page missing items');
    collected.push(...items);
    cursor = page?.nextCursor ? String(page.nextCursor) : '';
  } while (cursor);
  return collected;
}

function unionModels (openItems, privateItems) {
  const byId = new Map();
  for (const item of openItems) {
    const model = normalizeModel(item);
    if (model) byId.set(model.id, model);
  }
  for (const item of privateItems) {
    const model = normalizeModel(item);
    if (!model || byId.has(model.id)) continue;
    byId.set(model.id, model);
  }
  return [...byId.values()];
}

function interpret (record, username) {
  if (!record || typeof record !== 'object' || !username || record.username !== username) {
    return { known: false, username: username || '', checkedAt: null, models: [], ids: null };
  }
  const models = Array.isArray(record.models) ? record.models : [];
  const ids = new Set(models.map(m => String(m.id)));
  return {
    known: true,
    username,
    checkedAt: record.checkedAt || null,
    models,
    ids
  };
}

export async function readOwnModelsRecord (dataPath = CONFIG.dataPath) {
  try {
    const text = await readFile(filePath(dataPath));
    const record = JSON.parse(text);
    return record && typeof record === 'object' ? record : null;
  } catch {
    return null;
  }
}

function remember (record) {
  memory = record;
}

/** Sync snapshot for request handlers. A file for another username is unknown. */
export function currentOwnModels () {
  if (memory === undefined) {
    try {
      memory = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
    } catch {
      memory = null;
    }
  }
  return interpret(memory, CONFIG.username || '');
}

export function abortOwnModelsCheck () {
  activeAbort?.abort();
}

/**
 * Walk the account's published models in two passes (open, then Private).
 * Skips when `username` is empty, when a complete record is younger than a
 * day, and (when `onlyIfMissing`) when a complete record for this username
 * already exists. A file without both passes listed is due even inside the
 * day. `force` skips that wait (a manual metadata refresh) and still
 * requires a key and both passes. No key, an abort, or a failed pass
 * leaves the previous file, so `checkedAt` does not move.
 *
 * @param {{ fetcher?: Function, now?: number|Function, signal?: AbortSignal, username?: string, dataPath?: string, secretKey?: string, onlyIfMissing?: boolean, force?: boolean }} [opts]
 */
export async function refreshOwnModels ({
  fetcher,
  now = Date.now,
  signal,
  username = CONFIG.username,
  dataPath = CONFIG.dataPath,
  secretKey,
  onlyIfMissing = false,
  force = false
} = {}) {
  const clock = typeof now === 'function' ? now() : now;
  if (!username) return { skipped: 'no-username' };

  const existing = await readOwnModelsRecord(dataPath);
  const complete = recordIsComplete(existing, username);
  if (!force && complete && onlyIfMissing) return { skipped: 'present' };
  if (!force && complete && existing.checkedAt) {
    const age = clock - new Date(existing.checkedAt).getTime();
    if (Number.isFinite(age) && age >= 0 && age < OWN_MODELS_DUE_MS) {
      return { skipped: 'fresh' };
    }
  }
  if (!secretKey) return { skipped: 'no-key' };

  const fetchPage = fetcher || getModelsByUsernamePage;
  let openItems;
  let privateItems;
  try {
    openItems = await walkPass(fetchPage, { username, secretKey, signal });
    privateItems = await walkPass(fetchPage, {
      username, secretKey, signal, availability: 'Private'
    });
  } catch (err) {
    if (signal?.aborted || err?.name === 'AbortError') return { skipped: 'aborted' };
    return { skipped: 'error' };
  }

  const models = unionModels(openItems, privateItems);
  const record = {
    username,
    checkedAt: new Date(clock).toISOString(),
    listed: [...LISTED],
    models
  };
  const dir = `${dataPath}/model-cache`;
  if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
  await writeFile(filePath(dataPath), record);
  if (dataPath === CONFIG.dataPath) remember(record);
  return { updated: true, count: models.length };
}

/**
 * Fire-and-forget. Does not start when `isBlocked` is true. `onReady` runs
 * after a successful write (no status line).
 */
export function scheduleOwnModelsCheck ({
  secretKey,
  onlyIfMissing = false,
  isBlocked,
  onReady,
  username,
  dataPath
} = {}) {
  if (typeof isBlocked === 'function' && isBlocked()) {
    return Promise.resolve({ skipped: 'blocked' });
  }
  abortOwnModelsCheck();
  const ac = new AbortController();
  activeAbort = ac;
  return refreshOwnModels({
    secretKey,
    onlyIfMissing,
    signal: ac.signal,
    username,
    dataPath
  }).then(result => {
    if (activeAbort === ac) activeAbort = null;
    if (result?.updated && typeof onReady === 'function') onReady(result);
    return result;
  }).catch(() => {
    if (activeAbort === ac) activeAbort = null;
    return { skipped: 'error' };
  });
}
