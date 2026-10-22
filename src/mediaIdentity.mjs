/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// Local media-item alias store.
//
// Owns `${CONFIG.dataPath}/media-item-aliases.json` — a per-account file that
// maps extra identity keys (`blob:<id>`, `content:<sha256>`, later `image:<id>`)
// onto a canonical media-item id. Missing file = empty store. Unknown top-level
// keys are preserved through a load → write round-trip (same discipline as
// `src/overrides.mjs`). Store `_version` stays 1.
//
// Writers for `content:<sha256>` (generation file bytes) and `blob:<id>`
// (input blob joined onto a produced item) live in saveGenerationMedia,
// saveInputMedia, and contentHashBackfill. Phase 5e Image-id writers
// (`image:<id>` via name-join in serverIndex pass 2) record through
// `recordAlias` + `imageKey`. Content-hash of posted files and recipe
// lookup are later 5e leaves.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from './utils.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import { CONFIG } from './cli.mjs';

const ALIASES_VERSION = 1;

let _store = { _version: ALIASES_VERSION, canonical: {} };
let _loaded = false;
// Reverse index: identity key → canonical id. First canonical wins on load
// (matches the previous Object.entries scan). recordAlias last-writer updates.
let _byKey = new Map();

function aliasesPath () {
  return `${CONFIG.dataPath}/media-item-aliases.json`;
}

function emptyStore () {
  return { _version: ALIASES_VERSION, canonical: {} };
}

function ensureCanonicalMap (store) {
  if (!store.canonical || typeof store.canonical !== 'object' || Array.isArray(store.canonical)) {
    store.canonical = {};
  }
  if (typeof store._version !== 'number') {
    store._version = ALIASES_VERSION;
  }
}

function rebuildKeyIndex () {
  _byKey = new Map();
  const canonical = _store.canonical || {};
  for (const [id, entry] of Object.entries(canonical)) {
    if (!Array.isArray(entry?.keys)) continue;
    for (const key of entry.keys) {
      if (key == null || key === '') continue;
      if (!_byKey.has(key)) _byKey.set(key, id);
    }
  }
}

export async function loadAliasStore () {
  if (_loaded) return _store;

  try {
    const text = await readFile(aliasesPath());
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      _store = parsed;
      ensureCanonicalMap(_store);
    } else {
      _store = emptyStore();
    }
  } catch (ignoreErr) {
    _store = emptyStore();
  }

  rebuildKeyIndex();
  _loaded = true;
  return _store;
}

async function persist () {
  await writeFile(aliasesPath(), JSON.stringify(_store, null, 2));
}

export async function persistAliasStore () {
  await loadAliasStore();
  await persist();
}

// First key that maps onto a canonical id. Callers that need a populated
// cache should await loadAliasStore() first; an unloaded cache reports null
// rather than throwing.
export function resolveCanonicalId (keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    if (key == null || key === '') continue;
    const hit = _byKey.get(key);
    if (hit) return hit;
  }
  return null;
}

export function canonicalHasContentKey (canonicalId) {
  const id = normalizeMediaId(canonicalId);
  if (!id) return false;
  const keys = _store.canonical?.[id]?.keys;
  if (!Array.isArray(keys)) return false;
  return keys.some(k => typeof k === 'string' && k.startsWith('content:'));
}

export function contentKey (hex) {
  return 'content:' + String(hex).toLowerCase();
}

// Stable hash of every content: key currently stored. A posted-file or
// input sweep that already ran against this set has nothing new to match.
export function contentKeyEpoch () {
  const keys = [];
  const canonical = _store.canonical || {};
  for (const entry of Object.values(canonical)) {
    if (!Array.isArray(entry?.keys)) continue;
    for (const key of entry.keys) {
      if (typeof key === 'string' && key.startsWith('content:')) keys.push(key);
    }
  }
  keys.sort();
  return createHash('sha256').update(keys.join('\n')).digest('hex');
}

export function imageKey (id) {
  return 'image:' + normalizeMediaId(id);
}

// Streamed binary sha256. Do not hash with utils.readFile (UTF-8) and do not
// slurp the whole file into RAM (videos, accidental multi-GB paths).
export async function hashFileSha256 (filepath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filepath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

export async function recordAlias (canonicalId, key, { persist: shouldPersist = true } = {}) {
  await loadAliasStore();
  const id = normalizeMediaId(canonicalId);
  if (!id || key == null || key === '') return;

  const existing = _store.canonical[id];
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    _store.canonical[id] = { keys: [key] };
  } else {
    if (!Array.isArray(existing.keys)) existing.keys = [];
    if (!existing.keys.includes(key)) existing.keys.push(key);
  }

  if (!_byKey.has(key)) _byKey.set(key, id);

  if (shouldPersist) await persist();
  return _store.canonical[id];
}
