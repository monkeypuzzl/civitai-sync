/*eslint no-unused-vars: "error"*/

import path from 'node:path';
import { writeFile, fileExists, toDateString, unlink, rename } from './utils.mjs';
import { readFile, listDirectory, isDate } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { downloadMediaFile } from './mediaDownload.mjs';
import { mapPool, MEDIA_POOL_WIDTH } from './requestScheduler.mjs';
import { applyStorageFault } from './downloadFault.mjs';
import { flushFetchMiss } from './fetchMiss.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import {
  needsAceWorkflowFill,
  fetchAceSongIntoSidecar
} from './aceAudioWorkflow.mjs';
import { getMediaOverride, reactionsToTags } from './overrides.mjs';
import { extractInputDescriptors, saveInputMedia } from './inputMedia.mjs';
import { byteMissKeepsOpen, markContainerOpen, commitOpenContainer } from './downloadOpen.mjs';
import { comparableDownloadJson } from './signedUrl.mjs';
import {
  loadAliasStore,
  recordAlias,
  resolveCanonicalId,
  contentKey,
  hashFileSha256
} from './mediaIdentity.mjs';

export function generationsDataDir () { return `${CONFIG.dataPath}/generations`; }
export function generationsMediaDir () { return `${CONFIG.mediaPath}/generations`; }

// The canonical generation media store for a given date — the single source of
// every downloaded generation media-item, and the source the Exports
// projection hard-links FROM. Post-cutover (Exports plan C2) the store is flat:
// `media/generations/<date>`. Per ruling 8 this helper is the SOLE
// canonical-store reference in the exports / sync code, so the layout is
// single-sourced here. Never hard-code the legacy `all/` literal in
// exports/sync code — route every reference through this helper.
export function canonicalGenerationMediaDir (date = '') {
  return `${generationsMediaDir()}/${date}`;
}

// Curation reactions on a media item. A reaction download requests
// `favorite` and/or `feedback:liked` only (`generationReactions`). Disliked
// stays a reaction for overrides and exports; it is not a download choice.
// CLI wording for the download reactions is `DOWNLOAD_TYPES_MOD`.
export const WORKFLOW_TAGS = [ 'favorite', 'feedback:liked', 'feedback:disliked' ];

export { DOWNLOAD_TYPES_MOD, getDownloadTypes } from './downloadTypes.mjs';

export function generationFilepath ({ id = 0, createdAt = '' }) {
  const date = toDateString(createdAt);
  const filepath = `${generationsDataDir()}/${date}/${id}.json`;

  return filepath;
}

// Mesh format from the blob: lowercase, leading dot stripped. Missing → glb.
function normalizeMeshFormat (format) {
  const raw = String(format ?? '').trim().toLowerCase().replace(/^\./, '');
  return raw || 'glb';
}

// Same seed default as mediaFilepath's parameter, so attachment names cannot
// drift from the primary stem.
function generationStem (generationId, seed, mediaId) {
  const seedPart = seed === undefined ? 0 : seed;
  return `${generationId}_${String(seedPart)}_${mediaId}`;
}

export function generationMediaFilename ({ generationId = '', mediaId = '', seed = 0, type = '', format = '' } = {}) {
  const hasExtension = mediaId.includes('.');
  let suffix = '';
  if (!hasExtension) {
    suffix = type === 'model3d' ? `.${normalizeMeshFormat(format)}` : '.jpeg';
  }
  return `${generationStem(generationId, seed, mediaId)}${suffix}`;
}

export function mediaFilepath ({ date = '', generationId = '', mediaId = '', seed = 0, directory = '', type = '', format = '' } = {}) {
  const filename = generationMediaFilename({ generationId, mediaId, seed, type, format });
  const mediaDirectory = `${generationsMediaDir()}/${directory.length ? `${directory}/` : '' }${date}`;
  const filepath = path.resolve(mediaDirectory, filename);

  return filepath;
}

export function legacyMediaFilepaths ({ date = '', generationId = '', mediaId = '', seed = 0 }) {
  const legacyMediaDirectory = `${generationsMediaDir()}/${date}`;
  const hasExtension = mediaId.includes('.');
  const suffix = hasExtension ? '' : '.jpeg';
  const filepaths = [
    `${mediaId}${suffix}`,
    `${generationId}_${String(seed)}${suffix}`,
    `${generationId}_${String(seed)}_${mediaId}${suffix}`
  ].map(filepath =>
    path.resolve(legacyMediaDirectory, filepath)
  );

  return filepaths;
}

export async function getGenerationDates (path = generationsDataDir()) {
  const names = await listDirectory(path);
  const dates = names.filter(isDate);

  return dates;
}

export async function getGenerationIdsByDate (date = '', { includeLegacy = false, includeFailed = true, tags = [] } = {}) {
  const LEGACY_GENERATION_ID_LENGTH = 8 + '.json'.length;
  const filenames = await listDirectory(`${generationsDataDir()}/${date}`);
  const generationIds = filenames
    .filter(f => f.endsWith('.json'))
    .filter(f => includeLegacy ? true : f.length !== LEGACY_GENERATION_ID_LENGTH)
    .map(f => f.slice(0, f.lastIndexOf('.json')));

  if (includeFailed && !tags.length) {
    return generationIds;
  }

  const filteredIds = [];
  
  for (let generationId of generationIds) {
    const generation = await getGeneration(date, generationId);
    const mediaInfo = getGeneratedMediaInfo(generation);

    if (!mediaInfo.length) {
      continue;
    }

    if (tags.length) {
      const matchesTags = tags.some(tag =>
        mediaInfo.some(media => media.tags.includes(tag))
      );

      if (matchesTags) {
        filteredIds.push(generationId);
      }
    }

    else {
      filteredIds.push(generationId);
    }
  }

  return filteredIds;
}

export async function getGeneration (date = '', id, { stringType = false } = {}) {
  const filename = `${generationsDataDir()}/${date}/${id}.json`;

  try {
    const contents = await readFile(filename);

    if (!contents) {
      throw new Error('File empty');
    }

    if (stringType) {
      return contents.toString();
    }

    return JSON.parse(contents);
  }

  catch (error) {
    console.log(`Error retrieving generation, "${filename}", ${error.message}`);
    return null;
  }
}

function generationPublicFile (date, filename) {
  return `/media/generations/${date}/${filename}`;
}

function thumbExtFromUrl (url) {
  const pathPart = String(url || '').split(/[?#]/)[0];
  const ext = path.extname(pathPart).toLowerCase().replace(/^\./, '');
  if (ext === 'png') return 'png';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  return 'png';
}

function pushModel3dFile (files, seenUrls, primaryUrl, entry) {
  const url = entry && entry.url;
  if (!url || url === primaryUrl || seenUrls.has(url)) return;
  if (files.some(file => file.path === entry.path)) return;
  seenUrls.add(url);
  const row = { role: entry.role, format: entry.format, url, path: entry.path };
  if (entry.variant) row.variant = entry.variant;
  files.push(row);
}

function addModel3dAsset (files, seenUrls, primaryUrl, asset, variant, armatureVariant, date, stem) {
  if (!asset || typeof asset !== 'object') return;
  if (asset.url) {
    const format = normalizeMeshFormat(asset.format);
    pushModel3dFile(files, seenUrls, primaryUrl, {
      role: 'variant',
      variant,
      format,
      url: asset.url,
      path: generationPublicFile(date, `${stem}.${variant}.${format}`)
    });
  }
  const fbx = asset.fbx;
  if (fbx && fbx.url) {
    const format = normalizeMeshFormat(fbx.format || 'fbx');
    pushModel3dFile(files, seenUrls, primaryUrl, {
      role: 'variant',
      variant,
      format,
      url: fbx.url,
      path: generationPublicFile(date, `${stem}.${variant}.${format}`)
    });
  }
  const armature = asset.armature;
  if (armatureVariant && armature && armature.url) {
    const format = normalizeMeshFormat(armature.format);
    pushModel3dFile(files, seenUrls, primaryUrl, {
      role: 'variant',
      variant: armatureVariant,
      format,
      url: armature.url,
      path: generationPublicFile(date, `${stem}.${armatureVariant}.${format}`)
    });
  }
}

// Attachments of one mesh, excluding the primary URL. Thumb first, then
// base-format variants (`primary`), then rigged / animated / motion templates.
function model3dFiles (item, { date, stem, primaryUrl }) {
  const files = [];
  const seenUrls = new Set();
  if (item && item.thumbnailUrl) {
    const ext = thumbExtFromUrl(item.thumbnailUrl);
    pushModel3dFile(files, seenUrls, primaryUrl, {
      role: 'thumb',
      format: ext,
      url: item.thumbnailUrl,
      path: generationPublicFile(date, `${stem}.thumb.${ext}`)
    });
  }
  const variants = Array.isArray(item?.variants) ? item.variants : [];
  for (const variant of variants) {
    if (!variant || typeof variant !== 'object' || !variant.url) continue;
    const format = normalizeMeshFormat(variant.format);
    pushModel3dFile(files, seenUrls, primaryUrl, {
      role: 'variant',
      variant: 'primary',
      format,
      url: variant.url,
      path: generationPublicFile(date, `${stem}.primary.${format}`)
    });
  }
  addModel3dAsset(files, seenUrls, primaryUrl, item?.rigged, 'rigged', '', date, stem);
  addModel3dAsset(files, seenUrls, primaryUrl, item?.animated, 'animated', '', date, stem);
  const motions = item?.basicAnimations;
  if (motions && typeof motions === 'object') {
    addModel3dAsset(files, seenUrls, primaryUrl, motions.walking, 'walking', 'walking-armature', date, stem);
    addModel3dAsset(files, seenUrls, primaryUrl, motions.running, 'running', 'running-armature', date, stem);
  }
  return files;
}

function diskPathFromGenerationPublic (publicPath) {
  const marker = '/media/generations/';
  if (typeof publicPath !== 'string') return '';
  const at = publicPath.indexOf(marker);
  if (at === -1) return '';
  const rel = publicPath.slice(at + marker.length);
  if (!rel || rel.split('/').some(part => !part || part === '.' || part === '..')) return '';
  return path.resolve(generationsMediaDir(), rel);
}

// Jpeg-poison repair is a rename of `<stem>.jpeg` onto `<stem>.<format>`.
// No-op when the mesh name already exists, when no `.jpeg` sits beside it,
// or when the destination is itself a jpeg. Never unlinks a glob. Never
// mutates saved JSON.
async function renameJpegPoisonTo (destPath) {
  if (!destPath) return false;
  const ext = path.extname(destPath).toLowerCase();
  if (!ext || ext === '.jpeg' || ext === '.jpg') return false;
  if (await fileExists(destPath)) return false;
  const jpegPath = destPath.slice(0, -ext.length) + '.jpeg';
  if (!(await fileExists(jpegPath))) return false;
  await rename(jpegPath, destPath);
  return true;
}

function logicalMediaType (step, type) {
  if (type === 'model3d' || step?.$type === 'polyGen') return 'model3d';
  if (type === 'audio') return 'audio';
  if (step?.$type === 'aceStepAudio' && type === 'video') return 'audio';
  if (type === 'video') return 'video';
  if (type === 'image' || type == null) return 'image';
  return null;
}

// The single logical-type classifier (Phase 5a keystone). This is the
// hottest seam in the codebase — it runs on every download and every index
// build — so it preserves exact behaviour for the existing image/video/audio
// corpus while separating the wire/container type from the logical media
// type. `model3d` is the fourth logical type (`item.type` or a `polyGen`
// step). An explicit unknown wire type is skipped. An absent type stays
// image. Ported from the data-shape probe's `classifyOutputItem` /
// `isSuppressedStep` (dev/tools/data-shape-probe.mjs), the maintainer-
// validated reference implementation.
export function getGeneratedMediaInfo (generation, { hidden = false } = {}) {
  const { createdAt, steps } = generation;
  const date = toDateString(createdAt);
  const media = [];

  if (!steps) {
    return media;
  }

  steps.forEach((step) => {
    // Skip suppressed intermediate steps: the album-cover `imageGen` and the
    // `chatCompletion` lyric step on multi-step txt2music carry real outputs
    // in the JSON that are NOT user-facing (the same flag marks Wan-style
    // pre-interpolation steps). Enumerating them leaks phantom cover images
    // into the gallery. Older image/video records have no suppressed steps,
    // so this is a no-op for the existing corpus.
    if (step?.metadata?.suppressOutput === true) {
      return;
    }

    // Canonical-first enumeration: media items live under `step.output`
    // (canonical) with `step.images` as the legacy alias Civitai dual-emits
    // during the current rollout (it will be removed upstream). Older records
    // carry only `images`, so `output ?? images` reads both shapes; the items
    // expose the same `{ id, status, seed, url, type, duration }` fields.
    const items = step?.output ?? step?.images;

    if (!Array.isArray(items)) {
      return;
    }

    const metadata = step?.metadata;
    // `params` precedence mirrors buildGenerationEntry (newer shape:
    // gen.metadata.params; older: step.params). Used only for the cover-mode
    // audio duration fallback below.
    const params = generation.metadata?.params || step?.params || {};

    items.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const { id, status, seed, url, type, width, height, aspectRatio } = item;

      // Logical media type (separate from the wire/container `type`).
      // model3d (wire type or a polyGen step) wins before the audio / video /
      // image chain. ACE cover-mode stays the other wire-vs-logical exception.
      // An absent type is still image. An explicit unknown wire type is skipped.
      const logicalType = logicalMediaType(step, type);
      if (!logicalType) return;

      // Duration source: pure-audio `.mp3` outputs carry `item.duration`;
      // cover-mode `.mp4` outputs do not, so fall back to the requested
      // `params.duration`. Top-level `gen.duration` is wall-clock generation
      // time (never audio length) and is intentionally not consulted.
      const duration = item.duration ?? (logicalType === 'audio' ? params.duration : undefined);
      const isModel3d = logicalType === 'model3d';

      const mediaInfo = {
        date,
        generationId: generation.id,
        mediaId: id,
        seed,
        status,
        url,
        type: logicalType,
        duration,
        // Blob width/height on a mesh are layout fakes. Do not copy them.
        width: isModel3d ? 0 : (Number(width) || 0),
        height: isModel3d ? 0 : (Number(height) || 0),
        aspectRatio,
        tags: []
      };

      if (isModel3d) {
        mediaInfo.format = normalizeMeshFormat(item.format);
        mediaInfo.thumbnailUrl = typeof item.thumbnailUrl === 'string' ? item.thumbnailUrl : '';
        mediaInfo.files = model3dFiles(item, {
          date,
          stem: generationStem(generation.id, seed, id),
          primaryUrl: url
        });
      }

      // No file is saved for these. `canceled` is the wire token (one l).
      // Indexing it gives Exports a thumbnail path that was never written.
      if (status === 'failed' || status === 'expired' || status === 'canceled') {
        return;
      }

      // Canonical-first tag-block read: audio and all newer-shape generations
      // carry reactions under `metadata.output`; the legacy alias is
      // `metadata.images` (Civitai dual-emits both during the current
      // rollout). Reading `images`-only would make audio/newer-shape
      // reactions invisible to the media item, so `reaction=favorite` and the
      // Favorite export would silently miss them. Per-id fallback so an id
      // present only in `images` still resolves.
      const mediaTags = metadata ? (metadata.output?.[id] ?? metadata.images?.[id]) : undefined;

      if (mediaTags) {
        // Image deleted from onsite generator
        if (!!mediaTags.hidden !== hidden) {
          return;
        }
        
        const tags = Object.keys(mediaTags)
        .reduce((tags, tag) => {
          const value = mediaTags[tag];

          if (value === true) {
            tags[tag] = true;
          }

          else if (typeof value === 'string') {
            tags[`${tag}:${value}`] = true;
          }

          return tags;
        }, {});

        mediaInfo.tags = Object.keys(tags).sort();
      }
      
      media.push(mediaInfo);
    });
  });
  
  return media;
}

// Effective (override-merged) media info. Thin wrapper over
// getGeneratedMediaInfo: where a media-item has a local reaction override
// (keyed by its NORMALIZED id), its `tags` are replaced by the override's
// reactions; everything else — including the RAW `mediaId` consumers build
// `thumbnailPath` from — is left untouched. This is the single read seam
// through which overrides reach the index and the API; getGeneratedMediaInfo
// stays the pure "what does the server JSON say" function (used for
// download-time diffing and readServerReactions).
//
// Requires loadOverrides() to have populated the override cache; the index
// awaits it in ensureLoaded()/rebuild() before any entry build.
export function getEffectiveMediaInfo (generation, { hidden = false } = {}) {
  const media = getGeneratedMediaInfo(generation, { hidden });

  return media.map(m => {
    const ov = getMediaOverride(normalizeMediaId(m.mediaId));
    if (!ov) return m;
    return { ...m, tags: reactionsToTags(ov) };
  });
}

export async function forEachGeneration (fn, { includeLegacy = false }) {
  try {
    const dates = await getGenerationDates();

    for (let date of dates) {
      const ids = await getGenerationIdsByDate(date, { includeLegacy });

      for (let id of ids) {
        const generation = await getGeneration(date, id);

        if (generation) {
          const result = await fn(generation, { date }) || true;

          if (result === false) {
            return false;
          }
        }
      }
    }
  }

  catch (error) {
    console.error(error);
    return false;
  }

  return true;
}

// TODO: check status for images previously unavailable,
// e.g. downloading while on-site queue is pending. It should
// refresh the generation data and download missing media.
// Workaround, use 'Download missing'
async function syncGenerationOpen (filepath, open) {
  let doc;
  try {
    doc = JSON.parse(await readFile(filepath));
  } catch {
    return null;
  }
  const had = doc.downloadOpen === true;
  if (open === had) return null;
  if (open) doc.downloadOpen = true;
  else delete doc.downloadOpen;
  const written = await saveGenerationData(doc);
  if (!written) return null;
  try {
    const { upsertIndexEntries } = await import('./serverIndex.mjs');
    await upsertIndexEntries({ generations: [doc] });
  } catch {
    // The caller's savedItems upsert is the other chance to publish the flag.
  }
  return doc;
}

export async function saveGenerationData (generation) {
  const { id, createdAt } = generation;
  const filepath = generationFilepath({ id, createdAt });
  
  try {
    await writeFile(filepath, JSON.stringify(generation, null, 2));
    return filepath;
  }

  catch (error) {
    console.error(error);
    return '';
  }
}

// TODO: check status for images previously unavailable,
// e.g. downloading while on-site queue is , it should
// -> refresh the generation data and download missing media.
// Workaround, use 'Download missing'
async function fillAceSongSidecar (generation, { secretKey, signal }) {
  if (!secretKey || (signal && signal.aborted)) return;
  const params = generation?.metadata?.params || generation?.steps?.[0]?.params || {};
  if (!needsAceWorkflowFill(params)) return;
  const audioIds = getGeneratedMediaInfo(generation)
    .filter((m) => m.type === 'audio')
    .map((m) => normalizeMediaId(m.mediaId))
    .filter(Boolean);
  await fetchAceSongIntoSidecar({
    workflowId: generation.id,
    audioIds,
    secretKey,
    signal,
    dataPath: CONFIG.dataPath,
    recall: 'download'
  });
}

export async function saveGenerations (apiGenerationsResponse, {
    overwrite = false,
    overwriteIfModified = false,
    withImages = true,
    log,
    signal,
    secretKey,
    reactions
  } = {}
) {
  const { result } = apiGenerationsResponse;

  const report = {
    generationsNew: 0,
    generationsUpdated: 0,
    generationsSaved: 0,
    imagesSaved: 0,
    videosSaved: 0,
    audioSaved: 0,
    model3dSaved: 0,
    activity: null,
    error: null,
    lastSavedGenerationId: undefined,
    currentGenerations: [],
    currentMedia: undefined,
    // Generations that were freshly saved or overwritten this call. The
    // download orchestrator passes these to upsertIndexEntries() so the
    // server index reflects them without a full filesystem rescan.
    savedItems: []
  };

  const { data } = result;

  if (!data || !('json' in data) || !Array.isArray(data.json.items)) {
    console.log('Unexpected API data', JSON.stringify(data, null, 2));
    return report;
  }

  const { items } = data.json;

  if (!items.length) {
    return report;
  }

  const totalItems = items.length;

  function setActivity (activity) {
    report.activity = activity;
    if (log) log(report);
  }

  report.currentGenerations = items.map(({ id, createdAt }) => ({
    date: toDateString(createdAt),
    id,
    status: 'data-downloaded'
  }));

  for (let itemIndex = 0; itemIndex < totalItems; itemIndex++) {
    const generation = items[itemIndex];
    const genNum = itemIndex + 1;
    const currentReportItem = report.currentGenerations.find(item => item.id === generation.id);

    if (signal && signal.aborted) {
      currentReportItem.status = 'aborted';
      return report;
    }

    setActivity({ phase: 'checking', index: genNum, total: totalItems });

    const { id, createdAt } = generation;
    const date = toDateString(createdAt);
    const filepath = generationFilepath({ id, createdAt });
    const exists = await fileExists(filepath);
    const existed = exists;
    let shouldOverwrite = exists && overwrite;

    if (exists && overwriteIfModified) {
      const savedGenerationString = await getGeneration(date, id, { stringType: true });

      let savedCmp = savedGenerationString;
      try {
        savedCmp = comparableDownloadJson(JSON.parse(savedGenerationString));
      } catch {
        savedCmp = savedGenerationString;
      }
      if (savedCmp !== comparableDownloadJson(generation)) {
        shouldOverwrite = true;

        // Post-cutover there are no tag directories to prune when a reaction
        // is removed on-site: the canonical store holds the single copy, and
        // an export's membership is reconciled by the Exports sync engine
        // (reactive on the change, or on the next bulk/startup reconcile).
      }
    }

    if (shouldOverwrite) {
      currentReportItem.status = 'data-updating';
      await unlink(filepath);
    }

    else if (exists) {
      currentReportItem.status = 'data-exists';
    }

    if (!exists || shouldOverwrite) {
      setActivity({ phase: 'saving', index: genNum, total: totalItems });

      const filepath = await saveGenerationData(generation);

      if (!filepath) {
        currentReportItem.status = 'data-error';
        report.error = { message: 'Could not save generation' };
        return report;
      }

      currentReportItem.status = 'data-saved';
      report.lastSavedGenerationId = { date, id };
      report.generationsSaved ++;
      report.savedItems.push(generation);

      if (secretKey) {
        try {
          await fillAceSongSidecar(generation, { secretKey, signal });
        } catch (error) {
          console.error(error);
        }
      }

      if (!exists) {
        report.generationsNew ++;
      }
    }

    // JSON exists does not skip media (posts parity). Per-file skip and
    // expired CDN fail-soft live inside saveGenerationMedia.
    let mediaIncomplete = false;
    if (withImages) {
      const mediaReport = await saveGenerationMedia(generation, { signal, onProgress: (a) => setActivity(a), reactions });
      mediaIncomplete = mediaReport.incomplete === true;
      const { error, aborted, complete } = mediaReport;

      report.imagesSaved += mediaReport.imagesSaved;
      report.videosSaved += mediaReport.videosSaved;
      report.audioSaved += mediaReport.audioSaved;
      report.model3dSaved += mediaReport.model3dSaved;
      report.aborted = aborted;
      report.complete = complete;
      report.error = null;
      report.currentMedia = mediaReport;
      
      if (error) {
        if (error instanceof Error) {
          report.error = { message: error.message };
        }

        else {
          report.error = error;
        }

        currentReportItem.status = 'media-error';
      }

      else {
        currentReportItem.status = 'media-saved';
      }

    }

    let opened = null;
    const mediaStopped = !!(report.currentMedia && (report.currentMedia.aborted === true || report.currentMedia.fault === 'storage'));
    if (withImages && CONFIG.downloadMedia !== false && !mediaStopped && await fileExists(filepath)) {
      if (!mediaIncomplete) delete generation.downloadOpen;
      opened = await syncGenerationOpen(filepath, mediaIncomplete);
      // A clean finish writes the same JSON the walk started from. Hole-fill
      // must not report that as a saved generation. An incomplete walk does.
      if (opened && mediaIncomplete) report.savedItems.push(opened);
    }

    const mediaWrote = !!(report.currentMedia && (
      (report.currentMedia.imagesSaved || 0) > 0 ||
      (report.currentMedia.videosSaved || 0) > 0 ||
      (report.currentMedia.audioSaved || 0) > 0 ||
      (report.currentMedia.model3dSaved || 0) > 0
    ));
    if (existed && (shouldOverwrite || mediaWrote || opened)) report.generationsUpdated++;

    // Unchanged since download
    if (currentReportItem.status === 'data-downloaded') {
      if (report.currentMedia && (report.currentMedia.imagesSaved > 0 || report.currentMedia.videosSaved > 0 || report.currentMedia.audioSaved > 0 || report.currentMedia.model3dSaved > 0)) {
        currentReportItem.status = 'media-exists';
      }

      else {
        currentReportItem.status = 'done';
      }
    }

    report.activity = null;
    if (log) log(report);
  }

  return report;
}

export function getGenerationImages (generation) {
  // Old API
  if ('images' in generation) {
    return generation.images;
  }

  return generation.steps.map(step => step.images).flat(); 
}

async function recordGenerationContentHash (mediaId, filepath) {
  try {
    await loadAliasStore();
    const hex = await hashFileSha256(filepath);
    if (resolveCanonicalId([contentKey(hex)])) return;
    await recordAlias(normalizeMediaId(mediaId), contentKey(hex));
  } catch {
    // Fail-soft: alias errors must not fail the download.
  }
}

export async function saveGenerationMedia (generation, { doFetch = true, signal, onProgress, reactions } = {}) {
  const media = getGeneratedMediaInfo(generation);
  const report = { imagesSaved: 0, videosSaved: 0, audioSaved: 0, model3dSaved: 0, error: undefined, aborted: false, complete: false };
  try {
  const totalMedia = media.length;

  // The run's tag list, not `generationReactions`. Omitted or empty saves
  // every file. A reaction run passes that run's tags.
  const selectedReactions = Array.isArray(reactions) ? reactions : [];
  const saveEveryFile = selectedReactions.length === 0;
  let opening = null;
  const ensureOpen = () => {
    if (!doFetch || CONFIG.downloadMedia === false) return Promise.resolve();
    if (!opening) {
      opening = markContainerOpen(generation, async () => {
        const filepath = generationFilepath({ id: generation.id, createdAt: generation.createdAt });
        let stored = generation;
        try {
          stored = JSON.parse(await readFile(filepath));
        } catch {
          stored = generation;
        }
        stored.downloadOpen = true;
        generation.downloadOpen = true;
        await commitOpenContainer(stored, 'generations', (doc) => saveGenerationData(doc));
      });
    }
    return opening;
  };

  await mapPool(media, MEDIA_POOL_WIDTH, async (mediaInfo, mediaIndex, poolSignal) => {
    const live = poolSignal || signal;
    if (live?.aborted) {
      report.aborted = true;
      return { stop: true };
    }

    if (!saveEveryFile && !mediaInfo.tags.some(tag => selectedReactions.includes(tag))) {
      return null;
    }

    const itemFilepath = mediaFilepath(mediaInfo);

    if (mediaInfo.type === 'model3d') {
      await renameJpegPoisonTo(itemFilepath);
    }

    const primaryExists = await fileExists(itemFilepath);

    if (mediaInfo.type !== 'model3d') {
      if (primaryExists) {
        await recordGenerationContentHash(mediaInfo.mediaId, itemFilepath);
        return null;
      }

      if (!doFetch) return null;

      if (onProgress) onProgress({ phase: 'media', index: mediaIndex + 1, total: totalMedia });

      await ensureOpen();
      const result = await downloadMediaFile(mediaInfo.url, itemFilepath, { signal: live });

      if (applyStorageFault(report, result) || result.status === 'aborted') {
        report.aborted = true;
        return { stop: true };
      }

      if (result.status !== 'published') {
        if (byteMissKeepsOpen(result)) report.incomplete = true;
        return null;
      }

      if (mediaInfo.type === 'audio') report.audioSaved++;
      else if (mediaInfo.type === 'video') report.videosSaved++;
      else report.imagesSaved++;

      await recordGenerationContentHash(mediaInfo.mediaId, itemFilepath);
      return null;
    }

    if (primaryExists) {
      await recordGenerationContentHash(mediaInfo.mediaId, itemFilepath);
    } else if (doFetch) {
      if (onProgress) onProgress({ phase: 'media', index: mediaIndex + 1, total: totalMedia });
      await ensureOpen();
      const result = await downloadMediaFile(mediaInfo.url, itemFilepath, { signal: live });
      if (applyStorageFault(report, result) || result.status === 'aborted') {
        report.aborted = true;
        return { stop: true };
      }
      if (result.status === 'published') {
        report.model3dSaved++;
        await recordGenerationContentHash(mediaInfo.mediaId, itemFilepath);
      } else if (byteMissKeepsOpen(result)) {
        report.incomplete = true;
      }
    }

    if (doFetch && Array.isArray(mediaInfo.files)) {
      for (const file of mediaInfo.files) {
        if (live?.aborted || report.aborted) return { stop: true };
        const disk = diskPathFromGenerationPublic(file.path);
        if (!disk || !file.url) continue;
        if (await fileExists(disk)) continue;
        await ensureOpen();
        const result = await downloadMediaFile(file.url, disk, { signal: live });
        if (applyStorageFault(report, result) || result.status === 'aborted') {
          report.aborted = true;
          return { stop: true };
        }
        if (byteMissKeepsOpen(result)) report.incomplete = true;
      }
    }
    return null;
  }, { signal });

  if (signal?.aborted) report.aborted = true;
  if (report.aborted) return report;

  // Inputs are captured whenever files are fetched, including on a reaction
  // run. The file filter above does not skip them. Data only does.
  if (doFetch && CONFIG.downloadMedia !== false) {
    const inputDescriptors = extractInputDescriptors(generation, 'generation');
    const inputs = await saveInputMedia(inputDescriptors, { signal, onProgress, recall: 'download' });
    if (inputs && inputs.fault === 'storage') {
      report.fault = 'storage';
      report.aborted = true;
      return report;
    }

    if (signal && signal.aborted) {
      report.aborted = true;
      return report;
    }
  }

  report.complete = true;
  return report;
  } finally {
    await flushFetchMiss();
  }
}

export async function deleteAllDeletedMedia () {
  console.log('Removing local generation files that were deleted on Civitai...');
  let count = 0;
  const hiddenGenerations = [];

  await forEachGeneration(async (generation) => {
    // Once per generation. The tag block may live only on `output` (audio);
    // requiring an `images` key skipped those files.
    const hiddenMedia = getGeneratedMediaInfo(generation, { hidden: true });

    if (!hiddenMedia.length) {
      return;
    }

    for (const mediaInfo of hiddenMedia) {
      // Post-cutover there is a single canonical copy; unlink it, plus each
      // listed attachment. No glob. Export hard links self-heal on the next reconcile.
      const paths = [mediaFilepath(mediaInfo)];
      for (const file of mediaInfo.files || []) {
        const disk = diskPathFromGenerationPublic(file.path);
        if (disk) paths.push(disk);
      }
      const seen = new Set();
      for (const filepath of paths) {
        if (!filepath || seen.has(filepath)) continue;
        seen.add(filepath);
        if (await fileExists(filepath)) {
          await unlink(filepath);
          count ++;
        }
      }
    }

    hiddenGenerations.push(generation);
  }, { includeLegacy: true });

  if (hiddenGenerations.length) {
    // Dynamic import: serverIndex already imports this module.
    const { applyGenerationRemovals } = await import('./serverIndex.mjs');
    await applyGenerationRemovals(hiddenGenerations);
  }

  console.log(`${count} files were removed.`);
}
