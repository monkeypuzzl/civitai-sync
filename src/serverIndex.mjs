import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { readFile, listDirectory, isDate, writeFile, toDateString } from './utils.mjs';
import { getEffectiveMediaInfo, generationMediaFilename } from './generations.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import { portableFileSegment } from './portableFileSegment.mjs';
import { loadOverrides, getMediaOverride, reactionsToTags, mergeOccurrenceReactions, remapMediaOverride } from './overrides.mjs';
import { extractInputDescriptors, blobIdFromUrl, existingInputFilepath, adoptLegacyInputNames } from './inputMedia.mjs';
import { loadAliasStore, resolveCanonicalId, recordAlias, persistAliasStore, imageKey } from './mediaIdentity.mjs';
import { postedSourceName, postedMatchAt, buildGenerationRecipeIndex, matchRecipe } from './postedIdentity.mjs';
import { backfillContentHashes } from './contentHashBackfill.mjs';
import {
  applySidecarToMediaItems,
  backfillAspectFileDims,
  readSidecarSync
} from './mediaFileDimensions.mjs';
import {
  projectAudioParams,
  searchPromptFromAudio
} from './aceAudioParams.mjs';
import {
  applyAceAudioSidecar,
  readSidecarSync as readAceAudioSidecarSync
} from './aceAudioId3.mjs';
import { backfillAceAudio } from './aceAudioBackfill.mjs';
import { waitForExplorerIdle } from './explorerIdle.mjs';
import {
  aspectClassFromPixels as deriveAspectClass,
  namedAspectToken,
  paramsPixels,
  resolveProducedDuration,
  resolveProducedSize,
  ASPECT_CLASSES,
  ASPECT_CLASS_LABELS
} from './mediaAspect.mjs';
import { ensureTagCacheLoaded, getTagNameFromCache, formatTagName } from './tagCache.mjs';
import { browsingLevelOf } from './civitaiWire.mjs';
import { isRatingTagName, ratingTagLabel, ratingTokenForLevel } from '../dev/ui/src/lib/browsing-level.js';
import { CONFIG } from './cli.mjs';
import { civitaiUrl } from './civitaiDomain.mjs';
import { getEcosystemDisplayName } from './ecosystemDisplay.mjs';
import { getWorkflowAbbreviationExpansion, getWorkflowDisplayLabel, getWorkflowVocab } from './workflowVocab.mjs';
import { parseWorkflowFamily, remainderTokenFor } from './workflowFamily.mjs';
import { canonicalizeWorkflow, fullestWorkflow, workflowFromGenerationParams } from './workflowDesignate.mjs';
import { modelTypeLabel } from './modelTypeDisplay.mjs';
import { resolveCheckpoint, hydrateResource, resolveResourceVersionName, unionDecomposedSlots, decomposeCivitaiMetaResource, postedGenerationView } from './checkpointResolution.mjs';
import { assignModelFamily, fallbackGeneratorFamily, getModelFamily, sectionLabel } from './modelFamily.mjs';
import { extractEmbeddedMeta } from './embeddedMeta.mjs';
import { bumpOriginListCache } from './originList.mjs';
import { panelMediaId } from './comics.mjs';
import {
  derivePostStatus,
  deriveComicStatus,
  itemDate,
  itemTypes,
  itemAspects,
  itemResourceTypes,
  itemReactionTags,
  itemEcosystems,
  itemModels,
  itemVersions,
  itemResources,
  itemWorkflows,
  itemCfg,
  itemSteps,
  itemVersionIds,
  publicationTokensOf,
  model3dPublicationStatus,
  groupKeysFor,
  mediaItemToFilterable,
  coverPathOf
} from './explorerQuery.mjs';

// Bump on schema changes that require all clients to re-derive entries from
// raw JSON. The cache file declares its version in stats.json._version; on
// mismatch the cache is discarded and a one-shot full rebuild runs.
//
// History:
//   4 — incremental upsert + append-only NDJSON cache.
//   5 — Phase 1 of the Explorer roadmap: structured `checkpoint`/`resources`
//       on generations, `aspectClass` on generations and post media items,
//       `status`/`availability` on posts, and the derived `mediaItems`
//       projection that flattens generations + posts into per-media-item
//       records keyed by the (extension-stripped) Civitai image ID.
//   6 — Phase 1 follow-up: ecosystem identity now comes from the AIR URN
//       embedded in resource records (or threaded from `params.fluxMode`
//       for older Flux generations) rather than from a vendored
//       `baseModel`-token-to-ecosystem map. The `ecosystem` string field
//       on `entry.checkpoint` and `entry.resources[]` is replaced by an
//       `air` parsed-AIR-URN object. `decomposeResource` now reads
//       `modelName` from `resource.modelName` (older shape) as a fallback
//       to `resource.model.name` (newer), and `versionId` from
//       `resource.id` as a fallback to `resource.modelVersionId`. See
//       docs/guides/civitai-sync/internal/explorer-roadmap.md → Phase 1.1.
//   7 — local-canonical-reactions: index entries now merge per-media-item
//       reaction overrides (data/overrides/annotations.json) at build time
//       via getEffectiveMediaInfo, and getGeneratedMediaInfo's per-output
//       tag-block read became canonical-first (metadata.output ??
//       metadata.images) so audio / newer-shape server reactions reach
//       mediaItem.tags even with no local override. See
//       .cursor/plans/local-canonical-reactions_0d07d6d0.plan.md.
//   8 — Phase 3 of the Explorer roadmap: post entries now carry per-image
//       numeric `tagIds` (from post.getInfinite) plus a derived
//       `contentTags` name list (post-level tags ∪ image tagIds resolved
//       via the per-account tag-name cache, src/tagCache.mjs); the
//       mediaItems projection's `tags` field gains those resolved content
//       names alongside the curation kinds. The bump forces existing caches
//       to re-derive from the immutable JSON so `images[].tagIds` is
//       captured. See .cursor/plans/phase-3-faceted-filters_b29d2a3e.plan.md.
//   9 — Exports cutover (C2): the canonical generation store flattened from
//       `media/generations/all/<date>/` to `media/generations/<date>/`, so the
//       generation media-item `thumbnailPath` drops the `all/` segment. The
//       bump forces existing caches to re-derive paths so served thumbnails
//       (and the Exports hard-link source) point at the post-migration layout.
//       See .cursor/plans/exports_e3b1c7a2.plan.md.
//  10 — Phase 5a (audio): generation media items now carry the LOGICAL media
//       type from getGeneratedMediaInfo's classifier rather than an
//       extension re-derivation, so ACE cover-mode `.mp4` reclassifies from
//       video → audio, and suppressed intermediate steps (album-cover
//       imageGen, chatCompletion lyric) are dropped from enumeration — their
//       phantom cover-image media items disappear from the index. Generation
//       media items also gain a `duration` field. The bump forces one rebuild
//       so already-downloaded audio reaches parity. See
//       .cursor/plans/phase-5a-audio-media_c4b81e07.plan.md.
//  11 — Phase 5c/5d (drafts + deletion tracking): post entries gain
//       `createdAt` (the status-aware date key for drafts, which have
//       `publishedAt: null`) and `status` is now derived from `publishedAt`
//       when the saved JSON lacks it. The bump forces existing post caches to
//       re-derive so every entry carries `createdAt` (intermediate bumps are
//       free per the release model; this avoids a stale-cache gap if a future
//       consumer reads post `createdAt` for published entries too). See
//       .cursor/plans/phase-5cd-drafts-deletion_a3f8e2d1.plan.md.
//  (An earlier "12" was an aborted Phase 5c2 "Option B" bump — keying posts
//   on `createdAt` as a *storage* key. Reverted: post.getInfinite/post.get
//   omit top-level `createdAt`, so Option B storage was unworkable. Posts
//   stay keyed on `publishedAt` / the dateless `drafts/` bucket. That
//   conclusion was about the storage key, not about dating drafts: a draft
//   is datable from `images[].createdAt` / a guarded `cursorId − 100yr`.)
//  12 — Explorer Overview: `buildPostEntry` derives a draft's `createdAt`
//       from `min(images[].createdAt)` (robust) or `cursorId − 100yr`
//       (exact, guarded). Rebuilds from saved JSON — no re-download. The
//       on-disk storage bucket stays `drafts/`. See
//       .cursor/plans/explorer-overview_e0a7c1d9.plan.md.
//  13 — Model identity resolution: post-only media items decompose
//       `meta.civitaiResources`; video gens with empty `resources[]` infer
//       a checkpoint from orchestrator params (Wan / Hunyuan). Forces a
//       rebuild so the Models tree and `groupBy=model` stop dumping those
//       items into No model. See
//       .cursor/plans/model-identity-resolution_6beab23f.plan.md.
//  14 — Draft media-item dates: `buildPostEntry` copies `images[].createdAt`
//       onto each `media[]` row; `buildMediaItems` dates post-only items from
//       that (then post `createdAt`, then `publishedAt`) and never from the
//       storage bucket `post.date` (`'drafts'`). Rebuilds from saved JSON —
//       no re-download. Storage bucket stays `drafts/`.
//  15 — Input media: generation/post entries carry input refs; buildMediaItems
//       pass 3 creates input-only records + usedAsInput; GET /api/media lists
//       produced items only. Rebuilds from saved JSON — no re-download.
//  16 — Generation occurrences: buildMediaItems pass 1 appends
//       containers.generations[] (never last-wins overwrite). Derived
//       containers.generation + date + thumbnailPath + prompt/params
//       = newest sortKey. Date matches any occurrence day.
//  17 — Comics index: `index.comics` + populated `containers.comics`.
//       Rebuild from saved JSON; no re-download of gens/posts. See
//       .cursor/plans/phase-5b-comics_c0m1c5ab.plan.md.
//  18 — Aspect filter: generation `media[]` rows persist produced
//       `width`/`height` from user-facing `output[]` (suppressed steps
//       skipped). Media-item pixels/class come from the primary occurrence
//       row (then params, then an after-listen file-header sidecar).
//       Rebuild from saved JSON; no re-download. See
//       .cursor/plans/aspect-ratio-filter_c9f2a184.plan.md.
//  19 — ACE typed `audio` on generation entries and media items.
//       Search prompt is musicDescription || songConcept. Cover stills
//       are input role `cover`. ID3 sidecar hole-fills simple-mode
//       description/lyrics. Rebuild from saved JSON; no re-download.
//       See .cursor/plans/ace-audio-lightbox_a8e4d10c.plan.md.
//  20 — Closed ModelType alphabet on decomposed resources. Cached gen
//       NDJSON re-runs decomposeResource so dump / embed / omitted type
//       become LORA / TextualInversion / Other (cache-repaired at read).
//       mediaItems already re-derive (union post/comic slots by versionId).
//       See .cursor/plans/model-resource-capture_r4t1c201.plan.md.
//  21 — ACE audio layers: audio.simplePrompt (was songConcept); search
//       haystack is musicDescription + lyrics + distinct simple prompt.
//       ID3 TXXX NUL-terminator parse. Rebuild from saved JSON; no
//       re-download. See .cursor/plans/ace-audio-layers_a9e5c210.plan.md.
//  22 — posted identity: persist `sourceName` on post/comic media; coalesce
//       generation params (metadata.params || step.params, fill holes from
//       step.metadata.params); persist `params.clipSkip`. See
//       phase-5e-posted-identity plan.
//  23 — persist `params.workflow` (on-site generator job identifier) so
//       Explorer can facet/label it. See STS protocol + workflows plan.
//  24 — params.image / meta.image persist as input role source (was init).
//       Rebuild from saved JSON; no re-download.
//  25 — canonical params.workflow, including a designation from published
//       generation-data process / techniques when the generation token does
//       not canonicalize. Rebuild from saved JSON.
//  26 — generation job kind is params.workflow when that canonicalizes,
//       otherwise params.process, otherwise params.type. Tags are not read.
//       Rebuild from saved JSON. See generation-workflow-params plan.
//  27 — produced file size. Generation media rows store width/height from
//       resolveProducedSize plus pixelSource. params.width/height stay the
//       request canvas. A post/comic measurement replaces a stamp; a
//       generation-file header replaces a stamp or a post measurement.
//       Rebuild from saved JSON; no re-download. See
//       .cursor/plans/produced-file-size_f1l3px01.plan.md.
//  28 — a canceled generation output is not a media row. getGeneratedMediaInfo
//       skips it with failed/expired. Rebuild from saved JSON; no re-download.
//       See .cursor/plans/canceled-export-sync_c4ncel1.plan.md.
//  29 — generation model3d rows store logical type, mesh mediaPath, files[],
//       a 2D thumbnailPath (or ''), width/height 0, and pixelSource 'none'.
//       A v28 cache still types those jobs as image and points thumbnailPath
//       at a .jpeg. Rebuild from saved JSON; no re-download.
//       See .cursor/plans/3d-generation-ingest_3d0a1001.plan.md.
//  30 — new Model3D container. Generation entry shape unchanged.
//       A v29 cache must rescan.
//       See .cursor/plans/3d-published-model_3d0a1003.plan.md.
//  31 — Model3D entries store workflowId and thumbnailImageId. A v30
//       cache must rescan. Generation media rows do not gain pixels.
//       See .cursor/plans/3d-record-joins_3d0a1004.plan.md.
//  32 — generation params keep a non-empty ecosystem string (not the
//       placeholder "undefined"). A v31 cache has no ecosystem, so a
//       mesh with empty resources cannot resolve a generator family
//       until rebuild. Rebuild from saved JSON; no re-download.
//       See .cursor/plans/3d-generator-identity_3dfam01.plan.md.
//  33 — post and comic media rows carry imageResources. Media items union
//       those version ids after the generation slots and the file recipe.
//       A v32 post entry has no sibling, so a model the site lists beside
//       a recipe is missing until rescan. Rebuild from saved JSON. The
//       sibling itself arrives on the next posts or comics download.
//       See .cursor/plans/image-resource-union_i4r5u01.plan.md.
//  34 — post and comic images store one image.getGenerationData body.
//       Index rows project meta, process, techniques, and imageResources
//       from that body. A v33 entry has no body, so a field that lived
//       only on the untrimmed response is missing until rescan.
//       See .cursor/plans/generation-data-body_g3nb0d1.plan.md.
//  35 — post and comic entries store the container browsing-level bit.
//       Each post image and comic panel stores its own bit. Media items
//       copy the image bit. rating= reads the image bit only. A v34
//       cache has neither, so rebuild from saved JSON. No re-download.
//       See .cursor/plans/rating-scope_r4t1ng01.plan.md.
//  36 — a published card overlays the generation job on the media item.
//       Prompt, parameters, workflow, and resources come from the card
//       when the card has them. The generation file is not rewritten.
//       A v35 cache still prefers the job, so rebuild from saved JSON.
//       See .cursor/plans/published-refresh_p8rfsh01.plan.md.
//  37 — comic entries store `genre` (the wire token, or null). A v36 line
//       has no genre, so rebuild from saved JSON. No re-download.
//       See .cursor/plans/comic-genre_g3nr301.plan.md.
//  38 — Avatar (`img2img:avatar`) is an accepted workflow. A v37 generation
//       line stored that job with an empty workflow, so rebuild from saved
//       JSON. No re-download.
//       See .cursor/plans/vendored-residuals_r3s1d01.plan.md.
// Query-time Generations scope (`isGenerationBacked` / hasGeneration=1) does
// not bump INDEX_VERSION — saved JSON and NDJSON are unchanged.
export const INDEX_VERSION = 38;

// A v37 generation line has no Avatar workflow. A cache older than this is rebuilt from saved JSON.
export const REUSABLE_ENTRY_VERSION = 38;

// --- Aspect-class helper (shared by entry builders + media-items) ---
//
// `normalizeMediaId` (the shared media-item id-space) now lives in
// `src/mediaId.mjs` so the override store can reuse it without depending on
// the index. Orientation + named-ratio snap live in `src/mediaAspect.mjs`.

// Persist extractor output on generation/post entries (no url, no
// thumbnailPath). Pass 3 of buildMediaItems resolves local files and
// drops refs that have none.
function persistInputRefs (record, origin) {
  const refs = [];
  const seen = new Set();
  for (const d of extractInputDescriptors(record, origin)) {
    if (!d?.url) continue;
    const id = blobIdFromUrl(d.url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const ref = {
      id,
      role: d.role,
      kind: d.kind || 'image',
      width: Number(d.width) || 0,
      height: Number(d.height) || 0
    };
    if (d.slot != null) ref.slot = d.slot;
    refs.push(ref);
  }
  return refs;
}

const REACTION_TAG_RE = /^(favorite|feedback:liked|feedback:disliked)$/;

// Finite browsing-level bit, or null when the saved record has none.
// Callers pass a Civitai record (via browsingLevelOf) or an index row
// that already stores the number.
function indexBrowsingLevel (record) {
  if (record && typeof record.browsingLevel === 'number' && Number.isFinite(record.browsingLevel)) {
    return record.browsingLevel;
  }
  const level = browsingLevelOf(record);
  if (level == null || level === '') return null;
  const n = Number(level);
  return Number.isFinite(n) ? n : null;
}

function applyImageBrowsingLevel (item, level) {
  if (level == null || level === '') return;
  const n = Number(level);
  if (Number.isFinite(n)) item.browsingLevel = n;
}

function splitReactionTags (tags) {
  const reactions = [];
  const content = [];
  for (const t of Array.isArray(tags) ? tags : []) {
    if (typeof t !== 'string') continue;
    if (REACTION_TAG_RE.test(t)) reactions.push(t);
    else content.push(t);
  }
  return { reactions, content };
}

function mergeOverrideReactions (item) {
  const ov = getMediaOverride(item.id);
  if (!ov) return;
  item.reactions = reactionsToTags(ov);
}

// Produced = created or published (or a comic container). Input-only items
// have empty containers and are excluded from galleries, facets, stats,
// the Models catalog, date bounds, and default exports.
export function isProduced (mi) {
  if (!mi?.containers) return false;
  return mi.containers.generation != null
    || (Array.isArray(mi.containers.posts) && mi.containers.posts.length > 0)
    || (Array.isArray(mi.containers.comics) && mi.containers.comics.length > 0);
}

export function isGenerationBacked (mi) {
  return mi?.containers?.generation != null;
}

export function isPostBacked (mi) {
  return Array.isArray(mi?.containers?.posts) && mi.containers.posts.length > 0;
}
export function isComicBacked (mi) {
  return Array.isArray(mi?.containers?.comics) && mi.containers.comics.length > 0;
}

// --- Entry builders ---
//
// These are the single seam where index entries are derived from raw API
// JSON. `buildGenerationEntry` reads through `getEffectiveMediaInfo`, so a
// per-media-item reaction override (data/overrides/annotations.json) is
// merged here and every upsertIndexEntries caller sees the overridden tags
// automatically. The builders are otherwise pure functions of their input —
// callers that have not loaded the override cache (e.g. the pure unit tests)
// simply see no overrides applied.

function inputPairsFromParams (params) {
  const pairs = [];
  const push = (obj) => {
    const w = Number(obj && obj.width);
    const h = Number(obj && obj.height);
    if (w > 0 && h > 0) pairs.push({ width: w, height: h });
  };
  if (!params || typeof params !== 'object') return pairs;
  if (params.sourceImage && typeof params.sourceImage === 'object') push(params.sourceImage);
  if (Array.isArray(params.images)) {
    for (const img of params.images) {
      if (img && typeof img === 'object') push(img);
    }
  }
  return pairs;
}

function applyMeasuredSize (existing, measured) {
  if (existing?.type === 'model3d') return;
  const next = resolveProducedSize({
    current: {
      width: existing.width,
      height: existing.height,
      pixelSource: existing.pixelSource || 'none'
    },
    post: { width: measured && measured.width, height: measured && measured.height }
  });
  existing.width = next.width;
  existing.height = next.height;
  existing.pixelSource = next.pixelSource;
  existing.aspectClass = deriveAspectClass(next.width, next.height);
  if (existing.type === 'audio') {
    if (!existing.duration) {
      const filled = resolveProducedDuration({ postDuration: measured && measured.duration });
      if (filled) existing.duration = filled;
    }
    return;
  }
  const dur = resolveProducedDuration({
    postDuration: measured && measured.duration,
    itemDuration: existing.duration
  });
  if (dur) existing.duration = dur;
}

function persistedModel3dFiles (files, date) {
  if (!Array.isArray(files)) return [];
  return files.map(file => {
    const name = typeof file?.path === 'string' ? path.basename(file.path) : '';
    const row = {
      role: file.role,
      format: file.format,
      path: name ? `/media/generations/${date}/${name}` : ''
    };
    if (file.variant) row.variant = file.variant;
    return row;
  }).filter(file => file.path);
}

function indexEcosystem (value) {
  if (typeof value !== 'string') return {};
  const s = value.trim();
  if (!s || s.toLowerCase() === 'undefined') return {};
  return { ecosystem: s };
}

export function buildGenerationEntry (gen, date) {
  // Override-aware: getEffectiveMediaInfo overlays any local reaction
  // override onto the server's tags. computeStats and buildMediaItems then
  // inherit the override-merged tags automatically because they iterate the
  // built entry's `tags` / `media`.
  const mediaInfo = getEffectiveMediaInfo(gen);
  if (!mediaInfo.length) return null;

  const step = gen.steps?.[0];
  // Civitai's generation payload changed around mid-February 2026: newer
  // entries carry `params` and `resources` under `gen.metadata`, while
  // older entries place them on `gen.steps[0]`. Read from the new location
  // first and fall back to the step so both shapes work. INDEX 22 fills
  // holes from the older dual-emit copy at `step.metadata.params` (Flux Ultra
  // jobs store steps/cfgScale/clipSkip only there). Do not prefer the fill
  // copy over primary — clipSkip lives on step.params for most older gens.
  // Newer payloads nest image size under `params.aspectRatio`; older
  // payloads expose flat `width` / `height`. Resources stay primary-only.
  const primary = gen.metadata?.params || step?.params || {};
  const fill = (step?.metadata && step.metadata.params) || {};
  const params = { ...primary };
  for (const [k, v] of Object.entries(fill)) {
    // Holes only. The string 'undefined' is a real Flux sampler token — do
    // not treat it as missing (recipe casefolds it later).
    if (params[k] == null || params[k] === '') params[k] = v;
  }
  const rawResources = gen.metadata?.resources || step?.resources || [];
  const px = paramsPixels(params);
  const width = px?.width || 0;
  const height = px?.height || 0;
  const inputPairs = inputPairsFromParams(params);

  // Decompose every resource (Phase 1c). The four-axis identity (resource
  // type / ecosystem / model line / version) is documented in
  // docs/guides/civitai-sync/product-model.md → "Naming a model".
  //
  // Phase 1.1: ecosystem identity comes from the AIR URN embedded in each
  // resource record. Older Flux generations carry the AIR URN at
  // `params.fluxMode` rather than on the resource record itself; thread
  // that as `airOverride` so the decomposed resource still gets a parsed
  // AIR. See data-shape-probe report (Phase 1e) — `params.fluxMode`
  // covers ~99% of older-shape Flux entries in real corpora.
  // R1 chain: generation resources (unchanged, including fluxMode AIR) →
  // orchestrator video inference when resources[] is empty. Post meta is
  // not available on the generation JSON. A 3D job skips that video
  // inference (engine alone is not enough to skip).
  const skipVideoInference = mediaInfo.some(m => m.type === 'model3d')
    || params.workflow === 'txt2model3d'
    || params.workflow === 'img2model3d'
    || params.output === 'model3d';
  const { resources, checkpoint } = resolveCheckpoint({
    resources: rawResources,
    params,
    skipVideoInference
  });

  const allTags = new Set();
  const media = mediaInfo.map(m => {
    m.tags.forEach(t => allTags.add(t));
    // Phase 5a: trust the logical type from getGeneratedMediaInfo's classifier
    // (it already maps ACE cover-mode `.mp4` from wire-video to logical
    // audio, fixing the extension-derivation bug that mislabelled it as
    // video). The `.mp4`/`.webm` extension fallback is retained ONLY as the
    // pre-existing back-compat path for older video records whose wire item
    // carried no `type` — dropping it would regress those to 'image'. Cover
    // mode is caught by the `audio` branch first, so the extension no longer
    // mislabels it.
    const hasExt = m.mediaId.includes('.');
    let type = 'image';
    if (m.type === 'model3d') type = 'model3d';
    else if (m.type === 'audio') type = 'audio';
    else if (m.type === 'video' || m.mediaId.endsWith('.mp4') || m.mediaId.endsWith('.webm')) type = 'video';
    if (type === 'model3d') {
      const meshName = generationMediaFilename(m);
      const files = persistedModel3dFiles(m.files, date);
      const thumb = files.find(file => file.role === 'thumb' && file.path);
      return {
        mediaId: m.mediaId,
        seed: m.seed,
        type,
        duration: m.duration,
        width: 0,
        height: 0,
        pixelSource: 'none',
        aspectClass: '',
        thumbnailPath: thumb ? thumb.path : '',
        mediaPath: `/media/generations/${date}/${meshName}`,
        files,
        tags: m.tags
      };
    }
    const produced = resolveProducedSize({
      blob: { width: m.width, height: m.height, aspectRatio: m.aspectRatio },
      request: px,
      input: inputPairs,
      upscaleWidth: params.upscaleWidth,
      upscaleHeight: params.upscaleHeight,
      upscale: params.upscale,
      scaleFactor: params.scaleFactor,
      aspect: params.aspectRatio,
      resolution: params.resolution
    });
    return {
      mediaId: m.mediaId,
      seed: m.seed,
      type,
      // Item duration only. params.duration and gen.duration are not the file.
      duration: m.duration,
      width: produced.width,
      height: produced.height,
      pixelSource: produced.pixelSource,
      aspectClass: deriveAspectClass(produced.width, produced.height),
      thumbnailPath: `/media/generations/${date}/${gen.id}_${m.seed}_${m.mediaId}${hasExt ? '' : '.jpeg'}`,
      tags: m.tags
    };
  });

  const audio = projectAudioParams(params);
  const producedTypes = new Set(media.map(row => row.type));
  const mediaType = producedTypes.size === 1 ? [...producedTypes][0] : '';

  return {
    type: 'generation',
    id: gen.id,
    date,
    createdAt: gen.createdAt,
    tags: [...allTags],
    mediaCount: media.length,
    media,
    prompt: searchPromptFromAudio(audio) || params.prompt || '',
    negativePrompt: params.negativePrompt || '',
    // Back-compat: callers (Lightbox.jsx, Gallery.jsx, etc.) read `model` as
    // a string. Phase 1b adds the structured `checkpoint` alongside; Phase 3
    // UI work consumes the structured form.
    model: checkpoint?.modelName && checkpoint.modelName !== '(unknown)' ? checkpoint.modelName : '',
    checkpoint,
    resources,
    params: {
      sampler: params.sampler || '',
      steps: params.steps || 0,
      cfgScale: params.cfgScale || 0,
      width,
      height,
      clipSkip: params.clipSkip ?? null,
      workflow: workflowFromGenerationParams(params, { mediaType }),
      ...indexEcosystem(params.ecosystem)
    },
    aspectClass: deriveAspectClass(width, height),
    inputs: persistInputRefs(gen, 'generation'),
    ...(audio ? { audio } : {}),
    ...(gen.downloadOpen === true ? { downloadOpen: true } : {})
  };
}

// Image content-tag names from numeric ids. Ladder names are not content.
// Unresolved ids are skipped here; the media page adds `tag-<id>` itself.
function namesFromTagIds (tagIds, getTagName) {
  const seen = new Set();
  const out = [];
  for (const id of tagIds || []) {
    const name = getTagName(id);
    if (!name || isRatingTagName(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

// Image-name union on a post. Curated `post.tags` are not content tags.
// `getTagName` is injected so tests resolve ids without the cache singleton.
export function resolvePostContentTags (postEntry, getTagName = getTagNameFromCache) {
  const ids = [];
  for (const m of postEntry.media || []) {
    for (const id of m.tagIds || []) ids.push(id);
  }
  return namesFromTagIds(ids, getTagName).sort();
}

// A draft's temporal coordinate. post.getInfinite/post.get omit top-level
// `createdAt`; the date still rides in `images[].createdAt` (robust min) and
// in `cursorId` (= createdAt + 100yr, exact but sort-offset-fragile). A
// draft whose saved JSON predates both fields stays null → Overview's
// undatedDrafts tail. Published/scheduled posts are not derived this way
// (they key on publishedAt); an explicit post.createdAt still wins.
const CURSOR_ID_FUTURE_YEAR_FLOOR = 2100;

function createdAtFromCursorId (cursorId) {
  if (cursorId == null) return null;
  const d = new Date(cursorId);
  if (Number.isNaN(d.getTime())) return null;
  // Guard: only subtract 100yr when the value sits ~100yr ahead of the
  // present era. A non-offset date (e.g. 2026) must not be rewritten.
  if (d.getUTCFullYear() < CURSOR_ID_FUTURE_YEAR_FLOOR) return null;
  d.setUTCFullYear(d.getUTCFullYear() - 100);
  return d.toISOString();
}

// Parseable ISO → YYYY-MM-DD. Rejects the storage bucket `'drafts'` and any
// other non-date. Do not use `toDateString` here: it slices to the first `T`
// and `'drafts'.slice(0, -1)` is `'draft'`.
function temporalDay (iso) {
  if (typeof iso !== 'string' || !iso) return '';
  if (Number.isNaN(new Date(iso).getTime())) return '';
  const t = iso.indexOf('T');
  return t === -1 ? iso.slice(0, 10) : iso.slice(0, t);
}

export function derivePostCreatedAt (post) {
  if (post.createdAt) return post.createdAt;
  const isDraft = !post.publishedAt;
  if (!isDraft) return null;
  const imageDates = [];
  for (const img of Array.isArray(post.images) ? post.images : []) {
    if (typeof img?.createdAt !== 'string' || !img.createdAt) continue;
    if (Number.isNaN(new Date(img.createdAt).getTime())) continue;
    imageDates.push(img.createdAt);
  }
  if (imageDates.length) return imageDates.reduce((a, b) => (a < b ? a : b));
  return createdAtFromCursorId(post.cursorId);
}

export function buildPostEntry (post, date, getTagName = getTagNameFromCache) {
  const images = Array.isArray(post.images) ? post.images : [];

  const media = images.map((img, i) => {
    const isVideo = img.type === 'video';
    const isAudio = img.type === 'audio'; // Phase 5a — audio surfaces fall through here when Civitai ships the type
    let type = 'image';
    let ext = '.jpeg';
    if (isVideo) { type = 'video'; ext = '.mp4'; }
    else if (isAudio) { type = 'audio'; ext = '.mp3'; } // pending real audio file extension confirmation in Phase 5a
    const paddedIndex = String(i + 1).padStart(2, '0');
    const width = img.width || 0;
    const height = img.height || 0;
    const createdAt = temporalDay(img.createdAt) ? img.createdAt : undefined;
    const view = postedGenerationView(img);
    return {
      index: i + 1,
      imageId: img.id,
      sourceName: postedSourceName(img.name),
      type,
      width,
      height,
      aspectClass: deriveAspectClass(width, height),
      duration: img.metadata?.duration || undefined,
      meta: view.meta,
      // Per-image creation time from post.getInfinite. The post entry's
      // `date` is the storage bucket (`YYYY-MM-DD` or `'drafts'`); this is
      // the media item's temporal coordinate when it has no generation.
      createdAt,
      // Phase 3: numeric content-tag ids from post.getInfinite, resolved to
      // names via the tag-name cache for the `tag=` filter on standalone
      // post images. Kept as numbers so a later cache fill can re-resolve.
      tagIds: Array.isArray(img.tagIds) ? img.tagIds.filter(n => typeof n === 'number') : [],
      browsingLevel: indexBrowsingLevel(img),
      ...(img.hasMeta === false ? { hasMeta: false } : {}),
      ...(img.hideMeta === true ? { hideMeta: true } : {}),
      thumbnailPath: `/media/posts/${date}/${post.id}/${paddedIndex}_${img.id}${ext}`,
      inputs: persistInputRefs(view.meta ? { ...img, meta: view.meta } : img, 'post-image'),
      ...persistedGenerationSources(view)
    };
  });

  // Phase 1d / 5c: status / availability are first-class fields. The saved
  // JSON carries an explicit `status` (savePostData derives it from
  // `publishedAt`); when it is absent (older JSON written before Phase 5c) we
  // fall back to the same derivation — `publishedAt: null` → draft, otherwise
  // published. Existing published corpora keep status 'published', so this is
  // additive (no INDEX_VERSION bump): only newly-downloaded drafts gain a
  // 'draft' value.
  const status = typeof post.status === 'string'
    ? post.status
    : (post.publishedAt ? 'published' : 'draft');
  const availability = typeof post.availability === 'string' ? post.availability : null;

  const entry = {
    type: 'post',
    id: post.id,
    date,
    publishedAt: post.publishedAt,
    // Phase 5c / Overview: a draft has no `publishedAt`, so
    // `explorerQuery.itemDate` keys date-range/sort on `createdAt`. Top-level
    // `post.createdAt` is omitted by post.getInfinite/post.get; when absent on
    // a draft we derive it from `min(images[].createdAt)` or a guarded
    // `cursorId − 100yr`. Published posts keep an explicit `createdAt` if
    // present and otherwise leave it null (they key on `publishedAt`).
    createdAt: derivePostCreatedAt(post),
    title: post.title || '',
    detail: post.detail ?? null,
    tags: post.tags || [],
    url: civitaiUrl(`/posts/${post.id}`),
    stats: post.stats || {},
    status,
    availability,
    imageCount: media.filter(m => m.type === 'image').length,
    videoCount: media.filter(m => m.type === 'video').length,
    audioCount: media.filter(m => m.type === 'audio').length,
    deletedImages: Array.isArray(post.deletedImages) ? post.deletedImages : [],
    browsingLevel: indexBrowsingLevel(post),
    media
  };
  // Phase 3: derived content-tag name list used by the `tag=` filter.
  entry.contentTags = resolvePostContentTags(entry, getTagName);
  if (post.downloadOpen === true) entry.downloadOpen = true;
  return entry;
}

function pad2 (n) {
  return String(n ?? 0).padStart(2, '0');
}

function isIndexableComicPanel (panel) {
  return Boolean(panel && panel.status === 'Ready' && (panel.imageId != null || panel.imageUrl));
}

function comicGenreToken (value) {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return token ? token : null;
}

export function buildComicEntry (comic, date) {
  const chaptersIn = Array.isArray(comic.chapters) ? comic.chapters : [];
  const media = [];

  const cover = comic.coverImage;
  const coverId = cover?.id ?? comic.coverImageId;
  if (coverId != null) {
    const width = cover?.width || 0;
    const height = cover?.height || 0;
    media.push({
      role: 'cover',
      imageId: coverId,
      type: 'image',
      width,
      height,
      aspectClass: deriveAspectClass(width, height),
      thumbnailPath: `/media/comics/${date}/${comic.id}/cover_${coverId}.jpeg`
    });
  }

  for (const chapter of chaptersIn) {
    if (!chapter) continue;
    const chapterFolder = `${pad2(chapter.position)}_${chapter.id}`;
    for (const panel of (Array.isArray(chapter.panels) ? chapter.panels : [])) {
      if (!isIndexableComicPanel(panel)) continue;
      const mediaId = panelMediaId(panel);
      const width = panel.image?.width || 0;
      const height = panel.image?.height || 0;
      const view = postedGenerationView(panel.image);
      media.push({
        role: 'panel',
        panelId: panel.id,
        panelMediaId: mediaId,
        imageId: panel.imageId != null ? panel.imageId : undefined,
        sourceName: postedSourceName(panel.image?.name),
        chapterId: chapter.id,
        chapterPosition: chapter.position,
        chapterFolder,
        index: panel.position,
        type: 'image',
        width,
        height,
        aspectClass: deriveAspectClass(width, height),
        meta: view.meta,
        ...(panel.image?.hasMeta === false ? { hasMeta: false } : {}),
        ...(panel.image?.hideMeta === true ? { hideMeta: true } : {}),
        createdAt: temporalDay(panel.image?.createdAt) ? panel.image.createdAt : undefined,
        browsingLevel: indexBrowsingLevel(panel.image),
        thumbnailPath: `/media/comics/${date}/${comic.id}/${chapterFolder}/${pad2(panel.position)}_${mediaId}.jpeg`,
        ...persistedGenerationSources(view)
      });
    }
  }

  const chapters = chaptersIn.map(ch => ({
    id: ch.id,
    position: ch.position,
    name: ch.name || '',
    status: ch.status,
    publishedAt: ch.publishedAt ?? null,
    initialPublishedAt: ch.initialPublishedAt ?? null,
    availability: ch.availability ?? null,
    earlyAccessConfig: ch.earlyAccessConfig ?? null,
    earlyAccessEndsAt: ch.earlyAccessEndsAt ?? null
  }));

  const entry = {
    type: 'comic',
    id: comic.id,
    date,
    createdAt: comic.createdAt || null,
    publishedAt: comic.publishedAt ?? null,
    name: comic.name || '',
    description: comic.description ?? null,
    genre: comicGenreToken(comic.genre),
    url: civitaiUrl(`/comics/project/${comic.id}`),
    metrics: comic.metrics || {},
    chapters,
    imageCount: media.filter(m => m.role !== 'cover' && m.type === 'image').length,
    videoCount: 0,
    audioCount: 0,
    deletedPanels: Array.isArray(comic.deletedPanels) ? comic.deletedPanels : [],
    browsingLevel: indexBrowsingLevel(comic),
    media
  };
  entry.status = deriveComicStatus(entry);
  if (comic.downloadOpen === true) entry.downloadOpen = true;
  return entry;
}

function model3dLicenseName (model) {
  const license = model && model.license;
  if (license && typeof license === 'object' && typeof license.name === 'string') return license.name;
  return '';
}

function model3dStillPath (value) {
  if (typeof value !== 'string' || !value.startsWith('/media/model3ds/')) return '';
  const pathOnly = value.split('?')[0].toLowerCase();
  if (!/\.(png|jpe?g|webp|gif)$/.test(pathOnly)) return '';
  return value;
}

function storedWorkflowId (model) {
  const value = model && model.workflowId;
  if (typeof value !== 'string' || value === '') return null;
  return value;
}

// model3dDetailSelect returns thumbnailImageId and thumbnailImage.
// imageSelect on that relation includes id. The scalar is the id on the
// detail payload. When the scalar is absent, the nested image id is used.
function storedThumbnailImageId (model) {
  if (!model || typeof model !== 'object') return null;
  const scalar = model.thumbnailImageId;
  if (scalar != null && scalar !== '') return scalar;
  const image = model.thumbnailImage;
  if (image && typeof image === 'object' && image.id != null && image.id !== '') return image.id;
  return null;
}

function model3dRowLive (row) {
  if (!row || typeof row !== 'object') return false;
  return row.status !== 'deleted' && row.status !== 'Deleted';
}

function sameStoredId (a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  return a === b || String(a) === String(b);
}

export function model3dForGeneration (model3ds, generationId) {
  if (generationId == null || generationId === '') return null;
  const rows = Array.isArray(model3ds) ? model3ds : [];
  for (const row of rows) {
    if (!model3dRowLive(row)) continue;
    if (!sameStoredId(row.workflowId, generationId)) continue;
    return row;
  }
  return null;
}

export function model3dForImageId (model3ds, imageId) {
  if (imageId == null || imageId === '') return null;
  const rows = Array.isArray(model3ds) ? model3ds : [];
  for (const row of rows) {
    if (!model3dRowLive(row)) continue;
    if (!sameStoredId(row.thumbnailImageId, imageId)) continue;
    return row;
  }
  return null;
}

export function buildModel3dEntry (model, date) {
  if (!model || model.id == null) return null;
  const status = model3dPublicationStatus(model.status);
  const files = [];
  let primaryPath = '';
  for (const file of (Array.isArray(model.files) ? model.files : [])) {
    if (!file || typeof file.localPath !== 'string') continue;
    if (!file.localPath.startsWith('/media/model3ds/')) continue;
    files.push({
      path: file.localPath,
      format: typeof file.format === 'string' ? file.format : '',
      variant: typeof file.variant === 'string' ? file.variant : ''
    });
    if (!primaryPath && file.isPrimary === true) primaryPath = file.localPath;
  }
  if (!primaryPath && files.length) primaryPath = files[0].path;
  const thumbnailPath = model3dStillPath(model.thumbPath);
  const media = thumbnailPath
    ? [{ type: 'model3d', thumbnailPath, mediaId: `model3d-thumb:${model.id}` }]
    : [];
  return {
    type: 'model3d',
    id: model.id,
    date,
    createdAt: model.createdAt || null,
    publishedAt: model.publishedAt ?? null,
    name: model.name || '',
    status,
    workflowId: storedWorkflowId(model),
    thumbnailImageId: storedThumbnailImageId(model),
    licenseName: model3dLicenseName(model),
    thumbnailPath,
    primaryPath,
    files,
    media,
    ...(model.downloadOpen === true ? { downloadOpen: true } : {})
  };
}

// --- Media-item projection (Phase 1a) ---
//
// `mediaItems` is a derived array, rebuilt in lockstep with the source-of-
// truth `generations` and `posts` arrays. NOT persisted as NDJSON: keeping
// the projection in memory only avoids a class of cache-invalidation bugs.
// Cost is O(N + M) per rebuild; for tens of thousands of items it is sub-
// 100ms in practice.
//
// The dedup key is the Civitai image ID with any trailing media-file
// extension stripped (`normalizeMediaId`). This unifies the `mediaId` form
// used in generations (string, sometimes with `.jpeg`/`.mp4`) with the `id`
// form used in posts (number) so a media item that originated from the
// user's on-site generator AND was published in a post becomes a single
// record with both container back-references.

function extractParamsFromMeta (meta) {
  // Image-meta keys are freeform per api-contract.md "API Type Reliability".
  // Values may be strings ("832x1216", "20") or numbers — coerce defensively.
  if (!meta || typeof meta !== 'object') return { sampler: '', steps: 0, cfgScale: 0, width: 0, height: 0 };
  const sampler = meta.sampler || meta.Sampler || '';
  const stepsRaw = meta.steps ?? meta.Steps ?? 0;
  const cfgRaw = meta.cfgScale ?? meta['CFG scale'] ?? meta.CFG ?? 0;
  let width = 0, height = 0;
  if (typeof meta.Size === 'string') {
    const [w, h] = meta.Size.split('x').map(s => parseInt(s, 10) || 0);
    width = w || 0;
    height = h || 0;
  }
  return {
    sampler: typeof sampler === 'string' ? sampler : '',
    steps: typeof stepsRaw === 'number' ? stepsRaw : (parseInt(stepsRaw, 10) || 0),
    cfgScale: typeof cfgRaw === 'number' ? cfgRaw : (parseFloat(cfgRaw) || 0),
    width,
    height
  };
}

function seedFromMeta (meta) {
  if (!meta || typeof meta !== 'object') return undefined;
  const seed = meta.seed ?? meta.Seed;
  if (seed == null || seed === '') return undefined;
  return typeof seed === 'number' ? seed : (parseInt(String(seed), 10) || seed);
}

function paramsFromImageMeta (meta, pixels = {}) {
  const fromMeta = extractParamsFromMeta(meta);
  return {
    ...fromMeta,
    width: fromMeta.width || pixels.width || 0,
    height: fromMeta.height || pixels.height || 0
  };
}

function persistedGenerationSources (src) {
  if (!src || typeof src !== 'object') return {};
  const out = {};
  if (typeof src.process === 'string' && src.process) out.process = src.process;
  if (Array.isArray(src.techniques)) out.techniques = src.techniques;
  if (src.workflowSourcesCaptured === true) out.workflowSourcesCaptured = true;
  if (Array.isArray(src.imageResources) && src.imageResources.length) {
    out.imageResources = src.imageResources;
  }
  return out;
}

function designatedWorkflow (row, mediaType) {
  const candidates = [];
  const meta = row?.meta;
  if (meta && typeof meta === 'object') {
    candidates.push(canonicalizeWorkflow(meta.workflow, { mediaType }));
  }
  candidates.push(canonicalizeWorkflow(row?.process, { mediaType }));
  if (Array.isArray(row?.techniques)) {
    for (const technique of row.techniques) {
      const name = technique && typeof technique === 'object' ? technique.name : undefined;
      candidates.push(canonicalizeWorkflow(name, { mediaType }));
    }
  }
  return fullestWorkflow(candidates);
}

function paramsWithDesignation (params, row, mediaType) {
  const base = params && typeof params === 'object' ? params : {};
  const current = typeof base.workflow === 'string' ? base.workflow : '';
  if (current) return base;
  return { ...base, workflow: designatedWorkflow(row, mediaType) };
}

function publishedMetaWithheld (row) {
  return row?.hideMeta === true || row?.hasMeta === false;
}

function publishedMetaObject (row) {
  if (publishedMetaWithheld(row)) return null;
  const meta = row?.meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  if (!Object.keys(meta).length) return null;
  return meta;
}

function slotStrength (slot) {
  const value = slot?.strength;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Published resources replace the generation list when the card has any.
// A shared version id keeps the generation strength when the card omits it.
// An empty card leaves the generation resources. Returns whether a list landed.
function replacePublishedResources (existing, meta, imageResources) {
  const hasRecipe = Array.isArray(meta?.civitaiResources) && meta.civitaiResources.length > 0;
  const hasRows = Array.isArray(imageResources) && imageResources.length > 0;
  if (!hasRecipe && !hasRows) return false;
  const resolved = slotsWithImageResources(resolveCheckpoint({ meta }), imageResources);
  const published = Array.isArray(resolved?.resources) ? resolved.resources : [];
  if (!published.length) return false;

  const genById = new Map();
  const genSlots = [];
  if (existing.checkpoint) genSlots.push(existing.checkpoint);
  if (Array.isArray(existing.resources)) genSlots.push(...existing.resources);
  for (const slot of genSlots) {
    const key = versionSlotKey(slot);
    if (key && !genById.has(key)) genById.set(key, slot);
  }

  const resources = published.map(slot => {
    const next = { ...slot };
    const gen = genById.get(versionSlotKey(slot));
    if (gen && slotStrength(next) == null && slotStrength(gen) != null) {
      next.strength = gen.strength;
    }
    return next;
  });
  const checkpoint = resources.find(slot => slot.type === 'Checkpoint') || resources[0] || null;
  existing.resources = resources;
  existing.checkpoint = checkpoint;
  if (checkpoint?.modelName && checkpoint.modelName !== '(unknown)') {
    existing.model = checkpoint.modelName;
  }
  return true;
}

// Overlay a published card onto a generation-backed media item.
// `lock` records fields a post already supplied so a later comic does not
// replace them. Does not write the generation job.
function overlayPublishedCard (existing, row, lock) {
  const supplied = { meta: false, workflow: false, resources: false };
  if (!existing || !row) return supplied;
  const meta = publishedMetaObject(row);

  if (!lock?.meta && meta) {
    if ('prompt' in meta || 'Prompt' in meta) {
      existing.prompt = meta.prompt || meta.Prompt || '';
    }
    if ('negativePrompt' in meta || 'Negative prompt' in meta) {
      existing.negativePrompt = meta.negativePrompt || meta['Negative prompt'] || '';
    }
    const derived = paramsFromImageMeta(meta, row);
    const params = { ...(existing.params || {}) };
    if (derived.sampler) params.sampler = derived.sampler;
    if (derived.steps) params.steps = derived.steps;
    if (derived.cfgScale) params.cfgScale = derived.cfgScale;
    if (derived.width) params.width = derived.width;
    if (derived.height) params.height = derived.height;
    existing.params = params;
    const seed = seedFromMeta(meta);
    if (seed !== undefined) existing.seed = seed;
    supplied.meta = true;
  }

  if (!lock?.workflow) {
    const designated = designatedWorkflow(row, existing.type || row?.type);
    if (designated) {
      existing.params = { ...(existing.params || {}), workflow: designated };
      supplied.workflow = true;
    }
  }

  if (!lock?.resources && replacePublishedResources(existing, meta, row.imageResources)) {
    supplied.resources = true;
  }

  return supplied;
}

// Leftover input-only fill from JPEG UserComment / PNG parameters.
// Never invents a generation container. Never overwrites a produced item.
function applyEmbeddedMeta (item, filepath) {
  if (!item || !filepath) return;
  if (item.containers?.generation != null) return;
  if (item.containers?.posts?.length) return;
  if (item.containers?.comics?.length) return;
  const meta = extractEmbeddedMeta(filepath);
  if (!meta) return;

  const fromMeta = extractParamsFromMeta(meta);
  const resolved = resolveCheckpoint({ meta });
  item.prompt = meta.prompt || meta.Prompt || '';
  item.negativePrompt = meta.negativePrompt || meta['Negative prompt'] || '';
  item.params = fromMeta;
  const seed = meta.seed ?? meta.Seed;
  if (seed != null && seed !== '') {
    item.seed = typeof seed === 'number' ? seed : (parseInt(seed, 10) || seed);
  }
  if (fromMeta.width && fromMeta.height) {
    item.width = fromMeta.width;
    item.height = fromMeta.height;
    item.aspectClass = deriveAspectClass(fromMeta.width, fromMeta.height);
  }
  if (resolved.checkpoint) {
    item.checkpoint = resolved.checkpoint;
    item.resources = resolved.resources;
    if (!item.model) {
      item.model = resolved.checkpoint.modelName !== '(unknown)'
        ? resolved.checkpoint.modelName
        : (meta.Model || '');
    }
  }
}

// Union post/comic civitaiResources onto an existing (usually generation-
// backed) media item. Generation slots win on versionId. When there are no
// civitaiResources, keep the older null-checkpoint backfill (freeform
// meta.Model). Does not rewrite generation entries.
function finiteResourceVersionId (value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function decomposedImageResources (rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = row.modelVersionId ?? row.versionId;
    if (!finiteResourceVersionId(id)) continue;
    const decomposed = decomposeCivitaiMetaResource(row);
    if (!decomposed || !finiteResourceVersionId(decomposed.versionId)) continue;
    out.push(decomposed);
  }
  return out;
}

function versionSlotKey (resource) {
  if (resource?.versionId == null || resource.versionId === '') return '';
  return String(resource.versionId);
}

function slotsWithImageResources (resolved, imageResources) {
  const extra = decomposedImageResources(imageResources);
  if (!extra.length) return resolved;
  const primary = (Array.isArray(resolved?.resources) && resolved.resources.length)
    ? resolved.resources
    : (resolved?.checkpoint ? [resolved.checkpoint] : []);
  return unionDecomposedSlots(primary, extra);
}

function postedImageId (m) {
  return m?.imageId != null && m.imageId !== '' ? normalizeMediaId(m.imageId) : '';
}

function resolvePostedExisting (m, byId, recipeIndex, postedAt) {
  const imageId = postedImageId(m);
  if (imageId) {
    const hit = byId.get(imageId);
    if (hit) return hit;
  }
  if (m?.sourceName) {
    const nameId = normalizeMediaId(m.sourceName);
    if (nameId) {
      const hit = byId.get(nameId);
      if (hit) return hit;
    }
  }
  if (imageId) {
    const aliased = resolveCanonicalId([imageKey(imageId)]);
    if (aliased) {
      const hit = byId.get(aliased);
      if (hit) return hit;
    }
  }
  if (recipeIndex) {
    const mediaId = matchRecipe(m?.meta, postedAt, recipeIndex);
    if (mediaId) {
      const hit = byId.get(mediaId);
      if (hit) return hit;
    }
  }
  return null;
}

function collectPostedAlias (pendingAliases, existing, m) {
  const imageId = postedImageId(m);
  if (!existing || !imageId) return;
  pendingAliases.push({ canonicalId: existing.id, imageId });
}

// Streamed sync sha256 for pass 3 leftover matching. Do not slurp the
// whole file (videos). Returns null when the path is missing or unreadable.
function hashFileSha256Sync (filepath) {
  if (!filepath) return null;
  try {
    const hash = createHash('sha256');
    const fd = fs.openSync(filepath, 'r');
    try {
      const buf = new Uint8Array(64 * 1024);
      let n;
      while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
        hash.update(buf.subarray(0, n));
      }
    } finally {
      fs.closeSync(fd);
    }
    return hash.digest('hex');
  } catch {
    return null;
  }
}

function filepathFromThumbnailPath (thumbnailPath) {
  if (typeof thumbnailPath !== 'string' || !CONFIG?.mediaPath) return null;
  const prefixes = [
    ['/media/generations/', 'generations'],
    ['/media/posts/', 'posts'],
    ['/media/comics/', 'comics'],
    ['/media/inputs/', 'inputs']
  ];
  for (const [prefix, sub] of prefixes) {
    if (!thumbnailPath.startsWith(prefix)) continue;
    const rel = thumbnailPath.slice(prefix.length).replace(/^[/\\]+/, '');
    if (!rel || rel.includes('..')) return null;
    return `${CONFIG.mediaPath}/${sub}/${rel}`;
  }
  return null;
}

// Which occurrence file was consumed. One generation → that job. Two+
// → leftover leftover bytes if still on disk, else latest occurrence whose
// sortKey is at or before the consumer. Fail closed (null) rather than
// copying newest pixels as if they were the input.
function pickConsumedOccurrence (item, { consumerCreatedAt, leftoverFilepath } = {}) {
  const occs = Array.isArray(item?.containers?.generations)
    ? item.containers.generations
    : [];
  if (occs.length === 0) {
    return item?.thumbnailPath
      ? { thumbnailPath: item.thumbnailPath }
      : null;
  }
  if (occs.length === 1) return occs[0];

  if (leftoverFilepath) {
    const leftoverHash = hashFileSha256Sync(leftoverFilepath);
    if (leftoverHash) {
      for (const occ of occs) {
        const occPath = filepathFromThumbnailPath(occ.thumbnailPath);
        if (!occPath) continue;
        const occHash = hashFileSha256Sync(occPath);
        if (occHash && occHash === leftoverHash) return occ;
      }
    }
  }

  if (consumerCreatedAt) {
    let best = null;
    for (const occ of occs) {
      const key = occ.sortKey || '';
      if (!key || key > consumerCreatedAt) continue;
      if (!best || key > (best.sortKey || '')) best = occ;
    }
    if (best) return best;
  }
  return null;
}

export function buildMediaItems (generations, posts, comics = [], getTagName = getTagNameFromCache) {
  if (typeof comics === 'function') {
    getTagName = comics;
    comics = [];
  } else if (!Array.isArray(comics)) {
    comics = [];
  }
  return projectMediaItemRecords(generations, posts, comics, getTagName).items;
}

// Resolved input rows for each generation, keyed by generation id. Same
// objects pass 3 attaches to that job's members, before a later job or a
// post merges onto the item. Empty lists are omitted. Not written to NDJSON.
export function projectGenerationInputs (generations, posts = [], comics = [], getTagName = getTagNameFromCache) {
  if (typeof comics === 'function') {
    getTagName = comics;
    comics = [];
  } else if (!Array.isArray(comics)) {
    comics = [];
  }
  return projectMediaItemRecords(generations, posts, comics, getTagName).generationInputs;
}

function projectMediaItemRecords (generations, posts, comics, getTagName) {
  const byId = new Map();
  const pendingAliases = [];

  // Resolve a post media item's numeric tagIds to content-tag names via the
  // tag-name cache (Phase 3). Unresolved ids are skipped (graceful — the
  // pure unit tests run with no cache loaded and simply see no content tags).
  // Pass 1: every generation media item gets a record carrying full
  // generation-side metadata — model, params, resources, tags, batch ref.
  // One media id may appear on many jobs; append occurrences and derive
  // the primary (newest sortKey) after the loop so iteration order cannot
  // last-wins to the oldest job.
  const genFieldsById = new Map();
  const mediaRowFieldsByOcc = new Map();

  for (const gen of generations) {
    if (!Array.isArray(gen.media)) continue;
    const batchSize = gen.media.length;
    gen.media.forEach((m, batchIndex) => {
      const id = normalizeMediaId(m.mediaId);
      if (!id) return;
      const occ = {
        id: gen.id,
        batchDate: gen.date,
        sortKey: gen.createdAt || '',
        thumbnailPath: m.thumbnailPath,
        seed: m.seed,
        batchIndex,
        batchSize
      };
      genFieldsById.set(gen.id, {
        prompt: gen.prompt || '',
        negativePrompt: gen.negativePrompt || '',
        params: gen.params || {},
        checkpoint: gen.checkpoint || null,
        resources: Array.isArray(gen.resources) ? gen.resources : [],
        model: gen.model || '',
        audio: gen.audio || null
      });
      mediaRowFieldsByOcc.set(`${id}\0${gen.id}`, {
        duration: m.duration,
        type: m.type,
        tags: Array.isArray(m.tags) ? [...m.tags] : [],
        width: m.width || 0,
        height: m.height || 0,
        pixelSource: m.pixelSource || 'none',
        mediaPath: m.mediaPath || '',
        files: Array.isArray(m.files) ? m.files : undefined
      });

      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, {
          id,
          type: m.type, // 'image' | 'video' | 'audio' | 'model3d'
          date: gen.date,
          thumbnailPath: m.thumbnailPath,
          seed: m.seed,
          width: 0,
          height: 0,
          aspectClass: '',
          // Phase 5a: audio duration captured on the generation media entry by
          // buildGenerationEntry (pure-audio `.mp3` item.duration or cover-mode
          // `.mp4` params.duration). Undefined for image/video, which drops out
          // of the JSON — unchanged from the previous hardcoded `undefined`.
          duration: m.duration,
          tags: Array.isArray(m.tags) ? [...m.tags] : [],
          // Raw numeric content-tag ids surface only on post media (a generation
          // media item gains them when it merges with a post in pass 2). Phase 4's
          // media-item gallery resolves these to names with a `tag-<id>` fallback.
          contentTagIds: [],
          prompt: gen.prompt || '',
          negativePrompt: gen.negativePrompt || '',
          model: gen.model || '',
          checkpoint: gen.checkpoint || null,
          resources: Array.isArray(gen.resources) ? gen.resources : [],
          params: gen.params || {},
          containers: {
            generation: null, // set in finalize from newest sortKey
            generations: [occ],
            posts: [],
            comics: [] // Phase 5b placeholder
          },
          inputs: [],
          usedAsInput: []
        });
      } else {
        existing.containers.generations = existing.containers.generations || [];
        existing.containers.generations.push(occ);
      }
    });
  }

  // Finalize after the gen loop so primary date / path / prompt do not
  // depend on iteration order (index.generations is newest-first).
  for (const item of byId.values()) {
    const rawList = item.containers.generations;
    if (!rawList?.length) continue;
    const byGenId = new Map();
    for (const occ of rawList) {
      if (occ?.id) byGenId.set(occ.id, occ);
    }
    const list = [...byGenId.values()];
    list.sort((a, b) => (b.sortKey || '').localeCompare(a.sortKey || ''));
    item.containers.generations = list;
    const primary = list[0];
    const fields = genFieldsById.get(primary.id);
    const row = mediaRowFieldsByOcc.get(`${item.id}\0${primary.id}`);
    item.containers.generation = {
      id: primary.id,
      batchIndex: primary.batchIndex,
      batchSize: primary.batchSize,
      batchDate: primary.batchDate,
      sortKey: primary.sortKey
    };
    item.date = primary.batchDate;
    item.thumbnailPath = primary.thumbnailPath;
    item.seed = primary.seed;
    if (fields) {
      item.prompt = fields.prompt;
      item.negativePrompt = fields.negativePrompt;
      item.params = fields.params;
      item.checkpoint = fields.checkpoint;
      item.resources = fields.resources;
      item.model = fields.model;
      if (fields.audio) item.audio = { ...fields.audio };
    }
    if (row) {
      item.duration = row.duration;
      item.type = row.type;
      item.tags = row.tags;
      item.pixelSource = row.pixelSource || 'none';
      item.width = row.width || 0;
      item.height = row.height || 0;
      if (row.mediaPath) item.mediaPath = row.mediaPath;
      if (Array.isArray(row.files)) item.files = row.files;
    } else {
      item.pixelSource = item.pixelSource || 'none';
    }
    item.aspectClass = deriveAspectClass(item.width, item.height);
    if (item.type === 'model3d') {
      item.width = 0;
      item.height = 0;
      item.pixelSource = 'none';
      item.aspectClass = '';
    }
  }

  const recipeIndex = buildGenerationRecipeIndex(generations);
  // Fields a post card already supplied. A later comic does not replace them.
  const publishedLock = new Map();

  // Pass 2: each post media item either merges into an existing generation
  // record (cross-surface dedup) or creates a new record sourced only from
  // the post side. Externally-uploaded post media will land here without a
  // generation back-reference.
  for (const post of posts) {
    if (!Array.isArray(post.media)) continue;
    post.media.forEach(m => {
      const id = normalizeMediaId(m.imageId);
      if (!id) return;
      const postRef = {
        id: post.id,
        indexInPost: m.index,
        status: post.status || 'published',
        title: post.title || '',
        thumbnailPath: m.thumbnailPath,
        // Media-page On Civitai opens this Image row. The post page keeps
        // entry.url (/posts/{id}). A joined item's page id is the blob;
        // this stays the Image id from the start of the loop.
        url: civitaiUrl('/images/' + id),
        availability: typeof post.availability === 'string' ? post.availability : null,
        // Read-time scheduled vs published is derived from this stamp
        // (never frozen). Drafts have publishedAt: null.
        publishedAt: post.publishedAt ?? null,
        // Drafts have publishedAt: null; use the derived createdAt so
        // post-only media items sort on the temporal axis, not as ''.
        sortKey: post.publishedAt || post.createdAt || ''
      };

      const postedAt = postedMatchAt(m);
      const existing = resolvePostedExisting(m, byId, recipeIndex, postedAt);
      if (existing) {
        collectPostedAlias(pendingAliases, existing, m);
        existing.containers.posts.push(postRef);
        // Carry the post's raw numeric content-tag ids onto the media item so
        // the media-item gallery can render them (resolved name or `tag-<id>`).
        if (Array.isArray(m.tagIds) && m.tagIds.length) {
          existing.contentTagIds = [...new Set([...(existing.contentTagIds || []), ...m.tagIds])];
        }
        applyMeasuredSize(existing, m);
        applyImageBrowsingLevel(existing, m.browsingLevel);
        const supplied = overlayPublishedCard(existing, m, null);
        const prior = publishedLock.get(existing) || { meta: false, workflow: false, resources: false };
        publishedLock.set(existing, {
          meta: prior.meta || supplied.meta,
          workflow: prior.workflow || supplied.workflow,
          resources: prior.resources || supplied.resources
        });
      } else {
        const fromMeta = paramsWithDesignation(paramsFromImageMeta(m.meta, m), m, m.type);
        const resolved = slotsWithImageResources(resolveCheckpoint({ meta: m.meta }), m.imageResources);
        const modelName = resolved.checkpoint?.modelName;
        byId.set(id, {
          id,
          type: m.type,
          // Temporal day, never the storage bucket (`post.date` is `'drafts'`
          // for unpublished posts). Image createdAt → post createdAt →
          // publishedAt → '' (honest undated).
          date: temporalDay(m.createdAt) || temporalDay(post.createdAt) || temporalDay(post.publishedAt),
          thumbnailPath: m.thumbnailPath,
          seed: seedFromMeta(m.meta),
          width: m.width || 0,
          height: m.height || 0,
          pixelSource: (m.width && m.height) ? 'post' : 'none',
          aspectClass: deriveAspectClass(m.width, m.height),
          duration: m.duration,
          tags: [],
          contentTagIds: Array.isArray(m.tagIds) ? [...new Set(m.tagIds)] : [],
          browsingLevel: indexBrowsingLevel(m),
          prompt: m.meta?.prompt || m.meta?.Prompt || '',
          negativePrompt: m.meta?.negativePrompt || m.meta?.['Negative prompt'] || '',
          model: (modelName && modelName !== '(unknown)') ? modelName : (m.meta?.Model || ''),
          checkpoint: resolved.checkpoint,
          resources: resolved.resources,
          params: fromMeta,
          containers: {
            generation: null,
            posts: [postRef],
            comics: []
          },
          inputs: [],
          usedAsInput: []
        });
      }
    });
  }

  // Pass 2b: each Ready comic panel either merges into an existing
  // generation/post record (Image-backed panels join the shared id-space)
  // or creates a comic-only record. Cover/hero chrome is not a media-item.
  // Generation remains authoritative when the same imageId already exists.
  for (const comic of comics) {
    if (!Array.isArray(comic.media)) continue;
    for (const m of comic.media) {
      if (m.role === 'cover' || m.role === 'hero') continue;
      const id = m.panelMediaId || (m.imageId != null ? normalizeMediaId(m.imageId) : '');
      if (!id) continue;
      const chapter = Array.isArray(comic.chapters)
        ? comic.chapters.find(ch => ch && String(ch.id) === String(m.chapterId))
        : null;
      // An Image-backed panel opens /images/{id}. A panel with no Image
      // id has no public image page; the comic page stays entry.url.
      const imagePageId = postedImageId(m);
      const comicRef = {
        id: comic.id,
        chapterId: m.chapterId,
        chapterFolder: m.chapterFolder,
        panelId: m.panelId,
        name: comic.name || '',
        thumbnailPath: m.thumbnailPath,
        url: imagePageId
          ? civitaiUrl('/images/' + imagePageId)
          : civitaiUrl('/comics/project/' + comic.id),
        availability: chapter?.availability ?? null,
        earlyAccessEndsAt: chapter?.earlyAccessEndsAt ?? null,
        // Wire ComicChapterStatus (PascalCase). Matcher classifies from
        // the enum, not leftover chapter publishedAt.
        chapterStatus: chapter?.status ?? null,
        sortKey: comic.createdAt || ''
      };

      const postedAt = postedMatchAt(m);
      const existing = resolvePostedExisting(m, byId, recipeIndex, postedAt);
      if (existing) {
        collectPostedAlias(pendingAliases, existing, m);
        existing.containers.comics = existing.containers.comics || [];
        existing.containers.comics.push(comicRef);
        applyImageBrowsingLevel(existing, m.browsingLevel);
        applyMeasuredSize(existing, m);
        overlayPublishedCard(existing, m, publishedLock.get(existing));
      } else {
        const fromMeta = paramsWithDesignation(paramsFromImageMeta(m.meta, m), m, m.type || 'image');
        const resolved = slotsWithImageResources(resolveCheckpoint({ meta: m.meta }), m.imageResources);
        const modelName = resolved.checkpoint?.modelName;
        byId.set(id, {
          id,
          type: m.type || 'image',
          date: temporalDay(comic.createdAt) || (isDate(comic.date) ? comic.date : ''),
          thumbnailPath: m.thumbnailPath,
          seed: seedFromMeta(m.meta),
          width: m.width || 0,
          height: m.height || 0,
          pixelSource: (m.width && m.height) ? 'post' : 'none',
          aspectClass: deriveAspectClass(m.width, m.height),
          duration: m.duration,
          tags: [],
          contentTagIds: [],
          browsingLevel: indexBrowsingLevel(m),
          prompt: m.meta?.prompt || m.meta?.Prompt || '',
          negativePrompt: m.meta?.negativePrompt || m.meta?.['Negative prompt'] || '',
          model: (modelName && modelName !== '(unknown)') ? modelName : (m.meta?.Model || ''),
          checkpoint: resolved.checkpoint,
          resources: resolved.resources,
          params: fromMeta,
          containers: {
            generation: null,
            posts: [],
            comics: [comicRef]
          },
          inputs: [],
          usedAsInput: []
        });
      }
    }
  }

  // Pass 3: resolve generation/post entry input refs onto produced media
  // items, insert input-only records when a local file exists, and record
  // usedAsInput edges. Refs with no local file are dropped. Same-id
  // occurrences pick the consumed job (date-bound; leftover leftover hash
  // when still on disk). Do not copy newest thumbnailPath as the consumed file.
  // A generation edge stamps workflow from that generation's params.workflow.
  // A post edge stamps ''. Do not read the output item.
  function thumbnailPathFromInputFile (id, filepath) {
    const sep = Math.max(filepath.lastIndexOf('/'), filepath.lastIndexOf('\\'));
    const base = sep === -1 ? filepath : filepath.slice(sep + 1);
    const dot = base.lastIndexOf('.');
    const ext = dot === -1 ? 'jpeg' : base.slice(dot + 1);
    return `/media/inputs/${portableFileSegment(id)}.${ext}`;
  }

  function resolveInputRef (ref, { consumerCreatedAt } = {}) {
    if (!ref?.id) return null;
    const norm = normalizeMediaId(ref.id);
    const canonical = resolveCanonicalId(['blob:' + norm]);
    const lookupId = canonical || norm;
    const existing = byId.get(lookupId);
    if (existing?.thumbnailPath) {
      const leftoverFilepath = existingInputFilepath(ref.id);
      const occ = pickConsumedOccurrence(existing, { consumerCreatedAt, leftoverFilepath });
      const visual = occ?.thumbnailPath
        ? { thumbnailPath: occ.thumbnailPath }
        : {};
      return {
        id: lookupId,
        role: ref.role,
        kind: ref.kind || 'image',
        width: Number(ref.width) || existing.width || 0,
        height: Number(ref.height) || existing.height || 0,
        ...visual,
        ...(occ?.id ? { generation: occ.id } : {}),
        ...(ref.slot != null ? { slot: ref.slot } : {})
      };
    }
    const filepath = existingInputFilepath(ref.id);
    if (!filepath) return null;
    return {
      id: ref.id,
      role: ref.role,
      kind: ref.kind || 'image',
      width: Number(ref.width) || 0,
      height: Number(ref.height) || 0,
      thumbnailPath: thumbnailPathFromInputFile(ref.id, filepath),
      ...(ref.slot != null ? { slot: ref.slot } : {})
    };
  }

  function inputTypeFromKind (kind) {
    if (kind === 'video') return 'video';
    if (kind === 'audio') return 'audio';
    return 'image';
  }

  function ensureUsedAsInput (item, edge) {
    if (!Array.isArray(item.usedAsInput)) item.usedAsInput = [];
    const dup = item.usedAsInput.some(e =>
      e.from === edge.from && e.id === edge.id && e.role === edge.role && e.slot === edge.slot
    );
    if (!dup) item.usedAsInput.push(edge);
  }

  function attachResolvedInputs (items, resolved) {
    if (!resolved.length) return;
    for (const item of items) {
      const byInputId = new Map((item.inputs || []).map(r => [r.id, r]));
      for (const r of resolved) byInputId.set(r.id, r);
      item.inputs = [...byInputId.values()];
    }
  }

  function processInputRefs (refs, { from, producerItems, attachTo, consumerCreatedAt, workflow }) {
    if (!Array.isArray(refs) || !refs.length || !producerItems.length) return [];
    const edgeWorkflow = typeof workflow === 'string' ? workflow : '';
    const resolved = [];
    for (const ref of refs) {
      const resolvedRef = resolveInputRef(ref, { consumerCreatedAt });
      if (!resolvedRef) continue;
      resolved.push(resolvedRef);

      for (const producer of producerItems) {
        const edge = { from, id: producer.id, role: ref.role, workflow: edgeWorkflow };
        if (ref.slot != null) edge.slot = ref.slot;
        if (resolvedRef.generation) edge.generation = resolvedRef.generation;

        const existing = byId.get(resolvedRef.id);
        if (existing) {
          ensureUsedAsInput(existing, edge);
          continue;
        }

        const inputOnly = {
          id: ref.id,
          type: inputTypeFromKind(resolvedRef.kind),
          date: producer.date,
          thumbnailPath: resolvedRef.thumbnailPath,
          seed: undefined,
          width: resolvedRef.width || 0,
          height: resolvedRef.height || 0,
          aspectClass: deriveAspectClass(resolvedRef.width, resolvedRef.height),
          duration: undefined,
          tags: [],
          contentTagIds: [],
          prompt: '',
          negativePrompt: '',
          model: '',
          checkpoint: null,
          resources: [],
          params: {},
          containers: {
            generation: null,
            posts: [],
            comics: []
          },
          inputs: [],
          usedAsInput: [edge]
        };
        byId.set(ref.id, inputOnly);
        applyEmbeddedMeta(inputOnly, existingInputFilepath(inputOnly.id));
      }
    }
    attachResolvedInputs(attachTo, resolved);
    return resolved;
  }

  const generationInputs = new Map();
  for (const gen of generations) {
    const children = [];
    if (Array.isArray(gen.media)) {
      for (const m of gen.media) {
        const child = byId.get(normalizeMediaId(m.mediaId));
        if (child) children.push(child);
      }
    }
    const resolved = processInputRefs(gen.inputs, {
      from: 'generation',
      producerItems: children,
      attachTo: children,
      consumerCreatedAt: gen.createdAt || '',
      workflow: typeof gen.params?.workflow === 'string' ? gen.params.workflow : ''
    });
    if (gen?.id != null && resolved.length) generationInputs.set(gen.id, resolved);
  }

  for (const post of posts) {
    if (!Array.isArray(post.media)) continue;
    for (const m of post.media) {
      const postedAt = postedMatchAt(m);
      const child = resolvePostedExisting(m, byId, recipeIndex, postedAt);
      if (!child) continue;
      processInputRefs(m.inputs, {
        from: 'post',
        producerItems: [child],
        attachTo: [child],
        consumerCreatedAt: postedAt || m.createdAt || post.createdAt || post.publishedAt || '',
        workflow: ''
      });
    }
  }

  // Reaction tokens leave `tags` (content names). The reaction record is
  // the union of every generation occurrence, then the local override.
  // A job's own tags stay on the generation entry; they are not this record.
  // Content names stay the primary occurrence's. Date, path, and prompt
  // stay newest and are already copied above.
  for (const item of byId.values()) {
    if (!Array.isArray(item.inputs)) item.inputs = [];
    if (!Array.isArray(item.usedAsInput)) item.usedAsInput = [];
    item.contentTags = namesFromTagIds(item.contentTagIds, getTagName);
    const split = splitReactionTags(item.tags);
    item.tags = split.content;
    const occs = item.containers?.generations;
    if (Array.isArray(occs) && occs.length) {
      const rows = occs.map(occ => {
        const row = mediaRowFieldsByOcc.get(`${item.id}\0${occ.id}`);
        return { sortKey: occ.sortKey || '', tags: row?.tags || [] };
      });
      item.reactions = reactionsToTags(mergeOccurrenceReactions(rows));
    } else {
      item.reactions = split.reactions;
    }
    mergeOverrideReactions(item);
  }

  // Sort newest first. Generation sortKey wins when present; otherwise the
  // earliest post container's sortKey; input-only items use the producer's.
  function mediaItemSortKey (item) {
    const genKey = item.containers?.generation?.sortKey;
    if (genKey) return genKey;
    const postKey = item.containers?.posts?.[0]?.sortKey;
    if (postKey) return postKey;
    const comicKey = item.containers?.comics?.[0]?.sortKey;
    if (comicKey) return comicKey;
    const producerId = item.usedAsInput?.[0]?.id;
    if (producerId) {
      const producer = byId.get(producerId);
      if (producer && producer !== item) {
        return producer.containers?.generation?.sortKey
          || producer.containers?.posts?.[0]?.sortKey
          || producer.containers?.comics?.[0]?.sortKey
          || producer.date
          || '';
      }
    }
    return item.date || '';
  }

  const items = [...byId.values()];
  items.sort((a, b) => mediaItemSortKey(b).localeCompare(mediaItemSortKey(a)));
  return { items, pendingAliases, generationInputs };
}

// O(1) media-item lookup prepared at project time. Keys are canonical
// (already-normalized) ids. Rebuilt whenever mediaItems is re-derived —
// never persisted.
function attachMediaById (idx) {
  const map = new Map();
  for (const mi of idx.mediaItems || []) {
    if (mi?.id != null) map.set(mi.id, mi);
  }
  idx.mediaById = map;
  return idx;
}

// One writer at a time for the NDJSON files. Re-entrant on the same store so
// a generation-removal pass can upsert and compact while it already holds
// the lock. A lock file older than five minutes is leftover from a dead
// process and is replaced.
const indexWriteSlot = new AsyncLocalStorage();
const INDEX_LOCK_STALE_MS = 5 * 60 * 1000;

async function acquireIndexLock (lockPath) {
  const slash = lockPath.lastIndexOf('/');
  if (slash !== -1) {
    await fs.promises.mkdir(lockPath.slice(0, slash), { recursive: true });
  }

  for (;;) {
    try {
      const handle = await fs.promises.open(lockPath, 'wx');
      await handle.writeFile(new Date().toISOString());
      return handle;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      let stale = false;
      try {
        const st = await fs.promises.stat(lockPath);
        stale = Date.now() - st.mtimeMs >= INDEX_LOCK_STALE_MS;
      } catch (statErr) {
        if (statErr.code === 'ENOENT') continue;
        throw statErr;
      }
      if (stale) {
        await fs.promises.unlink(lockPath).catch(unlinkErr => {
          if (unlinkErr.code !== 'ENOENT') throw unlinkErr;
        });
        continue;
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
}

// --- Factory: the single architectural seam ---
//
// `options.dataPath` may be a string OR a getter property — that lets the
// default singleton live-bind to CONFIG.dataPath without re-construction.
// Each store owns its in-memory index and on-disk NDJSON cache; multiple
// stores constructed against different `dataPath` values do not interfere.

export function createIndexStore (options) {
  function getDataPath () { return options.dataPath; }
  function indexDir () { return `${getDataPath()}/index`; }
  function genNdjsonPath () { return `${indexDir()}/generations.ndjson`; }
  function postsNdjsonPath () { return `${indexDir()}/posts.ndjson`; }
  function comicsNdjsonPath () { return `${indexDir()}/comics.ndjson`; }
  function model3dsNdjsonPath () { return `${indexDir()}/model3ds.ndjson`; }
  function statsPath () { return `${indexDir()}/stats.json`; }
  function indexLockPath () { return `${indexDir()}/write.lock`; }
  function generationsDataDir () { return `${getDataPath()}/generations`; }
  function postsDataDir () { return `${getDataPath()}/posts`; }
  function comicsDataDir () { return `${getDataPath()}/comics`; }
  function model3dsDataDir () { return `${getDataPath()}/model3ds`; }

  let index = { generations: [], posts: [], comics: [], model3ds: [], mediaItems: [], mediaById: new Map(), generationInputs: new Map(), stats: {} };
  let loaded = false;
  let loadingPromise = null;
  let appendCount = 0;
  const lockToken = {};

  async function withIndexWrite (fn) {
    if (indexWriteSlot.getStore() === lockToken) return fn();
    const handle = await acquireIndexLock(indexLockPath());
    try {
      return await indexWriteSlot.run(lockToken, fn);
    } finally {
      await handle.close();
      await fs.promises.unlink(indexLockPath()).catch(() => {});
    }
  }

  let lastPendingPostedAliases = [];

  function deriveProjectedMediaItems (generations, posts, comics) {
    const projected = projectMediaItemRecords(
      generations, posts, comics || [], getTagNameFromCache
    );
    applySidecarToMediaItems(projected.items, readSidecarSync(getDataPath()));
    applyAceAudioSidecar(projected.items, readAceAudioSidecarSync(getDataPath()));
    lastPendingPostedAliases = projected.pendingAliases;
    return projected;
  }

  async function persistPendingPostedAliases () {
    const pending = lastPendingPostedAliases;
    lastPendingPostedAliases = [];
    if (!pending.length) return;
    for (const { canonicalId, imageId } of pending) {
      if (!canonicalId || imageId == null || imageId === '') continue;
      await recordAlias(canonicalId, imageKey(imageId), { persist: false });
      await remapMediaOverride(imageId, canonicalId);
    }
    await persistAliasStore();
  }

  // --- NDJSON I/O ---

  // Append-only NDJSON: when an item is updated we append a fresh line. At
  // load time we dedupe by id, keeping the last occurrence — so the most
  // recent appended state always wins. A line `{ id, _removed: true }` drops
  // that id. A later line for the same id without `_removed` restores it.
  // compact() rewrites the file from this parse, so removal lines do not stay.
  function parseNdjson (text) {
    const byId = new Map();
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const item = JSON.parse(line);
        if (!item || typeof item !== 'object') continue;
        if (item._removed === true) {
          byId.delete(String(item.id));
          continue;
        }
        byId.set(String(item.id), item);
      } catch { /* skip malformed line */ }
    }
    return [...byId.values()];
  }

  function toNdjson (items) {
    if (!items.length) return '';
    return items.map(item => JSON.stringify(item)).join('\n') + '\n';
  }

  async function readNdjsonFile (filepath) {
    try {
      const text = await readFile(filepath);
      return parseNdjson(text);
    } catch {
      return null;
    }
  }

  async function writeNdjsonFile (filepath, items) {
    await writeFile(filepath, toNdjson(items));
  }

  async function appendNdjsonLines (filepath, items) {
    if (!items.length) return;
    const text = items.map(item => JSON.stringify(item)).join('\n') + '\n';
    await fs.promises.appendFile(filepath, text, 'utf-8');
  }

  // --- Stats ---

  function computeStats (generations, posts, mediaItems, comics = [], model3ds = []) {
    let genImages = 0;
    let genVideos = 0;
    let genAudio = 0;
    let genModel3d = 0;
    let postImages = 0;
    let postVideos = 0;
    let postAudio = 0;
    let totalFavorites = 0;
    let totalLiked = 0;
    let totalDisliked = 0;
    let genFrom = '';
    let genTo = '';
    let postFrom = '';
    let postTo = '';
    let comicFrom = '';
    let comicTo = '';
    let comicChapters = 0;
    let comicPanels = 0;

    for (const g of generations) {
      for (const m of g.media) {
        if (m.type === 'video') genVideos++;
        else if (m.type === 'audio') genAudio++;
        else if (m.type === 'model3d') genModel3d++;
        else genImages++;
      }
      if (g.date && (!genFrom || g.date < genFrom)) genFrom = g.date;
      if (g.date && (!genTo || g.date > genTo)) genTo = g.date;
    }

    if (Array.isArray(mediaItems)) {
      for (const mi of mediaItems) {
        if (!isProduced(mi)) continue;
        const reactions = Array.isArray(mi.reactions) ? mi.reactions : [];
        if (reactions.includes('favorite')) totalFavorites++;
        if (reactions.includes('feedback:liked')) totalLiked++;
        if (reactions.includes('feedback:disliked')) totalDisliked++;
      }
    }

    for (const p of posts) {
      for (const m of p.media) {
        if (m.type === 'video') postVideos++;
        else if (m.type === 'audio') postAudio++;
        else postImages++;
      }
      if (p.date && isDate(p.date) && (!postFrom || p.date < postFrom)) postFrom = p.date;
      if (p.date && isDate(p.date) && (!postTo || p.date > postTo)) postTo = p.date;
    }

    for (const c of comics) {
      comicChapters += Array.isArray(c.chapters) ? c.chapters.length : 0;
      if (Array.isArray(c.media)) {
        comicPanels += c.media.filter(m => m.role !== 'cover' && m.role !== 'hero').length;
      }
      if (c.date && isDate(c.date) && (!comicFrom || c.date < comicFrom)) comicFrom = c.date;
      if (c.date && isDate(c.date) && (!comicTo || c.date > comicTo)) comicTo = c.date;
    }

    return {
      _version: INDEX_VERSION,
      totalGenerations: generations.length,
      totalPosts: posts.length,
      totalComics: comics.length,
      totalModel3ds: (Array.isArray(model3ds) ? model3ds : []).filter(row => {
        const status = row && row.status;
        return status !== 'deleted' && status !== 'Deleted';
      }).length,
      totalMediaItems: Array.isArray(mediaItems) ? mediaItems.filter(isProduced).length : 0,
      totalImages: genImages + postImages,
      totalVideos: genVideos + postVideos,
      totalAudio: genAudio + postAudio,
      totalModel3d: genModel3d,
      genImages,
      genVideos,
      genAudio,
      genModel3d,
      postImages,
      postVideos,
      postAudio,
      comicChapters,
      comicPanels,
      comicFrom,
      comicTo,
      totalFavorites,
      totalLiked,
      totalDisliked,
      generationDateRange: { from: genFrom, to: genTo },
      postDateRange: { from: postFrom, to: postTo },
      dateRange: {
        from: earliest(genFrom, earliest(postFrom, comicFrom)),
        to: latest(genTo, latest(postTo, comicTo))
      }
    };
  }

  async function writeStats (stats) {
    await writeFile(statsPath(), JSON.stringify(stats, null, 2));
  }

  // --- Sorting ---

  // In-memory arrays are kept sorted with newest first.
  function genSortKey (entry) { return entry.createdAt || ''; }
  function postSortKey (entry) { return entry.publishedAt || ''; }
  function comicSortKey (entry) { return entry.createdAt || ''; }
  function model3dSortKey (entry) { return entry.createdAt || ''; }

  function sortGenerationsDesc (items) {
    items.sort((a, b) => genSortKey(b).localeCompare(genSortKey(a)));
  }

  function sortPostsDesc (items) {
    items.sort((a, b) => postSortKey(b).localeCompare(postSortKey(a)));
  }

  function sortComicsDesc (items) {
    items.sort((a, b) => comicSortKey(b).localeCompare(comicSortKey(a)));
  }

  function sortModel3dsDesc (items) {
    items.sort((a, b) => model3dSortKey(b).localeCompare(model3dSortKey(a)));
  }

  // Insert `entry` into the descending-sorted `arr` at the correct position
  // using binary search. Caller is responsible for removing any existing
  // entry with the same id first.
  function insertSortedDesc (arr, entry, getKey) {
    const key = getKey(entry);
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (getKey(arr[mid]).localeCompare(key) > 0) lo = mid + 1;
      else hi = mid;
    }
    arr.splice(lo, 0, entry);
  }

  // Replace existing entry with same id (if present) and insert in sorted
  // position.
  function upsertEntry (arr, entry, getKey) {
    const idStr = String(entry.id);
    const existingIdx = arr.findIndex(e => String(e.id) === idStr);
    if (existingIdx !== -1) {
      arr.splice(existingIdx, 1);
    }
    insertSortedDesc(arr, entry, getKey);
  }

  // --- Cold path: load or full-build ---

  async function loadFromCache () {
    const statsText = await readFile(statsPath()).catch(() => null);
    if (!statsText) return null;

    let stats;
    try { stats = JSON.parse(statsText); } catch { return null; }
    const cacheVersion = stats._version;
    if (typeof cacheVersion !== 'number' || cacheVersion < REUSABLE_ENTRY_VERSION) return null;

    const generations = await readNdjsonFile(genNdjsonPath());
    if (!generations) return null;

    const posts = await readNdjsonFile(postsNdjsonPath());
    if (!posts) return null;

    let comics = await readNdjsonFile(comicsNdjsonPath());
    let comicsMissing = false;
    if (!comics) {
      // Missing comics.ndjson does not invalidate gens/posts. Scan the
      // comics tree only (empty corpus → []).
      comics = await scanComics();
      comicsMissing = true;
    }

    let model3ds = await readNdjsonFile(model3dsNdjsonPath());
    let model3dsMissing = false;
    if (!model3ds) {
      model3ds = await scanModel3ds();
      model3dsMissing = true;
    }

    // Cache files may contain superseded lines from a previous session that
    // exited before compact() ran. parseNdjson dedupes; sort once for
    // hot-path correctness.
    sortGenerationsDesc(generations);
    sortPostsDesc(posts);
    sortComicsDesc(comics);
    sortModel3dsDesc(model3ds);

    // Phase 3: re-resolve each post entry's content-tag names from its
    // persisted media `tagIds` + post-level tags against the (now-loaded)
    // tag-name cache. This keeps `contentTags` fresh relative to the cache
    // across restarts without persisting it — the numeric tagIds are the
    // durable source; the names are derived. Cache loaded by ensureLoaded()
    // before this runs.
    for (const p of posts) p.contentTags = resolvePostContentTags(p);

    // Phase 1a: derive the media-items projection on every load. Cheap
    // (O(N+M)) and avoids the cache-invalidation surface that a persisted
    // mediaItems.ndjson would introduce. File-header sidecar fills holes.
    const projected = deriveProjectedMediaItems(generations, posts, comics);
    const mediaItems = projected.items;
    await persistPendingPostedAliases();

    // Stats may pre-date the totalMediaItems / totalAudio fields; recompute
    // so the in-memory numbers reflect the current schema even when the
    // on-disk stats.json was written by an older code path.
    const refreshedStats = computeStats(generations, posts, mediaItems, comics, model3ds);

    if (cacheVersion !== INDEX_VERSION || comicsMissing || model3dsMissing) {
      if (comicsMissing) await writeNdjsonFile(comicsNdjsonPath(), comics);
      if (model3dsMissing) await writeNdjsonFile(model3dsNdjsonPath(), model3ds);
      await writeStats(refreshedStats);
    }

    return attachMediaById({
      generations,
      posts,
      comics,
      model3ds,
      mediaItems,
      generationInputs: projected.generationInputs,
      stats: refreshedStats
    });
  }

  async function fullRebuild () {
    const generations = await scanGenerations();
    const posts = await scanPosts();
    const comics = await scanComics();
    const model3ds = await scanModel3ds();
    const projected = deriveProjectedMediaItems(generations, posts, comics);
    const mediaItems = projected.items;
    await persistPendingPostedAliases();
    const stats = computeStats(generations, posts, mediaItems, comics, model3ds);

    await writeNdjsonFile(genNdjsonPath(), generations);
    await writeNdjsonFile(postsNdjsonPath(), posts);
    await writeNdjsonFile(comicsNdjsonPath(), comics);
    await writeNdjsonFile(model3dsNdjsonPath(), model3ds);
    await writeStats(stats);
    appendCount = 0;

    return attachMediaById({
      generations,
      posts,
      comics,
      model3ds,
      mediaItems,
      generationInputs: projected.generationInputs,
      stats
    });
  }

  // --- Full scan helpers (used by fullRebuild) ---

  async function scanGenerations () {
    const items = [];
    const dataDir = generationsDataDir();
    const dates = (await listDirectory(dataDir)).filter(isDate);

    for (const date of dates) {
      const files = await listDirectory(`${dataDir}/${date}`);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await readFile(`${dataDir}/${date}/${file}`);
          const gen = JSON.parse(raw);
          const entry = buildGenerationEntry(gen, date);
          if (entry) items.push(entry);
        } catch { /* skip unparseable */ }
      }
    }

    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return items;
  }

  async function scanPosts () {
    const items = [];
    const dataDir = postsDataDir();
    // 'drafts' is the dateless bucket for posts with no publishedAt (see posts.mjs POST_DRAFTS_DIR).
    const dates = (await listDirectory(dataDir)).filter(d => isDate(d) || d === 'drafts');

    for (const date of dates) {
      const files = await listDirectory(`${dataDir}/${date}`);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await readFile(`${dataDir}/${date}/${file}`);
          const post = JSON.parse(raw);
          const entry = buildPostEntry(post, date);
          if (entry) items.push(entry);
        } catch { /* skip unparseable */ }
      }
    }

    items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    return items;
  }

  async function scanComics () {
    const items = [];
    const dataDir = comicsDataDir();
    // Date dirs only — comics have no drafts/ bucket (createdAt storage key).
    const dates = (await listDirectory(dataDir)).filter(isDate);

    for (const date of dates) {
      const files = await listDirectory(`${dataDir}/${date}`);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await readFile(`${dataDir}/${date}/${file}`);
          const comic = JSON.parse(raw);
          const entry = buildComicEntry(comic, date);
          if (entry) items.push(entry);
        } catch { /* skip unparseable */ }
      }
    }

    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return items;
  }

  async function scanModel3ds () {
    const items = [];
    const dataDir = model3dsDataDir();
    const dates = (await listDirectory(dataDir)).filter(isDate);

    for (const date of dates) {
      const files = await listDirectory(`${dataDir}/${date}`);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await readFile(`${dataDir}/${date}/${file}`);
          const model = JSON.parse(raw);
          const entry = buildModel3dEntry(model, date);
          if (entry) items.push(entry);
        } catch { /* skip unparseable */ }
      }
    }

    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return items;
  }

  // --- Public store methods ---

  // Idempotent: loads the cache once, or does a full rebuild if no cache.
  // All hot-path callers go through this so they never block on duplicate
  // scans within a single process. Concurrent first-time callers share a
  // single in-flight promise so duplicate fullRebuild()s cannot race the
  // NDJSON + stats.json writes. On rejection the memo clears so a
  // transient EACCES / EBUSY blip does not permanently brick the store.
  async function ensureLoaded () {
    if (loaded) return index;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      await adoptLegacyInputNames();
      // Load the reaction overrides before any entry is built so
      // buildGenerationEntry (via getEffectiveMediaInfo) merges them. On the
      // cache-hit path the entries' tags were already baked in at their last
      // upsert/rebuild, but loading the map here keeps the in-memory override
      // cache populated for the reaction-edit (PATCH) path.
      await loadOverrides();
      await loadAliasStore();
      // Phase 3: load the tag-name cache before building entries so
      // buildPostEntry / buildMediaItems resolve image tagIds → content-tag
      // names. An empty/absent cache is fine — names just stay unresolved.
      await ensureTagCacheLoaded();
      const cached = await loadFromCache();
      if (cached) {
        index = cached;
      } else {
        index = await fullRebuild();
      }
      loaded = true;
      return index;
    })().catch((err) => {
      loadingPromise = null;
      throw err;
    });

    return loadingPromise;
  }

  // Self-heal entry point. Discards the in-memory state and re-derives
  // every entry from the on-disk JSON, rewriting the NDJSON cache.
  // Use sparingly: the hot path is upsert().
  async function rebuild () {
    await adoptLegacyInputNames();
    // Mirror ensureLoaded(): overrides + tag-name cache must be loaded
    // before fullRebuild() derives entries via getEffectiveMediaInfo /
    // resolvePostContentTags.
    await loadOverrides();
    await loadAliasStore();
    await ensureTagCacheLoaded();
    index = await fullRebuild();
    loaded = true;
    // Settings rebuild still converges leftover inputs/ joins. Explorer
    // listen must not await this — startServer queues it after bind.
    await backfillContentHashes({
      generations: index.generations,
      posts: index.posts,
      comics: index.comics || [],
      force: true
    });
    await backfillAspectFileDims({
      mediaItems: index.mediaItems,
      dataPath: getDataPath(),
      mediaPath: CONFIG?.mediaPath
    });
    const { getAvailableSecretKey } = await import('./keyActions.mjs');
    await backfillAceAudio({
      mediaItems: index.mediaItems,
      secretKey: getAvailableSecretKey()
    });
    projectMediaItems();
    await persistPendingPostedAliases();
    return index;
  }

  function projectMediaItems () {
    const projected = deriveProjectedMediaItems(
      index.generations, index.posts, index.comics || []
    );
    index.mediaItems = projected.items;
    index.generationInputs = projected.generationInputs;
    attachMediaById(index);
    index.stats = computeStats(
      index.generations,
      index.posts,
      index.mediaItems,
      index.comics || [],
      index.model3ds || []
    );
    // Upsert keeps this index object. Drop the offer cache or a download
    // would keep the previous menu until restart.
    listOfferCache.delete(index);
    bumpOriginListCache();
  }

  // Rebuild the derived media-items projection + stats without a gen/post
  // upsert (leaf 3 PATCH on input-only items). Same path as tag reproject.
  function reprojectMediaItems () {
    if (!loaded) return;
    projectMediaItems();
  }

  // Phase 3: re-resolve content-tag names after the tag-name cache has been
  // filled (e.g. by the after-download hook). The numeric tagIds already
  // live on the post entries, so this is a pure in-memory re-projection — no
  // disk re-read of the immutable JSON. Refreshes each post entry's
  // `contentTags`, rebuilds the mediaItems projection, and recomputes stats.
  function reprojectTagNames () {
    if (!loaded) return;
    for (const p of index.posts) p.contentTags = resolvePostContentTags(p);
    projectMediaItems();
  }

  // Single mutation primitive. Download saves and reaction edits pass the raw
  // JSON just written to disk. A generation already in the cache whose
  // builder returns null is removed with one `{ id, _removed: true }` line.
  // A generation that was never indexed is not appended. Posts and comics
  // still skip a null build. Appends, then recomputes the media-item
  // projection and stats. Safe to call with empty arrays.
  async function upsert ({ generations = [], posts = [], comics = [], model3ds = [] } = {}) {
    if (!generations.length && !posts.length && !comics.length && !model3ds.length) return;
    return withIndexWrite(() => upsertUnlocked({ generations, posts, comics, model3ds }));
  }

  async function upsertUnlocked ({ generations = [], posts = [], comics = [], model3ds = [] } = {}) {
    await ensureLoaded();

    const newGenEntries = [];
    const removedGens = [];
    for (const gen of generations) {
      const date = toDateString(gen.createdAt);
      const entry = buildGenerationEntry(gen, date);
      if (!entry) {
        const idStr = String(gen.id);
        const existingIdx = index.generations.findIndex(e => String(e.id) === idStr);
        if (existingIdx !== -1) {
          index.generations.splice(existingIdx, 1);
          removedGens.push({ id: gen.id, _removed: true });
        }
        continue;
      }
      upsertEntry(index.generations, entry, genSortKey);
      newGenEntries.push(entry);
    }

    const newPostEntries = [];
    for (const post of posts) {
      // Match posts.mjs postDateDir: published/scheduled under publishedAt date,
      // drafts in the dateless 'drafts' bucket (stable id-keyed paths; the
      // temporal createdAt is derived at index-build, not used as a storage key).
      const date = post.publishedAt ? toDateString(post.publishedAt) : 'drafts';
      const entry = buildPostEntry(post, date);
      if (!entry) continue;
      upsertEntry(index.posts, entry, postSortKey);
      newPostEntries.push(entry);
    }

    const newComicEntries = [];
    if (!Array.isArray(index.comics)) index.comics = [];
    for (const comic of comics) {
      if (!comic?.createdAt) continue;
      const date = toDateString(comic.createdAt);
      if (!date || !isDate(date)) continue;
      const entry = buildComicEntry(comic, date);
      if (!entry) continue;
      upsertEntry(index.comics, entry, comicSortKey);
      newComicEntries.push(entry);
    }

    const newModel3dEntries = [];
    if (!Array.isArray(index.model3ds)) index.model3ds = [];
    for (const model of model3ds) {
      if (!model?.createdAt) continue;
      const date = toDateString(model.createdAt);
      if (!date || !isDate(date)) continue;
      const entry = buildModel3dEntry(model, date);
      if (!entry) continue;
      upsertEntry(index.model3ds, entry, model3dSortKey);
      newModel3dEntries.push(entry);
    }

    if (!newGenEntries.length && !removedGens.length && !newPostEntries.length && !newComicEntries.length && !newModel3dEntries.length) return;

    if (newGenEntries.length) {
      await appendNdjsonLines(genNdjsonPath(), newGenEntries);
      appendCount += newGenEntries.length;
    }

    if (removedGens.length) {
      await appendNdjsonLines(genNdjsonPath(), removedGens);
      appendCount += removedGens.length;
    }

    if (newPostEntries.length) {
      await appendNdjsonLines(postsNdjsonPath(), newPostEntries);
      appendCount += newPostEntries.length;
    }

    if (newComicEntries.length) {
      await appendNdjsonLines(comicsNdjsonPath(), newComicEntries);
      appendCount += newComicEntries.length;
    }

    if (newModel3dEntries.length) {
      await appendNdjsonLines(model3dsNdjsonPath(), newModel3dEntries);
      appendCount += newModel3dEntries.length;
    }

    // Rebuild the derived media-items projection in lockstep with the
    // source-of-truth arrays. Cheap; not persisted.
    projectMediaItems();
    await persistPendingPostedAliases();
    await writeStats(index.stats);
  }

  // Rewrites NDJSON from the files on disk (last line wins, removal lines
  // omitted). Does not write this process's memory back, so a removal
  // another process already compacted stays gone. No-op when this store
  // has not appended.
  async function compact () {
    if (!loaded || appendCount === 0) return;
    return withIndexWrite(async () => {
      if (!loaded || appendCount === 0) return;
      await rewriteNdjsonFromDisk(genNdjsonPath());
      await rewriteNdjsonFromDisk(postsNdjsonPath());
      await rewriteNdjsonFromDisk(comicsNdjsonPath());
      await rewriteNdjsonFromDisk(model3dsNdjsonPath());
      appendCount = 0;
    });
  }

  async function rewriteNdjsonFromDisk (filepath) {
    const items = await readNdjsonFile(filepath);
    if (!items) return;
    await writeNdjsonFile(filepath, items);
  }

  // Sync deleted: project generations that have a hidden output. Skip a
  // batch the cache already matches. Then compact so the file has no
  // removal lines left. The generation walk stays outside this lock.
  async function applyGenerationRemovals (rawGenerations = []) {
    if (!rawGenerations.length) return;
    return withIndexWrite(async () => {
      await ensureLoaded();
      const changed = [];
      for (const gen of rawGenerations) {
        if (!gen || gen.id == null) continue;
        const date = toDateString(gen.createdAt);
        const entry = buildGenerationEntry(gen, date);
        const idStr = String(gen.id);
        const cached = index.generations.find(candidate => String(candidate.id) === idStr);
        if (!entry && !cached) continue;
        if (entry && cached && JSON.stringify(entry) === JSON.stringify(cached)) continue;
        changed.push(gen);
      }
      if (!changed.length) return;
      await upsert({ generations: changed });
      if (appendCount > 0) await compact();
    });
  }

  // Resolve a media-item record (with its `containers` back-references) by
  // id. Accepts a raw or already-normalized id — normalized internally so the
  // reaction API can pass the lightbox's raw `mediaId` or Phase 3's
  // normalized `select` id interchangeably. Uses the project-time
  // `index.mediaById` Map (O(1)); falls back to an array scan only when
  // the Map is absent. Returns the record or undefined.
  function getMediaItemById (id) {
    const norm = normalizeMediaId(id);
    const map = index.mediaById;
    if (map) {
      if (map.has(norm)) return map.get(norm);
      const aliased = resolveCanonicalId(['image:' + norm, 'blob:' + norm]);
      if (aliased) return map.get(aliased);
      return;
    }
    const found = (index.mediaItems || []).find(mi => mi.id === norm);
    if (found) return found;
    const aliased = resolveCanonicalId(['image:' + norm, 'blob:' + norm]);
    if (aliased) return (index.mediaItems || []).find(mi => mi.id === aliased);
  }

  return {
    getIndex: () => index,
    ensureLoaded,
    upsert,
    compact,
    applyGenerationRemovals,
    rebuild,
    reprojectTagNames,
    reprojectMediaItems,
    getMediaItemById
  };
}

// --- Default singleton: lazy, live-bound to CONFIG.dataPath ---

let _defaultStore = null;

function defaultStore () {
  if (!_defaultStore) {
    _defaultStore = createIndexStore({
      get dataPath () { return CONFIG.dataPath; }
    });
  }
  return _defaultStore;
}

// --- Index-level helpers ---

/**
 * Collect the set of unique Civitai model-version IDs referenced anywhere
 * in the loaded index — across generation resources (the primary
 * checkpoint plus every additional resource), and post-image
 * `meta.civitaiResources[]` entries. The model-version cache uses this
 * to discover what to fetch from `/api/v1/model-versions/<id>` after a
 * download.
 *
 * Returns numeric IDs only (Civitai-hosted resources). Non-numeric IDs
 * (e.g. external HuggingFace paths) are filtered out — they are not
 * resolvable via the Civitai REST endpoint.
 *
 * @param {object} [index] — defaults to the singleton index
 * @returns {number[]}
 */
/**
 * Collect the set of unique numeric content-tag ids referenced by post
 * images anywhere in the loaded index. The tag-name cache uses this after a
 * download to learn which ids still need resolving via `tag.getById`.
 *
 * @param {object} [index] — defaults to the singleton index
 * @returns {number[]}
 */
export function collectTagIdsFromIndex (index = getIndex()) {
  const ids = new Set();
  for (const post of index.posts || []) {
    for (const m of post.media || []) {
      for (const id of m.tagIds || []) {
        if (typeof id === 'number' && Number.isFinite(id)) ids.add(id);
      }
    }
  }
  return [...ids];
}

export function collectVersionIdsFromIndex (index = getIndex()) {
  const ids = new Set();
  const consider = v => {
    if (typeof v === 'number' && Number.isFinite(v)) ids.add(v);
  };

  for (const gen of index.generations || []) {
    consider(gen.checkpoint?.versionId);
    for (const r of gen.resources || []) consider(r.versionId);
  }

  for (const post of index.posts || []) {
    for (const m of post.media || []) {
      const civitaiResources = m.meta?.civitaiResources;
      if (Array.isArray(civitaiResources)) {
        for (const r of civitaiResources) {
          consider(r?.modelVersionId);
        }
      }
      if (Array.isArray(m.imageResources)) {
        for (const r of m.imageResources) {
          consider(r?.modelVersionId);
        }
      }
    }
  }

  // Belt-and-suspenders: video-inferred and post-only checkpoints also live
  // on the derived mediaItems projection (same ids as above when the index
  // is consistent; covers a projection that was rebuilt after inference).
  for (const mi of index.mediaItems || []) {
    if (!isProduced(mi)) continue;
    consider(mi.checkpoint?.versionId);
    for (const r of mi.resources || []) consider(r.versionId);
  }

  return [...ids];
}

// --- Corpus-derived facet values ---
//
// The Explorer offers a filter value only when at least one local media item
// matches it. Schema enums (`ModelType`, media `type`, `aspect`) remain the
// URL-token alphabet and the canonical display order; this helper is what
// the UI actually lists. When `index.mediaItems` is populated, "present"
// means the value appears on that projection (each record is already a
// downloaded media item). Otherwise a generation/post entry contributes
// only when `entry.media.length > 0`. Computed per request (no
// INDEX_VERSION bump). See explorer-url-protocol.md → Grammar vs. offered
// options.

function facetValueLabel (axis, value) {
  if (axis === 'ecosystems') return getEcosystemDisplayName(value) || value;
  if (axis === 'resourceTypes') return modelTypeLabel(value) || value;
  if (axis === 'workflows') return getWorkflowDisplayLabel(value) || value;
  return value;
}

function sortFacetValues (map) {
  return [...map.values()].sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
}

function bumpFacet (map, axis, value) {
  if (!value) return;
  const e = map.get(value) || { value, label: facetValueLabel(axis, value), count: 0 };
  if (axis === 'workflows' && e.category === undefined) {
    const rec = getWorkflowVocab(value);
    if (rec?.category) e.category = rec.category;
  }
  e.count++;
  map.set(value, e);
}

function originWalkScope ({ postBacked, comicBacked, generationBacked } = {}) {
  if (postBacked) return 'post';
  if (comicBacked) return 'comic';
  if (generationBacked) return 'generation';
  return null;
}

function skipOriginItem (mi, scope) {
  if (scope === 'post') return !isPostBacked(mi);
  if (scope === 'comic') return !isComicBacked(mi);
  if (scope === 'generation') return !isGenerationBacked(mi);
  return false;
}

/**
 * Distinct facet values present in the local corpus, for FacetBar option
 * lists. When `index.mediaItems` is populated, the walk is over that
 * projection (each record is already a downloaded media item, including
 * post-only and video-inferred identity). Otherwise it falls back to
 * generations (all axes) + posts (`types` / `aspects`), skipping entries
 * with no downloaded media — the path the facet-values unit test drives.
 * `postBacked` / `comicBacked` / `generationBacked` are mutually exclusive
 * (post, then comic, then generation). An empty scoped walk returns empty
 * values — it does not fall through to the unscoped posts contribution.
 *
 * @param {object} index — the loaded index ({ generations, posts, mediaItems, … }).
 * @param {(versionId:number|string)=>object|null} [getModelVersion]
 * @param {{ generationBacked?: boolean, postBacked?: boolean, comicBacked?: boolean }} [opts]
 * @returns {{ types: object[], aspects: object[], resourceTypes: object[], reactionTags: object[], ecosystems: object[], models: object[], versions: object[], resources: object[], workflows: object[] }}
 *   each a `{ value, label, count, category? }[]` sorted by count desc then label.
 */
export function computeFacetValues (index, getModelVersion = () => null, { generationBacked, postBacked, comicBacked } = {}) {
  const axes = {
    types: new Map(),
    aspects: new Map(),
    resourceTypes: new Map(),
    reactionTags: new Map(),
    ecosystems: new Map(),
    models: new Map(),
    versions: new Map(),
    resources: new Map(),
    workflows: new Map()
  };

  const contribute = (entry, pairs) => {
    for (const [axis, values] of pairs) {
      for (const v of values) bumpFacet(axes[axis], axis, v);
    }
  };

  const allAxisPairs = (entry) => [
    ['types', itemTypes(entry)],
    ['aspects', itemAspects(entry)],
    ['resourceTypes', itemResourceTypes(entry, getModelVersion)],
    ['reactionTags', itemReactionTags(entry)],
    ['ecosystems', itemEcosystems(entry, getModelVersion)],
    ['models', itemModels(entry, getModelVersion)],
    ['versions', itemVersions(entry, getModelVersion)],
    ['resources', itemResources(entry, getModelVersion)],
    ['workflows', itemWorkflows(entry)]
  ];

  const mediaItems = index.mediaItems;
  const scope = originWalkScope({ postBacked, comicBacked, generationBacked });
  if (Array.isArray(mediaItems) && mediaItems.length) {
    for (const mi of mediaItems) {
      if (!isProduced(mi)) continue;
      if (skipOriginItem(mi, scope)) continue;
      contribute(mi, allAxisPairs(mediaItemToFilterable(mi)));
    }
  } else if (scope === 'post' || scope === 'comic') {
    // Empty scoped walk — do not fall through to the leftover-projection
    // posts contribution used when mediaItems is missing.
  } else {
    for (const g of index.generations || []) {
      if (!g.media?.length) continue;
      contribute(g, allAxisPairs(g));
    }

    if (scope !== 'generation') {
      for (const p of index.posts || []) {
        if (!p.media?.length) continue;
        contribute(p, [
          ['types', itemTypes(p)],
          ['aspects', itemAspects(p)]
        ]);
      }
    }
  }

  return {
    types: sortFacetValues(axes.types),
    aspects: sortFacetValues(axes.aspects),
    resourceTypes: sortFacetValues(axes.resourceTypes),
    reactionTags: sortFacetValues(axes.reactionTags),
    ecosystems: sortFacetValues(axes.ecosystems),
    models: sortFacetValues(axes.models),
    versions: sortFacetValues(axes.versions),
    resources: sortFacetValues(axes.resources),
    workflows: sortFacetValues(axes.workflows)
  };
}

/**
 * Two-level Aspect Ratio tree for the FacetBar picker. Always emits the
 * three orientation parents (even at count 0). Ratio children only when
 * present in produced media items. `hint` is the dominant `width×height`
 * in that token (count desc, then smaller pixel area).
 */
export function computeAspectTree (index, { generationBacked, postBacked, comicBacked } = {}) {
  const buckets = new Map();
  for (const key of ASPECT_CLASSES) {
    buckets.set(key, { count: 0, ratios: new Map() });
  }

  const scope = originWalkScope({ postBacked, comicBacked, generationBacked });
  for (const mi of index.mediaItems || []) {
    if (!isProduced(mi)) continue;
    if (skipOriginItem(mi, scope)) continue;
    const cls = mi.aspectClass;
    if (!buckets.has(cls)) continue;
    const bucket = buckets.get(cls);
    bucket.count++;
    const token = namedAspectToken(mi.width, mi.height);
    if (!token) continue;
    let ratio = bucket.ratios.get(token);
    if (!ratio) {
      ratio = { count: 0, sizes: new Map() };
      bucket.ratios.set(token, ratio);
    }
    ratio.count++;
    const w = Number(mi.width) || 0;
    const h = Number(mi.height) || 0;
    if (w && h) {
      const sizeKey = `${w}\u00D7${h}`;
      const prev = ratio.sizes.get(sizeKey) || { count: 0, area: w * h };
      prev.count++;
      ratio.sizes.set(sizeKey, prev);
    }
  }

  function dominantHint (sizes) {
    let best = null;
    for (const [label, info] of sizes) {
      if (
        !best ||
        info.count > best.count ||
        (info.count === best.count && info.area < best.area)
      ) {
        best = { label, count: info.count, area: info.area };
      }
    }
    return best ? best.label : '';
  }

  return {
    classes: ASPECT_CLASSES.map(key => {
      const bucket = buckets.get(key);
      const ratios = [...bucket.ratios.entries()]
        .filter(([, info]) => info.count > 0)
        .sort((a, b) => b[1].count - a[1].count || String(a[0]).localeCompare(String(b[0])))
        .map(([value, info]) => ({
          value,
          label: value,
          hint: dominantHint(info.sizes),
          count: info.count
        }));
      return {
        key,
        label: ASPECT_CLASS_LABELS[key],
        count: bucket.count,
        ratios
      };
    })
  };
}

const TYPE_WORKFLOW_LABELS = Object.freeze({
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  model3d: '3D'
});

function byCountThenLabel (a, b) {
  return b.count - a.count || String(a.label).localeCompare(String(b.label));
}

function typeTreeLeafEquivalents (tree) {
  let n = 0;
  for (const type of tree.types || []) {
    for (const child of type.children || []) {
      n += child.kind === 'mode' ? (child.children || []).length : 1;
    }
  }
  return n;
}

/**
 * Gallery type → mode abbreviation → workflow identifier.
 * Same origin guards as `computeAspectTree`. A missing or non-string
 * `params.workflow` is empty and does not throw. The type root is `mi.type`.
 * One identifier under an abbreviation is a `workflow` row. Two or more are
 * a `mode` row keyed by the abbreviation. Unknown (`none:<type>`) is the
 * remainder beside those rows. A leaf is offered only when the workflow
 * category equals `mi.type`.
 *
 * @param {object} index
 * @param {{ generationBacked?: boolean, postBacked?: boolean, comicBacked?: boolean }} [opts]
 * @returns {{ types: object[] }}
 */
export function computeTypeWorkflowTree (index, { generationBacked, postBacked, comicBacked } = {}) {
  const scope = originWalkScope({ postBacked, comicBacked, generationBacked });
  const buckets = new Map();
  for (const type of OFFER_TYPE_ORDER) {
    buckets.set(type, { count: 0, remainder: 0, modes: new Map() });
  }

  for (const mi of index?.mediaItems || []) {
    if (!isProduced(mi)) continue;
    if (skipOriginItem(mi, scope)) continue;
    const type = mi.type;
    if (!buckets.has(type)) continue;
    const bucket = buckets.get(type);
    bucket.count++;
    const raw = mi.params && typeof mi.params.workflow === 'string' ? mi.params.workflow : '';
    const family = parseWorkflowFamily(raw);
    const leafHere = family.offered && family.abbreviation && family.category === type;
    if (leafHere) {
      let ids = bucket.modes.get(family.abbreviation);
      if (!ids) {
        ids = new Map();
        bucket.modes.set(family.abbreviation, ids);
      }
      ids.set(raw, (ids.get(raw) || 0) + 1);
    } else {
      bucket.remainder++;
    }
  }

  const types = [];
  for (const type of OFFER_TYPE_ORDER) {
    const bucket = buckets.get(type);
    if (!bucket.count) continue;
    const children = [];
    for (const [abbrev, ids] of bucket.modes) {
      const rows = [];
      let modeCount = 0;
      for (const [id, count] of ids) {
        modeCount += count;
        const label = getWorkflowDisplayLabel(id);
        if (!label) continue;
        rows.push({ key: id, kind: 'workflow', label, count });
      }
      if (!rows.length) continue;
      rows.sort(byCountThenLabel);
      if (rows.length === 1) {
        children.push(rows[0]);
        continue;
      }
      const title = getWorkflowAbbreviationExpansion(rows[0].key);
      const mode = {
        key: abbrev,
        kind: 'mode',
        label: abbrev,
        count: modeCount,
        children: rows
      };
      if (title) mode.title = title;
      children.push(mode);
    }
    if (bucket.remainder > 0) {
      children.push({
        key: remainderTokenFor(type),
        kind: 'remainder',
        label: 'Unknown',
        count: bucket.remainder
      });
    }
    children.sort(byCountThenLabel);
    types.push({
      key: type,
      kind: 'type',
      label: TYPE_WORKFLOW_LABELS[type],
      count: bucket.count,
      children
    });
  }
  return { types };
}

/**
 * Inclusive [min, max] YYYY-MM-DD bounds over media-present entries.
 * When walking media items, unions every generation-occurrence day
 * (not only the newest `itemDate`). Sibling to `computeFacetValues`;
 * same media-present / `isProduced` guard. Empty corpus →
 * `{ min: null, max: null }`. Prefers `index.mediaItems`; falls back
 * to generations + posts (unchanged: those use `itemDate`).
 *
 * @param {object} index
 * @param {{ generationBacked?: boolean, postBacked?: boolean, comicBacked?: boolean, dateSource?: string }} [opts]
 * @returns {{ min: string|null, max: string|null }}
 */
export function computeDateBounds (index, { generationBacked, postBacked, comicBacked, dateSource } = {}) {
  let min = null;
  let max = null;
  const considerDay = (raw) => {
    const d = String(raw || '').slice(0, 10);
    if (!d) return;
    if (min == null || d < min) min = d;
    if (max == null || d > max) max = d;
  };
  const consider = (entry) => {
    considerDay(itemDate(entry));
  };

  const scope = originWalkScope({ postBacked, comicBacked, generationBacked });
  if (dateSource === 'container') {
    if (scope === 'post') {
      for (const p of index.posts || []) {
        if (!p.media?.length) continue;
        consider(p);
      }
    } else if (scope === 'comic') {
      for (const c of index.comics || []) {
        if (!c.media?.length) continue;
        consider(c);
      }
    } else if (scope === 'generation') {
      for (const g of index.generations || []) {
        if (!g.media?.length) continue;
        consider(g);
      }
    }
    return { min, max };
  }

  const mediaItems = index.mediaItems;
  if (Array.isArray(mediaItems) && mediaItems.length) {
    for (const mi of mediaItems) {
      if (!isProduced(mi)) continue;
      if (skipOriginItem(mi, scope)) continue;
      const filterable = mediaItemToFilterable(mi);
      if (filterable.occurrenceDates?.length) {
        for (const d of filterable.occurrenceDates) considerDay(d);
      } else {
        consider(filterable);
      }
    }
  } else if (scope === 'post' || scope === 'comic') {
    // Empty scoped walk — no leftover-projection fallthrough.
  } else {
    for (const g of index.generations || []) {
      if (!g.media?.length) continue;
      consider(g);
    }
    if (scope !== 'generation') {
      for (const p of index.posts || []) {
        if (!p.media?.length) continue;
        consider(p);
      }
    }
  }
  return { min, max };
}

// --- List offer (FacetBar visibility) --------------------------------------
//
// One walk of the origin's produced media items → which controls and options
// can change that list. Not cross-filtered. Cached per index object + scope
// + grain in a WeakMap (drops when the index is replaced). No INDEX_VERSION.

const listOfferCache = new WeakMap();
let listOfferComputeCount = 0;
let listOfferWarmRuns = 0;

// FacetBar queries for the three origins, media grain and container grain.
// dateSource=container is the batch / post / comic grain. Media grain omits it.
export const GALLERY_LIST_OFFER_SCOPES = Object.freeze([
  Object.freeze({ postBacked: true }),
  Object.freeze({ postBacked: true, dateSource: 'container' }),
  Object.freeze({ generationBacked: true }),
  Object.freeze({ generationBacked: true, dateSource: 'container' }),
  Object.freeze({ comicBacked: true }),
  Object.freeze({ comicBacked: true, dateSource: 'container' })
]);

const OFFER_GROUP_AXES = Object.freeze([
  'resourceType', 'ecosystem', 'model', 'version', 'resource',
  'aspect', 'sampler', 'month', 'day', 'publication'
]);

const OFFER_TYPE_ORDER = Object.freeze(['image', 'video', 'audio', 'model3d']);
const OFFER_REACTION_ORDER = Object.freeze(['favorite', 'feedback:liked', 'feedback:disliked']);
const OFFER_PUBLICATION_ORDER = Object.freeze(['published', 'scheduled', 'draft', 'unposted']);

function listOfferCacheKey ({ postBacked, comicBacked, generationBacked, dateSource, ownCheckedAt, ownUsername, ownIds } = {}) {
  const scope = postBacked ? 'post' : comicBacked ? 'comic' : generationBacked ? 'generation' : 'all';
  const grain = dateSource === 'container' ? 'container' : 'media';
  const ownKey = ownCheckedAt
    ? `${ownUsername || ''}|${ownCheckedAt}`
    : (ownIds && typeof ownIds[Symbol.iterator] === 'function' ? [...ownIds].map(String).sort().join(',') : '');
  return `${scope}|${grain}|${ownKey}`;
}

function bumpCapSet (set, key, cap = 2) {
  if (!key) return;
  if (set.size >= cap) return;
  set.add(key);
}

function dominantAspectHint (sizes) {
  let best = null;
  for (const [label, info] of sizes) {
    if (
      !best ||
      info.count > best.count ||
      (info.count === best.count && info.area < best.area)
    ) {
      best = { label, count: info.count, area: info.area };
    }
  }
  return best ? best.label : '';
}

function buildOfferAspectClasses (buckets) {
  return ASPECT_CLASSES
    .map(key => {
      const bucket = buckets.get(key);
      if (!bucket || bucket.count <= 0) return null;
      const ratios = [...bucket.ratios.entries()]
        .filter(([, info]) => info.count > 0)
        .sort((a, b) => b[1].count - a[1].count || String(a[0]).localeCompare(String(b[0])))
        .map(([value, info]) => ({
          value,
          label: value,
          hint: dominantAspectHint(info.sizes),
          count: info.count
        }));
      if (!ratios.length) return null;
      return {
        key,
        label: ASPECT_CLASS_LABELS[key],
        count: bucket.count,
        ratios
      };
    })
    .filter(Boolean);
}

function rangeShow (min, max, withValue, N) {
  if (withValue === 0) return false;
  if (min != null && max != null && min < max) return true;
  return withValue > 0 && withValue < N;
}

const RATING_TOKEN_ORDER = ['pg', 'pg-13', 'r', 'x', 'xxx'];

function contentNamesOfItem (mi) {
  const out = [];
  const push = (name) => {
    if (typeof name !== 'string' || !name) return;
    if (name === 'favorite' || name.startsWith('feedback:')) return;
    if (isRatingTagName(name)) return;
    out.push(name);
  };
  if (Array.isArray(mi?.contentTags)) {
    for (const t of mi.contentTags) push(t);
    return out;
  }
  const tags = Array.isArray(mi?.tags) ? mi.tags : [];
  const named = tags.some(t => typeof t === 'string' && t && t !== 'favorite' && !t.startsWith('feedback:') && !isRatingTagName(t));
  if (named) {
    for (const t of tags) push(t);
    return out;
  }
  if (Array.isArray(mi?.contentTagIds)) {
    for (const id of mi.contentTagIds) push(formatTagName(id));
  }
  return out;
}

function curatedPostNames (post) {
  const out = [];
  const seen = new Set();
  for (const t of post?.tags || []) {
    const name = typeof t === 'string' ? t : t?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function postMemberItems (post, byId) {
  const out = [];
  for (const m of post?.media || []) {
    const id = m?.imageId ?? m?.mediaId;
    if (id == null || id === '') continue;
    const mi = byId.get(String(id));
    if (mi) out.push(mi);
  }
  return out;
}

function originMediaItems (index, comicBacked) {
  const out = [];
  for (const mi of index?.mediaItems || []) {
    if (!isProduced(mi)) continue;
    if (comicBacked) {
      if (!isComicBacked(mi)) continue;
    } else if (!isPostBacked(mi)) continue;
    out.push(mi);
  }
  return out;
}

function selectedRatingTokens (rating) {
  return new Set(String(rating || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
}

/**
 * Tags panel payload. `ratings` counts images of this origin at both
 * grains. A label on every image is omitted by the client (`count ===
 * ratingTotal`). A label on every post, and not every image, stays.
 * `values` are image content names. `dateSource=container` counts posts
 * that contain the name; omitting it counts images. `postTags` are the
 * post's curated names, posts origin only. `rating` limits both lists
 * to images of those labels. Ladder names are not content values.
 *
 * @param {object} index
 * @param {{ comicBacked?: boolean, dateSource?: string, rating?: string }} [opts]
 */
export function computeTagFacet (index, { comicBacked = false, dateSource = '', rating = '' } = {}) {
  const images = originMediaItems(index, comicBacked);
  const containerGrain = dateSource === 'container' && !comicBacked;
  const byId = new Map();
  for (const mi of images) byId.set(String(mi.id), mi);
  const selected = selectedRatingTokens(rating);
  const inRating = (mi) => {
    if (!selected.size) return true;
    const token = ratingTokenForLevel(mi.browsingLevel);
    return !!(token && selected.has(token));
  };
  const ratingCounts = new Map();
  let ratingTotal = 0;
  for (const mi of images) {
    ratingTotal++;
    const token = ratingTokenForLevel(mi.browsingLevel);
    if (token) ratingCounts.set(token, (ratingCounts.get(token) || 0) + 1);
  }
  const ratings = RATING_TOKEN_ORDER
    .filter(token => (ratingCounts.get(token) || 0) > 0)
    .map(token => ({
      value: token,
      label: ratingTagLabel(token),
      count: ratingCounts.get(token)
    }));

  const counts = new Map();
  const bump = (name) => {
    if (!name || isRatingTagName(name)) return;
    const e = counts.get(name) || { value: name, label: name, count: 0 };
    e.count++;
    counts.set(name, e);
  };
  let total = 0;
  if (containerGrain) {
    for (const p of index?.posts || []) {
      if (!p.media?.length) continue;
      const members = postMemberItems(p, byId).filter(inRating);
      if (selected.size && !members.length) continue;
      total++;
      const names = new Set();
      for (const mi of members) {
        for (const name of contentNamesOfItem(mi)) names.add(name);
      }
      for (const name of names) bump(name);
    }
  } else {
    for (const mi of images) {
      if (!inRating(mi)) continue;
      total++;
      for (const name of contentNamesOfItem(mi)) bump(name);
    }
  }
  const values = [...counts.values()]
    .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));

  const postCounts = new Map();
  const bumpPost = (name) => {
    if (!name) return;
    const e = postCounts.get(name) || { value: name, label: name, count: 0 };
    e.count++;
    postCounts.set(name, e);
  };
  let postTotal = 0;
  if (!comicBacked) {
    const posts = index?.posts || [];
    const postById = new Map(posts.map(p => [String(p.id), p]));
    if (containerGrain) {
      for (const p of posts) {
        if (!p.media?.length) continue;
        const members = postMemberItems(p, byId).filter(inRating);
        if (selected.size && !members.length) continue;
        postTotal++;
        for (const name of curatedPostNames(p)) bumpPost(name);
      }
    } else {
      for (const mi of images) {
        if (!inRating(mi)) continue;
        postTotal++;
        const names = new Set();
        for (const ref of mi.containers?.posts || []) {
          const post = postById.get(String(ref.id));
          for (const name of curatedPostNames(post)) names.add(name);
        }
        for (const name of names) bumpPost(name);
      }
    }
  }
  const postTags = [...postCounts.values()]
    .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
  return { values, total, ratings, ratingTotal, postTags, postTotal };
}

/**
 * FacetBar offer payload for one origin + grain. Population P is produced
 * media items in scope; N = |P|. Membership controls use P; group axes and
 * When use the gallery row set (media items, or containers when
 * `dateSource=container`). Does not call `computeModelHierarchy`. Does not
 * read CONFIG.
 *
 * @param {object} index
 * @param {(versionId:number|string)=>object|null} [getModelVersion]
 * @param {{ generationBacked?: boolean, postBacked?: boolean, comicBacked?: boolean, dateSource?: string }} [opts]
 */
export function computeListOffer (index, getModelVersion = () => null, opts = {}) {
  const cacheKey = listOfferCacheKey(opts);
  let byKey = listOfferCache.get(index);
  if (byKey?.has(cacheKey)) return byKey.get(cacheKey);
  listOfferComputeCount++;

  const { postBacked, comicBacked, generationBacked, dateSource } = opts;
  const scope = originWalkScope({ postBacked, comicBacked, generationBacked });
  const publicationScope = postBacked ? 'post' : comicBacked ? 'comic' : 'all';
  const pubCtx = { publicationScope };

  const population = [];
  for (const mi of index.mediaItems || []) {
    if (!isProduced(mi)) continue;
    if (skipOriginItem(mi, scope)) continue;
    population.push(mi);
  }
  const N = population.length;

  const typeCounts = new Map();
  const reactionCounts = new Map();
  for (const t of OFFER_REACTION_ORDER) reactionCounts.set(t, 0);
  const publicationCounts = new Map();
  let usedAsInputCount = 0;
  let cfgMin = null;
  let cfgMax = null;
  let cfgWith = 0;
  let stepsMin = null;
  let stepsMax = null;
  let stepsWith = 0;
  const aspectBuckets = new Map();
  for (const key of ASPECT_CLASSES) {
    aspectBuckets.set(key, { count: 0, ratios: new Map() });
  }
  const ratioTokens = new Set();
  const versionIds = new Set();
  let missingVersion = 0;
  let usesOwn = false;
  const ownIds = opts.ownIds;

  for (const mi of population) {
    const mediaType = mi.type;
    if (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio') {
      typeCounts.set(mediaType, (typeCounts.get(mediaType) || 0) + 1);
    }

    for (const t of itemReactionTags(mi)) {
      if (reactionCounts.has(t)) reactionCounts.set(t, reactionCounts.get(t) + 1);
    }

    for (const token of publicationTokensOf(mi, pubCtx)) {
      publicationCounts.set(token, (publicationCounts.get(token) || 0) + 1);
    }

    if (Array.isArray(mi.usedAsInput) && mi.usedAsInput.length > 0) usedAsInputCount++;

    const cfg = itemCfg(mi);
    if (cfg != null) {
      cfgWith++;
      if (cfgMin == null || cfg < cfgMin) cfgMin = cfg;
      if (cfgMax == null || cfg > cfgMax) cfgMax = cfg;
    }
    const steps = itemSteps(mi);
    if (steps != null) {
      stepsWith++;
      if (stepsMin == null || steps < stepsMin) stepsMin = steps;
      if (stepsMax == null || steps > stepsMax) stepsMax = steps;
    }

    const cls = mi.aspectClass || deriveAspectClass(mi.width, mi.height);
    if (aspectBuckets.has(cls)) {
      const bucket = aspectBuckets.get(cls);
      bucket.count++;
      const token = namedAspectToken(mi.width, mi.height);
      if (token) {
        ratioTokens.add(token);
        let ratio = bucket.ratios.get(token);
        if (!ratio) {
          ratio = { count: 0, sizes: new Map() };
          bucket.ratios.set(token, ratio);
        }
        ratio.count++;
        const w = Number(mi.width) || 0;
        const h = Number(mi.height) || 0;
        if (w && h) {
          const sizeKey = `${w}\u00D7${h}`;
          const prev = ratio.sizes.get(sizeKey) || { count: 0, area: w * h };
          prev.count++;
          ratio.sizes.set(sizeKey, prev);
        }
      }
    } else {
      const token = namedAspectToken(mi.width, mi.height);
      if (token) ratioTokens.add(token);
    }

    const ids = itemVersionIds(mi);
    if (!ids.length) missingVersion++;
    else {
      for (const id of ids) {
        if (versionIds.size >= 2) break;
        versionIds.add(id);
      }
    }

    if (!usesOwn && ownIds && ownIds.size) {
      const slots = [];
      if (mi.checkpoint) slots.push(mi.checkpoint);
      if (Array.isArray(mi.resources)) slots.push(...mi.resources);
      for (const r of slots) {
        if (r?.modelId != null && r.modelId !== '' && ownIds.has(String(r.modelId))) {
          usesOwn = true;
          break;
        }
      }
    }
  }

  // Content names and rating labels. A chip shows when it can change
  // this grain's rows. Rating labels use member image bits, not the
  // container bit.
  const tagFacet = computeTagFacet(index, { comicBacked, dateSource });
  let showTags = false;
  for (const v of tagFacet.values) {
    if (v.count > 0 && v.count < tagFacet.total) { showTags = true; break; }
  }
  if (!showTags) {
    for (const v of tagFacet.ratings) {
      if (v.count > 0 && v.count < tagFacet.ratingTotal) { showTags = true; break; }
    }
  }
  if (!showTags) {
    for (const v of tagFacet.postTags || []) {
      if (v.count > 0 && v.count < tagFacet.postTotal) { showTags = true; break; }
    }
  }

  const showType = [...typeCounts.keys()].length >= 2;
  const showTypeTree = typeTreeLeafEquivalents(computeTypeWorkflowTree(index, {
    generationBacked, postBacked, comicBacked
  })) >= 2;
  const types = showType
    ? OFFER_TYPE_ORDER.filter(t => typeCounts.has(t))
    : undefined;

  const reaction = OFFER_REACTION_ORDER.filter(t => {
    const c = reactionCounts.get(t) || 0;
    return c > 0 && c < N;
  });
  const showReaction = reaction.length > 0;

  const publication = OFFER_PUBLICATION_ORDER.filter(t => (publicationCounts.get(t) || 0) > 0);
  const showPublication = publication.length >= 2;

  const showUsedAsInput = usedAsInputCount > 0 && usedAsInputCount < N;
  const showAspect = ratioTokens.size >= 2;
  const showCfg = rangeShow(cfgMin, cfgMax, cfgWith, N);
  const showSteps = rangeShow(stepsMin, stepsMax, stepsWith, N);
  const showResources = !(versionIds.size === 0 || (versionIds.size === 1 && missingVersion === 0));

  const dateBounds = computeDateBounds(index, opts);
  const showWhen = !!(dateBounds.min && dateBounds.max && dateBounds.min < dateBounds.max);

  // Group axes: second loop over gallery rows; cap each set at 2.
  const axisSets = new Map();
  for (const axis of OFFER_GROUP_AXES) axisSets.set(axis, new Set());

  const considerGroupRow = (row) => {
    for (const axis of OFFER_GROUP_AXES) {
      const set = axisSets.get(axis);
      if (set.size >= 2) continue;
      for (const key of groupKeysFor(row, axis, getModelVersion)) {
        bumpCapSet(set, key, 2);
      }
    }
  };

  if (dateSource === 'container') {
    if (scope === 'post') {
      for (const p of index.posts || []) {
        if (!p.media?.length) continue;
        considerGroupRow(p);
      }
    } else if (scope === 'comic') {
      for (const c of index.comics || []) {
        if (!c.media?.length) continue;
        considerGroupRow(c);
      }
    } else if (scope === 'generation') {
      for (const g of index.generations || []) {
        if (!g.media?.length) continue;
        considerGroupRow(g);
      }
    }
  } else {
    for (const mi of population) {
      considerGroupRow(mediaItemToFilterable(mi));
    }
  }

  const groupAxes = OFFER_GROUP_AXES.filter(axis => axisSets.get(axis).size >= 2);

  const show = {
    type: showType,
    typeTree: showTypeTree,
    aspect: showAspect,
    reaction: showReaction,
    publication: showPublication,
    usedAsInput: showUsedAsInput,
    cfg: showCfg,
    steps: showSteps,
    when: showWhen,
    tags: showTags,
    resources: showResources,
    ownModels: !!(ownIds && ownIds.size && usesOwn)
  };

  const payload = { total: N, show, groupAxes, ownKnown: opts.ownIds != null };
  if (showType) payload.types = types;
  if (showReaction) payload.reaction = reaction;
  if (showPublication) payload.publication = publication;
  if (showAspect) payload.aspect = { classes: buildOfferAspectClasses(aspectBuckets) };
  if (showCfg) payload.cfg = { min: cfgMin, max: cfgMax };
  if (showSteps) payload.steps = { min: stepsMin, max: stepsMax };
  if (showWhen) payload.when = { min: dateBounds.min, max: dateBounds.max };

  if (!byKey) {
    byKey = new Map();
    listOfferCache.set(index, byKey);
  }
  byKey.set(cacheKey, payload);
  return payload;
}

// Six gallery offers, using the same model-version getter the offer route
// uses. Called before listen and again after an idle measurement rebuild.
// Not from projectMediaItems — a download upsert must not pay for six walks.
export function warmListOffers (getModelVersion = () => null) {
  const index = getIndex();
  if (!index) return;
  for (const opts of GALLERY_LIST_OFFER_SCOPES) {
    computeListOffer(index, getModelVersion, opts);
  }
  listOfferWarmRuns++;
}

// After-listen refill. One scope per turn so a download or a gallery click
// can run before the remaining scopes. The warm count moves only after the
// sixth, so a pass that parked midway is not finished. startServer and
// Settings rebuild keep the synchronous warmListOffers.
export async function refillListOffersWhenIdle (getModelVersion = () => null) {
  const index = getIndex();
  if (!index) return;
  for (const opts of GALLERY_LIST_OFFER_SCOPES) {
    await waitForExplorerIdle();
    computeListOffer(index, getModelVersion, opts);
  }
  listOfferWarmRuns++;
}

export function readCachedListOffer (opts) {
  const index = getIndex();
  if (!index) return undefined;
  const byKey = listOfferCache.get(index);
  if (!byKey) return undefined;
  return byKey.get(listOfferCacheKey(opts));
}

export function listOfferWarmCount () {
  return listOfferWarmRuns;
}

export function takeListOfferComputeCount () {
  const n = listOfferComputeCount;
  listOfferComputeCount = 0;
  return n;
}

// --- Models catalog + FacetBar hierarchy ---
//
// The Models tab is a Civitai-shaped catalog of corpus-present `Model.id`s
// plus a model page (`/models/{id}-{slug}?modelVersionId=`). The FacetBar
// tree is type → base model → model → version (not AIR-root folders).
// Node identity is the IMMUTABLE upstream key — ModelType enum, `baseModel`
// token, `Model.id`, `ModelVersion.id` — never the display name.
//
// Aggregations are COMPUTED per request (never persisted, no INDEX_VERSION
// bump). Prefer `index.mediaItems`; fall back to generations when the
// projection is empty. Hydrate from the model-version cache at walk time.
//
// `getModelVersion(versionId)` returns a cached model-version record (or
// null). `.data.model.name` is the authoritative Model.name;
// `.data.name` is the authoritative version name; `.data.baseModel` fills
// a missing slot token.

const TREE_THUMB_LIMIT = 4;

function resourceListForTree (item) {
  const list = Array.isArray(item.resources) ? item.resources : [];
  if (list.length) return list;
  return item.checkpoint ? [item.checkpoint] : [];
}

function asCsvFilter (value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

function axisHits (values, selected) {
  if (!selected.length) return true;
  const set = new Set(values);
  return selected.some(s => set.has(s));
}

function treeNodeLabel (level, key, rep, getModelVersion) {
  switch (level) {
    case 'type': return modelTypeLabel(key) || key;
    case 'ecosystem': return getEcosystemDisplayName(key) || key;
    case 'baseModel': return key;
    case 'model': {
      const cached = getModelVersion(rep?.versionId);
      const name = cached?.data?.model?.name;
      if (name) return name;
      if (rep?.modelName && rep.modelName !== '(unknown)') return rep.modelName;
      return `Model ${key}`;
    }
    case 'version': {
      const name = resolveResourceVersionName(rep, getModelVersion);
      if (name) return name;
      return `Version ${key}`;
    }
    default: return key;
  }
}

function forEachProducedItem (index, fn, { generationBacked, postBacked, comicBacked } = {}) {
  const scope = originWalkScope({ generationBacked, postBacked, comicBacked });
  const mediaItems = index.mediaItems;
  if (Array.isArray(mediaItems) && mediaItems.length) {
    for (const mi of mediaItems) {
      if (!isProduced(mi)) continue;
      if (skipOriginItem(mi, scope)) continue;
      const when = mi.containers?.generation?.sortKey
        || mi.containers?.posts?.[0]?.sortKey
        || mi.date
        || '';
      const coverPath = coverPathOf(mi);
      fn({
        resources: resourceListForTree(mi),
        checkpoint: mi.checkpoint,
        type: mi.type,
        ecosystem: mi.params?.ecosystem,
        media: [{
          thumbnailPath: mi.thumbnailPath,
          type: mi.type,
          ...(coverPath ? { coverPath } : {})
        }],
        when,
        mediaCount: 1
      });
    }
    return;
  }
  if (scope === 'post' || scope === 'comic') return;
  for (const gen of index.generations || []) {
    const mediaCount = Array.isArray(gen.media) ? gen.media.length : 0;
    if (!mediaCount) continue;
    const memberTypes = new Set((gen.media || []).map(m => m && m.type).filter(Boolean));
    fn({
      resources: resourceListForTree(gen),
      checkpoint: gen.checkpoint,
      type: memberTypes.size === 1 ? [...memberTypes][0] : '',
      ecosystem: gen.params?.ecosystem,
      media: gen.media,
      when: gen.createdAt || gen.date || '',
      mediaCount
    });
  }
}

function pushThumb (node, media) {
  if (node.recentThumbnails.length >= TREE_THUMB_LIMIT) return;
  for (const m of media || []) {
    if (node.recentThumbnails.length >= TREE_THUMB_LIMIT) break;
    if (m.thumbnailPath) {
      const thumb = { thumbnailPath: m.thumbnailPath, type: m.type };
      if (m.coverPath) thumb.coverPath = m.coverPath;
      node.recentThumbnails.push(thumb);
    }
  }
}

function bumpWhen (node, when) {
  if (!when) return;
  if (!node.firstUsed || when < node.firstUsed) node.firstUsed = when;
  if (!node.lastUsed || when > node.lastUsed) node.lastUsed = when;
}

function hierarchySort (a, b) {
  return b.count - a.count || String(a.label).localeCompare(String(b.label));
}

function hierarchyModelIdentity (r) {
  if (r.modelId != null && r.modelId !== '') {
    return { key: String(r.modelId), idKind: 'id' };
  }
  const name = r.modelName && r.modelName !== '(unknown)' ? r.modelName : '';
  if (!name) return null;
  return { key: name, idKind: 'name' };
}

function catalogOptionList (map, axis) {
  return [...map.values()]
    .filter(n => n.count > 0 && n.value !== '')
    .map(n => ({
      value: n.value,
      label: axis === 'resourceTypes'
        ? (modelTypeLabel(n.value) || n.value)
        : n.value,
      count: n.count
    }))
    .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
}

function bumpCatalogOption (map, value) {
  if (!value) return;
  const e = map.get(value) || { value, count: 0 };
  e.count++;
  map.set(value, e);
}

const FAMILY_SECTION_ORDER = ['image', 'video', 'audio', 'model3d'];

/**
 * Family / variant filter expression. Empty lists → true. A node matches when
 * it hits a selected variant, or hits a selected family that has no selected
 * variant of its own. A variant whose family is not selected still matches
 * (the variant implies its family).
 */
function familyExpr (node, families, variants) {
  if (!families.length && !variants.length) return true;
  const nodeFamilies = node.familyIds || new Set();
  const nodeVariants = node.variantIds || new Set();
  if (variants.some(v => nodeVariants.has(v))) return true;
  const variantsByFamily = new Map();
  for (const v of variants) {
    const fid = String(v).split(':')[0];
    if (!variantsByFamily.has(fid)) variantsByFamily.set(fid, []);
    variantsByFamily.get(fid).push(v);
  }
  for (const fid of families) {
    if (!nodeFamilies.has(fid)) continue;
    if (!variantsByFamily.has(fid)) return true;
  }
  return false;
}

/**
 * Catalog of corpus-present models (one node per Model.id). Filters AND
 * across `resourceType` and the family/variant expression (OR within an
 * axis). Name-only leftovers (`idKind: 'name'`) are included but are not a
 * model page. `options.resourceTypes`, family chips, and variant chips each
 * count distinct catalog models (a model used on many images counts once;
 * a model that appears as two types counts on both). Card `count` stays
 * media items. `options.sections` lists corpus-present families by output
 * type; variants are omitted when fewer than two are present. `baseModel`
 * / `ecosystem` filter arguments are ignored. Computed per request.
 *
 * @param {object} index
 * @param {{ resourceTypes?: string[]|string, resourceType?: string[]|string, families?: string[]|string, family?: string[]|string, variants?: string[]|string, variant?: string[]|string }} [filters]
 * @param {(versionId:number|string)=>object|null} [getModelVersion]
 */
export function aggregateModelCatalog (index, filters = {}, getModelVersion = () => null) {
  const resourceTypes = asCsvFilter(filters.resourceTypes ?? filters.resourceType);
  const families = asCsvFilter(filters.families ?? filters.family);
  const variants = asCsvFilter(filters.variants ?? filters.variant);
  // Intentionally ignore filters.baseModel / filters.ecosystem (unreleased
  // catalog keys deleted; callers that still pass them must not narrow).

  const models = new Map();
  const optionTypes = new Map();
  const optionFamily = new Map(); // familyId → count
  const optionVariant = new Map(); // variantId → count

  forEachProducedItem(index, ({ resources, media, when, mediaCount }) => {
    const seenModel = new Set();

    for (const raw of resources) {
      const r = hydrateResource(raw, getModelVersion);
      const typeKey = r.type || 'Other';

      const assignment = assignModelFamily({
        baseModel: r.baseModel,
        airEcosystem: r.air?.ecosystem,
        versionId: r.versionId
      });

      const ident = hierarchyModelIdentity(r);
      if (!ident) continue;
      const mapKey = `${ident.idKind}:${ident.key}`;

      let node = models.get(mapKey);
      if (!node) {
        node = {
          key: ident.key,
          idKind: ident.idKind,
          types: new Set(),
          baseModels: new Set(),
          familyIds: new Set(),
          variantIds: new Set(),
          count: 0,
          firstUsed: when,
          lastUsed: when,
          recentThumbnails: [],
          rep: r
        };
        models.set(mapKey, node);
      }

      node.types.add(typeKey);
      if (r.baseModel) node.baseModels.add(r.baseModel);
      if (assignment) {
        node.familyIds.add(assignment.familyId);
        for (const vid of assignment.variantIds) node.variantIds.add(vid);
      }
      if (!node.lastUsed || (when && when >= node.lastUsed)) {
        node.rep = r;
      }

      if (!seenModel.has(mapKey)) {
        node.count += mediaCount;
        bumpWhen(node, when);
        pushThumb(node, media);
        seenModel.add(mapKey);
      }
    }
  });

  forEachProducedItem(index, ({ type, ecosystem, checkpoint, resources, media, when, mediaCount }) => {
    const fam = fallbackGeneratorFamily({ type, ecosystem, checkpoint, resources });
    if (!fam) return;
    const mapKey = `family:${fam.familyId}`;
    let node = models.get(mapKey);
    if (!node) {
      node = {
        key: fam.familyId,
        idKind: 'family',
        types: new Set(),
        baseModels: new Set(),
        familyIds: new Set([fam.familyId]),
        variantIds: new Set(),
        count: 0,
        firstUsed: when,
        lastUsed: when,
        recentThumbnails: [],
        rep: null
      };
      models.set(mapKey, node);
    }
    node.count += mediaCount;
    bumpWhen(node, when);
    pushThumb(node, media);
  });

  // Option counts: a model contributes 1 to each type, family, and variant it touches.
  for (const node of models.values()) {
    if (node.count <= 0 || node.key === '') continue;
    for (const t of node.types) bumpCatalogOption(optionTypes, t);
    for (const fid of node.familyIds) bumpCatalogOption(optionFamily, fid);
    for (const vid of node.variantIds) bumpCatalogOption(optionVariant, vid);
  }

  const own = filters.ownModels;
  const ownKnown = own?.known === true;
  const ownList = ownKnown && Array.isArray(own.models) ? own.models : [];
  const ownIds = ownKnown ? new Set(ownList.map(m => String(m.id))) : null;
  const mineOn = filters.mine === true || filters.mine === '1' || filters.mine === 'true';

  const catalogCard = (n) => {
    if (n.idKind === 'family') {
      const fam = getModelFamily(n.key);
      return {
        key: n.key,
        label: fam?.label || n.key,
        type: '',
        typeLabel: '',
        baseModels: [],
        idKind: 'family',
        count: n.count,
        firstUsed: n.firstUsed,
        lastUsed: n.lastUsed,
        recentThumbnails: n.recentThumbnails
      };
    }
    const type = n.rep?.type || [...n.types][0] || 'Other';
    const baseList = [...n.baseModels].sort((a, b) => String(a).localeCompare(String(b)));
    const card = {
      key: n.key,
      label: treeNodeLabel('model', n.key, n.rep, getModelVersion),
      type,
      typeLabel: modelTypeLabel(type) || type,
      baseModels: baseList,
      idKind: n.idKind,
      count: n.count,
      firstUsed: n.firstUsed,
      lastUsed: n.lastUsed,
      recentThumbnails: n.recentThumbnails
    };
    if (ownIds && n.idKind === 'id' && ownIds.has(String(n.key))) card.mine = true;
    return card;
  };

  const passesCatalog = (n) => axisHits([...n.types], resourceTypes) && familyExpr(n, families, variants);
  const indexNodes = [...models.values()].filter(n => n.count > 0 && n.key !== '');

  let nodes = indexNodes
    .filter(n => passesCatalog(n))
    .filter(n => !mineOn || !ownKnown || (n.idKind === 'id' && ownIds.has(String(n.key))))
    .map(catalogCard);

  if (mineOn && ownKnown) {
    const usedIds = new Set(
      indexNodes.filter(n => n.idKind === 'id').map(n => String(n.key))
    );
    for (const record of ownList) {
      const id = String(record.id);
      if (usedIds.has(id)) continue;
      const type = record.type || 'Other';
      const base = (record.versions || []).map(v => v.baseModel).find(Boolean) || '';
      const assignment = assignModelFamily({ baseModel: base });
      const stub = {
        types: new Set([type]),
        familyIds: new Set(assignment ? [assignment.familyId] : []),
        variantIds: new Set(assignment?.variantIds || [])
      };
      if (!axisHits([type], resourceTypes) || !familyExpr(stub, families, variants)) continue;
      nodes.push({
        key: id,
        label: record.name || `Model ${id}`,
        type,
        typeLabel: modelTypeLabel(type) || type,
        baseModels: base ? [base] : [],
        idKind: 'id',
        count: 0,
        unused: true,
        mine: true,
        firstUsed: '',
        lastUsed: '',
        recentThumbnails: []
      });
    }
  }
  nodes.sort(hierarchySort);

  let mineCount = 0;
  if (ownKnown) {
    const usedOwned = new Set();
    for (const n of indexNodes) {
      if (n.idKind === 'id' && ownIds.has(String(n.key))) usedOwned.add(String(n.key));
    }
    mineCount = usedOwned.size;
    for (const record of ownList) {
      if (!usedOwned.has(String(record.id))) mineCount++;
    }
  }

  const sectionsByType = new Map();
  for (const [fid, entry] of optionFamily) {
    const fam = getModelFamily(fid);
    const outputType = fam?.outputType || 'image';
    const label = fam?.label || fid;
    const familyVariants = (fam?.variants || [])
      .map(v => {
        const hit = optionVariant.get(v.id);
        if (!hit || hit.count <= 0) return null;
        return { value: v.id, label: v.label, count: hit.count };
      })
      .filter(Boolean);
    const familyOpt = {
      value: fid,
      label,
      count: entry.count
    };
    if (familyVariants.length >= 2) familyOpt.variants = familyVariants;
    if (!sectionsByType.has(outputType)) sectionsByType.set(outputType, []);
    sectionsByType.get(outputType).push(familyOpt);
  }

  const sections = [];
  for (const ot of FAMILY_SECTION_ORDER) {
    const list = sectionsByType.get(ot);
    if (!list || !list.length) continue;
    list.sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
    sections.push({
      outputType: ot,
      label: sectionLabel(ot) || ot,
      families: list
    });
  }

  return {
    level: 'catalog',
    nodes,
    options: {
      resourceTypes: catalogOptionList(optionTypes, 'resourceTypes'),
      sections,
      ...(ownKnown ? { mine: { count: mineCount } } : {})
    }
  };
}

function familyCrumbFromResource (r) {
  if (!r) return null;
  const assignment = assignModelFamily({
    baseModel: r.baseModel,
    airEcosystem: r.air?.ecosystem,
    versionId: r.versionId
  });
  if (!assignment?.familyId) return null;
  const fam = getModelFamily(assignment.familyId);
  if (!fam?.label) return null;
  return { level: 'family', key: assignment.familyId, label: fam.label };
}

function selectedVersionSlot (versionId, versions, ownRec) {
  if (!versionId) return null;
  const rep = versions.get(versionId)?.rep;
  if (rep) return rep;
  const own = (ownRec?.versions || []).find(v => v && String(v.id) === String(versionId));
  if (!own) return null;
  return { baseModel: own.baseModel || '', versionId: own.id };
}

/**
 * One model's corpus-present versions. Default `selectedVersionId` is the
 * latest `lastUsed` among those versions (or the requested id when present).
 * Gallery remains `GET /api/media?versionId=`.
 *
 * @param {object} index
 * @param {{ modelId: string|number, versionId?: string|number }} context
 * @param {(versionId:number|string)=>object|null} [getModelVersion]
 */
export function aggregateModelPage (index, context = {}, getModelVersion = () => null) {
  const modelId = context.modelId != null && context.modelId !== '' ? String(context.modelId) : null;
  const requestedVersion = context.versionId != null && context.versionId !== ''
    ? String(context.versionId)
    : null;

  const versions = new Map();
  let modelRep = null;
  let modelCount = 0;
  let firstUsed = '';
  let lastUsed = '';
  const seenItem = new Set();
  let itemSeq = 0;

  forEachProducedItem(index, ({ resources, media, when, mediaCount }) => {
    const matching = [];
    for (const raw of resources) {
      const r = hydrateResource(raw, getModelVersion);
      if (modelId == null || r.modelId == null || String(r.modelId) !== modelId) continue;
      matching.push(r);
    }
    if (!matching.length) return;

    const itemKey = ++itemSeq;
    if (!seenItem.has(itemKey)) {
      modelCount += mediaCount;
      if (when) {
        if (!firstUsed || when < firstUsed) firstUsed = when;
        if (!lastUsed || when > lastUsed) lastUsed = when;
      }
      seenItem.add(itemKey);
    }

    const seenVer = new Set();
    for (const r of matching) {
      if (!modelRep || (when && (!lastUsed || when >= lastUsed))) modelRep = r;
      const verKey = r.versionId != null && r.versionId !== '' ? String(r.versionId) : '';
      if (!verKey) continue;
      let node = versions.get(verKey);
      if (!node) {
        node = {
          key: verKey,
          rep: r,
          baseModel: r.baseModel || '',
          count: 0,
          firstUsed: when,
          lastUsed: when,
          recentThumbnails: []
        };
        versions.set(verKey, node);
      }
      if (!seenVer.has(verKey)) {
        node.count += mediaCount;
        bumpWhen(node, when);
        pushThumb(node, media);
        if (when && (!node.lastUsed || when >= node.lastUsed)) {
          node.rep = r;
          node.baseModel = r.baseModel || node.baseModel || '';
        }
        seenVer.add(verKey);
      }
    }
  });

  const versionList = [...versions.values()]
    .filter(n => n.count > 0 && n.key !== '')
    .map(n => ({
      key: n.key,
      label: treeNodeLabel('version', n.key, n.rep, getModelVersion),
      baseModel: n.baseModel || '',
      count: n.count,
      lastUsed: n.lastUsed,
      recentThumbnails: n.recentThumbnails
    }));
  versionList.sort((a, b) => String(b.lastUsed || '').localeCompare(String(a.lastUsed || ''))
    || String(a.label).localeCompare(String(b.label)));

  let selectedVersionId = null;
  if (requestedVersion && versionList.some(v => v.key === requestedVersion)) {
    selectedVersionId = requestedVersion;
  } else if (versionList.length) {
    selectedVersionId = versionList[0].key;
  }

  const type = modelRep?.type || 'Other';
  let model = modelId
    ? {
        key: modelId,
        label: treeNodeLabel('model', modelId, modelRep, getModelVersion),
        type,
        typeLabel: modelTypeLabel(type) || type,
        count: modelCount,
        firstUsed,
        lastUsed
      }
    : null;

  const ownList = context.ownModels?.known === true && Array.isArray(context.ownModels.models)
    ? context.ownModels.models
    : null;
  const ownRec = ownList && modelId
    ? ownList.find(m => String(m.id) === modelId)
    : null;
  if (ownRec) {
    if (model && modelRep) {
      model = { ...model, mine: true };
    } else if (modelId) {
      const ownType = ownRec.type || 'Other';
      model = {
        key: modelId,
        label: ownRec.name || `Model ${modelId}`,
        type: ownType,
        typeLabel: modelTypeLabel(ownType) || ownType,
        count: 0,
        firstUsed: '',
        lastUsed: '',
        mine: true
      };
    }
    if (!versionList.length && Array.isArray(ownRec.versions)) {
      for (const v of ownRec.versions) {
        if (v?.id == null || v.id === '') continue;
        versionList.push({
          key: String(v.id),
          label: v.name || `Version ${v.id}`,
          baseModel: v.baseModel || '',
          count: 0,
          lastUsed: '',
          recentThumbnails: []
        });
      }
      if (!selectedVersionId && versionList.length) selectedVersionId = versionList[0].key;
    }
  }

  const familyCrumb = familyCrumbFromResource(selectedVersionSlot(selectedVersionId, versions, ownRec));

  return {
    level: 'model',
    breadcrumb: model
      ? [
          ...(familyCrumb ? [familyCrumb] : []),
          { level: 'model', key: model.key, label: model.label }
        ]
      : [],
    model,
    versions: versionList,
    selectedVersionId
  };
}

/**
 * Full-depth, corpus-present nested tree for the FacetBar TreePicker.
 * `{ types: [{ key, label, count, baseModels: [{ key, label, count, models: [{ key, label, count, idKind, versions: [{ key, label, count }] }] }] }] }`.
 * Empty `baseModel` slots add to the type count but do not invent a second-
 * level node. Name-only models (`idKind: 'name'`) have an empty `versions`
 * array. Computed per request (no INDEX_VERSION bump).
 *
 * @param {object} index
 * @param {(versionId:number|string)=>object|null} [getModelVersion]
 * @param {{ generationBacked?: boolean, postBacked?: boolean, comicBacked?: boolean }} [opts]
 */
export function computeModelHierarchy (index, getModelVersion = () => null, { generationBacked, postBacked, comicBacked, ownIds } = {}) {
  const types = new Map();

  const contribute = (resources, mediaCount) => {
    if (!mediaCount) return;
    const seenType = new Set();
    const seenBase = new Set();
    const seenModel = new Set();
    const seenVer = new Set();

    for (const raw of resources) {
      const r = hydrateResource(raw, getModelVersion);
      const typeKey = r.type || 'Other';
      if (!typeKey) continue;

      let typeNode = types.get(typeKey);
      if (!typeNode) {
        typeNode = { key: typeKey, count: 0, baseModels: new Map(), rep: r };
        types.set(typeKey, typeNode);
      }
      if (!seenType.has(typeKey)) {
        typeNode.count += mediaCount;
        seenType.add(typeKey);
      }

      const baseKey = (typeof r.baseModel === 'string' && r.baseModel) ? r.baseModel : '';
      if (!baseKey) continue;
      const baseId = `${typeKey}\0${baseKey}`;
      let baseNode = typeNode.baseModels.get(baseKey);
      if (!baseNode) {
        baseNode = { key: baseKey, count: 0, models: new Map(), rep: r };
        typeNode.baseModels.set(baseKey, baseNode);
      }
      if (!seenBase.has(baseId)) {
        baseNode.count += mediaCount;
        seenBase.add(baseId);
      }

      const ident = hierarchyModelIdentity(r);
      if (!ident) continue;
      const modelId = `${baseId}\0${ident.idKind}:${ident.key}`;
      let modelNode = baseNode.models.get(modelId);
      if (!modelNode) {
        modelNode = { key: ident.key, idKind: ident.idKind, count: 0, versions: new Map(), rep: r };
        baseNode.models.set(modelId, modelNode);
      }
      if (!seenModel.has(modelId)) {
        modelNode.count += mediaCount;
        seenModel.add(modelId);
      }

      if (ident.idKind !== 'id') continue;
      const verKey = r.versionId != null && r.versionId !== '' ? String(r.versionId) : '';
      if (!verKey) continue;
      const verId = `${modelId}\0${verKey}`;
      let verNode = modelNode.versions.get(verKey);
      if (!verNode) {
        verNode = { key: verKey, count: 0, rep: r };
        modelNode.versions.set(verKey, verNode);
      }
      if (!seenVer.has(verId)) {
        verNode.count += mediaCount;
        seenVer.add(verId);
      }
    }
  };

  forEachProducedItem(index, ({ resources, mediaCount }) => {
    contribute(resources, mediaCount);
  }, { generationBacked, postBacked, comicBacked });

  const toVersions = (map) => [...map.values()]
    .filter(n => n.count > 0 && n.key !== '')
    .map(n => ({
      key: n.key,
      label: treeNodeLabel('version', n.key, n.rep, getModelVersion),
      count: n.count
    }))
    .sort(hierarchySort);

  const toModels = (map) => [...map.values()]
    .filter(n => n.count > 0 && n.key !== '')
    .map(n => {
      const row = {
        key: n.key,
        label: treeNodeLabel('model', n.key, n.rep, getModelVersion),
        count: n.count,
        idKind: n.idKind,
        versions: n.idKind === 'id' ? toVersions(n.versions) : []
      };
      if (ownIds && n.idKind === 'id' && ownIds.has(String(n.key))) row.own = true;
      return row;
    })
    .sort(hierarchySort);

  const toBaseModels = (map) => [...map.values()]
    .filter(n => n.count > 0 && n.key !== '')
    .map(n => ({
      key: n.key,
      label: n.key,
      count: n.count,
      models: toModels(n.models)
    }))
    .sort(hierarchySort);

  const list = [...types.values()]
    .filter(n => n.count > 0 && n.key !== '')
    .map(n => ({
      key: n.key,
      label: treeNodeLabel('type', n.key, n.rep, getModelVersion),
      count: n.count,
      baseModels: toBaseModels(n.baseModels)
    }))
    .sort(hierarchySort);

  const familyCounts = new Map();
  forEachProducedItem(index, ({ type, ecosystem, checkpoint, resources, mediaCount }) => {
    if (!mediaCount) return;
    const ids = new Set();
    const fallback = fallbackGeneratorFamily({ type, ecosystem, checkpoint, resources });
    if (fallback) ids.add(fallback.familyId);
    const slots = [];
    if (checkpoint && typeof checkpoint === 'object') slots.push(checkpoint);
    if (Array.isArray(resources)) {
      for (const r of resources) if (r && typeof r === 'object') slots.push(r);
    }
    for (const r of slots) {
      const assignment = assignModelFamily({
        baseModel: r.baseModel,
        airEcosystem: r.air?.ecosystem,
        versionId: r.versionId
      });
      if (!assignment?.familyId) continue;
      const fam = getModelFamily(assignment.familyId);
      if (fam?.outputType === 'model3d') ids.add(assignment.familyId);
    }
    for (const id of ids) familyCounts.set(id, (familyCounts.get(id) || 0) + mediaCount);
  }, { generationBacked, postBacked, comicBacked });

  const familiesByType = new Map();
  for (const [fid, count] of familyCounts) {
    const fam = getModelFamily(fid);
    if (!fam || fam.outputType !== 'model3d' || !(count > 0)) continue;
    const row = { key: fid, label: fam.label, count };
    const list = familiesByType.get(fam.outputType) || [];
    list.push(row);
    familiesByType.set(fam.outputType, list);
  }
  const familySections = [];
  for (const ot of FAMILY_SECTION_ORDER) {
    const rows = familiesByType.get(ot);
    if (!rows?.length) continue;
    rows.sort(hierarchySort);
    familySections.push({
      outputType: ot,
      label: sectionLabel(ot) || ot,
      count: rows.reduce((sum, row) => sum + row.count, 0),
      families: rows
    });
  }

  return { types: list, familySections };
}

// --- Overview aggregation ---
//
// Container-grain temporal activity dashboard: generation batches *created*
// vs posts/comics *published*, bucketed by month. Computed per request
// (never persisted). Markers are a capped sample; counts sum every media
// item in the bucket. See explorer-overview plan.

const OVERVIEW_MARKERS_CAP = 48;

// The inclusive [dateFrom, dateTo] day range for a `YYYY-MM` key, so a month
// header click-throughs to `/generations?dateFrom=…&dateTo=…` (the date facet
// compares on the YYYY-MM-DD prefix, inclusive).
function monthRange (month) {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return { dateFrom: '', dateTo: '' };
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { dateFrom: `${month}-01`, dateTo: `${month}-${String(lastDay).padStart(2, '0')}` };
}

function bumpType (counts, type) {
  if (type === 'audio') counts.audio++;
  else if (type === 'video') counts.video++;
  else if (type === 'model3d') counts.model3d++;
  else counts.image++;
}

// First media item with a path. `coverPath` is the downloaded cover still
// when that input file exists; otherwise the thumb is the primary file.
// Same shape as Models catalog `recentThumbnails`.
function pickThumb (media, mediaById) {
  if (!Array.isArray(media)) return null;
  for (const m of media) {
    if (!m?.thumbnailPath) continue;
    const raw = m.mediaId ?? m.imageId ?? m.id;
    let item = null;
    if (mediaById && raw != null && raw !== '') {
      const norm = normalizeMediaId(raw);
      item = mediaById.get(norm) || mediaById.get(String(raw)) || null;
    }
    const coverPath = coverPathOf(item) || coverPathOf(m);
    const thumb = { thumbnailPath: m.thumbnailPath, type: m.type };
    if (coverPath) thumb.coverPath = coverPath;
    return thumb;
  }
  return null;
}

function emptyCounts () {
  return { image: 0, video: 0, audio: 0, model3d: 0 };
}

function ensureOverviewBucket (map, month) {
  let b = map.get(month);
  if (!b) {
    b = {
      month,
      ...monthRange(month),
      created: { counts: emptyCounts(), markers: [], batchesTotal: 0, more: 0 },
      published: { counts: emptyCounts(), markers: [], total: 0, more: 0 },
      comics: { counts: emptyCounts(), markers: [], total: 0, more: 0 }
    };
    map.set(month, b);
  }
  return b;
}

function publicationMedia (entry) {
  if (Array.isArray(entry.media)) return entry.media;
  if (Array.isArray(entry.images)) return entry.images;
  return [];
}

function lookupOverviewMedia (mediaById, mediaId) {
  if (!mediaById || typeof mediaById.get !== 'function' || !mediaId) return null;
  return mediaById.get(mediaId) || mediaById.get(String(mediaId)) || null;
}

// Tooltip facts for the page the marker opens. A singleton uses the media
// item the /media/<id> page renders (primary date and audio title). A miss
// falls back to this job. Several items, or one item with no mediaId, use
// the batch page's createdAt and member types.
function batchOverviewMarker (gen, media, mediaById) {
  const marker = {
    kind: 'batch',
    id: gen.id,
    date: (gen.createdAt || '').slice(0, 10) || gen.date || '',
    mediaCount: media.length,
    thumb: pickThumb(media, mediaById)
  };
  const only = media.length === 1 ? media[0] : null;
  const rawId = only && only.mediaId != null && only.mediaId !== '' ? only.mediaId : '';
  const mediaId = rawId ? normalizeMediaId(rawId) : '';
  if (mediaId) {
    const item = lookupOverviewMedia(mediaById, mediaId);
    marker.mediaId = mediaId;
    marker.mediaType = (item && item.type) || only.type || '';
    marker.titleAt = item ? (item.date || '') : (gen.date || '');
    const audioTitle = String((item ? item.audio?.title : gen.audio?.title) || '').trim();
    if (audioTitle) marker.audioTitle = audioTitle;
    return marker;
  }
  marker.titleAt = gen.createdAt || gen.date || '';
  marker.members = media.map(m => ({ type: m.type }));
  return marker;
}

/**
 * Compute the Overview activity dashboard over the loaded index.
 *
 * @param {object} index — the loaded index ({ generations, posts, comics? }).
 * @param {object} [opts]
 * @param {number} [opts.now] — injected clock (ms) so scheduled/upcoming is testable.
 * @returns {{ upcoming: object[], months: object[], undatedDrafts: object }}
 */
export function computeOverview (index, { now = Date.now() } = {}) {
  const nowMonth = new Date(now).toISOString().slice(0, 7);
  const buckets = new Map();
  const undatedDrafts = { counts: emptyCounts(), markers: [], total: 0, more: 0 };

  for (const gen of index.generations || []) {
    const media = Array.isArray(gen.media) ? gen.media : [];
    if (!media.length) continue;
    const month = (gen.createdAt || gen.date || '').slice(0, 7);
    if (!month) continue;
    const bucket = ensureOverviewBucket(buckets, month);
    for (const m of media) bumpType(bucket.created.counts, m.type);
    bucket.created.batchesTotal++;
    if (bucket.created.markers.length < OVERVIEW_MARKERS_CAP) {
      bucket.created.markers.push(batchOverviewMarker(gen, media, index.mediaById));
    }
  }

  function addPublication (entry, kind) {
    const media = publicationMedia(entry);
    const status = kind === 'comic'
      ? deriveComicStatus(entry)
      : derivePostStatus(entry.publishedAt, now);
    const dated = kind === 'comic'
      ? { ...entry, type: 'comic', status }
      : { ...entry, type: 'post', status };
    const date = itemDate(dated, now) || '';
    const month = date.slice(0, 7);
    const titleAt = kind === 'comic'
      ? date
      : (status === 'draft' ? (entry.createdAt || '') : (entry.publishedAt || ''));
    const marker = {
      kind,
      id: entry.id,
      status,
      date: date.slice(0, 10),
      titleAt,
      mediaCount: media.length,
      thumb: pickThumb(media, index.mediaById)
    };
    if (kind === 'comic') marker.name = entry.name || '';
    else marker.title = entry.title || '';

    if (status === 'draft' && !month) {
      for (const m of media) bumpType(undatedDrafts.counts, m.type);
      undatedDrafts.total++;
      if (undatedDrafts.markers.length < OVERVIEW_MARKERS_CAP) {
        undatedDrafts.markers.push(marker);
      }
      return;
    }
    if (!month) return;

    const bucket = ensureOverviewBucket(buckets, month);
    const lane = kind === 'comic' ? bucket.comics : bucket.published;
    for (const m of media) bumpType(lane.counts, m.type);
    lane.total++;
    if (lane.markers.length < OVERVIEW_MARKERS_CAP) {
      lane.markers.push(marker);
    }
  }

  for (const p of index.posts || []) addPublication(p, 'post');
  for (const c of index.comics || []) addPublication(c, 'comic');

  for (const b of buckets.values()) {
    b.created.more = Math.max(0, b.created.batchesTotal - b.created.markers.length);
    b.published.more = Math.max(0, b.published.total - b.published.markers.length);
    b.comics.more = Math.max(0, b.comics.total - b.comics.markers.length);
  }
  undatedDrafts.more = Math.max(0, undatedDrafts.total - undatedDrafts.markers.length);

  const upcoming = [];
  const months = [];
  for (const b of buckets.values()) {
    if (b.month > nowMonth) upcoming.push(b);
    else months.push(b);
  }
  upcoming.sort((a, b) => b.month.localeCompare(a.month));
  months.sort((a, b) => b.month.localeCompare(a.month));

  return { upcoming, months, undatedDrafts };
}

// --- Backwards-compatible named exports ---
//
// Callers in server.mjs, explorerServer.mjs, downloadActions.mjs, and
// downloadPostsActions.mjs continue to import the names below.

export function getIndex () { return defaultStore().getIndex(); }

function openRows (rows) {
  const out = [];
  for (const row of rows || []) {
    if (!row || row.downloadOpen !== true || row.id == null) continue;
    out.push({
      id: row.id,
      date: row.date || '',
      publishedAt: row.publishedAt || null,
      createdAt: row.createdAt || null
    });
  }
  return out;
}

export function downloadOpenIds () {
  const index = getIndex();
  return {
    posts: openRows(index.posts),
    comics: openRows(index.comics),
    model3ds: openRows(index.model3ds),
    generations: openRows(index.generations)
  };
}

export function hasDownloadOpen () {
  const open = downloadOpenIds();
  return open.posts.length + open.comics.length + open.model3ds.length + open.generations.length > 0;
}
export async function ensureIndexLoaded () { return defaultStore().ensureLoaded(); }
export async function buildIndex () { return defaultStore().ensureLoaded(); }
export async function rebuildIndex () { return defaultStore().rebuild(); }
export async function upsertIndexEntries (entries) { return defaultStore().upsert(entries); }
export async function applyGenerationRemovals (rawGenerations) { return defaultStore().applyGenerationRemovals(rawGenerations); }
export async function compactIndex () { return defaultStore().compact(); }
export function reprojectIndexTagNames () { return defaultStore().reprojectTagNames(); }
export function reprojectIndexMediaItems () { return defaultStore().reprojectMediaItems(); }
export function getMediaItemById (id) { return defaultStore().getMediaItemById(id); }

/** @internal test-only — drop the singleton so the next load re-reads NDJSON. */
export function __resetForTest () {
  _defaultStore = null;
}

// --- Helpers ---

function earliest (a, b) {
  if (!a) return b || '';
  if (!b) return a;
  return a < b ? a : b;
}

function latest (a, b) {
  if (!a) return b || '';
  if (!b) return a;
  return a > b ? a : b;
}
