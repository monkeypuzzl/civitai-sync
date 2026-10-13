// Single seam for model-axis identity on a generation or post media item.
//
// Resolution precedence (R1 — every Models-tree / groupBy=model / facet
// extractor must go through this chain):
//
//   1. Generation `resources[]` — existing decomposeResource path, including
//      `params.fluxMode` as airOverride for older-shape Flux.
//   2. Post `meta.civitaiResources[]` — first `type: checkpoint` entry, else
//      the first entry. Post image meta (`image.getGenerationData` / Image.meta)
//      uses lowercase `type` and `modelVersionId` (see civitaiResourceSchema).
//   3. Orchestrator video params — when resources are empty and
//      `params.engine` plus `workflow` or `type` are present: infer
//      modelVersionId from the vendored orchestrator map.
//   4. Freeform `meta.Model` string (external/off-site tooling per
//      image-onsite.ts) → synthetic checkpoint with modelName only.
//   5. Display label at READ time via resolveModelGroupKey /
//      hydrateResource / hydrateItemForDisplay — if versionId is set and
//      modelName is empty/'(unknown)', resolve through the model-version
//      cache. A resolvable versionId must not land in the No model bucket.
//      Cache-offline stub is `Version ${versionId}` (stable on the id until
//      refresh fills the line name). The lightbox detail payload uses the
//      same seam so `(unknown)` never ships as a user-facing line name;
//      versionName stays a separate field (never promoted into modelName).
//
// Sibling of `src/resourceDecomposition.mjs`. Callers: buildGenerationEntry
// and buildMediaItems (index build); explorerQuery groupKeysFor / itemModels
// / matchesScope (read time); handleMediaDetail / handleGenerationDetail
// (display hydration).

import { decomposeResource, canonicalResourceType, MODEL_TYPES } from './resourceDecomposition.mjs';
import { inferOrchestratorModel } from './orchestratorModelMap.mjs';
import { generatorFamilyForItem } from './modelFamily.mjs';
import { isEcosystemKeyAlias } from './ecosystemDisplay.mjs';
import { parseAir } from './airUrn.mjs';

const UNKNOWN_NAMES = new Set(['', '(unknown)']);
const MODEL_TYPE_SET = new Set(MODEL_TYPES);

function pickPrimary (resources) {
  return resources.find(r => r.type === 'Checkpoint') || resources[0] || null;
}

function versionKey (r) {
  if (r?.versionId != null && r.versionId !== '') return String(r.versionId);
  return null;
}

/**
 * Union decomposed resource slots. Primary wins on versionId; extras
 * without a versionId append when modelName is not already present.
 * Media-item projection only — generation entries stay job-shaped.
 *
 * @param {object[]} [primary]
 * @param {object[]} [extra]
 * @returns {{ resources: object[], checkpoint: object|null }}
 */
export function unionDecomposedSlots (primary = [], extra = []) {
  const resources = [];
  const seenVersion = new Set();
  const seenName = new Set();

  const remember = (r) => {
    const vk = versionKey(r);
    if (vk) seenVersion.add(vk);
    if (r.modelName && !UNKNOWN_NAMES.has(r.modelName)) seenName.add(r.modelName);
  };

  for (const r of primary) {
    if (!r || typeof r !== 'object') continue;
    resources.push(r);
    remember(r);
  }
  for (const r of extra) {
    if (!r || typeof r !== 'object') continue;
    const vk = versionKey(r);
    if (vk) {
      if (seenVersion.has(vk)) continue;
      seenVersion.add(vk);
      resources.push(r);
      remember(r);
      continue;
    }
    const name = r.modelName && !UNKNOWN_NAMES.has(r.modelName) ? r.modelName : null;
    if (name && seenName.has(name)) continue;
    resources.push(r);
    remember(r);
  }
  return { resources, checkpoint: pickPrimary(resources) };
}

/**
 * Hydrated checkpoint ∪ resources[], de-duped by versionId. Read-time
 * extractors (type / ecosystem / version / scope) go through this so a
 * stored dump or omitted type cannot bypass canonicalResourceType / cache.
 *
 * @param {object|null|undefined} item
 * @param {(id: number|string) => object|null} [getModelVersion]
 * @returns {object[]}
 */
export function hydratedResourceSlots (item, getModelVersion = () => null) {
  const out = [];
  const seen = new Set();
  const consider = (raw) => {
    if (!raw || typeof raw !== 'object') return;
    const r = hydrateResource(raw, getModelVersion);
    const k = versionKey(r) || `anon:${out.length}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(r);
  };
  consider(item?.checkpoint);
  for (const r of item?.resources || []) consider(r);
  return out;
}

/**
 * Map a post `meta.civitaiResources[]` entry onto a generation-shaped
 * resource record, then decompose. `type` is lowercase on the wire
 * (`checkpoint`); `weight` is LoRA strength; `modelVersionName` is the
 * version label when present.
 *
 * @param {object|null|undefined} r
 * @returns {import('./resourceDecomposition.mjs').DecomposedResource|null}
 */
export function decomposeCivitaiMetaResource (r) {
  if (!r || typeof r !== 'object') return null;
  if (r.modelVersionId == null && r.modelType == null && r.type == null && r.id == null) {
    return null;
  }
  return decomposeResource({
    type: r.type,
    modelType: r.modelType,
    model: r.model,
    modelVersionId: r.modelVersionId,
    id: r.id,
    modelId: r.modelId,
    modelName: r.modelName,
    name: r.name,
    modelVersionName: r.modelVersionName,
    baseModel: r.baseModel,
    air: r.air,
    strength: r.strength ?? r.weight
  });
}

function syntheticCheckpoint ({ modelName, versionId, baseModel, ecosystem }) {
  return {
    type: 'Checkpoint',
    modelId: null,
    modelName: modelName || '(unknown)',
    versionId: versionId ?? null,
    versionName: null,
    baseModel: baseModel ?? null,
    air: ecosystem
      ? {
          ecosystem,
          type: 'checkpoint',
          source: 'civitai',
          modelId: null,
          versionId: versionId ?? null,
          fileId: null,
          format: null,
          raw: null
        }
      : null,
    strength: null
  };
}

/**
 * Infer a decomposed checkpoint from orchestrator video params (R1.3).
 * Returns null when the engine/workflow/type tuple is missing or unmapped.
 *
 * @param {object|null|undefined} params
 * @returns {import('./resourceDecomposition.mjs').DecomposedResource|null}
 */
export function inferCheckpointFromVideoParams (params) {
  const looked = inferOrchestratorModel(params);
  if (!looked) return null;
  return syntheticCheckpoint({
    versionId: looked.modelVersionId,
    baseModel: looked.baseModel,
    ecosystem: looked.ecosystem
  });
}

/**
 * Ordered R1 chain. Returns `{ checkpoint, resources }`. `resources` is the
 * full decomposed list used by the Models catalog (every slot); `checkpoint`
 * is the primary (first Checkpoint, else first entry).
 *
 * @param {object} [input]
 * @param {object[]} [input.resources]  Generation resources[] (raw).
 * @param {object|null} [input.meta]    Post image meta (civitaiResources, Model).
 * @param {object} [input.params]       Generation params (engine/workflow/type, fluxMode).
 * @param {boolean} [input.skipVideoInference]  Skip R1.3 when the job is 3D.
 *   Also skipped when `params.workflow` is `txt2model3d` / `img2model3d` or
 *   `params.output` is `model3d`. Engine alone does not skip.
 * @returns {{ checkpoint: object|null, resources: object[] }}
 */
function paramsAreModel3dJob (params) {
  const workflow = params && params.workflow;
  if (workflow === 'txt2model3d' || workflow === 'img2model3d') return true;
  return params?.output === 'model3d';
}

export function resolveCheckpoint ({ resources = [], meta = null, params = {}, skipVideoInference = false } = {}) {
  const fluxModeAir = typeof params?.fluxMode === 'string' ? params.fluxMode : null;

  const fromGen = (Array.isArray(resources) ? resources : [])
    .map(r => decomposeResource(r, { airOverride: fluxModeAir }))
    .filter(Boolean);
  if (fromGen.length) {
    return { resources: fromGen, checkpoint: pickPrimary(fromGen) };
  }

  const cr = meta?.civitaiResources;
  if (Array.isArray(cr) && cr.length) {
    const fromMeta = cr.map(decomposeCivitaiMetaResource).filter(Boolean);
    if (fromMeta.length) {
      return { resources: fromMeta, checkpoint: pickPrimary(fromMeta) };
    }
  }

  if (!skipVideoInference && !paramsAreModel3dJob(params)) {
    const inferred = inferCheckpointFromVideoParams(params);
    if (inferred) {
      return { resources: [inferred], checkpoint: inferred };
    }
  }

  const modelStr = typeof meta?.Model === 'string' ? meta.Model.trim() : '';
  if (modelStr) {
    const synthetic = syntheticCheckpoint({ modelName: modelStr });
    return { resources: [synthetic], checkpoint: synthetic };
  }

  return { resources: [], checkpoint: null };
}

/**
 * Read-time line name for one decomposed resource. Same stub rules as
 * treeNodeLabel: cache model name → recorded modelName → `Model ${id}` →
 * `Version ${versionId}` → empty. A resolvable versionId never returns
 * empty, so it cannot land in No model.
 *
 * @param {object|null|undefined} resource
 * @param {(id: number|string) => object|null} [getModelVersion]
 * @returns {string}
 */
export function resolveResourceLineName (resource, getModelVersion = () => null) {
  if (!resource) return '';
  const cached = resource.versionId != null && typeof getModelVersion === 'function'
    ? getModelVersion(resource.versionId)
    : null;
  const cacheName = cached?.data?.model?.name;
  if (cacheName) return cacheName;
  if (resource.modelName && !UNKNOWN_NAMES.has(resource.modelName)) return resource.modelName;
  if (resource.modelId != null) return `Model ${resource.modelId}`;
  if (resource.versionId != null) return `Version ${resource.versionId}`;
  return '';
}

/**
 * Read-time grouping / facet key for the model-line axis. Delegates to
 * resolveResourceLineName on the primary checkpoint. A resolvable
 * versionId never returns empty (No model). Cache-offline stub is
 * `Version ${versionId}`.
 *
 * @param {object} item  Generation entry or media item with `checkpoint`.
 * @param {(id: number|string) => object|null} [getModelVersion]
 * @returns {string}
 */
export function resolveModelGroupKey (item, getModelVersion = () => null) {
  const fallback = generatorFamilyForItem(item);
  if (fallback) return `family:${fallback.familyId}`;
  return resolveResourceLineName(item?.checkpoint, getModelVersion);
}

export function displayNameFromCache (versionId, getModelVersion) {
  if (versionId == null || typeof getModelVersion !== 'function') return null;
  const cached = getModelVersion(versionId);
  return cached?.data?.model?.name || null;
}

/**
 * Fill modelId / modelName / versionName / air / type / baseModel from the
 * model-version cache when the stored resource only has a versionId (post
 * `civitaiResources`, video-inferred checkpoints). A recorded `baseModel`
 * that is an alias of the AIR ecosystem key yields to the cache Prisma
 * token. Always canonicalizes `type` onto the closed ModelType alphabet
 * (dump / embed / omitted → LORA / TextualInversion / cache-or-Other).
 * Does not replace `modelName` with a stub — grouping/tree callers keep
 * the recorded `'(unknown)'` and resolve the label via
 * resolveResourceLineName.
 *
 * @param {object|null|undefined} r
 * @param {(id: number|string) => object|null} [getModelVersion]
 * @returns {object|null|undefined}
 */
export function hydrateResource (r, getModelVersion = () => null) {
  if (!r || typeof r !== 'object') return r;
  const cached = r.versionId != null && typeof getModelVersion === 'function'
    ? getModelVersion(r.versionId)
    : null;
  const data = cached?.data;
  let type = canonicalResourceType(r.type);
  if ((!type || type === 'Other' || !MODEL_TYPE_SET.has(type)) && data?.model?.type) {
    const fromCache = canonicalResourceType(data.model.type);
    if (fromCache && fromCache !== 'Other') type = fromCache;
  }
  if (!data) {
    if (type === r.type) return r;
    return { ...r, type };
  }
  const modelId = r.modelId ?? data.model?.id ?? data.modelId ?? null;
  const recordedName = r.modelName && !UNKNOWN_NAMES.has(r.modelName) ? r.modelName : null;
  const modelName = recordedName || data.model?.name || r.modelName;
  const versionName = r.versionName || data.name || null;
  let air = r.air;
  if (!air?.ecosystem && typeof data.air === 'string' && data.air) {
    air = parseAir(data.air) || air;
  }
  const recordedBase = (typeof r.baseModel === 'string' && r.baseModel) ? r.baseModel : null;
  const cacheBase = (typeof data.baseModel === 'string' && data.baseModel) ? data.baseModel : null;
  const eco = air?.ecosystem || '';
  const baseModel = (cacheBase && recordedBase && isEcosystemKeyAlias(recordedBase, eco))
    ? cacheBase
    : (recordedBase || cacheBase || r.baseModel || null);
  if (
    r.modelId === modelId
    && r.modelName === modelName
    && r.versionName === versionName
    && r.air === air
    && r.type === type
    && r.baseModel === baseModel
  ) return r;
  return { ...r, modelId, modelName, versionName, air, type, baseModel };
}

function hydrateResourceForDisplay (r, getModelVersion) {
  if (!r || typeof r !== 'object') return r;
  const h = hydrateResource(r, getModelVersion);
  const line = resolveResourceLineName(h, getModelVersion);
  const modelName = (h.modelName && !UNKNOWN_NAMES.has(h.modelName))
    ? h.modelName
    : (line || '');
  return { ...h, modelName, versionName: h.versionName || null };
}

/**
 * Clone a generation entry or media-item record with cache-hydrated
 * `checkpoint` / `resources` / `model` for a detail response. Never mutates
 * `item`. Cache-offline line names are `Version ${id}`; versionName is kept
 * as its own field and is never used as the line name.
 *
 * @param {object|null|undefined} item
 * @param {(id: number|string) => object|null} [getModelVersion]
 * @returns {object|null|undefined}
 */
export function hydrateItemForDisplay (item, getModelVersion = () => null) {
  if (!item || typeof item !== 'object') return item;
  const resources = Array.isArray(item.resources)
    ? item.resources.map(r => hydrateResourceForDisplay(r, getModelVersion))
    : item.resources;
  const checkpoint = item.checkpoint
    ? hydrateResourceForDisplay(item.checkpoint, getModelVersion)
    : item.checkpoint;
  const line = resolveResourceLineName(checkpoint, getModelVersion);
  const model = (line && !UNKNOWN_NAMES.has(line))
    ? line
    : (item.model && !UNKNOWN_NAMES.has(item.model) ? item.model : '');
  const hit = generatorFamilyForItem({ ...item, resources, checkpoint });
  const generatorFamily = hit ? { id: hit.familyId, label: hit.label } : null;
  return { ...item, resources, checkpoint, model, generatorFamily };
}

/**
 * Display slots for one post or comic member. The media item wins: hydrated
 * checkpoint, resources, and model, plus canonical `params.workflow`. A
 * lookup miss resolves resources from `member.meta` and leaves workflow
 * empty. Never mutates `member` or the media item.
 *
 * @param {object|null|undefined} member
 * @param {(id: string|number) => object|null|undefined} [getMediaItem]
 * @param {(id: number|string) => object|null} [getModelVersion]
 * @returns {{ checkpoint: object|null, resources: object[], model: string, workflow: string }}
 */
export function memberDisplaySlots (member, getMediaItem, getModelVersion = () => null) {
  const empty = { checkpoint: null, resources: [], model: '', workflow: '' };
  if (!member || typeof member !== 'object') return empty;

  const id = member.mediaId;
  const mi = (id != null && id !== '' && typeof getMediaItem === 'function')
    ? getMediaItem(id)
    : null;

  if (mi && typeof mi === 'object') {
    const hydrated = hydrateItemForDisplay(mi, getModelVersion) || mi;
    const workflow = typeof mi.params?.workflow === 'string' ? mi.params.workflow : '';
    return {
      checkpoint: hydrated.checkpoint ?? null,
      resources: Array.isArray(hydrated.resources) ? hydrated.resources : [],
      model: typeof hydrated.model === 'string' ? hydrated.model : '',
      workflow
    };
  }

  const resolved = resolveCheckpoint({ meta: member.meta });
  const hydrated = hydrateItemForDisplay({
    checkpoint: resolved.checkpoint,
    resources: resolved.resources,
    model: ''
  }, getModelVersion);
  return {
    checkpoint: hydrated?.checkpoint ?? null,
    resources: Array.isArray(hydrated?.resources) ? hydrated.resources : [],
    model: typeof hydrated?.model === 'string' ? hydrated.model : '',
    workflow: ''
  };
}
