import {
  useUrlState
} from "./chunk-CPLX52FD.js";
import {
  A,
  T,
  getUiPrefs,
  patchUiPrefs,
  q,
  y
} from "./chunk-OGIWOTNU.js";

// src/downloadQueue.mjs
var DOWNLOAD_TYPE_ORDER = Object.freeze(["generations", "posts", "comics", "model3ds"]);
var DOWNLOAD_TYPE_LABELS = Object.freeze({
  generations: "Generations",
  posts: "Posts",
  comics: "Comics",
  model3ds: "3D"
});
function canonicalizeDownloadTypes(list) {
  const source = Array.isArray(list) ? list : [];
  const present = new Set(source);
  return DOWNLOAD_TYPE_ORDER.filter((id) => present.has(id));
}

// src/autoDownload.mjs
var MINUTE = 60 * 1e3;
var HOUR = 60 * MINUTE;
var RECOVERY_FLOOR = 2 * MINUTE;
var DOWNLOAD_PERIODS = Object.freeze([
  Object.freeze({ id: "5m", ms: 5 * MINUTE, label: "5 mins" }),
  Object.freeze({ id: "15m", ms: 15 * MINUTE, label: "15 mins" }),
  Object.freeze({ id: "30m", ms: 30 * MINUTE, label: "30 mins" }),
  Object.freeze({ id: "1h", ms: HOUR, label: "1 hour" }),
  Object.freeze({ id: "3h", ms: 3 * HOUR, label: "3 hours" }),
  Object.freeze({ id: "6h", ms: 6 * HOUR, label: "6 hours" }),
  Object.freeze({ id: "12h", ms: 12 * HOUR, label: "12 hours" }),
  Object.freeze({ id: "1d", ms: 24 * HOUR, label: "1 day" })
]);
var PERIOD_BY_ID = new Map(DOWNLOAD_PERIODS.map((period) => [period.id, period]));
var DEFAULT_PERIOD = PERIOD_BY_ID.get("1h");
function periodById(id) {
  return PERIOD_BY_ID.get(id) || DEFAULT_PERIOD;
}
function periodLabel(id) {
  return periodById(id).label;
}

// dev/ui/src/lib/sticky-ui.js
var _prefs = { _version: 1, views: {} };
var _prefsLoaded = false;
function resolveStickyValue({ present, urlValue, sticky, schemaDefault }) {
  if (present) return urlValue;
  if (sticky != null && sticky !== "") return sticky;
  return schemaDefault;
}
function stickySchemaKeys(schema) {
  return Object.keys(schema).filter((k) => keySticky(schema, k));
}
function keySticky(schema, key) {
  return schema[key] && schema[key].sticky === true;
}
function buildHydratePartial({ schema, present, prefs, view }) {
  const out = {};
  for (const key of stickySchemaKeys(schema)) {
    if (present && present[key]) continue;
    const sticky = prefs && prefs.views && prefs.views[view] ? prefs.views[view][key] : void 0;
    if (sticky == null || sticky === "") continue;
    out[key] = sticky;
  }
  return Object.keys(out).length ? out : null;
}
function buildPrefsPatch({ schema, partial, view }) {
  if (!partial || !view) return null;
  const keys = {};
  for (const key of Object.keys(partial)) {
    if (!keySticky(schema, key)) continue;
    keys[key] = partial[key];
  }
  if (!Object.keys(keys).length) return null;
  return { views: { [view]: keys } };
}
async function loadUiPrefs() {
  if (_prefsLoaded) return _prefs;
  try {
    const doc = await getUiPrefs();
    if (doc && typeof doc === "object" && !Array.isArray(doc)) {
      const localViewer = _prefs.meshViewer;
      _prefs = doc;
      if (!_prefs.views || typeof _prefs.views !== "object" || Array.isArray(_prefs.views)) {
        _prefs.views = {};
      }
      if ((localViewer === "on" || localViewer === "off") && _prefs.meshViewer !== localViewer) {
        _prefs.meshViewer = localViewer;
      }
    } else {
      _prefs = { _version: 1, views: {} };
    }
  } catch {
    _prefs = { _version: 1, views: {} };
  }
  _prefsLoaded = true;
  return _prefs;
}
function readDownloadTypes() {
  const list = canonicalizeDownloadTypes(_prefs.downloadTypes);
  return list.length ? list : null;
}
function readDownloadAdvancedOpen() {
  return _prefs.downloadAdvancedOpen === true;
}
function rememberDownloadAdvancedOpen(open) {
  const next = open === true;
  if (_prefs.downloadAdvancedOpen === next) return;
  _prefs.downloadAdvancedOpen = next;
  patchUiPrefs({ downloadAdvancedOpen: next }).catch(() => {
  });
}
function readDownloadAuto() {
  return _prefs.downloadAuto === true;
}
function readDownloadEvery() {
  return periodById(_prefs.downloadEvery).id;
}
function readDownloadRecheck() {
  return _prefs.downloadRecheck === true;
}
function rememberDownloadAuto(on) {
  const next = on === true;
  if (_prefs.downloadAuto === next) return;
  _prefs.downloadAuto = next;
  patchUiPrefs({ downloadAuto: next }).catch(() => {
  });
}
function rememberDownloadEvery(id) {
  const next = periodById(id).id;
  if (_prefs.downloadEvery === next) return;
  _prefs.downloadEvery = next;
  patchUiPrefs({ downloadEvery: next }).catch(() => {
  });
}
function rememberDownloadRecheck(on) {
  const next = on === true;
  if (_prefs.downloadRecheck === next) return;
  _prefs.downloadRecheck = next;
  patchUiPrefs({ downloadRecheck: next }).catch(() => {
  });
}
function rememberDownloadTypes(types) {
  const next = canonicalizeDownloadTypes(types);
  if (!next.length) return;
  const prev = canonicalizeDownloadTypes(_prefs.downloadTypes);
  if (prev.length === next.length && prev.every((id, i) => id === next[i])) return;
  _prefs.downloadTypes = next;
  patchUiPrefs({ downloadTypes: next }).catch(() => {
  });
}
function rememberMeshViewer(value) {
  if (value !== "on" && value !== "off") return;
  _prefs.meshViewer = value;
  patchUiPrefs({ meshViewer: value }).catch(() => {
  });
}
function readMeshViewerPref() {
  return {
    loaded: _prefsLoaded,
    on: _prefsLoaded && _prefs.meshViewer === "on"
  };
}
function rememberSticky(patch) {
  if (!patch || !patch.views || typeof patch.views !== "object") return;
  if (!_prefs.views || typeof _prefs.views !== "object" || Array.isArray(_prefs.views)) {
    _prefs.views = {};
  }
  for (const view of Object.keys(patch.views)) {
    const incoming = patch.views[view];
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) continue;
    if (!_prefs.views[view] || typeof _prefs.views[view] !== "object" || Array.isArray(_prefs.views[view])) {
      _prefs.views[view] = {};
    }
    Object.assign(_prefs.views[view], incoming);
  }
  patchUiPrefs(patch).catch(() => {
  });
}
function useStickyUrlState(schema) {
  const [state, urlUpdate, { present, view }] = useUrlState(schema);
  const resolved = T(() => {
    const out = { ...state };
    for (const key of stickySchemaKeys(schema)) {
      const sticky = _prefs.views && _prefs.views[view] ? _prefs.views[view][key] : void 0;
      out[key] = resolveStickyValue({
        present: present[key],
        urlValue: state[key],
        sticky,
        schemaDefault: schema[key] && schema[key].default
      });
    }
    return out;
  }, [state, present, view, schema]);
  const hydratedForView = A(null);
  y(() => {
    if (!_prefsLoaded) return;
    if (hydratedForView.current === view) return;
    hydratedForView.current = view;
    const partial = buildHydratePartial({ schema, present, prefs: _prefs, view });
    if (partial) urlUpdate(partial);
  }, [schema, present, view, urlUpdate]);
  const update = q((partial, options) => {
    urlUpdate(partial, options);
    const patch = buildPrefsPatch({ schema, partial, view });
    if (patch) rememberSticky(patch);
  }, [schema, urlUpdate, view]);
  return [resolved, update];
}

export {
  DOWNLOAD_TYPE_ORDER,
  DOWNLOAD_TYPE_LABELS,
  canonicalizeDownloadTypes,
  DOWNLOAD_PERIODS,
  periodLabel,
  loadUiPrefs,
  readDownloadTypes,
  readDownloadAdvancedOpen,
  rememberDownloadAdvancedOpen,
  readDownloadAuto,
  readDownloadEvery,
  readDownloadRecheck,
  rememberDownloadAuto,
  rememberDownloadEvery,
  rememberDownloadRecheck,
  rememberDownloadTypes,
  rememberMeshViewer,
  readMeshViewerPref,
  useStickyUrlState
};
