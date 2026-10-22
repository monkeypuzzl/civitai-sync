// Tree helpers for the Models picker. The `models=` grammar lives in
// src/modelsQuery.mjs. Importers of parse/serialize use that module.

const SERIALIZE_ORDER = ['type', 'baseModel', 'ecosystem', 'modelId', 'modelName', 'versionId', 'familyOutput', 'familyId', 'variant'];

export function termDepth (term) {
  if (!term) return 0;
  if (term.versionId) return 4;
  if (term.modelId || term.modelName) return 3;
  if (term.baseModel || term.ecosystem || term.familyId) return 2;
  if (term.type || term.familyOutput) return 1;
  return 0;
}

/** True when `term` is an ancestor-or-equal of `node` (prefix / subtree). */
export function termCoversNode (term, node) {
  if (!term || !node) return false;
  for (const k of SERIALIZE_ORDER) {
    if (term[k] == null || term[k] === '') continue;
    if (String(node[k] ?? '') !== String(term[k])) return false;
  }
  return termDepth(term) <= termDepth(node);
}

export const FLAT_TAXONOMY_KEYS = [
  'model', 'version', 'ecosystem', 'resourceType', 'resource', 'versionId', 'baseModel'
];

export function asCsvList (value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

export function hasFlatTaxonomy (state) {
  if (!state) return false;
  return FLAT_TAXONOMY_KEYS.some(k => asCsvList(state[k]).length > 0);
}

export function clearedFlatTaxonomy () {
  return {
    model: [],
    version: [],
    ecosystem: [],
    resourceType: [],
    resource: [],
    versionId: [],
    baseModel: []
  };
}

/** Tree-row key. Same shape the Models picker uses for expand state. */
export function scopeNodeKey (term) {
  if (!term) return '';
  if (term.familyOutput || term.familyId) {
    const familyParts = [];
    if (term.familyOutput) familyParts.push(`o:${term.familyOutput}`);
    if (term.familyId) familyParts.push(`f:${term.familyId}`);
    return familyParts.join('/');
  }
  const parts = [`t:${term.type || ''}`];
  if (term.baseModel) parts.push(`b:${term.baseModel}`);
  if (term.ecosystem) parts.push(`e:${term.ecosystem}`);
  if (term.modelId) parts.push(`m:${term.modelId}`);
  else if (term.modelName) parts.push(`mn:${term.modelName}`);
  if (term.versionId) parts.push(`v:${term.versionId}`);
  return parts.join('/');
}

/**
 * Type row and base-model row for a selected model. Does not open versions.
 * A stored ecosystem term still opens that row.
 */
export function ancestorExpandKeys (term) {
  if (term?.familyId && term?.familyOutput) {
    return [scopeNodeKey({ familyOutput: term.familyOutput })];
  }
  if (!term?.type) return [];
  const keys = [scopeNodeKey({ type: term.type })];
  if (term.baseModel) {
    keys.push(scopeNodeKey({ type: term.type, baseModel: term.baseModel }));
  } else if (term.ecosystem) {
    keys.push(scopeNodeKey({ type: term.type, ecosystem: term.ecosystem }));
  }
  return keys;
}

/** A branch stays a branch when the holes are few and the inclusion list would not be. */
export function keepAsException (holes, remainder) {
  return holes >= 1 && holes <= 3 && remainder > 3;
}

function ownedTerm (node) {
  return {
    type: node.type,
    baseModel: node.baseModel,
    modelId: String(node.modelId)
  };
}

/**
 * Unchecking one owned model while Mine is on. A few holes stay on `mine`.
 * A short remainder, or a fourth hole, writes the other owned models and
 * drops mine. Non-owned terms stay. Mine off does not invent terms.
 *
 * @param {{ mine?: boolean, terms?: object[], ownedNodes?: object[], unchecked?: object }} input
 * @returns {{ mine: boolean, terms: object[] }}
 */
export function narrowOwnSelection ({ mine, terms, ownedNodes, unchecked } = {}) {
  const current = Array.isArray(terms) ? terms : [];
  if (!mine) return { mine: false, terms: current };
  const owned = Array.isArray(ownedNodes) ? ownedNodes : [];
  const ownedIds = new Set(owned.map(n => String(n.modelId)));
  const dropId = unchecked?.modelId != null ? String(unchecked.modelId) : '';
  const kept = current.filter(t => !t?.mine && !(t?.modelId && ownedIds.has(String(t.modelId))));
  const prior = current.filter(t => t?.mine);
  const seen = new Set();
  const holes = [];
  for (const hole of prior.length ? (prior[prior.length - 1].except || []) : []) {
    const id = hole?.modelId != null ? String(hole.modelId) : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    holes.push(hole);
  }
  if (dropId && !seen.has(dropId)) {
    seen.add(dropId);
    holes.push(unchecked?.type ? ownedTerm(unchecked) : { modelId: dropId });
  }
  const remaining = owned.filter(n => !seen.has(String(n.modelId)));
  if (keepAsException(holes.length, remaining.length)) {
    return { mine: true, terms: [...kept, { mine: true, except: holes }] };
  }
  const next = kept.slice();
  for (const node of remaining) next.push(ownedTerm(node));
  return { mine: false, terms: next };
}
