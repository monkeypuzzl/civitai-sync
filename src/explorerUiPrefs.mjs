// Explorer Sticky UI preferences.
//
// Owns `${CONFIG.dataPath}/explorer/ui.json` — the last explicit choice for
// `sticky: true` URL-schema keys (user-data class). Missing file = empty
// document; GET / load never creates the file. Unknown keys and a higher
// `_version` survive load → write (overrides.mjs rule). PATCH accepts
// `(view, key)` pairs in STICKY_REGISTRY, only `allowed` values, a
// top-level `meshViewer` of `on` or `off`, a top-level `downloadTypes`
// array of download ids, a top-level `downloadAdvancedOpen` boolean,
// `downloadAuto` boolean, `downloadEvery` period id, and `downloadRecheck` boolean.
// None of these is a URL key. An empty or invalid `downloadTypes` does not
// clear a stored set. An invalid advanced flag does not clear a stored one.
//
// Leaf module: no `serverIndex` import. Persistence is mkdirp + atomic
// rename via `utils.writeFile`.

import { readFile, writeFile } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { canonicalizeDownloadTypes } from './downloadQueue.mjs';
import { DOWNLOAD_PERIODS } from './autoDownload.mjs';

const DOWNLOAD_PERIOD_IDS = new Set(DOWNLOAD_PERIODS.map(period => period.id));

export const UI_PREFS_VERSION = 1;

export const STICKY_REGISTRY = Object.freeze({
  generations: Object.freeze({
    granularity: Object.freeze({ allowed: Object.freeze(['media', 'batch']) })
  }),
  posts: Object.freeze({
    granularity: Object.freeze({ allowed: Object.freeze(['media', 'post']) })
  }),
  comics: Object.freeze({
    granularity: Object.freeze({ allowed: Object.freeze(['media', 'comic']) })
  })
});

let _prefs = { _version: UI_PREFS_VERSION, views: {} };
let _loaded = false;

function uiPrefsPath () {
  return `${CONFIG.dataPath}/explorer/ui.json`;
}

function emptyDoc () {
  return { _version: UI_PREFS_VERSION, views: {} };
}

function isPlainObject (v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

// Idempotent. Missing or malformed file → empty document in memory; never
// writes. Higher `_version`: operate on `views`, do not discard.
export async function loadUiPrefs () {
  if (_loaded) return _prefs;

  try {
    const text = await readFile(uiPrefsPath());
    const parsed = JSON.parse(text);
    if (isPlainObject(parsed)) {
      _prefs = parsed;
      if (!isPlainObject(_prefs.views)) {
        _prefs.views = {};
      }
      if (typeof _prefs._version !== 'number') {
        _prefs._version = UI_PREFS_VERSION;
      }
    } else {
      _prefs = emptyDoc();
    }
  } catch {
    _prefs = emptyDoc();
  }

  _loaded = true;
  return _prefs;
}

// Synchronous cache. Unloaded → empty document (never throws).
export function getUiPrefs () {
  return _prefs;
}

async function persist () {
  await writeFile(uiPrefsPath(), JSON.stringify(_prefs, null, 2));
}

// Merge allow-listed keys only. Unknown view/key: ignore. Invalid value for
// a known key: skip that key. Persist only if an allowed value changed.
export async function patchUiPrefs (partial) {
  await loadUiPrefs();
  if (!isPlainObject(partial)) return _prefs;

  let changed = false;
  if (Object.prototype.hasOwnProperty.call(partial, 'meshViewer')) {
    const value = partial.meshViewer;
    if ((value === 'on' || value === 'off') && _prefs.meshViewer !== value) {
      _prefs.meshViewer = value;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'downloadAdvancedOpen')) {
    const value = partial.downloadAdvancedOpen;
    if (typeof value === 'boolean' && _prefs.downloadAdvancedOpen !== value) {
      _prefs.downloadAdvancedOpen = value;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'downloadAuto')) {
    const value = partial.downloadAuto;
    if (typeof value === 'boolean' && _prefs.downloadAuto !== value) {
      _prefs.downloadAuto = value;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'downloadEvery')) {
    const value = partial.downloadEvery;
    if (DOWNLOAD_PERIOD_IDS.has(value) && _prefs.downloadEvery !== value) {
      _prefs.downloadEvery = value;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'downloadRecheck')) {
    const value = partial.downloadRecheck;
    if (typeof value === 'boolean' && _prefs.downloadRecheck !== value) {
      _prefs.downloadRecheck = value;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'downloadTypes')) {
    const next = canonicalizeDownloadTypes(partial.downloadTypes);
    if (next.length) {
      const current = canonicalizeDownloadTypes(_prefs.downloadTypes);
      if (current.length !== next.length || current.some((id, i) => id !== next[i])) {
        _prefs.downloadTypes = next;
        changed = true;
      }
    }
  }

  const incomingViews = partial.views;
  if (!isPlainObject(incomingViews)) {
    if (changed) await persist();
    return _prefs;
  }

  for (const view of Object.keys(incomingViews)) {
    const registry = STICKY_REGISTRY[view];
    if (!registry) continue;
    const incoming = incomingViews[view];
    if (!isPlainObject(incoming)) continue;

    for (const key of Object.keys(incoming)) {
      const spec = registry[key];
      if (!spec) continue;
      const value = incoming[key];
      if (!spec.allowed.includes(value)) continue;

      const currentView = _prefs.views[view];
      const current = isPlainObject(currentView) ? currentView[key] : undefined;
      if (current === value) continue;

      if (!isPlainObject(_prefs.views[view])) {
        _prefs.views[view] = {};
      }
      _prefs.views[view][key] = value;
      changed = true;
    }
  }

  if (changed) await persist();
  return _prefs;
}

/** @internal — test-only. Drop the load-once cache so the next loadUiPrefs re-reads disk. */
export function __resetForTest () {
  _loaded = false;
  _prefs = emptyDoc();
}
