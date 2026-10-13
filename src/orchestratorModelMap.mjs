// Lookup module for the vendored orchestrator video → modelVersionId map.
//
// Reads `src/vendor/orchestrator-model-map.mjs` and resolves a generation's
// `params.engine` / `workflow` / `type` (plus Wan version + resolution) to a
// numeric modelVersionId. This is the single approved consumer of that
// vendored file — see `src/vendor/README.md` and
// `docs/guides/civitai-sync/internal/vendored-snapshots.md`.
//
// Mapping rationale (source-read, civitai-src @ the SHA in the vendored header):
//
//   Hunyuan — `hunyuan.handler.ts` has no version-id table. `engine.utils.ts`
//   maps `hunyuan` → ecosystem `HyV1`; `ecosystemSettings` locks the
//   checkpoint at modelVersionId 1313562 (`modelLocked: true`, the bf16 build
//   the handler names). txt2vid only.
//
//   Wan — `generation/version-ids.ts` `wanBaseModelGroupIdMap` covers v2.1 variants.
//   `form-graph/generation/video/wan.graph.ts` `wanVersionDefs` maps (version, t2v|i2v) → ecosystem key;
//   v2.1 img2vid also has a resolution split (`i2v_480p` vs `i2v` = 720p).
//   Later versions (2.2 / 2.5 / 2.7) only appear as ecosystemSettings
//   `defaults.model.id`. Default version when `wanVersion` is absent: v2.1
//   (matches the handler fallback). Default i2v resolution when unknown: 480p
//   (matches the handler default).
//
//   Other engines in ENGINE_TO_ECOSYSTEM (kling, veo3, …) resolve via
//   engine → ecosystem key → ecosystemSettings model id, so adding an
//   engine later is a refresh, not a call-site change.
//
// Returns null when the tuple is unmapped (probe slot
// `orchestrator_video_no_resources` is the operational coverage check).

import { ENGINE_TO_ECOSYSTEM, WAN_VERSION_ECOSYSTEMS, ECOSYSTEM_TO_VERSION_ID } from './vendor/orchestrator-model-map.mjs';

function videoProcess (params) {
  const type = String(params.type || '').toLowerCase();
  const workflow = String(params.workflow || '').toLowerCase();
  const process = String(params.process || '').toLowerCase();
  const blob = `${type} ${workflow} ${process}`;
  if (/\bimg2vid\b|\bi2v\b|image-to-video/.test(blob)) return 'i2v';
  if (/\btxt2vid\b|\bt2v\b|text-to-video/.test(blob)) return 't2v';
  if (params.sourceImage || (Array.isArray(params.images) && params.images.length)) return 'i2v';
  return 't2v';
}

function wanI2vResolution (params) {
  const r = params.resolution;
  if (r === '720p' || r === '480p') return r;
  const img = params.sourceImage || (Array.isArray(params.images) && params.images[0]) || null;
  const w = img?.width || 0;
  const h = img?.height || 0;
  if (!w || !h) return '480p';
  if (Math.min(w, h) >= 720 || Math.max(w, h) >= 1280) return '720p';
  return '480p';
}

function lookup (ecosystemKey) {
  if (!ecosystemKey) return null;
  const versionId = ECOSYSTEM_TO_VERSION_ID[ecosystemKey];
  if (typeof versionId !== 'number') return null;
  return {
    modelVersionId: versionId,
    baseModel: null,
    ecosystem: ecosystemKey.toLowerCase()
  };
}

/**
 * Infer the implied orchestrator checkpoint from video-generation params.
 *
 * Requires `params.engine` and at least one of `workflow` / `type` (the
 * R1.3 gate). Returns `{ modelVersionId, baseModel: null, ecosystem }` or
 * null. Base model is the Prisma token from the version cache at hydrate
 * time — do not copy the ecosystem table key into that field.
 *
 * @param {object|null|undefined} params
 * @returns {{ modelVersionId: number, baseModel: null, ecosystem: string }|null}
 */
export function inferOrchestratorModel (params) {
  if (!params || typeof params !== 'object') return null;
  const engine = typeof params.engine === 'string' ? params.engine : '';
  if (!engine) return null;
  if (!params.workflow && !params.type) return null;

  if (engine === 'wan') {
    const version = params.wanVersion || params.version || 'v2.1';
    const process = videoProcess(params);
    const def = WAN_VERSION_ECOSYSTEMS[version] || WAN_VERSION_ECOSYSTEMS['v2.1'];
    if (!def) return null;
    let ecoKey = def[process];
    if (process === 'i2v' && version === 'v2.1' && wanI2vResolution(params) === '480p') {
      ecoKey = def.i2v_480p || ecoKey;
    }
    return lookup(ecoKey);
  }

  const ecoKey = ENGINE_TO_ECOSYSTEM[engine];
  return lookup(ecoKey);
}

export { ENGINE_TO_ECOSYSTEM, WAN_VERSION_ECOSYSTEMS, ECOSYSTEM_TO_VERSION_ID };
