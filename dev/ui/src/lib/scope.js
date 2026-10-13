// Client copy of the `scope=` grammar in src/explorerQuery.mjs.
// Keep parse / serialize in lockstep with the server: prefixes t/b/e/m/v/mn/o/f,
// `~` between terms, `/` between segments, values encodeURIComponent-ed.

const PREFIX = {
  t: 'type',
  b: 'baseModel',
  e: 'ecosystem',
  m: 'modelId',
  v: 'versionId',
  mn: 'modelName',
  o: 'familyOutput',
  f: 'familyId'
};

const SERIALIZE_ORDER = ['type', 'baseModel', 'ecosystem', 'modelId', 'modelName', 'versionId', 'familyOutput', 'familyId'];
const SERIALIZE_PREFIX = {
  type: 't',
  baseModel: 'b',
  ecosystem: 'e',
  modelId: 'm',
  modelName: 'mn',
  versionId: 'v',
  familyOutput: 'o',
  familyId: 'f'
};

function parseSegment (raw) {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot < 1) return null;
  const field = PREFIX[raw.slice(0, dot)];
  if (!field) return null;
  let value = raw.slice(dot + 1);
  try { value = decodeURIComponent(value); } catch { /* keep raw */ }
  if (!value) return null;
  return { field, value };
}

export function parseScope (param) {
  if (!param) return [];
  const terms = [];
  for (const rawTerm of String(param).split('~')) {
    if (!rawTerm) continue;
    const term = {};
    for (const rawSeg of rawTerm.split('/')) {
      const seg = parseSegment(rawSeg);
      if (!seg) continue;
      term[seg.field] = seg.value;
    }
    if (Object.keys(term).length) terms.push(term);
  }
  return terms;
}

function serializeTerm (term) {
  if (!term || typeof term !== 'object') return '';
  const segs = [];
  for (const field of SERIALIZE_ORDER) {
    const value = term[field];
    if (value == null || value === '') continue;
    if (field === 'modelName' && term.modelId) continue;
    segs.push(`${SERIALIZE_PREFIX[field]}.${encodeURIComponent(String(value))}`);
  }
  return segs.join('/');
}

export function serializeScopeTerms (terms) {
  if (!Array.isArray(terms) || !terms.length) return '';
  return terms.map(serializeTerm).filter(Boolean).join('~');
}

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

/**
 * Unchecking one owned model while Mine is on drops the live predicate and
 * writes a model-level term for each other owned node, keeping non-owned terms.
 * Mine off does not invent terms.
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
  const kept = current.filter(t => !(t?.modelId && ownedIds.has(String(t.modelId))));
  const next = kept.slice();
  for (const node of owned) {
    if (String(node.modelId) === dropId) continue;
    next.push({
      type: node.type,
      baseModel: node.baseModel,
      modelId: String(node.modelId)
    });
  }
  return { mine: false, terms: next };
}
