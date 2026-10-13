// Decompose a Civitai resource record (as seen in saved generation JSON
// under `gen.metadata.resources[]` or `gen.steps[0].resources[]`) into a
// stable structured form for the index entry.
//
// This module replaces the earlier `src/baseModelTaxonomy.mjs`. The
// architectural change: ecosystem identity now comes from the AIR URN
// embedded in the resource record (or in `params.fluxMode` for older
// Flux generations), not from a vendored `baseModel`-token-to-ecosystem
// map. See:
//   - docs/guides/civitai-sync/product-model.md
//       (AIR URN + baseModel are the deterministic axes; the vendored
//        snapshot is display-only)
//   - docs/guides/civitai-sync/api-contract.md → "Resource shape on generations"
//
// Field precedence (graceful when fields are missing):
//
//   - `type`        ← `canonicalResourceType(modelType ?? model.type ?? type)`
//                       Closed Prisma ModelType alphabet. Post-meta dialects
//                       (`lora`, `embed`, omitted, C# ImageJobNetworkParams
//                       ToString) are aliases, never tree keys. Unknown → Other.
//   - `modelId`     ← `resource.modelId` ?? `resource.model.id` ?? null
//   - `modelName`   ← `resource.model.name` ?? `resource.modelName` ?? '(unknown)'
//                       (older-shape resources carry the model line name as
//                        a TOP-LEVEL `modelName` field; newer-shape resources
//                        nest it under `model.name`. We accept either.)
//   - `versionId`   ← `resource.modelVersionId` ?? `resource.id` ?? null
//                       (the version ID is `resource.id` in the older shape;
//                        `modelVersionId` is the explicit alternative when
//                        upstream provides it. Post meta always uses
//                        `modelVersionId`.)
//   - `versionName` ← `resource.name` (= `ModelVersion.name`) ??
//                       `resource.modelVersionName` (post meta) ?? null
//   - `baseModel`   ← `resource.baseModel` ?? null
//   - `air`         ← `parseAir(resource.air)` ?? null
//                       (the `air` field appears on newer-shape resource
//                        records. Older-shape records may carry the AIR URN
//                        in `params.fluxMode`; the index builder handles
//                        that surface separately and threads it in via the
//                        optional `airOverride` parameter to this function.)
//   - `strength`    ← `resource.strength` (only when numeric, else null)
//
// Returns `null` when `resource` is not a non-null object — callers can use
// the returned value as a truthy check.

import { parseAir } from './airUrn.mjs';

// Prisma ModelType, protocol order (explorer-url-protocol.md resourceType).
// Tree keys, resourceType= tokens, and scope t. segments are this alphabet.
export const MODEL_TYPES = Object.freeze([
  'Checkpoint',
  'TextualInversion',
  'Hypernetwork',
  'AestheticGradient',
  'LORA',
  'LoCon',
  'DoRA',
  'Controlnet',
  'Upscaler',
  'MotionModule',
  'VAE',
  'TextEncoder',
  'UNet',
  'CLIPVision',
  'Poses',
  'Wildcards',
  'Workflows',
  'ComfyWorkflows',
  'Detection',
  'VisionLanguage',
  'CLIP',
  'LLM',
  'Other'
]);

const MODEL_TYPE_SET = new Set(MODEL_TYPES);

// Post meta.civitaiResources[].type is lowercase / AIR / historical dialect;
// generation resources use the ModelType enum. Map onto one alphabet.
const LOWERCASE_TYPE_TO_MODEL_TYPE = {
  checkpoint: 'Checkpoint',
  lora: 'LORA',
  locon: 'LoCon',
  lycoris: 'LoCon',
  dora: 'DoRA',
  textualinversion: 'TextualInversion',
  embedding: 'TextualInversion',
  embed: 'TextualInversion',
  vae: 'VAE',
  controlnet: 'Controlnet',
  hypernetwork: 'Hypernetwork',
  hypernet: 'Hypernetwork',
  motionmodule: 'MotionModule',
  motion: 'MotionModule',
  upscaler: 'Upscaler',
  wildcards: 'Wildcards',
  poses: 'Poses',
  unet: 'UNet',
  clipvision: 'CLIPVision',
  clip: 'CLIP',
  ag: 'AestheticGradient',
  aestheticgradient: 'AestheticGradient',
  textencoder: 'TextEncoder',
  comfyworkflows: 'ComfyWorkflows',
  visionlanguage: 'VisionLanguage',
  vlm: 'VisionLanguage',
  llm: 'LLM',
  other: 'Other'
};

const NETWORK_PARAMS_TYPE = /ImageJobNetworkParams\s*\{[^}]*Type\s*=\s*([A-Za-z0-9]+)/i;

/**
 * Map a wire / post-meta / AIR type string onto a ModelType. Unknown values
 * (including C# ImageJobNetworkParams ToString dumps without a parseable
 * Type=) become Other — they are never a tree axis.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function canonicalResourceType (raw) {
  if (typeof raw !== 'string' || !raw.length) return 'Other';
  if (MODEL_TYPE_SET.has(raw)) return raw;
  const mapped = LOWERCASE_TYPE_TO_MODEL_TYPE[raw.toLowerCase()];
  if (mapped) return mapped;
  const dump = raw.match(NETWORK_PARAMS_TYPE);
  if (dump) return canonicalResourceType(dump[1]);
  return 'Other';
}

/**
 * @typedef {object} DecomposedResource
 * @property {string}             type
 * @property {number|null}        modelId
 * @property {string}             modelName
 * @property {number|null}        versionId
 * @property {string|null}        versionName
 * @property {string|null}        baseModel
 * @property {object|null}        air         Parsed AIR URN, or null.
 * @property {number|null}        strength
 */

/**
 * @param {object|null|undefined} resource
 *   The resource record from saved JSON.
 * @param {object} [opts]
 * @param {string} [opts.airOverride]
 *   AIR URN string to use when the resource record itself does not carry one.
 *   Typically the index builder passes `params.fluxMode` here for older-shape
 *   Flux generations, since those carry the AIR URN at the params level
 *   rather than the resource level.
 * @returns {DecomposedResource|null}
 */
export function decomposeResource (resource, opts = {}) {
  if (!resource || typeof resource !== 'object') return null;

  const type = canonicalResourceType(
    resource.modelType ?? resource.model?.type ?? resource.type
  );
  const baseModel = resource.baseModel ?? null;
  const strengthRaw = resource.strength;

  // Older-shape resource records carry `modelName` at the top level; newer
  // shape nests it under `model.name`. Accept either; fall back to a
  // discoverable bucket so the Models tab can still surface the resource.
  const modelName = resource.model?.name ?? resource.modelName ?? '(unknown)';

  // Older-shape carries the version ID at `resource.id`; newer shape
  // sometimes uses `modelVersionId`. Accept either.
  const versionId = resource.modelVersionId ?? resource.id ?? null;

  // AIR URN: prefer the explicit `air` field on the resource. When that's
  // absent, fall back to the caller-provided override (which the index
  // builder fills from `params.fluxMode` for older Flux generations).
  const airSource = typeof resource.air === 'string' && resource.air.length > 0
    ? resource.air
    : (typeof opts.airOverride === 'string' ? opts.airOverride : null);
  const air = airSource ? parseAir(airSource) : null;

  return {
    type: typeof type === 'string' && type.length ? type : 'Other',
    modelId: resource.modelId ?? resource.model?.id ?? null,
    modelName,
    versionId,
    versionName: typeof resource.name === 'string'
      ? resource.name
      : (typeof resource.modelVersionName === 'string' ? resource.modelVersionName : null),
    baseModel,
    air,
    strength: typeof strengthRaw === 'number' ? strengthRaw : null
  };
}
