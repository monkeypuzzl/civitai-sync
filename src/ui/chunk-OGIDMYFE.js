import {
  useUrlState
} from "./chunk-Z6L3MMX7.js";
import {
  A,
  T,
  getUiPrefs,
  patchUiPrefs,
  q,
  y
} from "./chunk-QDJYYBZC.js";

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
  loadUiPrefs,
  rememberMeshViewer,
  readMeshViewerPref,
  useStickyUrlState
};
