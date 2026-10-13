// Thin router wrapper around the URL grammar.
//
// All routing is delegated to ./url-state.js (the parser + formatter),
// ./url-migrations.js (the version registry), and ./view-params.js (the
// view-scoped param prune on a view change). This module's only job is to
// bind those pure functions to `history` and `window.popstate` and expose a
// stable surface that views can call.
//
// Public surface (preserved for back-compat with the v5.1.0 router):
//   - getRoute()              → UrlState (parsed + migrated)
//   - replaceState(partial, opts?) → merge partial; history.replaceState
//   - pushState(partial, opts?)    → merge partial; history.pushState
//   - navigate(view, opts?)   → back-compat alias for pushState({ view })
//   - subscribe(cb)           → popstate + urlstatechange listener, returns unsubscribe
//
// Optional `opts` `{ list, mediaList, originHref, focus, originPage, anchorSlot }`
// is written onto `history.state` (not the URL). `replaceState` preserves
// existing keys (facet tweaks, canonical rewrite). `pushState` starts a
// fresh bag then applies opts — Option F must not inherit the previous
// view's this-lists. `focus: null` / `anchorSlot: null` drops that key.
//
// Per the protocol's Implementation Contract (item 2 / item 3): facet
// tweaks use replaceState; view changes and groupBy changes use pushState.
// Call sites are responsible for choosing the right one. The hook in
// url-state.js wraps this with a schema-driven update() that defaults to
// replaceState.

import { parseUrl, formatUrl } from './url-state.js';
import { applyMigrations } from './url-migrations.js';
import { pruneCarriedParams, dropEntityScopedParams } from './view-params.js';

const URLSTATE_EVENT = 'urlstatechange';

export function getRoute () {
  const parsed = parseUrl(location.pathname + location.search);
  return applyMigrations(parsed);
}

export function replaceState (partial, opts) {
  const next = mergePartial(getRoute(), partial);
  // Facet tweaks and canonical URL rewrites stay on the same history
  // entry — keep list/mediaList/focus/originPage unless opts overlays them.
  history.replaceState(mergeHistoryState(opts, { inherit: true }), '', formatUrl(next));
  dispatchUrlStateEvent();
}

export function pushState (partial, opts) {
  const next = mergePartial(getRoute(), partial);
  // A new history entry must not inherit the previous view's this-lists
  // (Option F to Posts would otherwise keep Generations mediaList). Callers
  // that copy lists or focus pass them in opts explicitly.
  history.pushState(mergeHistoryState(opts, { inherit: false }), '', formatUrl(next));
  dispatchUrlStateEvent();
}

// Back-compat with the v5.1.0 router. Accepts either a view name
// ('posts', 'download') or a path-like string ('posts/123'). Path-like
// forms are parsed and re-pushed under the new shape.
export function navigate (target, opts) {
  if (typeof target !== 'string') return;
  if (target.includes('/') || target.startsWith('/')) {
    const parsed = parseUrl(target.startsWith('/') ? target : '/' + target);
    pushState({
      view: parsed.view,
      entityId: parsed.entityId,
      modelTrail: parsed.modelTrail,
      params: parsed.params
    }, opts);
    return;
  }
  pushState({ view: target, entityId: null, modelTrail: null }, opts);
}

export function subscribe (cb) {
  const handler = () => cb();
  window.addEventListener('popstate', handler);
  window.addEventListener(URLSTATE_EVENT, handler);
  return () => {
    window.removeEventListener('popstate', handler);
    window.removeEventListener(URLSTATE_EVENT, handler);
  };
}

// --------------------------------------------------------------------------

const HISTORY_STATE_KEYS = ['list', 'mediaList', 'originHref', 'focus', 'originPage', 'anchorSlot'];

function snapshotHistoryState () {
  const s = typeof history === 'undefined' ? null : history.state;
  if (s == null || typeof s !== 'object' || Array.isArray(s)) return {};
  return { ...s };
}

function mergeHistoryState (opts, { inherit } = {}) {
  const next = inherit ? snapshotHistoryState() : {};
  if (opts != null && typeof opts === 'object') {
    for (const key of HISTORY_STATE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(opts, key)) continue;
      if ((key === 'focus' || key === 'anchorSlot') && opts[key] == null) delete next[key];
      else next[key] = opts[key];
    }
  }
  return Object.keys(next).length === 0 ? null : next;
}

function mergePartial (cur, partial) {
  if (!partial) return cur;
  // Gallery own-tab reset: `pushState({ view, entityId: null, params: {} })`.
  // Merge would keep the current query; empty `params` here means a bare view.
  const paramsPassed = Object.prototype.hasOwnProperty.call(partial, 'params');
  const emptyParams = paramsPassed
    && partial.params != null
    && typeof partial.params === 'object'
    && !Array.isArray(partial.params)
    && Object.keys(partial.params).length === 0;
  const bareViewReset = emptyParams
    && 'view' in partial
    && 'entityId' in partial
    && partial.entityId == null;

  const next = {
    view: 'view' in partial ? partial.view : cur.view,
    entityId: 'entityId' in partial ? partial.entityId : cur.entityId,
    modelTrail: 'modelTrail' in partial ? partial.modelTrail : cur.modelTrail,
    params: bareViewReset ? {} : { ...cur.params, ...(partial.params || {}) },
    v: 'v' in partial ? partial.v : cur.v,
    viewWasUnknown: false
  };
  // Drop null / empty values from params per Implementation Contract item 5.
  for (const k of Object.keys(next.params)) {
    const val = next.params[k];
    if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
      delete next.params[k];
    }
  }
  // If the view changed, an entityId / modelTrail from the previous view is
  // not meaningful — clear unless the caller passed one explicitly. Query
  // params are view-scoped (protocol IC item 10): drop recognised carried
  // keys, keep explicit partial.params and protocol-unknown keys (IC7).
  const explicitKeys = new Set(Object.keys(partial.params || {}));
  if (partial.view != null && partial.view !== cur.view) {
    if (!('entityId' in partial)) next.entityId = null;
    if (!('modelTrail' in partial)) next.modelTrail = null;
    next.params = pruneCarriedParams(next.params, {
      fromView: cur.view,
      toView: partial.view,
      explicitKeys
    });
  }
  const entityChanged = 'entityId' in partial && partial.entityId !== cur.entityId;
  if (entityChanged) {
    next.params = dropEntityScopedParams(next.params, {
      entityChanged: true,
      explicitKeys
    });
  }
  return next;
}

function dispatchUrlStateEvent () {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new Event(URLSTATE_EVENT));
  } catch {
    // Older Event constructor signatures — ignore.
  }
}
