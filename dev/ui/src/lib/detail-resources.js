// Lightbox / media-item detail: compose Model vs Additional Resources, and
// build Civitai-shaped Models page hrefs.
//
// Composition matches Civitai's generator (Model = checkpoint; Additional
// Resources = LoRAs etc.), not a duplicated full list. Hrefs follow
// explorer-url-protocol.md § Views (`/models/{modelId}-{slug}?modelVersionId=`).
// Type + modelId + versionId are required; ecosystem is not (it was an
// artefact of the four-segment path). Incomplete identity must not produce an href.
//
// Pure; no Preact. Same testable-from-tests/ precedent as modelSlug.js.

import { pathToken } from './modelSlug.js';
import { formatUrl, parseUrl } from './url-state.js';
import { modelTypeLabel } from './modelTypeDisplay.js';

const UNKNOWN_NAMES = new Set(['', '(unknown)']);

function lineName (r) {
  const n = r?.modelName;
  if (typeof n === 'string' && !UNKNOWN_NAMES.has(n)) return n;
  return '';
}

function versionSubtitle (name, version) {
  if (typeof version !== 'string' || !version) return '';
  if (name && version === name) return '';
  return version;
}

function isPrimaryResource (r, checkpoint) {
  if (!r || !checkpoint) return false;
  if (r === checkpoint) return true;
  const cv = checkpoint.versionId;
  const rv = r.versionId;
  if (cv != null && cv !== '' && rv != null && rv !== '') {
    return String(cv) === String(rv);
  }
  if (r.type === 'Checkpoint' && checkpoint.type === 'Checkpoint') {
    const cn = lineName(checkpoint);
    const rn = lineName(r);
    if (cn && cn === rn && (cv == null || cv === '') && (rv == null || rv === '')) {
      return true;
    }
  }
  return false;
}

export function resourceTypeLabel (type) {
  if (!type) return '';
  return modelTypeLabel(type) || type;
}

/**
 * Models catalog filtered to one model type, or '' when type is missing.
 * The query token is the API value (`LORA`), not the chip label (`LoRA`).
 *
 * @param {string|null|undefined} type
 * @returns {string}
 */
export function modelsTypeHref (type) {
  if (type == null || type === '') return '';
  return formatUrl({
    view: 'models',
    params: { resourceType: String(type) }
  });
}

/**
 * Section-wide Model link. Empty when that anchor would wrap a Mine chip
 * or a type-chip link. A primary with a type chip does not keep the link.
 *
 * @param {Array<{ kind?: string, href?: string, mine?: boolean, typeHref?: string }>|null|undefined} rows
 * @param {string} [soleHref]
 * @returns {string}
 */
export function modelSectionHref (rows, soleHref) {
  if (!soleHref) return '';
  const list = Array.isArray(rows) ? rows : [];
  if (list.some(row => row && row.mine)) return '';
  const linkAt = list.findIndex(row => row && row.href);
  if (linkAt < 0) return soleHref;
  for (let i = 0; i <= linkAt; i++) {
    const row = list[i];
    if (row && row.typeHref) return '';
  }
  return soleHref;
}

/**
 * Civitai-shaped Models page href for a decomposed resource, or '' when
 * type, modelId, or versionId is missing.
 *
 * @param {object|null|undefined} r
 * @returns {string}
 */
export function modelsVersionHref (r) {
  if (!r || typeof r !== 'object') return '';
  const type = r.type;
  const modelId = r.modelId;
  const versionId = r.versionId;
  if (!type) return '';
  if (modelId == null || modelId === '') return '';
  if (versionId == null || versionId === '') return '';
  const name = lineName(r);
  return formatUrl({
    view: 'models',
    entityId: pathToken(modelId, name),
    params: { modelVersionId: String(versionId) }
  });
}

function resourceForVersion (versionId, checkpoint, resources) {
  const list = [];
  if (checkpoint && typeof checkpoint === 'object') list.push(checkpoint);
  if (Array.isArray(resources)) {
    for (const r of resources) {
      if (r && typeof r === 'object') list.push(r);
    }
  }
  return list.find(r => r.versionId != null && r.versionId !== '' && String(r.versionId) === versionId) || null;
}

/**
 * Version-page href for a Models origin. The resource whose versionId
 * matches is the page (a LoRA stays that LoRA's model, not the checkpoint).
 * Non-default sort is copied so the gallery order matches the walk.
 * '' when versionId is missing or the matching resource is an incomplete
 * identity — the tab then stays on the catalog.
 *
 * @param {{ versionId?: string|number, sort?: string, checkpoint?: object|null, resources?: object[] }} [input]
 * @returns {string}
 */
export function modelsOriginReturnHref ({ versionId, sort, checkpoint, resources, familyId } = {}) {
  const withSort = (href) => {
    if (!href) return '';
    if (sort == null || sort === '' || String(sort) === 'date:desc') return href;
    const parsed = parseUrl(href);
    return formatUrl({
      view: parsed.view,
      entityId: parsed.entityId,
      modelTrail: parsed.modelTrail,
      params: { ...parsed.params, sort: String(sort) }
    });
  };
  if (versionId != null && versionId !== '') {
    return withSort(modelsVersionHref(resourceForVersion(String(versionId), checkpoint, resources)));
  }
  if (familyId == null || familyId === '') return '';
  return withSort(formatUrl({ view: 'models', params: { familyId: String(familyId) } }));
}

/**
 * Model-block row for an unnamed generator family. No type chip and no
 * version. Empty when the family has no id or label.
 *
 * @param {{ id?: string, label?: string }|null|undefined} family
 * @returns {{ name: string, version: string, href: string, versionId: string }|null}
 */
export function generatorFamilyModelBlock (family) {
  if (!family || !family.id || !family.label) return null;
  return {
    name: family.label,
    version: '',
    href: formatUrl({ view: 'models', params: { familyId: String(family.id) } }),
    versionId: ''
  };
}

function additionalRow (r) {
  const name = lineName(r);
  const version = versionSubtitle(name, r.versionName || '');
  const fallback = r.versionId != null ? `Version ${r.versionId}` : '';
  const displayName = name || fallback;
  if (!displayName && !version && !r.type) return null;
  const strength = (typeof r.strength === 'number' && r.strength !== 1)
    ? r.strength
    : null;
  return {
    name: displayName,
    version,
    type: r.type || '',
    typeLabel: resourceTypeLabel(r.type),
    typeHref: modelsTypeHref(r.type),
    strength,
    href: modelsVersionHref(r),
    versionId: r.versionId != null && r.versionId !== '' ? String(r.versionId) : '',
    mine: r.mine === true
  };
}

/**
 * Split a hydrated media-item / generation identity into the Model block
 * (primary checkpoint) and Additional Resources (everything else).
 *
 * @param {{ checkpoint?: object|null, resources?: object[], model?: string }} [input]
 * @returns {{ model: { name: string, version: string, href: string }|null, additional: object[] }}
 */
export function composeDetailResources ({ checkpoint, resources, model } = {}) {
  const list = Array.isArray(resources)
    ? resources.filter(r => r && typeof r === 'object')
    : [];
  const primary = checkpoint && typeof checkpoint === 'object' ? checkpoint : null;

  let modelOut = null;
  if (primary) {
    const name = lineName(primary);
    const version = versionSubtitle(name, primary.versionName || '');
    if (name || version) {
      modelOut = {
        name: name || version,
        version: name ? version : '',
        href: modelsVersionHref(primary),
        versionId: primary.versionId != null && primary.versionId !== ''
          ? String(primary.versionId)
          : '',
        mine: primary.mine === true,
        type: primary.type || '',
        typeLabel: resourceTypeLabel(primary.type),
        typeHref: modelsTypeHref(primary.type)
      };
    }
  } else if (typeof model === 'string' && model && !UNKNOWN_NAMES.has(model)) {
    modelOut = { name: model, version: '', href: '', versionId: '' };
  }

  const additional = [];
  for (const r of list) {
    if (isPrimaryResource(r, primary)) continue;
    const row = additionalRow(r);
    if (row) additional.push(row);
  }

  return { model: modelOut, additional };
}

function containerResourceKey (row) {
  if (row?.versionId != null && row.versionId !== '') return `v:${String(row.versionId)}`;
  const name = typeof row?.name === 'string' ? row.name.trim() : '';
  if (name) return `n:${name}`;
  return '';
}

/**
 * First-seen Model rows across container members, in member order.
 * Within a member the order is the media page's: checkpoint, then other
 * slots. Same versionId is one row (no versionId: same line name). The
 * first row keeps its kind. Strength is omitted: a post or comic
 * can use the same LoRA at more than one strength.
 *
 * @param {Array<{ checkpoint?: object|null, resources?: object[], model?: string }>|null|undefined} members
 * @returns {Array<{ kind: 'model'|'additional', name: string, version: string, href: string, versionId: string }>}
 */
export function unionContainerResources (members) {
  const seen = new Set();
  const rows = [];
  const list = Array.isArray(members) ? members : [];
  for (const member of list) {
    const { model, additional } = composeDetailResources({
      checkpoint: member?.checkpoint,
      resources: member?.resources,
      model: member?.model
    });
    const itemRows = [];
    if (model) itemRows.push({ kind: 'model', strength: null, ...model });
    for (const resource of additional) {
      itemRows.push({ kind: 'additional', ...resource, strength: null });
    }
    for (const row of itemRows) {
      const key = containerResourceKey(row);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      rows.push({ ...row, key: key || `anon:${rows.length}` });
    }
  }
  return rows;
}
