// Phase 2 URL state — parser, formatter, and Preact hook.
//
// Single source of truth for the Explorer URL grammar. See
// docs/guides/civitai-sync/explorer-url-protocol.md for the design
// specification — every public function here is normative against that doc.
//
// Three exports do the heavy lifting:
//   - parseUrl(href) → UrlState           (pure)
//   - formatUrl(state) → href             (pure, canonical form)
//   - useUrlState(schema) → [state, update, { present, view }] (Preact hook;
//     existing `const [state, update] = useUrlState(schema)` stays valid.
//     Persistence for sticky keys lives in sticky-ui.js, not here.)
//
// formatUrl(parseUrl(x)) re-emits the canonical form per Implementation
// Contract item 4 (stable parameter order: facets first alphabetical, then
// groupBy, groupSort, sort, q, select, granularity, from, _v).

import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { getRoute, replaceState as routerReplaceState, pushState as routerPushState, subscribe } from './router.js';
import { CURRENT_PROTOCOL_VERSION } from './url-migrations.js';

// Per the protocol's Views section. `resources-redirect` is the soft-fail
// landing for any historical /resources/* path that may exist in user
// bookmarks even though the protocol never shipped that route.
export const KNOWN_VIEWS = Object.freeze([
  'overview', 'generations', 'posts', 'comics', 'model3ds',
  'models', 'media',
  'exports', 'resources-redirect', 'download'
]);

const KNOWN_VIEW_SET = new Set(KNOWN_VIEWS);

// First-segment aliases — soft-fail redirects that resolve to a real view.
// resources was never a shipped view. Retired /library, /timeline, and
// /stats are unrecognised segments (viewWasUnknown).
const VIEW_ALIASES = Object.freeze({
  resources: 'resources-redirect'
});

// Views where the second path segment is an entity id (and the rest is empty).
const DETAIL_VIEWS = new Set(['posts', 'comics', 'model3ds', 'media', 'generations']);

// Per the protocol's Implementation Contract item 4. Order matters for emit.
const CONTROL_ORDER = Object.freeze(['groupBy', 'groupSort', 'sort', 'q', 'select', 'granularity', 'from']);
export const CONTROL_KEYS = new Set([...CONTROL_ORDER, '_v']);

// Single source of the protocol version: url-migrations.js owns it (it has
// no imports, so this is a clean one-way edge — no cycle). The migration
// runner lifts an incoming URL up to this version; `formatUrl` omits `_v`
// when a state is already at it (it is implicit, never emitted).
const CURRENT_VERSION = CURRENT_PROTOCOL_VERSION;

// The protocol floor: a bookmark authored before `_v` existed is interpreted
// as `_v=1` (explorer-url-protocol.md § Versioning), then lifted by the
// migration chain. This is distinct from CURRENT_VERSION — they coincided at
// _v=1 but diverge once a migration lands.
const PROTOCOL_FLOOR_VERSION = 1;

// --------------------------------------------------------------------------
// parseUrl
// --------------------------------------------------------------------------

export function parseUrl (href) {
  // Accept relative paths by mounting them on a synthetic base. The base host
  // is discarded after parsing — only pathname + search are inspected.
  const url = new URL(href, 'http://_internal_/');

  const rawSegments = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const segments = rawSegments.map(s => safeDecode(s));

  let view = 'overview';
  let viewWasUnknown = false;
  let unknownView = null;
  let entityId = null;
  let modelTrail = null;

  const top = segments[0];
  const rest = segments.slice(1);

  if (top == null) {
    view = 'overview';
  } else if (KNOWN_VIEW_SET.has(top)) {
    view = top;
  } else if (Object.prototype.hasOwnProperty.call(VIEW_ALIASES, top)) {
    view = VIEW_ALIASES[top];
  } else {
    view = 'overview';
    viewWasUnknown = true;
    unknownView = top;
  }

  if (!viewWasUnknown) {
    if (view === 'models') {
      // Numeric-prefix first segment is the Civitai-shaped model page
      // (`/models/{id}-{slug}`). A ModelType (or other non-numeric) first
      // segment is the pre-_v=3 folder trail, lifted by url-migrations.
      if (rest.length > 0) {
        if (/^\d/.test(rest[0])) {
          entityId = rest[0];
        } else {
          modelTrail = rest;
        }
      }
    } else if (DETAIL_VIEWS.has(view) && rest.length > 0) {
      entityId = rest[0];
    }
  }

  // Aggregate repeated keys into the comma form so the parsed shape matches
  // what formatUrl re-emits. Both forms are accepted on read per the protocol.
  const params = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key === '_v') continue;
    if (params[key] != null) {
      params[key] = params[key] + ',' + value;
    } else {
      params[key] = value;
    }
  }

  // A missing `_v` means the URL predates the parameter → floor (v1), which
  // the migration chain then lifts to current. Defaulting to CURRENT here
  // would skip migrations for the entire pre-`_v` bookmark corpus.
  const vRaw = url.searchParams.get('_v');
  let v = PROTOCOL_FLOOR_VERSION;
  if (vRaw != null) {
    const parsed = parseInt(vRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) v = parsed;
  }

  return {
    view, entityId, modelTrail, params, v, viewWasUnknown,
    ...(unknownView != null ? { unknownView } : {})
  };
}

function safeDecode (s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// --------------------------------------------------------------------------
// formatUrl
// --------------------------------------------------------------------------

export function formatUrl (state) {
  const view = state && state.view ? state.view : 'overview';
  const rawParams = (state && state.params) ? state.params : {};

  // _v can come in via state.v or via params._v; state.v wins.
  const paramsCopy = { ...rawParams };
  // mine=0 is off. The bookmark omits the key.
  if (paramsCopy.mine === '0' || paramsCopy.mine === 'false') delete paramsCopy.mine;
  const paramV = paramsCopy._v;
  delete paramsCopy._v;
  let v = state && state.v != null ? state.v : null;
  if (v == null && paramV != null) {
    const parsed = parseInt(paramV, 10);
    if (Number.isFinite(parsed) && parsed > 0) v = parsed;
  }
  if (v == null) v = CURRENT_VERSION;

  const pathname = buildPathname(view, state);

  // Drop empty values per IC5.
  const presentKeys = Object.keys(paramsCopy).filter(k => !isEmptyValue(paramsCopy[k]));

  // Facets (anything not in CONTROL_KEYS) come first, alphabetical by key.
  const facetKeys = presentKeys.filter(k => !CONTROL_KEYS.has(k)).sort();
  // Then the control keys in the protocol order.
  const controlKeys = CONTROL_ORDER.filter(k => paramsCopy[k] != null && !isEmptyValue(paramsCopy[k]));

  const parts = [];
  for (const k of facetKeys) parts.push(emitPair(k, paramsCopy[k]));
  for (const k of controlKeys) parts.push(emitPair(k, paramsCopy[k]));
  if (v !== CURRENT_VERSION) parts.push(emitPair('_v', String(v)));

  return parts.length === 0 ? pathname : `${pathname}?${parts.join('&')}`;
}

function buildPathname (view, state) {
  if (view === 'models' && state && state.entityId != null && state.entityId !== '') {
    return `/models/${encodeSegment(String(state.entityId))}`;
  }
  if (view === 'models' && state && Array.isArray(state.modelTrail) && state.modelTrail.length > 0) {
    return '/models/' + state.modelTrail.map(encodeSegment).join('/');
  }
  if (DETAIL_VIEWS.has(view) && state && state.entityId != null && state.entityId !== '') {
    return `/${view}/${encodeSegment(String(state.entityId))}`;
  }
  return `/${view}`;
}

function encodeSegment (s) {
  return encodeURIComponent(s);
}

// URL-encode a value while keeping commas and colons literal — both are
// allowed in the query component per RFC 3986 §3.4, and the protocol uses
// them in the comma form (`tag=a,b`) and in `sort=date:desc` / `tag=feedback:liked`.
function encodeValue (s) {
  return encodeURIComponent(s)
    .replace(/%2C/g, ',')
    .replace(/%3A/g, ':');
}

function emitPair (key, value) {
  const str = Array.isArray(value) ? value.join(',') : String(value);
  return `${encodeURIComponent(key)}=${encodeValue(str)}`;
}

function isEmptyValue (v) {
  if (v == null) return true;
  if (v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/**
 * Params for a hop whose href is the whole destination query.
 * Keys on the current route that the href omitted become null so
 * mergePartial deletes them (same-view merge would otherwise keep them).
 * A key on both takes the destination value.
 */
export function completeAuthoredParams (currentParams, nextParams) {
  const params = { ...(nextParams || {}) };
  const current = currentParams || {};
  for (const key of Object.keys(current)) {
    if (!Object.prototype.hasOwnProperty.call(params, key)) params[key] = null;
  }
  return params;
}

// --------------------------------------------------------------------------
// Schema-driven read / write helpers (shared by the hook below).
// --------------------------------------------------------------------------

// Schema-aware parse of raw URL param strings into typed hook state.
// `inPost` is the boolean consumer: '1'/'true' → true, any other present
// token (including '0') → false, absent → schema default (null = Any).
export function readSchemaState (params, schema) {
  const out = {};
  for (const key of Object.keys(schema)) {
    const def = schema[key] || {};
    const raw = params[key];
    if (raw == null || raw === '') {
      out[key] = cloneDefault(def);
      continue;
    }
    switch (def.type) {
      case 'csv':
        out[key] = String(raw).split(',').map(s => s.trim()).filter(Boolean);
        break;
      case 'number':
        out[key] = Number(raw);
        break;
      case 'integer':
        out[key] = parseInt(raw, 10);
        break;
      case 'boolean':
        out[key] = raw === '1' || raw === 'true';
        break;
      case 'string':
      default:
        out[key] = String(raw);
    }
  }
  return out;
}

function cloneDefault (def) {
  if (def.default === undefined) {
    if (def.type === 'csv') return [];
    return '';
  }
  if (Array.isArray(def.default)) return [...def.default];
  return def.default;
}

// Schema-aware encode of typed hook state into URL param strings (or null
// to drop the key). Boolean is a tristate: true → '1', false → '0',
// null/undefined → omit. Collapsing false onto omit made "Not in a post"
// snap back to Any.
export function serializeSchemaPartial (partial, schema) {
  const out = {};
  for (const key of Object.keys(partial)) {
    const def = schema[key] || {};
    const v = partial[key];
    switch (def.type) {
      case 'csv':
        if (!Array.isArray(v) || v.length === 0) out[key] = null;
        else out[key] = v.map(String).filter(Boolean).join(',');
        break;
      case 'boolean':
        out[key] = v == null ? null : (v ? '1' : '0');
        break;
      case 'number':
      case 'integer':
        out[key] = (v == null || v === '' || Number.isNaN(v)) ? null : String(v);
        break;
      case 'string':
      default:
        out[key] = (v == null || v === '') ? null : String(v);
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// useUrlState — Preact hook
// --------------------------------------------------------------------------
//
// Coalesces multiple update() calls within the same animation frame into a
// single history write, so a fast-typed search box doesn't paint the back
// stack with one entry per keystroke. (The view's own search-input debounce
// already attenuates this; the rAF coalesce is a backstop and a way to keep
// parse/format cycles off the keystroke path.)

let _pendingPartial = null;
let _pendingMode = 'replace';
let _rafId = null;

function flushPending () {
  _rafId = null;
  const partial = _pendingPartial;
  const mode = _pendingMode;
  _pendingPartial = null;
  _pendingMode = 'replace';
  if (!partial) return;
  if (mode === 'push') routerPushState({ params: partial });
  else routerReplaceState({ params: partial });
}

function schedulePartial (partial, mode) {
  if (!_pendingPartial) _pendingPartial = {};
  Object.assign(_pendingPartial, partial);
  if (mode === 'push') _pendingMode = 'push';
  if (_rafId == null) {
    if (typeof requestAnimationFrame === 'function') {
      _rafId = requestAnimationFrame(flushPending);
    } else {
      // Test / SSR fallback — flush on next microtask.
      _rafId = 1;
      Promise.resolve().then(flushPending);
    }
  }
}

export function useUrlState (schema) {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const update = () => setRoute(getRoute());
    return subscribe(update);
  }, []);

  // Memoise so consumers can put `state` (or its slices) in dependency arrays
  // without re-triggering effects on every render. `schema` is expected to be
  // module-scope-stable per the convention in the view migration tables.
  const state = useMemo(() => readSchemaState(route.params || {}, schema), [route, schema]);

  // URL-only: key missing or empty is not present. Sticky resolution (absent
  // vs explicit default) is sticky-ui.js — this hook never persists.
  const present = useMemo(() => {
    const params = route.params || {};
    const out = {};
    for (const key of Object.keys(schema)) {
      out[key] = params[key] != null && params[key] !== '';
    }
    return out;
  }, [route, schema]);

  const update = useCallback((partial, options) => {
    const mode = options && options.history === 'push' ? 'push' : 'replace';
    const serialized = serializeSchemaPartial(partial, schema);
    schedulePartial(serialized, mode);
  }, [schema]);

  return [state, update, { present, view: route.view }];
}
