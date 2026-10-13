// View-scoped URL-parameter registry. See
// docs/guides/civitai-sync/explorer-url-protocol.md § Query parameters
// ("Applies to" column) and § Implementation Contract items 7 and 10.
//
// Leaf module (no imports), mirroring url-migrations.js, so
// router.js → view-params.js is a one-way edge with no cycle.
//
// VIEW_PARAM_KEYS encodes the protocol "Applies to" column, cross-checked
// against each view's URL_SCHEMA. Param-free views map to an empty set.
// KNOWN_PARAM_KEYS is the union of every view's keys plus CONTROL_KEYS.
// Keep CONTROL_KEYS in lockstep with url-state.js (the test guards this).
//
// pruneCarriedParams uses Option F (view-scoped reset): on a view change,
// drop every protocol-recognised carried param. Keep only (a) keys the
// navigation passed explicitly and (b) protocol-unrecognised keys (IC7
// forward-compat). The keep-predicate is the single line marked OPTION F
// below; Option P would instead drop only when
// !VIEW_PARAM_KEYS[toView]?.has(key).
//
// dropEntityScopedParams drops ENTITY_PARAM_KEYS when the path entityId
// changes unless the navigation passed them explicitly. Empty: generation=
// is no longer entity-scoped.

// Must match url-state.js CONTROL_KEYS (CONTROL_ORDER ∪ {_v}).
const CONTROL_KEYS = Object.freeze([
  'groupBy', 'groupSort', 'sort', 'q', 'select', 'granularity', 'from', '_v'
]);

function paramSet (...keys) {
  return new Set(keys);
}

// Per-view applicable query-param keys (facets). Control keys live in
// CONTROL_KEYS and are unioned into KNOWN_PARAM_KEYS separately.
//
// Cross-check notes (protocol "Applies to" × URL_SCHEMA):
//   generations — URL_SCHEMA facets match the media-item + generation rows.
//   posts       — membership keys match Generations (minus inPost); plus
//                 tag/reaction/aspect/publication/date. `status` and
//                 `engagement` are prune-only (retired keys; Option F still
//                 drops a carried value rather than treating it as unknown).
//                 `title` is the container-title search (not on Generations).
//   comics      — same membership keys as posts plus tag/aspect.
//                 `engagement` is prune-only. `status` prune-only.
//                 `title` searches comic name.
//   media       — origin identity `from=` plus protocol media-item rows
//                 (inert on the node; no FacetBar). `generation=` is not a
//                 media view param (API hop GET /api/media/:id?generation=
//                 stays). Remaining keys are protocol media-item rows.
//                 `title` rides with a Posts/Comics origin.
//   overview, download, resources-redirect — param-free.
//   exports — workflowMode (and the saved query persists workflow too).
//   models — catalog csv filters + selected version; path identity is
//             entityId (`/models/{id}-{slug}`). sort/select via CONTROL_KEYS.
export const VIEW_PARAM_KEYS = Object.freeze({
  generations: paramSet(
    'type', 'ecosystem', 'model', 'version', 'resourceType', 'resource',
    'versionId', 'scope',
    'aspect', 'tag', 'reaction', 'dateFrom', 'dateTo',
    'cfgMin', 'cfgMax', 'stepsMin', 'stepsMax', 'inPost', 'publication', 'usedAsInput',
    'workflow', 'workflowMode', 'mine',
    'from',
    'slot',
    // prune-only: retired media-view generation= (API hop kept). Option F
    // still drops a carried generation= rather than treating it as unknown.
    'generation'
  ),
  posts: paramSet(
    'type', 'ecosystem', 'model', 'version', 'resourceType', 'resource',
    'versionId', 'scope',
    'tag', 'reaction', 'aspect', 'dateFrom', 'dateTo', 'status', 'publication', 'engagement',
    'cfgMin', 'cfgMax', 'stepsMin', 'stepsMax', 'usedAsInput', 'workflow', 'workflowMode', 'mine',
    'title',
    'from',
    'slot',
    'generation' // prune-only; see generations
  ),
  model3ds: paramSet(
    'publication', 'status',
    'from'
  ),
  comics: paramSet(
    'type', 'ecosystem', 'model', 'version', 'resourceType', 'resource',
    'versionId', 'scope',
    'tag', 'reaction', 'aspect', 'dateFrom', 'dateTo', 'status', 'publication', 'engagement',
    'cfgMin', 'cfgMax', 'stepsMin', 'stepsMax', 'usedAsInput', 'workflow', 'workflowMode', 'mine',
    'title',
    'from',
    'slot',
    'generation' // prune-only; see generations
  ),
  media: paramSet(
    'type', 'ecosystem', 'model', 'version', 'resourceType', 'resource',
    'versionId', 'familyId', 'scope',
    'aspect', 'tag', 'reaction', 'dateFrom', 'dateTo',
    'cfgMin', 'cfgMax', 'stepsMin', 'stepsMax', 'inPost', 'publication', 'usedAsInput',
    'workflow', 'workflowMode',
    'title',
    'from',
    'slot',
    // Used in… gallery on this page. Only the string `1` opens it. Other
    // views do not list it, so a view change drops a carried value.
    'usedIn'
  ),
  overview: paramSet(),
  models: paramSet(
    'resourceType', 'family', 'variant', 'modelVersionId', 'familyId', 'mine',
    'from'
  ),
  download: paramSet(),
  exports: paramSet('workflow', 'workflowMode'),
  'resources-redirect': paramSet()
});

export const KNOWN_PARAM_KEYS = new Set([
  ...CONTROL_KEYS,
  ...Object.values(VIEW_PARAM_KEYS).flatMap(s => [...s])
]);

// Params that name a fact about the current entity, not the view. On an
// entityId change (media A → media B) they drop unless the navigation passed
// them explicitly. Empty: `generation=` is no longer entity-scoped (retired
// as a media view param; prune-only via VIEW_PARAM_KEYS on origin galleries).
export const ENTITY_PARAM_KEYS = new Set();

/**
 * Drop protocol-recognised params that rode in from a previous view.
 *
 * @param {Record<string, unknown>} params
 * @param {{ fromView?: string, toView?: string, explicitKeys?: Set<string> }} [opts]
 * @returns {Record<string, unknown>} a new params object
 */
export function pruneCarriedParams (params, { fromView, toView, explicitKeys } = {}) {
  const src = params || {};
  if (fromView === toView) return { ...src };

  const explicit = explicitKeys instanceof Set
    ? explicitKeys
    : new Set(explicitKeys || []);

  const out = {};
  for (const key of Object.keys(src)) {
    if (explicit.has(key)) {
      out[key] = src[key];
      continue;
    }
    if (!KNOWN_PARAM_KEYS.has(key)) {
      // IC7: protocol-unrecognised params pass through (forward-compat).
      out[key] = src[key];
      continue;
    }
    // OPTION F: drop every protocol-recognised carried param.
    // Option P would keep when VIEW_PARAM_KEYS[toView]?.has(key).
  }
  return out;
}

/**
 * Drop entity-scoped params when the path identity changes.
 *
 * @param {Record<string, unknown>} params
 * @param {{ entityChanged?: boolean, explicitKeys?: Set<string> }} [opts]
 * @returns {Record<string, unknown>} a new params object
 */
export function dropEntityScopedParams (params, { entityChanged, explicitKeys } = {}) {
  const src = { ...(params || {}) };
  if (!entityChanged) return src;
  const explicit = explicitKeys instanceof Set
    ? explicitKeys
    : new Set(explicitKeys || []);
  for (const key of ENTITY_PARAM_KEYS) {
    if (!explicit.has(key)) delete src[key];
  }
  return src;
}
