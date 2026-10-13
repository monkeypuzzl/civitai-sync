// Lookup module for generator model families (Eco groups + official variants).
//
// Reads the vendored structural identity table under `src/vendor/` and
// assigns a corpus resource slot to a family / variant set. This module
// is the single approved consumer of `src/vendor/civitai-model-families.mjs`
// — see `src/vendor/README.md` and
// `docs/guides/civitai-sync/internal/vendored-snapshots.md`. The lint test
// in `tests/vendor-isolation.test.mjs` enforces it.
//
// Usage:
//   import { assignModelFamily, getModelFamily, sectionLabel } from './modelFamily.mjs';
//   assignModelFamily({ baseModel: 'Pony', airEcosystem: 'sdxl' })
//   getModelFamily('WanVideo')
//   sectionLabel('model3d')  // → '3D'

import { CIVITAI_MODEL_FAMILIES } from './vendor/civitai-model-families.mjs';

const SECTION_LABELS = Object.freeze({
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  model3d: '3D'
});

const familyById = new Map();
/** @type {Map<string, { familyId: string, variantIds: string[] }>} */
const ecoKeyToFamily = new Map();
/** lowercase member / ecosystem key → canonical key */
const ecoKeyLowerToKey = new Map();
/** official model version id → variant ids */
const versionIdToVariantIds = new Map();
const baseModelToEco = new Map();

for (const [name, ecoKey] of Object.entries(CIVITAI_MODEL_FAMILIES.baseModelToEcosystem || {})) {
  baseModelToEco.set(name, ecoKey);
}

for (const fam of CIVITAI_MODEL_FAMILIES.families || []) {
  familyById.set(fam.id, fam);
  const allVariantIds = (fam.variants || []).map(v => v.id);

  for (const member of fam.members || []) {
    ecoKeyToFamily.set(member, { familyId: fam.id, variantIds: [...allVariantIds] });
    ecoKeyLowerToKey.set(String(member).toLowerCase(), member);
  }

  for (const v of fam.variants || []) {
    for (const vid of v.versionIds || []) {
      const n = Number(vid);
      if (!Number.isFinite(n)) continue;
      const list = versionIdToVariantIds.get(n) || [];
      if (!list.includes(v.id)) list.push(v.id);
      versionIdToVariantIds.set(n, list);
    }
  }
}

function resolveEcosystemKey ({ baseModel, airEcosystem }) {
  if (baseModel && baseModelToEco.has(baseModel)) {
    return baseModelToEco.get(baseModel);
  }
  if (baseModel && ecoKeyToFamily.has(baseModel)) {
    return baseModel;
  }
  if (baseModel) {
    const lower = String(baseModel).toLowerCase();
    if (ecoKeyLowerToKey.has(lower)) return ecoKeyLowerToKey.get(lower);
  }
  if (airEcosystem) {
    const lower = String(airEcosystem).toLowerCase();
    if (ecoKeyLowerToKey.has(lower)) return ecoKeyLowerToKey.get(lower);
  }
  return null;
}

/**
 * Assign a resource slot to a model family.
 *
 * Lookup order:
 *   1. baseModel → baseModelToEcosystem → family
 *   2. baseModel equals an ecosystem key (any casing the snapshot stores)
 *   3. airEcosystem equals a member key (case-insensitive)
 *   4. versionId hit on an official version id (same family, unioned)
 *   A member key that is not on any variant stays in the family with no
 *   variant ids — it must not inherit every variant in the family.
 *   5. null
 *
 * @param {{ baseModel?: string|null, airEcosystem?: string|null, versionId?: string|number|null }} slot
 * @returns {{ familyId: string, variantIds: string[] }|null}
 */
export function assignModelFamily (slot = {}) {
  if (!slot || typeof slot !== 'object') return null;
  const { baseModel, airEcosystem, versionId } = slot;

  let familyId = null;
  const variantIds = new Set();

  const ecoKey = resolveEcosystemKey({ baseModel, airEcosystem });
  if (ecoKey) {
    const hit = ecoKeyToFamily.get(ecoKey);
    if (hit) {
      familyId = hit.familyId;
      const fam = familyById.get(hit.familyId);
      for (const v of fam?.variants || []) {
        if ((v.ecosystemKeys || []).includes(ecoKey)) variantIds.add(v.id);
      }
    }
  }

  if (versionId != null && versionId !== '') {
    const n = Number(versionId);
    const fromVersion = Number.isFinite(n) ? versionIdToVariantIds.get(n) : null;
    if (fromVersion?.length) {
      const versionFamily = String(fromVersion[0]).split(':')[0];
      if (!familyId) familyId = versionFamily;
      if (familyId === versionFamily) {
        for (const id of fromVersion) variantIds.add(id);
      }
    }
  }

  if (!familyId) return null;
  return { familyId, variantIds: [...variantIds] };
}

/**
 * @param {string|null|undefined} id
 * @returns {{ id: string, label: string, outputType: string, members: string[], variants: object[] }|null}
 */
export function getModelFamily (id) {
  if (!id || typeof id !== 'string') return null;
  return familyById.get(id) || null;
}

/**
 * Closed section labels for the Models catalog Family picker.
 * Unknown output types return the type string (no title-case).
 *
 * @param {string|null|undefined} outputType
 * @returns {string}
 */
const UNKNOWN_NAMES = new Set(['', '(unknown)']);

function slotHasCatalogIdentity (r) {
  if (!r || typeof r !== 'object') return false;
  if (r.modelId != null && r.modelId !== '') return true;
  if (typeof r.modelName === 'string' && r.modelName.trim() && !UNKNOWN_NAMES.has(r.modelName.trim())) {
    return true;
  }
  if (r.versionId != null && r.versionId !== '') return true;
  return false;
}

/**
 * Family for a 3D item that has no catalog model id, model name, or version
 * id. The ecosystem key is matched as an AIR ecosystem (not as a base-model
 * token). Image, video, and audio never resolve here. A version parameter
 * such as polygenVersion is not a version id.
 *
 * @param {{ type?: string, ecosystem?: string, resources?: object[], checkpoint?: object|null }} [slot]
 * @returns {{ familyId: string, label: string }|null}
 */
export function fallbackGeneratorFamily ({ type, ecosystem, resources, checkpoint } = {}) {
  if (type !== 'model3d') return null;
  const slots = [];
  if (checkpoint && typeof checkpoint === 'object') slots.push(checkpoint);
  if (Array.isArray(resources)) {
    for (const r of resources) {
      if (r && typeof r === 'object') slots.push(r);
    }
  }
  if (slots.some(slotHasCatalogIdentity)) return null;
  if (typeof ecosystem !== 'string') return null;
  const key = ecosystem.trim();
  if (!key || key.toLowerCase() === 'undefined') return null;
  const assignment = assignModelFamily({ airEcosystem: key });
  if (!assignment?.familyId) return null;
  const fam = getModelFamily(assignment.familyId);
  if (!fam?.label || fam.outputType !== 'model3d') return null;
  return { familyId: fam.id, label: fam.label };
}

/**
 * Fallback family for a media item or a generation whose every member is
 * model3d. Null when the item is not that shape.
 *
 * @param {object|null|undefined} item
 * @returns {{ familyId: string, label: string }|null}
 */
export function generatorFamilyForItem (item) {
  if (!item || typeof item !== 'object') return null;
  let type = item.type;
  if (type !== 'model3d' && Array.isArray(item.media) && item.media.length > 0
      && item.media.every(m => m && m.type === 'model3d')) {
    type = 'model3d';
  }
  return fallbackGeneratorFamily({
    type,
    ecosystem: item.params?.ecosystem,
    resources: item.resources,
    checkpoint: item.checkpoint
  });
}

export function sectionLabel (outputType) {
  if (!outputType || typeof outputType !== 'string') return '';
  return SECTION_LABELS[outputType] || outputType;
}
