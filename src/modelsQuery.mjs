// One gallery grammar for a model filter. A term names one resource slot.
// Terms are comma-separated. Segments are key.value, joined by `/`.
// The key is the token before the first dot. A dot inside a value stays.
// An `except` segment holes that term. Its value is an encoded term
// (`encodeURIComponent` of `serializeTerm`), so a slash inside the hole
// stays `%2F` and does not split the parent.
//
// Bookmarks climb this module's string lift with no index. Saved exports
// use exportLiftQuery, which may resolve display names to ids.

const KEY_TO_FIELD = Object.freeze({
  resourceType: 'type',
  ecosystem: 'ecosystem',
  base: 'baseModel',
  model: 'modelId',
  version: 'versionId',
  name: 'modelName',
  output: 'familyOutput',
  family: 'familyId',
  variant: 'variant'
});

const FIELD_TO_KEY = Object.freeze({
  type: 'resourceType',
  ecosystem: 'ecosystem',
  baseModel: 'base',
  modelId: 'model',
  versionId: 'version',
  modelName: 'name',
  familyOutput: 'output',
  familyId: 'family',
  variant: 'variant'
});

const FIELD_ORDER = Object.freeze([
  'type', 'ecosystem', 'baseModel', 'modelId', 'versionId', 'modelName',
  'familyOutput', 'familyId', 'variant'
]);

const MEDIA_TYPE_TOKENS = new Set(['image', 'video', 'audio', 'model3d']);

const LEGACY_PREFIX = Object.freeze({
  t: 'type',
  b: 'baseModel',
  e: 'ecosystem',
  m: 'modelId',
  v: 'versionId',
  mn: 'modelName',
  o: 'familyOutput',
  f: 'familyId'
});

const RETIRED_KEYS = Object.freeze([
  'scope', 'model', 'version', 'ecosystem', 'resourceType', 'resource', 'versionId', 'familyId'
]);

function csv (value) {
  if (Array.isArray(value)) return value.map(part => String(part).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value).split(',').map(part => part.trim()).filter(Boolean);
}

function decodeValue (raw) {
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function segmentOf (raw, prefixMap) {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot < 1) return null;
  const field = prefixMap[raw.slice(0, dot)];
  if (!field) return null;
  const value = decodeValue(raw.slice(dot + 1));
  if (!value) return null;
  return { field, value };
}

function termsFrom (param, separator, prefixMap, { bareMine = false } = {}) {
  if (param == null || param === '') return [];
  const terms = [];
  for (const rawTerm of String(param).split(separator)) {
    if (!rawTerm) continue;
    if (bareMine && rawTerm === 'mine') {
      terms.push({ mine: true });
      continue;
    }
    const term = {};
    for (const rawSeg of rawTerm.split('/')) {
      const seg = segmentOf(rawSeg, prefixMap);
      if (!seg) continue;
      term[seg.field] = seg.value;
    }
    if (Object.keys(term).length) terms.push(term);
  }
  return terms;
}

function exceptTerm (value) {
  const hole = {};
  for (const rawSeg of String(value).split('/')) {
    const seg = segmentOf(rawSeg, KEY_TO_FIELD);
    if (!seg) continue;
    hole[seg.field] = seg.value;
  }
  return Object.keys(hole).length ? hole : null;
}

function readExcept (rawSeg) {
  const dot = rawSeg.indexOf('.');
  if (dot < 1 || rawSeg.slice(0, dot) !== 'except') return undefined;
  const value = decodeValue(rawSeg.slice(dot + 1));
  if (!value) return null;
  return exceptTerm(value);
}

function assignPositive (term, rawSeg) {
  const seg = segmentOf(rawSeg, KEY_TO_FIELD);
  if (!seg) return;
  term[seg.field] = seg.value;
}

/** Parse a `models=` value. Empty or absent is []. `mine` is its own term. */
export function parseModels (param) {
  if (param == null || param === '') return [];
  const terms = [];
  for (const rawTerm of String(param).split(',')) {
    if (!rawTerm) continue;
    const segments = rawTerm.split('/');
    if (segments[0] === 'mine') {
      const term = { mine: true };
      const except = [];
      for (const rawSeg of segments.slice(1)) {
        const hole = readExcept(rawSeg);
        if (hole) except.push(hole);
      }
      if (except.length) term.except = except;
      terms.push(term);
      continue;
    }
    const term = {};
    const except = [];
    for (const rawSeg of segments) {
      const hole = readExcept(rawSeg);
      if (hole) {
        except.push(hole);
        continue;
      }
      if (hole === null) continue;
      assignPositive(term, rawSeg);
    }
    if (except.length) term.except = except;
    if (Object.keys(term).filter(key => key !== 'except').length) terms.push(term);
  }
  return terms;
}

/** Parse a legacy `scope=` forest (`~`, one-letter prefixes). */
export function parseLegacyScope (param) {
  return termsFrom(param, '~', LEGACY_PREFIX);
}

function exceptSegments (term) {
  const holes = Array.isArray(term?.except) ? term.except : [];
  const segs = [];
  for (const hole of holes) {
    const inner = serializeTerm(hole);
    if (!inner) continue;
    segs.push(`except.${encodeURIComponent(inner)}`);
  }
  return segs;
}

function serializeTerm (term) {
  if (!term || typeof term !== 'object') return '';
  if (term.mine) return '';
  const segs = [];
  for (const field of FIELD_ORDER) {
    const value = term[field];
    if (value == null || value === '') continue;
    if (field === 'modelName' && term.modelId) continue;
    if (field === 'familyOutput' && term.familyId) continue;
    if (field === 'variant' && !term.familyId) continue;
    const key = FIELD_TO_KEY[field];
    if (!key) continue;
    segs.push(`${key}.${encodeURIComponent(String(value))}`);
  }
  if (!segs.length) return '';
  segs.push(...exceptSegments(term));
  return segs.join('/');
}

function mineSerial (term) {
  const holes = exceptSegments(term);
  return holes.length ? `mine/${holes.join('/')}` : 'mine';
}

/** Serialize term objects to a `models=` value. Selection order is kept. `mine` is written once, last. */
export function serializeModels (terms) {
  if (!Array.isArray(terms) || !terms.length) return '';
  const parts = [];
  let mineTerm = null;
  for (const term of terms) {
    if (term?.mine) {
      mineTerm = term;
      continue;
    }
    const serial = serializeTerm(term);
    if (serial) parts.push(serial);
  }
  if (mineTerm) parts.push(mineSerial(mineTerm));
  return parts.join(',');
}

function unpublishedTypeSegment (param) {
  if (param == null || param === '') return false;
  for (const rawTerm of String(param).split(',')) {
    for (const rawSeg of rawTerm.split('/')) {
      if (rawSeg.startsWith('type.')) return true;
    }
  }
  return false;
}

function mineKeyOn (value) {
  return value === '1' || value === 'true' || value === true || value === 1;
}

function cmpId (a, b) {
  const na = Number(a);
  const nb = Number(b);
  const aNum = Number.isFinite(na) && String(na) === String(a);
  const bNum = Number.isFinite(nb) && String(nb) === String(b);
  if (aNum && bNum && na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

function withoutRetired (query) {
  const out = { ...(query || {}) };
  for (const key of RETIRED_KEYS) delete out[key];
  return out;
}

/**
 * Bookmark lift. No index. `version` display names are dropped.
 * `model` and `resource` become `name` terms. Gallery `type` tokens
 * that name a media type become `mediaType`. Gallery `mine=1` becomes
 * a `mine` term. A `type.` segment is left as written. A catalog
 * address (`view === 'models'`) is returned unchanged.
 *
 * @param {object} [query]
 * @param {{ view?: string }} [opts]
 */
export function stringLiftQuery (query, { view } = {}) {
  const src = query || {};
  if (view === 'models') return { ...src };
  const existingRaw = src.models == null ? '' : String(src.models);
  const preserveModels = unpublishedTypeSegment(existingRaw);
  const terms = preserveModels ? [] : parseModels(existingRaw);
  terms.push(...parseLegacyScope(src.scope));
  for (const id of csv(src.versionId)) terms.push({ versionId: id });
  for (const token of csv(src.resourceType)) terms.push({ type: token });
  for (const token of csv(src.ecosystem)) terms.push({ ecosystem: token });
  for (const token of csv(src.model)) terms.push({ modelName: token });
  for (const token of csv(src.resource)) terms.push({ modelName: token });
  const family = src.familyId;
  if (family != null && String(family) !== '') terms.push({ familyId: String(family) });
  if (mineKeyOn(src.mine)) terms.push({ mine: true });
  const out = withoutRetired(src);
  const typeTokens = csv(src.type);
  const media = typeTokens.filter(token => MEDIA_TYPE_TOKENS.has(token));
  const leftover = typeTokens.filter(token => !MEDIA_TYPE_TOKENS.has(token));
  if (media.length) {
    const have = csv(out.mediaType);
    const merged = [...have];
    for (const token of media) {
      if (!merged.includes(token)) merged.push(token);
    }
    out.mediaType = merged.join(',');
  }
  if (leftover.length) out.type = leftover.join(',');
  else delete out.type;
  delete out.mine;
  const serial = serializeModels(terms);
  if (preserveModels) out.models = serial ? `${existingRaw},${serial}` : existingRaw;
  else if (serial) out.models = serial;
  else delete out.models;
  return out;
}

/**
 * Export lift. String lift, then display names become ids when `lookup`
 * knows them. A version name with no id is dropped. A model name with no
 * id stays a `name` term.
 *
 * @param {object} [query]
 * @param {{ modelIdsForName?: (name: string) => string[], versionIdsForName?: (name: string) => string[] }|null} [lookup]
 */
export function exportLiftQuery (query, lookup) {
  const src = { ...(query || {}) };
  const modelTokens = [...csv(src.model), ...csv(src.resource)];
  const versionTokens = csv(src.version);
  delete src.model;
  delete src.resource;
  delete src.version;
  if (!lookup) return stringLiftQuery(query);
  const lifted = stringLiftQuery(src);
  const preserveModels = unpublishedTypeSegment(src.models);
  const terms = preserveModels ? [] : parseModels(lifted.models);
  const seenModels = new Set();
  for (const token of modelTokens) {
    const ids = typeof lookup.modelIdsForName === 'function' ? lookup.modelIdsForName(token) : [];
    const list = Array.isArray(ids) ? ids.map(id => String(id)).filter(Boolean) : [];
    if (!list.length) {
      terms.push({ modelName: token });
      continue;
    }
    for (const id of list.sort(cmpId)) {
      if (seenModels.has(id)) continue;
      seenModels.add(id);
      terms.push({ modelId: id });
    }
  }
  const seenVersions = new Set();
  for (const token of versionTokens) {
    const ids = typeof lookup.versionIdsForName === 'function' ? lookup.versionIdsForName(token) : [];
    const list = Array.isArray(ids) ? ids.map(id => String(id)).filter(Boolean).sort(cmpId) : [];
    for (const id of list) {
      if (seenVersions.has(id)) continue;
      seenVersions.add(id);
      terms.push({ versionId: id });
    }
  }
  const serial = serializeModels(terms);
  if (preserveModels) {
    const base = lifted.models == null ? '' : String(lifted.models);
    if (serial) lifted.models = base ? `${base},${serial}` : serial;
    else if (base) lifted.models = base;
    else delete lifted.models;
  } else if (serial) lifted.models = serial;
  else delete lifted.models;
  return lifted;
}

export function retiredModelKeys () {
  return RETIRED_KEYS;
}
