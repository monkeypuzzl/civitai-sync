// Sticky UI — remembered defaults under the URL protocol.
//
// Three layers: explicit URL param → last explicit choice in
// data/explorer/ui.json → URL_SCHEMA default. useUrlState stays URL-only;
// this module is the persistence + resolve wrapper. Hydrate is replaceState
// only (never a prefs write). A user update of a sticky: true key PATCHes.

import { useMemo, useEffect, useCallback, useRef } from 'preact/hooks';
import { useUrlState } from './url-state.js';
import { getUiPrefs, patchUiPrefs as patchUiPrefsApi } from './../api.js';

let _prefs = { _version: 1, views: {} };
let _prefsLoaded = false;

export function resolveStickyValue ({ present, urlValue, sticky, schemaDefault }) {
  if (present) return urlValue;
  if (sticky != null && sticky !== '') return sticky;
  return schemaDefault;
}

export function stickySchemaKeys (schema) {
  return Object.keys(schema).filter(k => keySticky(schema, k));
}

function keySticky (schema, key) {
  return schema[key] && schema[key].sticky === true;
}

export function buildHydratePartial ({ schema, present, prefs, view }) {
  const out = {};
  for (const key of stickySchemaKeys(schema)) {
    if (present && present[key]) continue;
    const sticky = prefs && prefs.views && prefs.views[view]
      ? prefs.views[view][key]
      : undefined;
    if (sticky == null || sticky === '') continue;
    out[key] = sticky;
  }
  return Object.keys(out).length ? out : null;
}

export function buildPrefsPatch ({ schema, partial, view }) {
  if (!partial || !view) return null;
  const keys = {};
  for (const key of Object.keys(partial)) {
    if (!keySticky(schema, key)) continue;
    keys[key] = partial[key];
  }
  if (!Object.keys(keys).length) return null;
  return { views: { [view]: keys } };
}

export async function loadUiPrefs () {
  if (_prefsLoaded) return _prefs;
  try {
    const doc = await getUiPrefs();
    if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
      const localViewer = _prefs.meshViewer;
      _prefs = doc;
      if (!_prefs.views || typeof _prefs.views !== 'object' || Array.isArray(_prefs.views)) {
        _prefs.views = {};
      }
      if ((localViewer === 'on' || localViewer === 'off') && _prefs.meshViewer !== localViewer) {
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

export function rememberMeshViewer (value) {
  if (value !== 'on' && value !== 'off') return;
  _prefs.meshViewer = value;
  patchUiPrefsApi({ meshViewer: value }).catch(() => {});
}

// First commit of a page. The shell has usually finished loadUiPrefs already.
// Reading here avoids painting the default off and then correcting it.
export function readMeshViewerPref () {
  return {
    loaded: _prefsLoaded,
    on: _prefsLoaded && _prefs.meshViewer === 'on'
  };
}

export function rememberSticky (patch) {
  if (!patch || !patch.views || typeof patch.views !== 'object') return;
  if (!_prefs.views || typeof _prefs.views !== 'object' || Array.isArray(_prefs.views)) {
    _prefs.views = {};
  }
  for (const view of Object.keys(patch.views)) {
    const incoming = patch.views[view];
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) continue;
    if (!_prefs.views[view] || typeof _prefs.views[view] !== 'object' || Array.isArray(_prefs.views[view])) {
      _prefs.views[view] = {};
    }
    Object.assign(_prefs.views[view], incoming);
  }
  // Fire-and-forget: the URL already shows the new value. Disk lag or a
  // PATCH failure must not revert the control.
  patchUiPrefsApi(patch).catch(() => {});
}

export function useStickyUrlState (schema) {
  const [state, urlUpdate, { present, view }] = useUrlState(schema);

  const resolved = useMemo(() => {
    const out = { ...state };
    for (const key of stickySchemaKeys(schema)) {
      const sticky = _prefs.views && _prefs.views[view]
        ? _prefs.views[view][key]
        : undefined;
      out[key] = resolveStickyValue({
        present: present[key],
        urlValue: state[key],
        sticky,
        schemaDefault: schema[key] && schema[key].default
      });
    }
    return out;
  }, [state, present, view, schema]);

  const hydratedForView = useRef(null);
  useEffect(() => {
    if (!_prefsLoaded) return;
    if (hydratedForView.current === view) return;
    hydratedForView.current = view;
    const partial = buildHydratePartial({ schema, present, prefs: _prefs, view });
    if (partial) urlUpdate(partial);
  }, [schema, present, view, urlUpdate]);

  const update = useCallback((partial, options) => {
    urlUpdate(partial, options);
    const patch = buildPrefsPatch({ schema, partial, view });
    if (patch) rememberSticky(patch);
  }, [schema, urlUpdate, view]);

  return [resolved, update];
}
