import http from 'node:http';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG, CURRENT_VERSION } from './cli.mjs';
import { nodeNoticeFor } from './nodeGate.mjs';
import { isCloudSyncPath } from './exports.mjs';
import { getIndex, buildIndex, rebuildIndex, collectVersionIdsFromIndex, collectTagIdsFromIndex, upsertIndexEntries, reprojectIndexTagNames, reprojectIndexMediaItems, getMediaItemById, aggregateModelCatalog, aggregateModelPage, computeOverview, computeFacetValues, computeListOffer, computeTagFacet, warmListOffers, refillListOffersWhenIdle, computeModelHierarchy, computeDateBounds, computeAspectTree, computeTypeWorkflowTree, isProduced, isGenerationBacked, isPostBacked, isComicBacked, model3dForGeneration, model3dForImageId, hasDownloadOpen } from './serverIndex.mjs';
import { inputsMediaDir } from './inputMedia.mjs';
import { parseByteRange } from './httpRange.mjs';
import { generationsDataDir, generationsMediaDir, getGeneration } from './generations.mjs';
import { repairModel3dOnce } from './model3dRepair.mjs';
import { postsMediaDir, postsDataDir, postFilepath, postsNeedGenerationData, postsNeedImageResources, postsNeedGenerationResponse } from './posts.mjs';
import { comicsMediaDir, comicsDataDir, comicFilepath } from './comics.mjs';
import { model3dsMediaDir, model3dsDataDir, model3dFilepath } from './model3ds.mjs';
import { imageBrowsingLevel } from './imageBrowsingLevel.mjs';
import { isRatingTagName } from '../dev/ui/src/lib/browsing-level.js';
import { readFile } from './utils.mjs';
import { normalizeMediaId, MEDIA_FILE_EXTS } from './mediaId.mjs';
import {
  applyFacets,
  applySort,
  paginateGrouped,
  isValidGroupAxis,
  mediaItemToFilterable,
  toTile,
  originFileForOverlay,
  derivePostStatus,
  deriveComicStatus,
  model3dListOffer,
  projectInputsForDetail,
  projectUsedInPreview,
  usedInConsumers,
  earliestUsedInDate,
  isInputOnlyItem,
  ownerReactionsForMember,
  ownerReactionsForStill
} from './explorerQuery.mjs';
import { buildDetailOrigin, containerListTile, originArgsFromSearchParams } from './originList.mjs';
import { model3dNeighbourOrigin } from './model3dNeighbours.mjs';
import {
  ensureTagCacheLoaded,
  getMissingTagIds,
  fetchMissingTagNames,
  formatTagName
} from './tagCache.mjs';
import {
  getMediaOverride,
  setMediaOverride,
  clearMediaOverride,
  readServerReactions,
  reactionsToTags,
  reactionsEqual,
  mergeOccurrenceReactions
} from './overrides.mjs';
import { loadUiPrefs, patchUiPrefs } from './explorerUiPrefs.mjs';
import { buildAutoSpec, classifyDownloadFinish, worsenQueueClass } from './autoDownload.mjs';
import { createAutoRunner } from './autoDownloadRun.mjs';
import { isAuthFault, isStorageFault } from './downloadFault.mjs';
import {
  notifyReactionChanged,
  notifyReactionsChanged,
  notifyDownloadCompleted,
  listExports,
  readExport,
  createExport,
  updateExport,
  deleteExport,
  deleteExportWithFiles,
  countRemovalFiles,
  startBulkSync,
  planExport,
  planExportDraft,
  getSyncJob,
  subscribeSyncJob,
  cancelSyncJob,
  invalidateDependencyMap,
  exportStatusPayload,
  reconcileExports,
  resolveExportRoot
} from './exports.mjs';
import { setConfig, setConfigParam } from './config.mjs';
import { fetchGenerations } from './downloadActions.mjs';
import { fetchPostsAllKinds } from './downloadPostsActions.mjs';
import { fetchComics } from './downloadComicsActions.mjs';
import { fetchModel3ds } from './downloadModel3dsActions.mjs';
import { getModel3dByPostId } from './civitaiApi.mjs';
import { execFile } from 'node:child_process';
import { buildOpenFolderLaunch } from './openFolderLaunch.mjs';
import os from 'node:os';
import { decryptAES } from './crypto.mjs';
import { fillIfMissing, refreshOnce } from './userData.mjs';
import { getAvailableSecretKey, setMemoizedSecretKey } from './keyActions.mjs';
import { requireLibraryAccount, onBeforeAccountCachePurge } from './accountIdentity.mjs';
import { applyDownloadModes, generationDownloadTags, rememberGenerationDownload, rememberPostDownload, rememberComicDownload, rememberModel3dDownload, settleRememberedMode, normalizeGenerationReactions } from './downloadTypes.mjs';
import { acceptQueueBody, stepDownloadQueue, queueSnapshot } from './downloadQueue.mjs';
import { CIVITAI_DOMAINS, getCivitaiDomain, civitaiUrl } from './civitaiDomain.mjs';
import { composeModelLeafCard } from './modelLeafCard.mjs';
import {
  ensureModelVersionCacheLoaded,
  getModelCacheStatus,
  fetchMissingModelVersions,
  getModelVersionsDueForRefresh,
  getRefreshableModelVersions,
  getModelVersionFromCache
} from './modelVersionCache.mjs';
import { hydrateItemForDisplay, memberDisplaySlots } from './checkpointResolution.mjs';
import {
  abortOwnModelsCheck,
  currentOwnModels,
  refreshOwnModels,
  scheduleOwnModelsCheck
} from './ownModels.mjs';
import { backfillContentHashes } from './contentHashBackfill.mjs';
import { backfillAspectFileDims } from './mediaFileDimensions.mjs';
import { backfillAceAudio } from './aceAudioBackfill.mjs';
import {
  armExplorerIdle,
  beginExplorerRequest,
  endExplorerRequest,
  allowBackgroundDuringRequest,
  setMeasurementWalksSuspended,
  waitForExplorerIdle
} from './explorerIdle.mjs';
import {
  armLibraryPreparation,
  settleLibraryPreparation,
  libraryPreparationActive,
  libraryPreparationPhase,
  onLibraryPreparationChange
} from './libraryPreparation.mjs';

export { buildOpenFolderLaunch };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.resolve(__dirname, 'ui');
const DEFAULT_PORT = 3456;

// --- Download Manager ---

const downloadState = {
  active: false,
  starting: false,
  userStop: false,
  type: null,
  mode: null,
  abortController: null,
  progress: null,
  startedAt: null,
  queue: null
};

async function readAutoSpec () {
  const prefs = await loadUiPrefs();
  let postsNeedUpdate = false;
  try {
    postsNeedUpdate = (await postsNeedGenerationData())
      || (await postsNeedImageResources())
      || (await postsNeedGenerationResponse());
  } catch {
    postsNeedUpdate = false;
  }
  return buildAutoSpec({
    downloadTypes: prefs.downloadTypes,
    downloadRecheck: prefs.downloadRecheck === true,
    generationDownload: CONFIG.generationDownload,
    generationReactions: CONFIG.generationReactions,
    postDownload: CONFIG.postDownload,
    comicDownload: CONFIG.comicDownload,
    model3dDownload: CONFIG.model3dDownload,
    postsNeedUpdate
  });
}

const autoRunner = createAutoRunner({
  schedule (fn, ms, opts) {
    if (opts && opts.repeat) return setInterval(fn, ms);
    return setTimeout(fn, ms);
  },
  clear (handle) {
    clearTimeout(handle);
    clearInterval(handle);
  },
  startQueue (spec) {
    return startDownloadQueue(spec);
  },
  readSpec: readAutoSpec,
  onPhase (snap) {
    broadcastSSE({ type: 'auto', ...snap });
  }
});

function autoSnapshot () {
  return autoRunner.snapshot();
}

// --- Model-cache Manager ---
//
// The model-version cache (`src/modelVersionCache.mjs`) is populated lazily.
// Auto-invocation runs in two situations:
//
//   1. After every successful download (generations / posts / future
//      comics): scope = newly-known versionIds + non-permanent records due
//      for refresh (>30 days since last check). Combined into a single
//      pass per download.
//
//   2. The user clicks "Refresh model metadata" in Settings: scope = every
//      non-permanent record (force=true). Permanent records (90+ days of
//      consistent 404s) are never refreshed; their data is final from the
//      cache's perspective.
//
// Serialisation: the model-cache flow defers behind active downloads. If a
// new download starts mid-flight, the model-cache run is aborted and will
// re-trigger from the download's after-completion hook, which combines new
// versionIds with the existing due-for-refresh set.

const modelCacheState = {
  active: false,
  trigger: null,         // 'after-download' | 'manual' | null
  abortController: null,
  startedAt: null,
  total: 0,
  fetched: 0,
  tombstoned: 0,
  preserved: 0,
  errors: 0
};

const sseClients = new Set();

export function closeSSEClients () {
  for (const res of sseClients) {
    try { res.end(); } catch { /* already closed */ }
  }
  sseClients.clear();
}

function broadcastSSE (data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

onLibraryPreparationChange(({ active, phase }) => {
  broadcastSSE({ type: 'preparation', active, phase });
});

const NETWORK_ERROR_CODES = ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'FETCH_ERROR'];

function friendlyErrorMessage (errors) {
  if (!errors || !errors.length) return 'Unknown error';
  const first = errors[0];
  const msg = first?.message || first?.json?.message || first?.error || String(first);
  const code = first?.code || first?.cause?.code || first?.json?.data?.code || '';
  if (NETWORK_ERROR_CODES.includes(code) || /fetch failed|network|ECONNR|ETIMEDOUT/i.test(msg)) {
    return 'Civitai service is unavailable. Try again shortly.';
  }
  // Prefer Civitai's own sentence when the fetch boundary already parsed it.
  if (typeof first?.message === 'string' && first.message.trim() && first.message !== String(code)) {
    return first.message;
  }
  if (/UNAUTHORIZED/i.test(msg) || /UNAUTHORIZED/i.test(code)) {
    return 'API key is invalid or expired. Update your API key.';
  }
  return msg || 'Unknown error';
}

async function resolveUsername (secretKey) {
  if (CONFIG.username) return CONFIG.username;

  try {
    await fillIfMissing({ secretKey });
  } catch (err) {
    return { error: err?.message || 'Civitai service unavailable' };
  }

  return CONFIG.username || null;
}

function finishExplorerDownload () {
  downloadState.active = false;
  setMeasurementWalksSuspended(false);
}

function runAfterDownloadHooks (secretKey) {
  if (!secretKey) return;
  triggerModelCacheAfterDownload(secretKey);
  triggerTagCacheAfterDownload(secretKey);
  triggerExportsAfterDownload();
  triggerOwnModelsAfterDownload(secretKey);
}

function downloadWrote (report) {
  if (!report) return false;
  return [
    'generationsNew', 'generationsUpdated',
    'postsNew', 'postsUpdated',
    'comicsNew', 'comicsUpdated',
    'model3dsNew', 'model3dsUpdated',
    'imagesSaved', 'videosSaved', 'audioSaved', 'model3dSaved', 'filesSaved'
  ].some((key) => (report[key] || 0) > 0);
}

function slimDownloadProgress (report) {
  if (!report) return null;
  return {
    generationsNew: report.generationsNew || 0,
    generationsUpdated: report.generationsUpdated || 0,
    postsNew: report.postsNew || 0,
    postsUpdated: report.postsUpdated || 0,
    comicsNew: report.comicsNew || 0,
    comicsUpdated: report.comicsUpdated || 0,
    model3dsNew: report.model3dsNew || 0,
    model3dsUpdated: report.model3dsUpdated || 0,
    imagesSaved: report.imagesSaved || 0,
    videosSaved: report.videosSaved || 0,
    audioSaved: report.audioSaved || 0,
    model3dSaved: report.model3dSaved || 0,
    filesSaved: report.filesSaved || 0,
    activity: report.activity || null
  };
}

function liveQueueSnapshot () {
  const queued = downloadState.queue;
  if (!queued) return null;
  return queueSnapshot({
    types: queued.types,
    results: queued.results,
    current: downloadState.type,
    startedAt: queued.startedAt,
    progress: slimDownloadProgress(downloadState.progress),
    spec: queued.spec,
    closed: false
  });
}

function downloadElapsed () {
  const started = downloadState.queue
    ? downloadState.queue.startedAt
    : downloadState.startedAt;
  return started ? Date.now() - started : 0;
}

function emitDownload (event) {
  const body = { ...event, elapsed: downloadElapsed() };
  const queue = liveQueueSnapshot();
  if (queue) body.queue = queue;
  broadcastSSE(body);
}

function endQueue () {
  downloadState.queue = null;
  downloadState.active = false;
  downloadState.type = null;
  downloadState.mode = null;
  downloadState.abortController = null;
  downloadState.progress = null;
  setMeasurementWalksSuspended(false);
}

function outcomeFromEvent (event) {
  return {
    type: event.type,
    status: event.status,
    message: event.message,
    errors: event.errors || 0,
    generationsNew: event.generationsNew || 0,
    generationsUpdated: event.generationsUpdated || 0,
    postsNew: event.postsNew || 0,
    postsUpdated: event.postsUpdated || 0,
    comicsNew: event.comicsNew || 0,
    comicsUpdated: event.comicsUpdated || 0,
    model3dsNew: event.model3dsNew || 0,
    model3dsUpdated: event.model3dsUpdated || 0,
    imagesSaved: event.imagesSaved || 0,
    videosSaved: event.videosSaved || 0,
    audioSaved: event.audioSaved || 0,
    model3dSaved: event.model3dSaved || 0,
    filesSaved: event.filesSaved || 0
  };
}

function rememberedForPortion (type) {
  if (type === 'generations') {
    if (downloadState.mode === 'missing-all') return 'all';
    if (downloadState.mode === 'missing-tags') return 'reactions';
    if (downloadState.mode === 'latest') return 'latest';
    return null;
  }
  if (type === 'posts' || type === 'comics' || type === 'model3ds') {
    return downloadState.mode === 'all' || downloadState.mode === 'latest' ? downloadState.mode : null;
  }
  return null;
}

function finishKind (event) {
  return classifyDownloadFinish({
    status: event && event.status,
    fault: event && event.fault,
    userStop: downloadState.userStop === true
  });
}

function clearRecheckIfClean (queued) {
  if (!queued || !queued.spec || queued.spec.recheck !== true) return;
  const watched = (queued.types || []).filter(id => id === 'posts' || id === 'comics');
  if (!watched.length) return;
  const results = queued.results || [];
  const clean = watched.every(id => results.some(item => (
    item && item.type === id && item.status === 'complete' && !item.errors
  )));
  if (!clean) return;
  patchUiPrefs({ downloadRecheck: false }).catch(() => {});
}

function finishType (event) {
  const remembered = rememberedForPortion(event && event.type);
  if (remembered) {
    settleRememberedMode(event.type, remembered, event).catch(() => {});
  }
  const queued = downloadState.queue;
  if (!queued) {
    emitDownload(event);
    finishExplorerDownload();
    autoRunner.noteFinish(finishKind(event));
    downloadState.userStop = false;
    if (event.status === 'complete') runAfterDownloadHooks(getAvailableSecretKey());
    return;
  }

  queued.class = worsenQueueClass(queued.class, finishKind(event));

  const step = stepDownloadQueue(queued, outcomeFromEvent(event));
  queued.results = step.results;
  queued.cursor = step.cursor;
  const terminal = step.done;
  downloadState.abortController = null;
  if (terminal) downloadState.progress = null;

  const queue = queueSnapshot({
    types: queued.types,
    results: queued.results,
    current: terminal ? null : downloadState.type,
    startedAt: queued.startedAt,
    progress: terminal ? null : slimDownloadProgress(downloadState.progress),
    spec: queued.spec,
    closed: terminal
  });
  broadcastSSE({ ...event, elapsed: Date.now() - queued.startedAt, final: true, queue });

  if (!terminal && step.startType) {
    const next = step.startType;
    runQueuedType(next).then(result => {
      if (result && result.error && downloadState.queue) {
        finishType({
          type: next,
          status: 'error',
          message: result.error,
          errors: 1,
          final: true
        });
      }
    }).catch(err => {
      if (downloadState.queue) {
        finishType({
          type: next,
          status: 'error',
          message: friendlyErrorMessage([err]),
          errors: 1,
          final: true
        });
      }
    });
    return;
  }

  const hooks = step.hooks;
  const secretKey = queued.secretKey;
  const finalKind = queued.class || 'steady';
  const finished = {
    spec: queued.spec,
    types: queued.types,
    results: queued.results
  };
  endQueue();
  downloadState.userStop = false;
  autoRunner.noteFinish(finalKind);
  if (finalKind === 'steady') clearRecheckIfClean(finished);
  if (hooks) runAfterDownloadHooks(secretKey);
}

function closeQueueIdle () {
  const queued = downloadState.queue;
  if (!queued) return;
  const type = downloadState.type || queued.types[0];
  const hooks = queued.results.some(result => result && result.status === 'complete');
  const secretKey = queued.secretKey;
  const queue = queueSnapshot({
    types: queued.types,
    results: queued.results,
    current: null,
    startedAt: queued.startedAt,
    progress: null,
    spec: queued.spec,
    closed: true
  });
  broadcastSSE({
    type,
    status: 'aborted',
    final: true,
    queue,
    elapsed: queued.startedAt ? Date.now() - queued.startedAt : 0
  });
  endQueue();
  downloadState.userStop = false;
  autoRunner.noteFinish('aborted');
  if (hooks) runAfterDownloadHooks(secretKey);
}

function queueHalted () {
  return !downloadState.queue || downloadState.queue.halt === true;
}

async function runQueuedType (type) {
  if (queueHalted()) return { stopped: true };
  const spec = downloadState.queue.spec || {};
  if (type === 'generations') {
    return startDownloadGenerations(spec.generations && spec.generations.mode, { fromQueue: true });
  }
  if (type === 'posts') {
    const posts = spec.posts || {};
    return startDownloadPosts(posts.mode, { checkAllMedia: posts.checkAllMedia === true, fromQueue: true });
  }
  if (type === 'comics') {
    const comics = spec.comics || {};
    return startDownloadComics({
      mode: comics.mode === 'all' ? 'all' : 'latest',
      checkAllMedia: comics.checkAllMedia === true,
      fromQueue: true
    });
  }
  if (type === 'model3ds') {
    const model3ds = spec.model3ds || {};
    return startDownloadModel3ds({
      mode: model3ds.mode === 'all' ? 'all' : 'latest',
      fromQueue: true
    });
  }
  return { error: 'No download type selected' };
}

export async function startDownloadQueue (body) {
  const accepted = acceptQueueBody(body);
  if (accepted.error) return accepted;
  if (downloadState.active || downloadState.queue || downloadState.starting) {
    return { error: 'A download is already in progress', code: 'busy' };
  }
  downloadState.starting = true;
  const gated = await gateDownloadKey();
  if (gated.error) {
    downloadState.starting = false;
    return { error: gated.error, fatal: true, code: 'auth' };
  }
  const secretKey = gated.secretKey;

  const now = Date.now();
  downloadState.queue = {
    types: accepted.types,
    spec: accepted.spec,
    results: [],
    cursor: 0,
    startedAt: now,
    halt: false,
    class: 'steady',
    secretKey
  };
  downloadState.active = true;
  downloadState.starting = false;
  downloadState.startedAt = now;

  let result;
  try {
    result = await runQueuedType(accepted.types[0]);
  } catch (err) {
    result = { error: friendlyErrorMessage([err]) };
  }
  if (result && result.stopped) {
    if (downloadState.queue) closeQueueIdle();
    return { ok: true, queue: null };
  }
  if (result && result.error) {
    if (downloadState.queue) {
      finishType({
        type: accepted.types[0],
        status: 'error',
        message: result.error,
        errors: 1,
        final: true
      });
    }
    return { error: result.error };
  }
  return { ok: true, queue: liveQueueSnapshot() };
}

async function startDownloadGenerations (mode, { fromQueue = false } = {}) {
  if (!fromQueue && (downloadState.active || downloadState.queue)) {
    return { error: 'A download is already in progress' };
  }

  const gated = await gateDownloadKey();
  if (gated.error) return gated;
  const secretKey = gated.secretKey;

  await rememberGenerationDownload(mode);
  if (fromQueue && queueHalted()) return { stopped: true };

  // If a model-cache / tag-cache refresh is running, abort it so the
  // download has the full network rate-limit budget. The after-download
  // hooks re-trigger fresh passes, picking up where the aborted runs left off.
  preemptModelCacheForDownload();
  preemptTagCacheForDownload();
  abortOwnModelsCheck();
  setMeasurementWalksSuspended(true);

  const tags = generationDownloadTags(mode);

  downloadState.active = true;
  downloadState.type = 'generations';
  downloadState.mode = mode;
  downloadState.abortController = new AbortController();
  downloadState.startedAt = Date.now();
  downloadState.progress = null;

  emitDownload({ type: 'generations', status: 'downloading', mode });

  fetchGenerations({
    secretKey,
    overwriteIfModified: true,
    withImages: CONFIG.downloadMedia !== false,
    tags,
    latest: mode === 'latest',
    resume: mode === 'missing-tags' || mode === 'missing-all',
    log: () => {},
    onProgress: (report) => {
      downloadState.progress = report;
      emitDownload({
        type: 'generations',
        status: report.aborted ? 'aborted' : report.complete ? 'complete' : 'downloading',
        generationsNew: report.generationsNew || 0,
        generationsUpdated: report.generationsUpdated || 0,
        imagesSaved: report.imagesSaved || 0,
        videosSaved: report.videosSaved || 0,
        audioSaved: report.audioSaved || 0,
        model3dSaved: report.model3dSaved || 0,
        batchDate: report.batchDate || '',
        activity: report.activity || null,
        errors: (report.errors || []).length
      });
    },
    signal: downloadState.abortController.signal
  }).then(async (report) => {
    let status = report?.aborted ? 'aborted' : (report?.errors?.length && !downloadWrote(report)) ? 'error' : 'complete';
    const fault = report?.fault;
    if (!report?.aborted && (fault === 'storage' || fault === 'auth' || fault === 'network')) status = 'error';
    finishType({
      type: 'generations',
      status,
      fault,
      message: status === 'error' ? friendlyErrorMessage(report?.errors) : undefined,
      generationsNew: report?.generationsNew || 0,
      generationsUpdated: report?.generationsUpdated || 0,
      imagesSaved: report?.imagesSaved || 0,
      videosSaved: report?.videosSaved || 0,
      audioSaved: report?.audioSaved || 0,
      model3dSaved: report?.model3dSaved || 0,
      errors: (report?.errors || []).length,
      final: true
    });
  }).catch((err) => {
    const fault = isStorageFault(err) ? 'storage' : isAuthFault(err) ? 'auth' : 'network';
    finishType({ type: 'generations', status: 'error', fault, message: friendlyErrorMessage([err]), errors: 1, final: true });
  });

  return { ok: true, type: 'generations', mode };
}

async function startDownloadPosts (mode, { checkAllMedia = false, fromQueue = false } = {}) {
  if (!fromQueue && (downloadState.active || downloadState.queue)) {
    return { error: 'A download is already in progress' };
  }

  const gated = await gateDownloadKey();
  if (gated.error) return gated;
  const secretKey = gated.secretKey;

  preemptModelCacheForDownload();
  preemptTagCacheForDownload();
  abortOwnModelsCheck();

  const username = await resolveUsername(secretKey);
  if (fromQueue && queueHalted()) return { stopped: true };
  if (username && typeof username === 'object' && username.error) {
    return { error: `Civitai service unavailable. Try again shortly. (${username.error})` };
  }
  if (!username) return { error: 'Could not resolve username. Check your API key.' };

  await rememberPostDownload(mode);
  if (fromQueue && queueHalted()) return { stopped: true };

  setMeasurementWalksSuspended(true);

  downloadState.active = true;
  downloadState.type = 'posts';
  downloadState.mode = mode;
  downloadState.abortController = new AbortController();
  downloadState.startedAt = Date.now();
  downloadState.progress = null;

  emitDownload({ type: 'posts', status: 'downloading', mode });

  fetchPostsAllKinds({
    secretKey,
    username,
    latest: mode === 'latest',
    checkAllMedia: mode === 'all' && checkAllMedia === true,
    withImages: CONFIG.downloadMedia !== false,
    log: () => {},
    onProgress: (report) => {
      downloadState.progress = report;
      emitDownload({
        type: 'posts',
        status: report.aborted ? 'aborted' : report.complete ? 'complete' : 'downloading',
        postsNew: report.postsNew || 0,
        postsUpdated: report.postsUpdated || 0,
        imagesSaved: report.imagesSaved || 0,
        videosSaved: report.videosSaved || 0,
        audioSaved: report.audioSaved || 0,
        batchDate: report.batchDate || '',
        activity: report.activity || null,
        errors: (report.errors || []).length
      });
    },
    signal: downloadState.abortController.signal
  }).then(async (report) => {
    let status = report?.aborted ? 'aborted' : (report?.errors?.length && !downloadWrote(report)) ? 'error' : 'complete';
    const fault = report?.fault;
    if (!report?.aborted && (fault === 'storage' || fault === 'auth' || fault === 'network')) status = 'error';
    finishType({
      type: 'posts',
      status,
      fault,
      message: status === 'error' ? friendlyErrorMessage(report?.errors) : undefined,
      postsNew: report?.postsNew || 0,
      postsUpdated: report?.postsUpdated || 0,
      imagesSaved: report?.imagesSaved || 0,
      videosSaved: report?.videosSaved || 0,
      audioSaved: report?.audioSaved || 0,
      errors: (report?.errors || []).length,
      final: true
    });
  }).catch((err) => {
    const fault = isStorageFault(err) ? 'storage' : isAuthFault(err) ? 'auth' : 'network';
    finishType({ type: 'posts', status: 'error', fault, message: friendlyErrorMessage([err]), errors: 1, final: true });
  });

  return { ok: true, type: 'posts', mode };
}

async function startDownloadComics ({ mode = 'latest', checkAllMedia = false, fromQueue = false } = {}) {
  if (!fromQueue && (downloadState.active || downloadState.queue)) {
    return { error: 'A download is already in progress' };
  }

  const gated = await gateDownloadKey();
  if (gated.error) return gated;
  const secretKey = gated.secretKey;
  if (fromQueue && queueHalted()) return { stopped: true };

  preemptModelCacheForDownload();
  preemptTagCacheForDownload();
  abortOwnModelsCheck();
  if (fromQueue && queueHalted()) return { stopped: true };
  setMeasurementWalksSuspended(true);

  const comicMode = mode === 'all' ? 'all' : 'latest';
  await rememberComicDownload(comicMode);
  if (fromQueue && queueHalted()) return { stopped: true };

  downloadState.active = true;
  downloadState.type = 'comics';
  downloadState.mode = comicMode;
  downloadState.abortController = new AbortController();
  downloadState.startedAt = Date.now();
  downloadState.progress = null;

  emitDownload({ type: 'comics', status: 'downloading' });

  fetchComics({
    secretKey,
    latest: comicMode !== 'all',
    checkAllMedia: checkAllMedia === true,
    withImages: CONFIG.downloadMedia !== false,
    log: () => {},
    onProgress: (report) => {
      downloadState.progress = report;
      emitDownload({
        type: 'comics',
        status: report.aborted ? 'aborted' : report.complete ? 'complete' : 'downloading',
        comicsNew: report.comicsNew || 0,
        comicsUpdated: report.comicsUpdated || 0,
        imagesSaved: report.imagesSaved || 0,
        activity: report.activity || null,
        errors: (report.errors || []).length
      });
    },
    signal: downloadState.abortController.signal
  }).then(async (report) => {
    let status = report?.aborted ? 'aborted' : (report?.errors?.length && !downloadWrote(report)) ? 'error' : 'complete';
    const fault = report?.fault;
    if (!report?.aborted && (fault === 'storage' || fault === 'auth' || fault === 'network')) status = 'error';
    finishType({
      type: 'comics',
      status,
      fault,
      message: status === 'error' ? friendlyErrorMessage(report?.errors) : undefined,
      comicsNew: report?.comicsNew || 0,
      comicsUpdated: report?.comicsUpdated || 0,
      imagesSaved: report?.imagesSaved || 0,
      errors: (report?.errors || []).length,
      final: true
    });
  }).catch((err) => {
    const fault = isStorageFault(err) ? 'storage' : isAuthFault(err) ? 'auth' : 'network';
    finishType({ type: 'comics', status: 'error', fault, message: friendlyErrorMessage([err]), errors: 1, final: true });
  });

  return { ok: true, type: 'comics' };
}

async function startDownloadModel3ds ({ mode = 'latest', fromQueue = false } = {}) {
  if (!fromQueue && (downloadState.active || downloadState.queue)) {
    return { error: 'A download is already in progress' };
  }

  const gated = await gateDownloadKey();
  if (gated.error) return gated;
  const secretKey = gated.secretKey;

  preemptModelCacheForDownload();
  preemptTagCacheForDownload();
  abortOwnModelsCheck();

  const username = await resolveUsername(secretKey);
  if (fromQueue && queueHalted()) return { stopped: true };
  if (username && typeof username === 'object' && username.error) {
    return { error: `Civitai service unavailable. Try again shortly. (${username.error})` };
  }
  if (!username) return { error: 'Could not resolve username. Check your API key.' };

  setMeasurementWalksSuspended(true);

  const model3dMode = mode === 'all' ? 'all' : 'latest';
  await rememberModel3dDownload(model3dMode);
  if (fromQueue && queueHalted()) return { stopped: true };

  downloadState.active = true;
  downloadState.type = 'model3ds';
  downloadState.mode = model3dMode;
  downloadState.abortController = new AbortController();
  downloadState.startedAt = Date.now();
  downloadState.progress = null;

  emitDownload({ type: 'model3ds', status: 'downloading' });

  fetchModel3ds({
    username,
    secretKey,
    latest: model3dMode !== 'all',
    withImages: CONFIG.downloadMedia !== false,
    log: () => {},
    onProgress: (report) => {
      downloadState.progress = report;
      emitDownload({
        type: 'model3ds',
        status: report.aborted ? 'aborted' : report.complete ? 'complete' : 'downloading',
        model3dsNew: report.model3dsNew || 0,
        model3dsUpdated: report.model3dsUpdated || 0,
        filesSaved: report.filesSaved || 0,
        activity: report.activity || null,
        errors: (report.errors || []).length
      });
    },
    signal: downloadState.abortController.signal
  }).then(async (report) => {
    let status = report?.feedUnavailable
      ? 'error'
      : report?.aborted
        ? 'aborted'
        : (report?.errors?.length && !downloadWrote(report)) ? 'error' : 'complete';
    const fault = report?.fault;
    if (!report?.aborted && (fault === 'storage' || fault === 'auth' || fault === 'network')) status = 'error';
    finishType({
      type: 'model3ds',
      status,
      fault,
      message: status === 'error' ? friendlyErrorMessage(report?.errors) : undefined,
      model3dsNew: report?.model3dsNew || 0,
      model3dsUpdated: report?.model3dsUpdated || 0,
      filesSaved: report?.filesSaved || 0,
      errors: (report?.errors || []).length,
      final: true
    });
  }).catch((err) => {
    const fault = isStorageFault(err) ? 'storage' : isAuthFault(err) ? 'auth' : 'network';
    finishType({ type: 'model3ds', status: 'error', fault, message: friendlyErrorMessage([err]), errors: 1, final: true });
  });

  return { ok: true, type: 'model3ds' };
}

// ---------------------------------------------------------------------------
// Model-cache orchestration.
//
// Three entry points:
//
//   - `triggerModelCacheAfterDownload(secretKey)` — fire-and-forget wrapper
//     used by the download-completion hooks. Walks the current index for
//     unique versionIds, combines with the cache's due-for-refresh set, and
//     starts a run unless one is already active or a download is.
//
//   - `startModelCacheRefresh({ force, secretKey })` — used by the manual
//     "Refresh model metadata" button. Refuses if a download is active; if
//     a model-cache run is already active, returns 409.
//
//   - `cancelModelCacheRefresh()` — aborts the active run.
//
// Serialisation is enforced: a download in progress preempts model-cache
// work (we never start one while a download is active, and starting a
// download cancels any active model-cache run so the network rate-limit is
// not split).

function triggerOwnModelsAfterDownload (secretKey) {
  scheduleOwnModelsCheck({
    secretKey,
    isBlocked: () => downloadState.active,
    onReady: () => broadcastSSE({ type: 'own-models', status: 'ready' })
  }).catch(() => {});
}

function triggerOwnModelsIfMissing (secretKey) {
  const pending = scheduleOwnModelsCheck({
    secretKey,
    onlyIfMissing: true,
    isBlocked: () => downloadState.active,
    onReady: () => broadcastSSE({ type: 'own-models', status: 'ready' })
  });
  // A download already in progress does not start the walk. Do not arm.
  if (downloadState.active) return;
  armLibraryPreparation('own-models');
  pending.finally(() => { settleLibraryPreparation('own-models'); });
}

function triggerModelCacheAfterDownload (secretKey) {
  if (!secretKey) return;
  // Don't block; failures are surfaced to the client via the SSE stream
  // but never propagate to the download flow.
  startModelCacheRefresh({ force: false, secretKey, trigger: 'after-download' })
    .catch(err => {
      if (isStorageFault(err)) autoRunner.noteStop();
    });
}

async function startModelCacheRefresh ({ force = false, secretKey, trigger = 'manual' } = {}) {
  const gated = await requireLibraryAccount(secretKey);
  if (!gated.ok) return { error: gated.message };
  if (downloadState.active) return { error: 'A download is in progress', code: 'download-active' };
  if (modelCacheState.active) return { error: 'Model-cache refresh already running', code: 'cache-active' };

  // Build the work list under cache load.
  await ensureModelVersionCacheLoaded();
  const indexIds = collectVersionIdsFromIndex();
  let versionIds;
  if (force) {
    // Manual button: re-fetch every non-permanent record. Plus any
    // index-known versionIds that aren't in the cache yet (shouldn't
    // normally happen, but covers the edge case where an index entry was
    // added without a download e.g. via overrides).
    const refreshable = getRefreshableModelVersions();
    versionIds = [...new Set([...refreshable, ...indexIds])];
  } else {
    // Auto: missing + due-for-refresh. The cache's `fetchMissing` does
    // its own `getMissing` filter when force=false, but we add the
    // due-for-refresh ids explicitly so existing entries get re-checked
    // alongside any new ones.
    const due = getModelVersionsDueForRefresh();
    versionIds = [...new Set([...indexIds, ...due])];
  }

  if (versionIds.length === 0 && !force) {
    // Nothing to do; emit a single SSE event so any subscribed UI knows.
    broadcastSSE({ type: 'model-cache', status: 'complete', trigger, total: 0, fetched: 0, final: true });
    return { ok: true, total: 0 };
  }

  modelCacheState.active = true;
  modelCacheState.trigger = trigger;
  modelCacheState.abortController = new AbortController();
  modelCacheState.startedAt = Date.now();
  modelCacheState.total = 0;
  modelCacheState.fetched = 0;
  modelCacheState.tombstoned = 0;
  modelCacheState.preserved = 0;
  modelCacheState.errors = 0;

  broadcastSSE({ type: 'model-cache', status: 'running', trigger, total: versionIds.length });

  // Fire-and-forget; the SSE stream is the channel by which UI tracks
  // completion. Errors are caught and reported as `status: 'error'`.
  (async () => {
    let report;
    try {
      report = await fetchMissingModelVersions({
        versionIds,
        secretKey,
        signal: modelCacheState.abortController.signal,
        force,
        onProgress: ({ index, total, currentId, status }) => {
          modelCacheState.total = total;
          if (status === 'cached') modelCacheState.fetched++;
          else if (status === 'tombstoned') modelCacheState.tombstoned++;
          else if (status === 'preserved') modelCacheState.preserved++;
          else if (status === 'error') modelCacheState.errors++;
          broadcastSSE({
            type: 'model-cache',
            status: 'running',
            trigger,
            index,
            total,
            currentId,
            itemStatus: status,
            fetched: modelCacheState.fetched,
            tombstoned: modelCacheState.tombstoned,
            preserved: modelCacheState.preserved,
            errors: modelCacheState.errors
          });
        }
      });
    } catch (err) {
      broadcastSSE({
        type: 'model-cache',
        status: 'error',
        trigger,
        message: friendlyErrorMessage([err]),
        final: true
      });
      modelCacheState.active = false;
      return;
    }

    if (report.aborted) {
      broadcastSSE({
        type: 'model-cache',
        status: 'aborted',
        trigger,
        total: report.total,
        fetched: report.fetched,
        tombstoned: report.tombstoned,
        preserved: report.preserved,
        skippedPermanent: report.skippedPermanent,
        errors: report.errors.length,
        elapsed: Date.now() - modelCacheState.startedAt,
        final: true
      });
      modelCacheState.active = false;
      return;
    }

    await setConfigParam('lastModelCacheRefreshAt', new Date().toISOString()).catch(() => {});

    // Manual refresh re-lists this account's models after the version
    // fetches, including inside the daily window. Cancel aborts this
    // signal too. A finished write moves checkedAt.
    if (trigger === 'manual') {
      broadcastSSE({
        type: 'model-cache',
        status: 'running',
        trigger,
        versionsDone: true
      });
      const own = await refreshOwnModels({
        force: true,
        secretKey,
        signal: modelCacheState.abortController.signal
      });
      if (own?.updated) broadcastSSE({ type: 'own-models', status: 'ready' });
      broadcastSSE({
        type: 'model-cache',
        status: own?.skipped === 'aborted' ? 'aborted' : 'complete',
        trigger,
        total: report.total,
        fetched: report.fetched,
        tombstoned: report.tombstoned,
        preserved: report.preserved,
        skippedPermanent: report.skippedPermanent,
        errors: report.errors.length,
        elapsed: Date.now() - modelCacheState.startedAt,
        final: true
      });
      modelCacheState.active = false;
      return;
    }

    broadcastSSE({
      type: 'model-cache',
      status: 'complete',
      trigger,
      total: report.total,
      fetched: report.fetched,
      tombstoned: report.tombstoned,
      preserved: report.preserved,
      skippedPermanent: report.skippedPermanent,
      errors: report.errors.length,
      elapsed: Date.now() - modelCacheState.startedAt,
      final: true
    });
    modelCacheState.active = false;
  })().catch(() => { modelCacheState.active = false; });

  return { ok: true, total: versionIds.length, trigger, force };
}

function cancelModelCacheRefresh () {
  if (!modelCacheState.active || !modelCacheState.abortController) {
    return { ok: false, message: 'No active model-cache refresh' };
  }
  modelCacheState.abortController.abort();
  return { ok: true };
}

onBeforeAccountCachePurge(() => {
  if (modelCacheState.active && modelCacheState.abortController) {
    modelCacheState.abortController.abort();
  }
});

async function gateDownloadKey () {
  const gate = await requireLibraryAccount(getAvailableSecretKey());
  if (!gate.ok) return { error: gate.message };
  return { secretKey: getAvailableSecretKey() };
}

export function explorerDownloadRun () {
  return {
    active: downloadState.active,
    queue: downloadState.queue
  };
}

// Called by `startDownloadGenerations` / `startDownloadPosts` (and any
// future download surface) when a new download begins. Cancels any active
// model-cache run so the new download has the full network budget.
function preemptModelCacheForDownload () {
  if (modelCacheState.active && modelCacheState.abortController) {
    modelCacheState.abortController.abort();
  }
}

// ---------------------------------------------------------------------------
// Tag-name cache orchestration (Phase 3).
//
// Parallel to the model-cache flow but lighter: after a download completes,
// resolve the content-tag ids newly present on post images (numeric
// `tagIds` from post.getInfinite) into names via tRPC `tag.getById`, then
// re-project the in-memory index so the `tag=` filter and the mediaItems
// projection reflect the resolved names without a relaunch. Fire-and-forget;
// failures never touch the download flow.

const tagCacheState = { active: false, abortController: null };

function triggerTagCacheAfterDownload (secretKey) {
  startTagCacheRefresh({ secretKey }).catch(err => {
    if (isStorageFault(err)) autoRunner.noteStop();
  });
}

// New downloads add canonical files that existing exports may now match
// (metadata-only exports such as `model=X` are evaluated HERE, never on a
// reaction PATCH — ruling 4). Fire-and-forget + fail-soft inside the exports
// module; never touches the download flow.
function triggerExportsAfterDownload () {
  try { notifyDownloadCompleted(); } catch { /* never breaks the download flow */ }
}

async function startTagCacheRefresh ({ secretKey } = {}) {
  const gated = await requireLibraryAccount(secretKey);
  if (!gated.ok) return;
  if (downloadState.active) return;
  if (tagCacheState.active) return;

  await ensureTagCacheLoaded();
  const missing = getMissingTagIds(collectTagIdsFromIndex());
  if (!missing.length) {
    broadcastSSE({ type: 'tag-cache', final: true });
    return;
  }

  tagCacheState.active = true;
  tagCacheState.abortController = new AbortController();
  try {
    await fetchMissingTagNames({
      tagIds: missing,
      secretKey,
      signal: tagCacheState.abortController.signal
    });
  } catch { /* surfaced nowhere; never breaks the download flow */ }
  finally {
    tagCacheState.active = false;
    // Re-derive content-tag names + mediaItems from the now-fuller cache.
    reprojectIndexTagNames();
    broadcastSSE({ type: 'tag-cache', final: true });
  }
}

function preemptTagCacheForDownload () {
  if (tagCacheState.active && tagCacheState.abortController) {
    tagCacheState.abortController.abort();
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  // Phase 5a (audio): pure-audio outputs serve as .mp3; .wav covers any
  // wave-format audio. Cover-mode audio serves through the .mp4 entry above.
  // Media file responses honor a single byte Range (see serveMedia).
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/vnd.wave',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.fbx': 'application/octet-stream',
  '.obj': 'application/octet-stream',
  '.usdz': 'application/octet-stream',
  '.stl': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function backfillDownloadTimestamps () {
  const index = getIndex();
  if (!CONFIG.lastDownloadGenerations && index.generations.length > 0) {
    try {
      const dir = generationsDataDir();
      const stat = fs.statSync(dir);
      await setConfigParam('lastDownloadGenerations', stat.mtime.toISOString());
    } catch { /* ignore missing dir */ }
  }
  if (!CONFIG.lastDownloadPosts && index.posts.length > 0) {
    try {
      const dir = postsDataDir();
      const stat = fs.statSync(dir);
      await setConfigParam('lastDownloadPosts', stat.mtime.toISOString());
    } catch { /* ignore missing dir */ }
  }
}

let contentHashBackfillInFlight = false;
let aspectDimBackfillInFlight = false;
let aceAudioBackfillInFlight = false;

let measurementPassQueued = false;
let measurementPassActive = false;
let measurementHeld = false;

// One arm for the whole refill span. A second walk that finishes while the
// pass is running must not increment the count: one finally settles it.
function holdMeasurement () {
  if (measurementHeld) return;
  measurementHeld = true;
  armLibraryPreparation('measurement');
}

function releaseMeasurement () {
  if (!measurementHeld) return;
  measurementHeld = false;
  settleLibraryPreparation('measurement');
}

function scheduleMeasurementMaintenance () {
  measurementPassQueued = true;
  if (measurementPassActive) return;
  measurementPassActive = true;
  runMeasurementPasses().catch(() => {
    measurementPassActive = false;
  });
}

async function runMeasurementPasses () {
  try {
    while (measurementPassQueued) {
      measurementPassQueued = false;
      await waitForExplorerIdle();
      try {
        reprojectIndexMediaItems();
        await refillListOffersWhenIdle(getModelVersionFromCache);
      } catch {
        // One pass failing must not leave later walks unable to schedule.
      }
    }
  } finally {
    measurementPassActive = false;
    if (measurementPassQueued) scheduleMeasurementMaintenance();
    else releaseMeasurement();
  }
}

function queueContentHashBackfill () {
  // A cloud-sync folder hydrates a placeholder when the hash opens it.
  // Settle without reading. Settings → Rebuild index still hashes.
  if (isCloudSyncPath(CONFIG?.mediaPath)) {
    armLibraryPreparation('content-hash');
    settleLibraryPreparation('content-hash');
    return;
  }
  if (contentHashBackfillInFlight) return;
  contentHashBackfillInFlight = true;
  armLibraryPreparation('content-hash');
  const index = getIndex() || {};
  backfillContentHashes({
    generations: index.generations,
    posts: index.posts,
    comics: index.comics || []
  })
    .then((result) => {
      if (!result?.wrote) return;
      holdMeasurement();
      scheduleMeasurementMaintenance();
    })
    .catch(() => {})
    .finally(() => {
      contentHashBackfillInFlight = false;
      settleLibraryPreparation('content-hash');
    });
}

function queueAspectDimBackfill () {
  if (aspectDimBackfillInFlight) return;
  aspectDimBackfillInFlight = true;
  armLibraryPreparation('file-dims');
  const mediaItems = getIndex()?.mediaItems;
  backfillAspectFileDims({ mediaItems })
    .then((result) => {
      if (!result?.wrote) return;
      holdMeasurement();
      scheduleMeasurementMaintenance();
    })
    .catch(() => {})
    .finally(() => {
      aspectDimBackfillInFlight = false;
      settleLibraryPreparation('file-dims');
    });
}

function queueAceAudioBackfill () {
  if (aceAudioBackfillInFlight) return;
  aceAudioBackfillInFlight = true;
  armLibraryPreparation('ace');
  const mediaItems = getIndex()?.mediaItems;
  backfillAceAudio({ mediaItems, secretKey: getAvailableSecretKey() })
    .then((result) => {
      if (!result?.wrote) return;
      holdMeasurement();
      scheduleMeasurementMaintenance();
    })
    .catch(() => {})
    .finally(() => {
      aceAudioBackfillInFlight = false;
      settleLibraryPreparation('ace');
    });
}

function queueModel3dRepairOnce () {
  if (CONFIG.model3dRepairOnce === true) return;
  armLibraryPreparation('model3d-repair');
  repairModel3dOnce({
    generations: getIndex()?.generations || [],
    readGeneration: (entry) => getGeneration(entry.date, entry.id),
    upsert: (generation) => upsertIndexEntries({ generations: [generation] })
  }).catch(() => {}).finally(() => {
    settleLibraryPreparation('model3d-repair');
  });
}

// One export walk per process. Started from the listen callback so the gallery
// can open without it. Status GETs do not await it. When it finishes, the
// progress socket tells the badge and the Exports page to read again.
let exportReconcilePromise = null;

function exportReconcileReady () {
  if (!exportReconcilePromise) {
    armLibraryPreparation('exports');
    exportReconcilePromise = reconcileExports()
      .catch(() => {})
      .finally(() => {
        settleLibraryPreparation('exports');
        broadcastSSE({ type: 'exports', event: 'reconciled' });
      });
  }
  return exportReconcilePromise;
}

// Lets an integration test start a fresh startup walk (with its barrier).
export function __resetExportReconcileForTest () {
  exportReconcilePromise = null;
}

export async function startServer ({ port = DEFAULT_PORT, host = '127.0.0.1' } = {}) {
  await Promise.all([
    buildIndex(),
    ensureModelVersionCacheLoaded()
  ]);
  warmListOffers(getModelVersionFromCache);
  await backfillDownloadTimestamps();
  const autoPrefs = await loadUiPrefs();
  autoRunner.hydrate({
    autoOn: autoPrefs.downloadAuto === true,
    every: autoPrefs.downloadEvery
  });
  armExplorerIdle();

  return new Promise((resolve, reject) => {
    const server = http.createServer(handleRequest);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < DEFAULT_PORT + 10) {
        resolve(startServer({ port: port + 1, host }));
      } else {
        reject(err);
      }
    });

    server.listen(port, host, () => {
      // Read the actual port back from the listening socket so callers that
      // request `port: 0` (OS-assigned ephemeral) receive the real port
      // number. The EADDRINUSE retry path above never triggers when `0` is
      // requested — the OS always returns a free port.
      resolve({ server, port: server.address().port, host });
      if (autoPrefs.downloadAuto === true) {
        autoRunner.noteBoot({ open: hasDownloadOpen() });
      }
      // Content-hash join, file-dim hole-fill, and ACE ID3 / getWorkflow
      // hole-fill are identity/pixel/audio backfill, not listen preconditions.
      // Export reconcile is the same: one walk, not awaited by startServer.
      queueContentHashBackfill();
      queueAspectDimBackfill();
      queueAceAudioBackfill();
      queueModel3dRepairOnce();
      exportReconcileReady();
      if (CONFIG.username) triggerOwnModelsIfMissing(getAvailableSecretKey());
    });
  });
}

async function handleRequest (req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  beginExplorerRequest();
  try {
    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname, url);
    }

    // File bytes only. /media/<id> is an Explorer view (SPA fallback);
    // a blanket startsWith('/media/') would 404 every media-item bookmark.
    if (
      pathname.startsWith('/media/generations/') ||
      pathname.startsWith('/media/posts/') ||
      pathname.startsWith('/media/inputs/') ||
      pathname.startsWith('/media/comics/') ||
      pathname.startsWith('/media/model3ds/')
    ) {
      return await serveMedia(req, res, pathname);
    }

    return await serveStatic(res, pathname);
  } catch (err) {
    sendError(res, 500, err.message);
  } finally {
    endExplorerRequest();
  }
}

function isInsideRoot (root, candidate) {
  const a = path.resolve(root);
  const b = path.resolve(candidate);
  return b === a || b.startsWith(a + path.sep);
}

function isMediaFilePath (filepath) {
  const base = path.basename(filepath);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return false;
  return MEDIA_FILE_EXTS.includes(base.slice(dot + 1).toLowerCase());
}

// A filename, not a directory URL. The dot is neither first nor last, so
// `.glb` alone and a trailing dot are not extensions. The suffix itself is
// not checked: as-file prefixes reveal any extension. `MEDIA_FILE_EXTS`
// (which includes `glb`) is the id strip and the export-dest reveal list.
function basenameHasExtension (filepath) {
  const base = path.basename(filepath);
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1;
}

function normalizeOpenFolderInput (mediaPath) {
  if (mediaPath.startsWith('media/') || mediaPath.startsWith('media\\')) {
    return '/' + mediaPath.replace(/\\/g, '/');
  }
  return mediaPath;
}

function stripTrailingSlashes (p) {
  const stripped = p.replace(/\/+$/, '');
  return stripped || '/';
}

function matchConfiguredRoot (input, root) {
  if (!root) return null;
  const resolvedRoot = path.resolve(root);
  if (path.resolve(input) === resolvedRoot) return resolvedRoot;
  return null;
}

function toOpenFolderResult (full, { treatAsFile = false } = {}) {
  // asFile prefixes reveal any filename (parent + filePath). A prefix path
  // with no extension is a directory (comic id folder) and opens unselected.
  // Export dests (treatAsFile false) still reveal only MEDIA_FILE_EXTS.
  const reveal = treatAsFile ? basenameHasExtension(full) : isMediaFilePath(full);
  if (reveal) return { folderPath: path.dirname(full), filePath: full };
  return { folderPath: full };
}

// Map POST /api/open-folder `path` to a local folder, and to a file when the
// last segment has an extension. Prefixes
// `/media/generations|posts|comics|inputs|model3ds/` with an extension are
// files (parent folder + filePath), including mesh suffixes and input-only
// files (I2I, I2V, V2V, audio covers) under mediaPath/inputs. The same
// prefixes with no extension are directories (comic id folder).
// `/media/exports/` (and the stored `media/exports/…` form) maps under
// mediaPath/exports: a media-file suffix opens the parent and carries
// filePath, otherwise the path itself is the folder so an Export row can
// open its dest root. Exact `/data` and `/media` (Settings Paths) open the
// configured data and media roots; the stored config values (relative or
// absolute) are also accepted when they resolve to those roots. Any other
// path must resolve inside a configured export root.
export function resolveOpenFolderPath (mediaPath, {
  generationsDir,
  postsDir,
  comicsDir,
  inputsDir,
  model3dsDir,
  mediaPath: mediaRoot,
  dataPath: dataRoot,
  exportRoots = []
} = {}) {
  if (!mediaPath || typeof mediaPath !== 'string') {
    return { error: 'Path required' };
  }

  const input = normalizeOpenFolderInput(mediaPath);

  const prefixes = [
    { prefix: '/media/generations/', root: generationsDir, asFile: true },
    { prefix: '/media/posts/', root: postsDir, asFile: true },
    { prefix: '/media/comics/', root: comicsDir, asFile: true },
    { prefix: '/media/inputs/', root: inputsDir, asFile: true },
    { prefix: '/media/model3ds/', root: model3dsDir, asFile: true },
    { prefix: '/media/exports/', root: mediaRoot ? path.join(mediaRoot, 'exports') : null, asFile: false }
  ];

  for (const { prefix, root, asFile } of prefixes) {
    if (!root || !input.startsWith(prefix)) continue;
    const rel = input.slice(prefix.length);
    if (!rel) return { error: 'Invalid path' };
    const full = path.resolve(path.join(root, rel));
    if (!isInsideRoot(root, full)) return { error: 'Invalid path' };
    return toOpenFolderResult(full, { treatAsFile: asFile });
  }

  const dataResolved = dataRoot ? path.resolve(dataRoot) : null;
  const mediaResolved = mediaRoot ? path.resolve(mediaRoot) : null;
  const sentinel = stripTrailingSlashes(input);
  if (sentinel === '/data' && dataResolved) return { folderPath: dataResolved };
  if (sentinel === '/media' && mediaResolved) return { folderPath: mediaResolved };

  const asConfigValue = matchConfiguredRoot(input, dataRoot)
    || matchConfiguredRoot(input, mediaRoot);
  if (asConfigValue) return { folderPath: asConfigValue };

  let resolved;
  if (path.isAbsolute(input)) {
    resolved = path.resolve(input);
  } else if (mediaRoot) {
    resolved = path.resolve(path.join(mediaRoot, input.replace(/^\.?[/\\]/, '')));
  } else {
    return { error: 'Invalid path' };
  }

  if (dataResolved && resolved === dataResolved) return { folderPath: dataResolved };
  if (mediaResolved && resolved === mediaResolved) return { folderPath: mediaResolved };

  for (const root of exportRoots) {
    if (!root) continue;
    if (isInsideRoot(root, resolved)) {
      return toOpenFolderResult(resolved);
    }
  }

  return { error: 'Invalid path' };
}

function configuredOpenRoots (opts) {
  return [
    opts.generationsDir,
    opts.postsDir,
    opts.comicsDir,
    opts.inputsDir,
    opts.model3dsDir,
    opts.mediaPath,
    opts.dataPath,
    ...(Array.isArray(opts.exportRoots) ? opts.exportRoots : [])
  ].filter(root => typeof root === 'string' && root);
}

// Deepest directory that contains every path. POSIX absolutes split to a
// leading empty segment; a drive-letter prefix is joined with the separator.
function sharedDirectory (dirs) {
  const parts = dirs.map(dir => path.resolve(dir).split(path.sep));
  const limit = Math.min(...parts.map(p => p.length));
  const common = [];
  for (let i = 0; i < limit; i++) {
    const seg = parts[0][i];
    if (!parts.every(p => p[i] === seg)) break;
    common.push(seg);
  }
  if (common.length === 0) return null;
  if (common[0] === '') {
    return common.length === 1 ? path.sep : path.join(path.sep, ...common.slice(1));
  }
  return common.join(path.sep);
}

// A shared root is opened only when it still sits inside a configured root.
// Otherwise the caller opens the first folder. Never walk up to `/`.
function allowedSharedRoot (dir, opts) {
  if (!dir) return null;
  const resolved = path.resolve(dir);
  for (const root of configuredOpenRoots(opts)) {
    const abs = path.resolve(root);
    if (resolved === abs || isInsideRoot(abs, resolved)) return resolved;
  }
  return null;
}

// Map POST /api/open-folder `{ paths: string[] }` to one folder. Same-directory
// files keep `filePaths` in request order: Finder selects every file, and
// Linux and Windows reveal the first. Files in more than one directory open
// their shared root with nothing selected. A path that fails
// resolveOpenFolderPath still errors.
export function resolveOpenFolderPaths (paths, opts = {}) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { error: 'Path required' };
  }
  const resolved = [];
  for (const entry of paths) {
    const one = resolveOpenFolderPath(entry, opts);
    if (one.error) return one;
    resolved.push(one);
  }
  const files = resolved.filter(r => r.filePath);
  const unique = [...new Set(resolved.map(r => r.folderPath))];
  if (unique.length === 1) {
    if (files.length > 0) {
      return {
        folderPath: unique[0],
        filePaths: files.map(r => r.filePath)
      };
    }
    return { folderPath: unique[0] };
  }
  const shared = allowedSharedRoot(sharedDirectory(unique), opts);
  return { folderPath: shared || unique[0] };
}

// Map POST /api/open-folder `{ json: { type, id } }` to the saved container
// JSON. `type` is the viewed surface (generation / post / comic) — not the
// generation-first parent used by GET /api/media/:id `raw`. Date comes from
// the index entry (`post.date` may be `drafts/`). filePath is always the
// `.json`; the launcher reveals it and must not open it in an editor.
export function resolveOpenJsonPath (json, {
  generations = [],
  posts = [],
  comics = [],
  generationsDir,
  postsDir,
  comicsDir
} = {}) {
  if (!json || typeof json !== 'object') return { error: 'Path required' };
  const type = json.type;
  const id = json.id;
  if (!type || id == null || id === '') return { error: 'Path required' };
  if (type !== 'generation' && type !== 'post' && type !== 'comic') {
    return { error: 'Invalid path' };
  }

  let entry;
  let root;
  if (type === 'generation') {
    entry = generations.find(g => String(g.id) === String(id));
    root = generationsDir;
  } else if (type === 'post') {
    entry = posts.find(p => String(p.id) === String(id));
    root = postsDir;
  } else {
    entry = comics.find(c => String(c.id) === String(id));
    root = comicsDir;
  }
  if (!entry || !root) return { error: 'Not found' };

  const date = entry.date
    || (entry.createdAt ? String(entry.createdAt).slice(0, 10) : '');
  if (!date) return { error: 'Not found' };

  const full = path.resolve(path.join(root, String(date), `${entry.id}.json`));
  if (!isInsideRoot(root, full)) return { error: 'Invalid path' };
  return { folderPath: path.dirname(full), filePath: full };
}

function openLocalFolder (resolved) {
  try {
    const existingMulti = Array.isArray(resolved.filePaths)
      ? resolved.filePaths.filter(p => p && fs.existsSync(p))
      : null;
    const filePath = resolved.filePath;
    const fileExists = Boolean(filePath && fs.existsSync(filePath));
    const launch = existingMulti
      ? buildOpenFolderLaunch({
          platform: os.platform(),
          folderPath: resolved.folderPath,
          filePaths: existingMulti
        })
      : buildOpenFolderLaunch({
          platform: os.platform(),
          folderPath: resolved.folderPath,
          filePath,
          fileExists
        });
    // Linux ShowItems waits for a D-Bus reply; timeout so a missing FileManager1
    // (or a hung activation) falls back to opening the folder. Windows explorer
    // /select often exits 1 on success — never treat that as a fallback.
    // A missing opener must not throw into the request handler.
    execFile(launch.cmd, launch.args, launch.fallback ? { timeout: 2500 } : {}, (err) => {
      if (!(err && launch.fallback)) return;
      try {
        execFile(launch.fallback.cmd, launch.fallback.args, () => {});
      } catch {
        // fallback binary missing
      }
    });
  } catch {
    // opener spawn failed before a callback
  }
}

function needsExportRoots (mediaPath) {
  if (!mediaPath || typeof mediaPath !== 'string') return false;
  const input = normalizeOpenFolderInput(mediaPath);
  const sentinel = stripTrailingSlashes(input);
  if (sentinel === '/data' || sentinel === '/media') return false;
  return !input.startsWith('/media/generations/')
    && !input.startsWith('/media/posts/')
    && !input.startsWith('/media/comics/')
    && !input.startsWith('/media/inputs/')
    && !input.startsWith('/media/exports/');
}

// --- API ---

async function handleApi (req, res, pathname, url) {
  const index = getIndex();

  if (pathname === '/api/stats' && req.method === 'GET') {
    return sendJson(res, index.stats);
  }

  if (pathname === '/api/ui-prefs' && req.method === 'GET') {
    return sendJson(res, await loadUiPrefs());
  }

  if (pathname === '/api/ui-prefs' && req.method === 'PATCH') {
    const body = await readBody(req);
    const saved = await patchUiPrefs(body);
    if (body && Object.prototype.hasOwnProperty.call(body, 'downloadAuto')) {
      autoRunner.noteSwitch(saved.downloadAuto === true);
    }
    if (body && body.downloadEvery && saved.downloadEvery === body.downloadEvery) {
      autoRunner.notePeriod(saved.downloadEvery);
    }
    return sendJson(res, saved);
  }

  if (pathname === '/api/download/modes' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, await applyDownloadModes(body));
  }

  // Overview activity dashboard. Computed per request over the index
  // (never stored). Drafts are dated from the derived createdAt on the
  // post entry; scheduled posts land in upcoming via derivePostStatus.
  if (pathname === '/api/overview' && req.method === 'GET') {
    return sendJson(res, computeOverview(index));
  }

  if (pathname === '/api/generations' && req.method === 'GET') {
    return handlePaginated(res, url, index.generations, 'prompt', { listScope: 'generations' });
  }

  if (pathname === '/api/posts' && req.method === 'GET') {
    // Read-time tri-state: a future publishedAt is 'scheduled' until it passes,
    // then 'published'. Derived per request (never frozen in the index — the
    // stored status is the binary draft/published) so the served status, the
    // `publication` facet, sort, and `itemDate` all see the live value.
    const postsWithStatus = index.posts.map(p => ({ ...p, status: derivePostStatus(p.publishedAt) }));
    return handlePaginated(res, url, postsWithStatus, 'title', { publicationScope: 'post', listScope: 'posts' });
  }

  if (pathname === '/api/comics' && req.method === 'GET') {
    // Derived comic status from chapter enums (published > scheduled > draft).
    // Re-stamped per request so the `publication` facet matches the gallery.
    const comicsWithStatus = (index.comics || []).map(c => ({ ...c, status: deriveComicStatus(c) }));
    return handlePaginated(res, url, comicsWithStatus, 'name', { publicationScope: 'comic', listScope: 'comics' });
  }

  if (pathname === '/api/model3ds' && req.method === 'GET') {
    const rows = (index.model3ds || []).filter(row => row && row.status !== 'deleted');
    return handlePaginated(res, url, rows, 'name', { publicationScope: 'model3d' });
  }

  // Media-item granularity (Phase 4 E4). Serves the flat `index.mediaItems`
  // projection through the SAME facet/sort/group pipeline as the entry views,
  // bridged by the shared `mediaItemToFilterable` adapter (ruling 4). Distinct
  // from the PATCH `/api/media/:id/reactions` routes below (method + path).
  if (pathname === '/api/media' && req.method === 'GET') {
    return handleMediaItems(res, url);
  }

  // Media-item detail. Identity key is the same id the list tile ships
  // (`normalizeMediaId`). Skip the `reactions` segment so GET
  // `/api/media/reactions` is not treated as an id (that path is PATCH-only).
  const mediaDetailMatch = pathname.match(/^\/api\/media\/([^/]+)$/);
  if (mediaDetailMatch && req.method === 'GET' && mediaDetailMatch[1] !== 'reactions') {
    return await handleMediaDetail(res, mediaDetailMatch[1], url);
  }

  const facetMatch = pathname.match(/^\/api\/facets\/(ecosystems|models|versions|resources|tags|types|aspects|resourceTypes|reactionTags|workflows|model-tree|date-bounds|aspect-tree|type-tree|offer)$/);
  if (facetMatch && req.method === 'GET') {
    return handleFacetValues(res, facetMatch[1], url);
  }

  // Models catalog / model page. No `modelId` → catalog (`resourceType`,
  // `baseModel`, `ecosystem` csv). With `modelId` → model page (`versionId`
  // optional). Gallery remains GET /api/media?versionId=.
  if (pathname === '/api/models' && req.method === 'GET') {
    return handleModelTree(res, url);
  }

  const genMatch = pathname.match(/^\/api\/generations\/(.+)$/);
  if (genMatch && req.method === 'GET') {
    return await handleGenerationDetail(res, genMatch[1], url);
  }

  const postMatch = pathname.match(/^\/api\/posts\/(\d+)$/);
  if (postMatch && req.method === 'GET') {
    return await handlePostDetail(res, postMatch[1], url);
  }

  const comicMatch = pathname.match(/^\/api\/comics\/(\d+)$/);
  if (comicMatch && req.method === 'GET') {
    return await handleComicDetail(res, comicMatch[1], url);
  }

  const model3dMatch = pathname.match(/^\/api\/model3ds\/(\d+)$/);
  if (model3dMatch && req.method === 'GET') {
    return await handleModel3dDetail(res, model3dMatch[1], url);
  }

  if (pathname === '/api/index/rebuild' && req.method === 'POST') {
    await allowBackgroundDuringRequest(async () => {
      await rebuildIndex();
      warmListOffers(getModelVersionFromCache);
    });
    return sendJson(res, { ok: true });
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    let needGenerationData = false;
    let needImageResources = false;
    let needGenerationResponse = false;
    try {
      needGenerationData = await postsNeedGenerationData();
      needImageResources = await postsNeedImageResources();
      needGenerationResponse = await postsNeedGenerationResponse();
    } catch {
      needGenerationData = false;
      needImageResources = false;
      needGenerationResponse = false;
    }
    return sendJson(res, {
      hasKey: !!CONFIG.secretKey,
      keyEncrypted: !!CONFIG.keyEncrypt,
      keyUnlocked: CONFIG.keyEncrypt ? !!getAvailableSecretKey() : true,
      username: CONFIG.username || '',
      dataPath: CONFIG.dataPath,
      mediaPath: CONFIG.mediaPath,
      downloadMedia: CONFIG.downloadMedia !== false,
      generationReactions: normalizeGenerationReactions(CONFIG.generationReactions),
      generationDownload: CONFIG.generationDownload || null,
      postDownload: CONFIG.postDownload || null,
      comicDownload: CONFIG.comicDownload || null,
      model3dDownload: CONFIG.model3dDownload || null,
      version: CURRENT_VERSION || '',
      lastDownloadGenerations: CONFIG.lastDownloadGenerations || null,
      lastDownloadPosts: CONFIG.lastDownloadPosts || null,
      lastDownloadComics: CONFIG.lastDownloadComics || null,
      lastDownloadModel3ds: CONFIG.lastDownloadModel3ds || null,
      domain: getCivitaiDomain(),
      allowAltDomain: CONFIG.allowAltDomain === true,
      availableDomains: CIVITAI_DOMAINS,
      postsNeedGenerationData: needGenerationData,
      postsNeedImageResources: needImageResources,
      postsNeedGenerationResponse: needGenerationResponse,
      nodeNotice: nodeNoticeFor(process.version)
    });
  }

  if (pathname === '/api/config' && req.method === 'PUT') {
    return await handleConfigUpdate(req, res);
  }

  if (pathname === '/api/user/refresh' && req.method === 'POST') {
    const secretKey = getAvailableSecretKey();
    if (!secretKey) {
      return sendJson(res, { ok: false, error: 'API key not available' }, 400);
    }
    const applied = await refreshOnce({ secretKey }).catch(() => null);
    const blocked = applied && applied.kind === 'blocked';
    if (!blocked && CONFIG.username && !currentOwnModels().known) triggerOwnModelsIfMissing(secretKey);
    const body = {
      ok: true,
      kind: applied && applied.kind,
      username: CONFIG.username || '',
      allowAltDomain: CONFIG.allowAltDomain === true,
      domain: getCivitaiDomain()
    };
    if (blocked) {
      body.libraryUsername = applied.libraryUsername;
      body.keyUsername = applied.keyUsername;
    }
    return sendJson(res, body);
  }

  if (pathname === '/api/key' && req.method === 'POST') {
    return await handleKeySave(req, res);
  }

  if (pathname === '/api/key/delete' && req.method === 'POST') {
    const { removeKey } = await import('./keyActions.mjs');
    await removeKey();
    return sendJson(res, { ok: true, hasKey: false });
  }

  if (pathname === '/api/key/password' && req.method === 'POST') {
    return await handleKeyPassword(req, res);
  }

  if (pathname === '/api/key/unprotect' && req.method === 'POST') {
    return await handleKeyUnprotect(req, res);
  }

  if (pathname === '/api/unlock' && req.method === 'POST') {
    if (!CONFIG.keyEncrypt) {
      return sendJson(res, { ok: true, message: 'Key is not encrypted' });
    }
    const body = await readBody(req);
    const password = body.password;
    if (!password) {
      return sendJson(res, { ok: false, error: 'Password required' }, 400);
    }
    try {
      const decrypted = decryptAES(CONFIG.secretKey, password);
      if (!decrypted) {
        return sendJson(res, { ok: false, error: 'Wrong password' }, 401);
      }
      // Store in the shared in-memory memo so CLI and Explorer share the
      // unlocked state for the remainder of the process.
      setMemoizedSecretKey(decrypted);
      await requireLibraryAccount(decrypted);
      return sendJson(res, { ok: true });
    } catch {
      return sendJson(res, { ok: false, error: 'Wrong password' }, 401);
    }
  }

  if (pathname === '/api/download/queue' && req.method === 'POST') {
    const body = await readBody(req);
    autoRunner.noteClick(body && body.auto === true);
    const result = await startDownloadQueue(body);
    if (result && result.error && result.code !== 'busy') {
      autoRunner.noteFinish(result.fatal ? 'fatal' : 'transient');
    } else if (result && result.ok && body && body.auto === true) {
      patchUiPrefs({ downloadRecheck: body.recheck === true }).catch(() => {});
    }
    return sendJson(res, result, result.error ? 400 : 202);
  }

  if (pathname === '/api/download/generations' && req.method === 'POST') {
    const body = await readBody(req);
    const mode = body.mode || 'latest';
    const result = await startDownloadGenerations(mode);
    return sendJson(res, result, result.error ? 400 : 202);
  }

  if (pathname === '/api/download/posts' && req.method === 'POST') {
    const body = await readBody(req);
    const mode = body.mode || 'latest';
    const result = await startDownloadPosts(mode, { checkAllMedia: body.checkAllMedia === true });
    return sendJson(res, result, result.error ? 400 : 202);
  }

  if (pathname === '/api/download/comics' && req.method === 'POST') {
    const body = await readBody(req);
    const result = await startDownloadComics({
      mode: body.mode === 'all' ? 'all' : 'latest',
      checkAllMedia: body.mode === 'all' && body.checkAllMedia === true
    });
    return sendJson(res, result, result.error ? 400 : 202);
  }

  if (pathname === '/api/download/model3ds' && req.method === 'POST') {
    const body = await readBody(req);
    const result = await startDownloadModel3ds({
      mode: body.mode === 'all' ? 'all' : 'latest'
    });
    return sendJson(res, result, result.error ? 400 : 202);
  }

  if (pathname === '/api/download/abort' && req.method === 'POST') {
    if (!downloadState.active && !downloadState.queue && !downloadState.starting) {
      autoRunner.noteStop();
      return sendJson(res, { ok: false, message: 'No active download' });
    }
    downloadState.userStop = true;
    autoRunner.noteStop();
    if (downloadState.queue) downloadState.queue.halt = true;
    if (downloadState.abortController) {
      downloadState.abortController.abort();
      return sendJson(res, { ok: true });
    }
    if (downloadState.queue) {
      closeQueueIdle();
      return sendJson(res, { ok: true });
    }
    return sendJson(res, { ok: false, message: 'No active download' });
  }

  if (pathname === '/api/download/status' && req.method === 'GET') {
    return sendJson(res, {
      active: downloadState.active,
      type: downloadState.type,
      mode: downloadState.mode,
      elapsed: downloadElapsed(),
      progress: downloadState.progress,
      queue: liveQueueSnapshot(),
      auto: autoSnapshot()
    });
  }

  if (pathname === '/api/download/progress' && req.method === 'GET') {
    return handleSSE(req, res);
  }

  // --- Model-cache endpoints ---

  if (pathname === '/api/model-cache/refresh' && req.method === 'POST') {
    const body = await readBody(req);
    const secretKey = getAvailableSecretKey();
    const result = await startModelCacheRefresh({
      force: !!body.force,
      secretKey,
      trigger: 'manual'
    });
    if (result.error) {
      const status = result.code === 'cache-active' || result.code === 'download-active'
        ? 409
        : 400;
      return sendJson(res, result, status);
    }
    return sendJson(res, result, 202);
  }

  if (pathname === '/api/model-cache/abort' && req.method === 'POST') {
    const result = cancelModelCacheRefresh();
    return sendJson(res, result, result.ok ? 200 : 200);
  }

  if (pathname === '/api/model-cache/status' && req.method === 'GET') {
    await ensureModelVersionCacheLoaded();
    const snapshot = getModelCacheStatus();
    return sendJson(res, {
      ...snapshot,
      lastRefreshedAt: CONFIG.lastModelCacheRefreshAt || null,
      isRunning: modelCacheState.active,
      activeTrigger: modelCacheState.active ? modelCacheState.trigger : null,
      activeProgress: modelCacheState.active
        ? {
            total: modelCacheState.total,
            fetched: modelCacheState.fetched,
            tombstoned: modelCacheState.tombstoned,
            preserved: modelCacheState.preserved,
            errors: modelCacheState.errors,
            elapsed: modelCacheState.startedAt
              ? Date.now() - modelCacheState.startedAt
              : 0
          }
        : null
    });
  }

  if (pathname === '/api/open-folder' && req.method === 'POST') {
    const body = await readBody(req);
    let resolved;
    if (body.json) {
      resolved = resolveOpenJsonPath(body.json, {
        generations: index.generations,
        posts: index.posts,
        comics: index.comics || [],
        generationsDir: generationsDataDir(),
        postsDir: postsDataDir(),
        comicsDir: comicsDataDir()
      });
    } else if (body.paths) {
      const pathList = Array.isArray(body.paths) ? body.paths : [];
      const needRoots = pathList.some(p => needsExportRoots(p));
      const exportRoots = needRoots
        ? (await listExports()).map(resolveExportRoot)
        : [];
      resolved = resolveOpenFolderPaths(pathList, {
        generationsDir: generationsMediaDir(),
        postsDir: postsMediaDir(),
        comicsDir: comicsMediaDir(),
        inputsDir: inputsMediaDir(),
        model3dsDir: model3dsMediaDir(),
        mediaPath: CONFIG.mediaPath,
        dataPath: CONFIG.dataPath,
        exportRoots
      });
    } else {
      const mediaPath = body.path;
      const exportRoots = needsExportRoots(mediaPath)
        ? (await listExports()).map(resolveExportRoot)
        : [];
      resolved = resolveOpenFolderPath(mediaPath, {
        generationsDir: generationsMediaDir(),
        postsDir: postsMediaDir(),
        comicsDir: comicsMediaDir(),
        inputsDir: inputsMediaDir(),
        model3dsDir: model3dsMediaDir(),
        mediaPath: CONFIG.mediaPath,
        dataPath: CONFIG.dataPath,
        exportRoots
      });
    }
    if (resolved.error) {
      return sendJson(res, { ok: false, error: resolved.error }, 400);
    }
    openLocalFolder(resolved);
    return sendJson(res, { ok: true });
  }

  // --- Exports ---
  // Multi-segment sync routes are matched before the single-segment
  // `/api/exports/:slug` so a slug is never mistaken for the `sync` segment.

  if (pathname === '/api/exports' && req.method === 'GET') {
    const list = await listExports();
    return sendJson(res, {
      exports: list.map(e => ({ ...e, status: exportStatusPayload(e.slug) }))
    });
  }

  if (pathname === '/api/exports' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body?.name || !String(body.name).trim()) {
      return sendJson(res, { error: 'name required' }, 400);
    }
    const rec = await createExport({
      name: body.name,
      query: body.query || {},
      path: body.path,
      linkMode: body.linkMode,
      includeInputMedia: body.includeInputMedia
    });
    invalidateDependencyMap();
    return sendJson(res, rec, 201);
  }

  if (pathname === '/api/exports/plan' && req.method === 'POST') {
    const body = await readBody(req);
    const result = await planExportDraft(body || {}, { slug: body?.slug });
    if (result.error === 'not-found') return sendError(res, 404, 'Not found');
    if (result.error === 'name-required') return sendJson(res, { error: 'name required' }, 400);
    if (result.failSoft) return sendJson(res, { pending: true, reason: result.code });
    if (result.error) return sendJson(res, { error: result.error }, 400);
    return sendJson(res, {
      dryRun: true,
      mode: result.classification,
      linkMode: result.linkMode,
      add: result.add,
      remove: result.remove,
      bytesNeeded: result.bytesNeeded,
      estimatedSeconds: result.estimatedSeconds,
      warnings: result.warnings,
      slug: result.slug,
      path: result.path
    });
  }

  const exportSyncEventsMatch = pathname.match(/^\/api\/exports\/([^/]+)\/sync\/([^/]+)\/events$/);
  if (exportSyncEventsMatch && req.method === 'GET') {
    return handleExportSyncEvents(req, res, exportSyncEventsMatch[2]);
  }

  const exportSyncCancelMatch = pathname.match(/^\/api\/exports\/([^/]+)\/sync\/([^/]+)\/cancel$/);
  if (exportSyncCancelMatch && req.method === 'POST') {
    const result = cancelSyncJob(exportSyncCancelMatch[2]);
    return sendJson(res, result, result.ok ? 200 : (result.status || 404));
  }

  const exportSyncMatch = pathname.match(/^\/api\/exports\/([^/]+)\/sync$/);
  if (exportSyncMatch && req.method === 'POST') {
    const body = await readBody(req);
    if (body?.dryRun) return await handleExportPlan(res, exportSyncMatch[1]);
    return await handleExportSync(res, exportSyncMatch[1]);
  }

  const exportRemovalMatch = pathname.match(/^\/api\/exports\/([^/]+)\/removal$/);
  if (exportRemovalMatch && req.method === 'GET') {
    const result = await countRemovalFiles(exportRemovalMatch[1]);
    if (result.error === 'not-found') return sendError(res, 404, 'Not found');
    if (result.error) return sendJson(res, result, 400);
    return sendJson(res, { files: result.files });
  }

  const exportItemMatch = pathname.match(/^\/api\/exports\/([^/]+)$/);
  if (exportItemMatch && req.method === 'GET') {
    const rec = await readExport(exportItemMatch[1]);
    if (!rec) return sendError(res, 404, 'Not found');
    return sendJson(res, { ...rec, status: exportStatusPayload(rec.slug) });
  }

  if (exportItemMatch && req.method === 'PUT') {
    const body = await readBody(req);
    const rec = await updateExport(exportItemMatch[1], body || {});
    if (!rec) return sendError(res, 404, 'Not found');
    if (rec.error === 'incomplete') return sendJson(res, rec, 409);
    invalidateDependencyMap();
    return sendJson(res, rec);
  }

  if (exportItemMatch && req.method === 'DELETE') {
    // `?files=1` is Delete files. Without it, Detach drops the record only.
    // The record stays until the filesystem intent is verified.
    const result = url.searchParams.get('files') === '1'
      ? await deleteExportWithFiles(exportItemMatch[1])
      : await deleteExport(exportItemMatch[1]);
    return sendRemoval(res, result);
  }

  // --- Reaction overrides ---
  // Batch route is matched before the single-item route so the exact path
  // `/api/media/reactions` is never mistaken for a `:mediaItemId` of
  // "reactions" (the single regex requires a segment before `/reactions`).

  if (pathname === '/api/media/reactions' && req.method === 'PATCH') {
    return await handleReactionsBatch(req, res);
  }

  const reactionMatch = pathname.match(/^\/api\/media\/(.+)\/reactions$/);
  if (reactionMatch && req.method === 'PATCH') {
    return await handleReactionPatch(req, res, reactionMatch[1]);
  }

  sendError(res, 404, 'Not found');
}

// Aggregate the query string into a plain params object, collapsing repeated
// keys into the comma form so `?tag=a&tag=b` and `?tag=a,b` behave the same
// (mirrors parseUrl on the client). The Explorer client emits the comma form
// (api.js passes the URL-state slice verbatim, steward ruling 3); this keeps
// hand-typed / shared URLs working too.
function paramsObject (url) {
  const out = {};
  for (const [k, v] of url.searchParams.entries()) {
    out[k] = out[k] != null ? `${out[k]},${v}` : v;
  }
  return out;
}

// Facet ctx prepared once per request. `mediaById` is the index Map built
// at project time so batch-grain publication / usedAsInput lookups are O(1)
// per member. `now` keeps scheduled vs published a read-time fact.
function facetQueryCtx (extra = {}) {
  const index = getIndex();
  const postsById = new Map();
  for (const post of index.posts || []) postsById.set(String(post.id), post);
  return {
    normalizeId: normalizeMediaId,
    getModelVersion: getModelVersionFromCache,
    now: Date.now(),
    mediaById: index.mediaById || new Map(),
    getMediaItemById,
    getPostById: (id) => postsById.get(String(id)) || null,
    ownModels: currentOwnModels(),
    ...extra
  };
}

// The (group | sort) → paginate → envelope tail shared by every gallery
// endpoint. Takes the ALREADY-filtered list. Pagination is always by ITEM
// (steward ruling 6 reversed): when `groupBy` is a valid axis the envelope
// adds `groups: [{ key, label, count, offset }]` metadata (no members) and
// `total`/`totalPages` count items. `mapItem` projects each emitted record
// (the tile DTO for gallery endpoints) and runs over the PAGE only so the
// per-page cost is bounded.
function respondPaginated (res, filtered, params, { mapItem, getModelVersion } = {}) {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(params.limit || '50', 10)));
  const sort = params.sort;
  const map = mapItem || (x => x);

  if (isValidGroupAxis(params.groupBy)) {
    const { items, groups, total } = paginateGrouped(filtered, {
      groupBy: params.groupBy, sort, groupSort: params.groupSort, page, limit,
      getModelVersion
    });
    const totalPages = Math.ceil(total / limit);
    return sendJson(res, {
      items: items.map(map), groups, total, page, limit, totalPages, grouped: true
    });
  }

  const sorted = applySort(filtered, sort);
  const total = sorted.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  sendJson(res, { items: sorted.slice(start, start + limit).map(map), total, page, limit, totalPages });
}

// Shared filter → tail pipeline for /api/generations, /api/posts, and
// /api/comics. Reads every facet under its protocol name (steward ruling 3);
// the pure pipeline lives in src/explorerQuery.mjs (unit-tested there). List
// payloads are tile DTOs; detail stays on `/api/generations|posts/:id`
// (comics detail is leaf 4).
function handlePaginated (res, url, items, searchField, extra = {}) {
  const params = paramsObject(url);
  const ctx = facetQueryCtx(extra);
  const filtered = applyFacets(items, params, searchField, ctx);
  const listScope = extra.listScope;
  respondPaginated(res, filtered, params, {
    mapItem: listScope
      ? (e => containerListTile(e, params, listScope, ctx))
      : (e => toTile(e, {
          q: params.q,
          mediaById: ctx.mediaById,
          normalizeId: ctx.normalizeId,
          getMediaItemById: ctx.getMediaItemById
        })),
    getModelVersion: getModelVersionFromCache
  });
}

// Media-item granularity (Phase 4 E4). Runs the SAME facet/sort/group pipeline
// over the flat `index.mediaItems` projection, bridged by the shared
// `mediaItemToFilterable` adapter (ruling 4 — one home for the shape map, no
// facet-logic duplication). The response items are the projected media items
// (the adapter's `_source`) with their numeric content-tag ids resolved to
// display strings — an unresolved id renders as `tag-<id>` (the Phase 3
// fallback, now with its first consumer). Publication and usedAsInput read
// stamps on `containers` / `usedAsInput` (adapted items keep those fields).
// Leftover `status=` dual-reads as `publication=` (scope `all` on unscoped
// media and `hasGeneration=1`). `hasPost=1` / `hasComic=1` / `hasGeneration=1`
// are mutually exclusive fetch-only scopes over `isProduced` (post, then
// comic, then generation); absence of all three stays all-produced.
// `usedInput=<id>` is a separate fetch-only page: that item's consumers,
// unscoped (no container filter, no facets). Unknown id is an empty page.
function projectMediaItem (entry) {
  const mi = entry._source || entry;
  const contentTags = [];
  const seen = new Set();
  const push = (name) => {
    if (!name || isRatingTagName(name) || seen.has(name)) return;
    seen.add(name);
    contentTags.push(name);
  };
  if (Array.isArray(mi.contentTags)) {
    for (const name of mi.contentTags) push(name);
  }
  for (const id of mi.contentTagIds || []) {
    const formatted = formatTagName(id);
    if (typeof formatted === 'string' && formatted.startsWith('tag-')) push(formatted);
  }
  const out = { ...mi, contentTags };
  delete out.contentTagIds;
  return out;
}

function respondUsedInputPage (res, params) {
  const source = getMediaItemById(params.usedInput);
  const consumers = source
    ? usedInConsumers(source.usedAsInput, getMediaItemById)
    : [];
  return respondPaginated(res, consumers, params, {
    mapItem: (entry) => {
      const projected = projectMediaItem(entry);
      const tile = toTile(projected, { q: params.q });
      const containers = projected.containers;
      tile.hasGeneration = !!(containers && containers.generation != null);
      tile.hasPost = Array.isArray(containers && containers.posts) && containers.posts.length > 0;
      tile.hasComic = Array.isArray(containers && containers.comics) && containers.comics.length > 0;
      return tile;
    },
    getModelVersion: getModelVersionFromCache
  });
}

function handleMediaItems (res, url) {
  const index = getIndex();
  const params = paramsObject(url);
  if (typeof params.usedInput === 'string' && params.usedInput !== '') {
    return respondUsedInputPage(res, params);
  }
  const produced = (index.mediaItems || []).filter(isProduced);
  let source = produced;
  let extra = {};
  if (params.hasPost === '1') {
    source = produced.filter(isPostBacked);
    extra = { publicationScope: 'post' };
  } else if (params.hasComic === '1') {
    source = produced.filter(isComicBacked);
    extra = { publicationScope: 'comic' };
  } else if (params.hasGeneration === '1') {
    source = produced.filter(isGenerationBacked);
  }
  const adapted = source.map(mediaItemToFilterable);
  const filtered = applyFacets(adapted, params, 'prompt', facetQueryCtx(extra));
  respondPaginated(res, filtered, params, {
    mapItem: e => toTile(projectMediaItem(e), {
      q: params.q,
      usedAsInput: params.usedAsInput,
      fileOrigin: params.hasPost === '1' ? 'post' : params.hasComic === '1' ? 'comic' : undefined
    }),
    getModelVersion: getModelVersionFromCache
  });
}

// Distinct facet values for the FacetBar option lists, ordered by use-count
// desc. Corpus-derived: an entry contributes only when it has downloaded
// media (`computeFacetValues`). `kind` ∈ types | aspects | resourceTypes |
// reactionTags | ecosystems | models | versions | resources | tags |
// workflows | model-tree | date-bounds | aspect-tree | type-tree | offer.
// `tags` is the post content-tag list (kept as its own branch — it is not
// a generation resource axis). `model-tree` is the full-depth nested
// hierarchy for the TreePicker; `date-bounds` is `{ min, max }` for When.
// `aspect-tree` is the two-level orientation + snap-or-exact ratio picker.
// `type-tree` is gallery type → mode abbreviation → workflow identifier.
// `offer` is the FacetBar visibility payload (`computeListOffer`).
// Ecosystem and resourceType labels resolve server-side (vendored display
// map / LORA→LoRA).
function handleFacetValues (res, kind, url) {
  const index = getIndex();
  const hasPost = url.searchParams.get('hasPost') === '1';
  const hasComic = url.searchParams.get('hasComic') === '1';
  const hasGeneration = url.searchParams.get('hasGeneration') === '1';
  const dateSource = url.searchParams.get('dateSource') || '';
  const walkOpts = {};
  if (hasPost) walkOpts.postBacked = true;
  else if (hasComic) walkOpts.comicBacked = true;
  else if (hasGeneration) walkOpts.generationBacked = true;
  if (dateSource) walkOpts.dateSource = dateSource;
  const own = currentOwnModels();
  if (own.known) {
    walkOpts.ownIds = own.ids;
    walkOpts.ownCheckedAt = own.checkedAt || '';
    walkOpts.ownUsername = own.username || '';
  }

  if (kind === 'offer') {
    if (url.searchParams.get('model3ds') === '1') {
      return sendJson(res, model3dListOffer(index.model3ds || []));
    }
    return sendJson(res, computeListOffer(index, getModelVersionFromCache, walkOpts));
  }
  if (kind === 'model-tree') {
    return sendJson(res, computeModelHierarchy(index, getModelVersionFromCache, walkOpts));
  }
  if (kind === 'date-bounds') {
    return sendJson(res, computeDateBounds(index, walkOpts));
  }
  if (kind === 'aspect-tree') {
    return sendJson(res, computeAspectTree(index, walkOpts));
  }
  if (kind === 'type-tree') {
    return sendJson(res, computeTypeWorkflowTree(index, walkOpts));
  }

  if (kind === 'tags') {
    return sendJson(res, computeTagFacet(index, {
      comicBacked: hasComic,
      dateSource,
      rating: url.searchParams.get('rating') || ''
    }));
  }

  const all = computeFacetValues(index, getModelVersionFromCache, walkOpts);
  sendJson(res, { values: all[kind] || [] });
}

// Models catalog (no modelId) or model page (`modelId`, optional `versionId`).
// Computed per request (not stored, no INDEX_VERSION bump). Labels resolve
// through the authoritative model-version cache. Catalog filters are
// `resourceType` / `baseModel` / `ecosystem` (csv). Selected version attaches
// the Stage 1 instrument card as `resource`.
function ownModelsArg () {
  const own = currentOwnModels();
  if (!own.known) return { known: false, models: [] };
  return { known: true, models: own.models };
}

function stampOwnResources (item) {
  const own = currentOwnModels();
  if (!item || !own.known || !own.ids) return item;
  const mark = (r) => {
    if (!r || r.modelId == null || r.modelId === '') return r;
    if (!own.ids.has(String(r.modelId))) return r;
    return r.mine === true ? r : { ...r, mine: true };
  };
  const resources = Array.isArray(item.resources) ? item.resources.map(mark) : item.resources;
  const checkpoint = item.checkpoint ? mark(item.checkpoint) : item.checkpoint;
  if (resources === item.resources && checkpoint === item.checkpoint) return item;
  return { ...item, resources, checkpoint };
}

function handleModelTree (res, url) {
  const index = getIndex();
  const modelId = url.searchParams.get('modelId') || '';
  const ownArg = ownModelsArg();
  if (modelId) {
    const versionId = url.searchParams.get('versionId') || undefined;
    const page = aggregateModelPage(index, { modelId, versionId, ownModels: ownArg }, getModelVersionFromCache);
    const selected = page.selectedVersionId;
    if (selected) {
      const href = civitaiUrl(`/models/${modelId}?modelVersionId=${selected}`);
      const rec = getModelVersionFromCache(Number(selected)) || getModelVersionFromCache(selected);
      const data = rec && rec.notFound === false && rec.data && typeof rec.data === 'object' ? rec.data : null;
      page.resource = composeModelLeafCard({ modelId, versionId: selected, data, href });
    }
    return sendJson(res, page);
  }
  const catalog = aggregateModelCatalog(index, {
    resourceType: url.searchParams.get('resourceType') || '',
    family: url.searchParams.get('family') || '',
    variant: url.searchParams.get('variant') || '',
    mine: url.searchParams.get('mine') || '',
    ownModels: ownArg
  }, getModelVersionFromCache);
  sendJson(res, catalog);
}

function indexEntriesForOrigin () {
  const index = getIndex();
  return {
    mediaItems: index.mediaItems || [],
    generations: index.generations || [],
    posts: index.posts || [],
    comics: index.comics || []
  };
}

function attachContainerOrigin (entry, url, { defaultScope, id }) {
  const args = originArgsFromSearchParams(url?.searchParams, {
    kind: 'container',
    id,
    defaultScope
  });
  const { origin, members } = buildDetailOrigin({
    ...args,
    entries: indexEntriesForOrigin(),
    members: entry.media || [],
    ctx: facetQueryCtx()
  });
  return { ...entry, media: members, origin };
}

function stampMemberDisplay (entry) {
  if (!entry || !Array.isArray(entry.media)) return entry;
  return {
    ...entry,
    media: entry.media.map(member => ({
      ...member,
      ...stampOwnResources(memberDisplaySlots(member, getMediaItemById, getModelVersionFromCache)),
      reactions: ownerReactionsForMember(member, { getMediaItemById })
    }))
  };
}

function attachMediaOrigin (url, id) {
  const args = originArgsFromSearchParams(url?.searchParams, {
    kind: 'media',
    id,
    defaultScope: null
  });
  const { origin } = buildDetailOrigin({
    ...args,
    entries: indexEntriesForOrigin(),
    ctx: facetQueryCtx()
  });
  return origin;
}

async function handleGenerationDetail (res, id, url) {
  const index = getIndex();
  const item = index.generations.find(g => g.id === id);

  if (!item) {
    return sendError(res, 404, 'Generation not found');
  }

  const withOrigin = stampMemberDisplay(attachContainerOrigin(item, url, {
    defaultScope: 'generations',
    id
  }));
  const indexEntry = stampOwnResources(hydrateItemForDisplay(withOrigin, getModelVersionFromCache));
  const resolvedInputs = index.generationInputs?.get(item.id) || [];
  const detailIndex = {
    ...indexEntry,
    inputs: projectInputsForDetail(resolvedInputs, getMediaItemById)
  };
  try {
    const filepath = `${generationsDataDir()}/${item.date}/${id}.json`;
    const raw = await readFile(filepath);
    const full = JSON.parse(raw);
    sendJson(res, { index: detailIndex, raw: full });
  } catch {
    sendJson(res, { index: detailIndex, raw: null });
  }
}

async function handlePostDetail (res, idStr, url) {
  const id = parseInt(idStr, 10);
  const index = getIndex();
  const item = index.posts.find(p => p.id === id);

  if (!item) {
    return sendError(res, 404, 'Post not found');
  }

  // Override the stored binary status with the read-time tri-state on a copy
  // (the in-memory index entry is shared; never mutate it). Keeps the detail
  // route consistent with /api/posts.
  const entry = { ...item, status: derivePostStatus(item.publishedAt) };
  const withOrigin = stampMemberDisplay(attachContainerOrigin(entry, url, {
    defaultScope: 'posts',
    id
  }));

  let raw = null;
  try {
    const filepath = `${CONFIG.dataPath}/posts/${item.date}/${id}.json`;
    raw = JSON.parse(await readFile(filepath));
  } catch {
    raw = null;
  }
  const summary = await model3dForPostDetail(item, raw);
  const indexOut = summary ? { ...withOrigin, model3d: summary } : withOrigin;
  sendJson(res, { index: indexOut, raw });
}

function model3dSummary (row) {
  if (!row || row.id == null || row.id === '') return null;
  return { id: row.id, name: row.name || '', status: row.status || '' };
}

function postImageIds (entry, raw) {
  const ids = [];
  const seen = new Set();
  const push = (imageId) => {
    if (imageId == null || imageId === '') return;
    const key = String(imageId);
    if (seen.has(key)) return;
    seen.add(key);
    ids.push(imageId);
  };
  for (const media of entry?.media || []) push(media && media.imageId);
  const images = raw && Array.isArray(raw.images) ? raw.images : [];
  for (const image of images) push(image && image.id);
  return ids;
}

function indexedLiveModel3d (model3ds, id) {
  const rows = Array.isArray(model3ds) ? model3ds : [];
  for (const row of rows) {
    if (!row || row.status === 'deleted' || row.status === 'Deleted') continue;
    if (row.id === id || (row.id != null && id != null && String(row.id) === String(id))) return row;
  }
  return null;
}

// Local thumbnail id first. One model3d.getByPostId only on a miss, and
// only to name a row already in the index. Does not write the post file
// and does not fetch mesh files.
async function model3dForPostDetail (entry, raw) {
  const model3ds = getIndex().model3ds || [];
  for (const imageId of postImageIds(entry, raw)) {
    const row = model3dForImageId(model3ds, imageId);
    if (row) return model3dSummary(row);
  }
  const postId = Number(entry && entry.id);
  if (!Number.isInteger(postId) || postId <= 0) return null;
  const secretKey = getAvailableSecretKey();
  if (!secretKey) return null;
  const body = await getModel3dByPostId({ postId, secretKey });
  if (!body || body.error || body.id == null) return null;
  return model3dSummary(indexedLiveModel3d(model3ds, body.id));
}

function comicJsonPath (item) {
  if (!item) return '';
  const fromCreated = comicFilepath({ id: item.id, createdAt: item.createdAt });
  if (fromCreated) return fromCreated;
  if (item.date) return `${comicsDataDir()}/${item.date}/${item.id}.json`;
  return '';
}

async function loadComicRaw (item) {
  const filepath = comicJsonPath(item);
  if (!filepath) return null;
  try {
    return JSON.parse(await readFile(filepath));
  } catch {
    return null;
  }
}

async function loadPostRaw (postEntry) {
  if (!postEntry || postEntry.date == null || postEntry.id == null) return null;
  try {
    const filepath = `${CONFIG.dataPath}/posts/${postEntry.date}/${postEntry.id}.json`;
    return JSON.parse(await readFile(filepath));
  } catch {
    return null;
  }
}

// Image-grain browsing level for the detail payload. `raw` is whichever
// parent file the rest of the page uses (generation, else first post, else
// comic). The rating still comes from the image row, so a generation-primary
// item reads its post or comic file as well.
async function imageLevelForMediaDetail (mi, raw, rawKind) {
  const posts = [];
  const comics = [];
  const index = getIndex();
  for (const ref of mi.containers?.posts || []) {
    let doc = null;
    if (rawKind === 'post' && raw && raw.id === ref.id) doc = raw;
    else {
      const entry = (index.posts || []).find(p => p.id === ref.id);
      doc = await loadPostRaw(entry);
    }
    if (doc) posts.push({ doc, indexInPost: ref.indexInPost });
  }
  if (!posts.length && rawKind === 'post' && raw) posts.push({ doc: raw });
  for (const ref of mi.containers?.comics || []) {
    let doc = null;
    if (rawKind === 'comic' && raw && raw.id === ref.id) doc = raw;
    else {
      const entry = (index.comics || []).find(c => c.id === ref.id);
      doc = await loadComicRaw(entry);
    }
    if (doc) comics.push({ doc, panelId: ref.panelId });
  }
  if (!comics.length && rawKind === 'comic' && raw) comics.push({ doc: raw });
  return imageBrowsingLevel({ mediaId: mi.id, posts, comics });
}

async function handleComicDetail (res, idStr, url) {
  const id = parseInt(idStr, 10);
  const index = getIndex();
  const item = (index.comics || []).find(c => c.id === id);

  if (!item) {
    return sendError(res, 404, 'Comic not found');
  }

  // Override stored status with the read-time derived status on a copy
  // (the in-memory index entry is shared; never mutate it). Keeps the
  // detail route consistent with /api/comics. Chapter leftover
  // publishedAt after unpublish must not become published.
  const entry = { ...item, status: deriveComicStatus(item) };
  const withOrigin = stampMemberDisplay(attachContainerOrigin(entry, url, {
    defaultScope: 'comics',
    id
  }));
  const raw = await loadComicRaw(item);
  sendJson(res, { index: withOrigin, raw });
}

function model3dJsonPath (item) {
  if (!item) return '';
  const fromCreated = model3dFilepath({ id: item.id, createdAt: item.createdAt });
  if (fromCreated) return fromCreated;
  if (item.date) return `${model3dsDataDir()}/${item.date}/${item.id}.json`;
  return '';
}

async function handleModel3dDetail (res, idStr, url) {
  const id = parseInt(idStr, 10);
  const index = getIndex();
  const item = (index.model3ds || []).find(row => row.id === id);
  if (!item || item.status === 'deleted') {
    return sendError(res, 404, '3D not found');
  }
  let raw = null;
  const filepath = model3dJsonPath(item);
  if (filepath) {
    try {
      raw = JSON.parse(await readFile(filepath));
    } catch {
      raw = null;
    }
  }
  sendJson(res, {
    index: {
      ...item,
      stillReactions: ownerReactionsForStill(item, { getMediaItemById }),
      origin: model3dNeighbourOrigin(index.model3ds || [], paramsObject(url), id)
    },
    raw
  });
}

// A `/media/generations/…` path, joined the same way serveMedia joins
// generationsMediaDir. A path that leaves that root is not a file we stat.
function generationMediaFile (urlPath) {
  if (typeof urlPath !== 'string' || !urlPath.startsWith('/media/generations/')) return null;
  const rel = urlPath.slice('/media/generations/'.length);
  if (!rel) return null;
  const root = generationsMediaDir();
  const full = path.resolve(path.join(root, rel));
  if (!isInsideRoot(root, full)) return null;
  return full;
}

async function fileBytesAt (urlPath) {
  const full = generationMediaFile(urlPath);
  if (!full) return null;
  try {
    const st = await fs.promises.stat(full);
    if (!st.isFile()) return null;
    return st.size;
  } catch {
    return null;
  }
}

// Bytes live on the JSON copy only. The in-memory index entry and its
// files array stay unchanged.
async function attachModel3dFileBytes (index) {
  const next = { ...index };
  if (Array.isArray(index.files)) {
    next.files = index.files.map(file => (
      file && typeof file === 'object' ? { ...file } : file
    ));
  }
  const primary = await fileBytesAt(next.mediaPath);
  if (primary != null) next.bytes = primary;
  if (Array.isArray(next.files)) {
    await Promise.all(next.files.map(async (file) => {
      if (!file || typeof file !== 'object') return;
      const n = await fileBytesAt(file.path);
      if (n != null) file.bytes = n;
    }));
  }
  return next;
}

// Full media-item record + parent saved JSON. 404 only when the media item
// is unknown; a known item whose parent file is missing still returns
// `{ index, raw: null }` (mirrors generation/post detail).
async function handleMediaDetail (res, id, url) {
  const mi = getMediaItemById(id);
  if (!mi) {
    return sendError(res, 404, 'Media item not found');
  }

  const generationParam = url?.searchParams?.get('generation');
  let overlayEntry = null;
  let overlayRow = null;
  if (generationParam) {
    const entry = getIndex().generations.find(e => e.id === generationParam);
    const row = entry?.media?.find(
      m => normalizeMediaId(m.mediaId) === normalizeMediaId(mi.id)
    );
    if (entry && row) {
      overlayEntry = entry;
      overlayRow = row;
    }
  }

  // Clone for the overlay response. Never mutate the in-memory index record.
  let payload = overlayEntry
    ? {
        ...mi,
        date: overlayEntry.date,
        createdAt: overlayEntry.createdAt,
        thumbnailPath: overlayRow.thumbnailPath,
        seed: overlayRow.seed
      }
    : mi;

  if (!overlayEntry) {
    const sp = url?.searchParams;
    let origin = sp?.get('origin') || '';
    const postParam = sp?.get('post');
    const comicParam = sp?.get('comic');
    if (!origin && postParam) origin = 'post';
    else if (!origin && comicParam) origin = 'comic';
    const containerId = origin === 'post'
      ? postParam
      : origin === 'comic'
        ? comicParam
        : undefined;
    const originPath = originFileForOverlay(mi, { origin, containerId });
    if (originPath) {
      payload = { ...(payload === mi ? mi : payload), thumbnailPath: originPath };
    }
  }

  let raw = null;
  let rawKind = null;
  if (overlayEntry) {
    // Load this job's saved JSON — do not reuse the primary/last-wins
    // containers.generation.batchDate path.
    raw = await getGeneration(overlayEntry.date, overlayEntry.id);
    rawKind = 'generation';
  } else {
    const gen = mi.containers?.generation;
    if (gen) {
      rawKind = 'generation';
      try {
        const filepath = `${generationsDataDir()}/${gen.batchDate}/${gen.id}.json`;
        raw = JSON.parse(await readFile(filepath));
      } catch {
        raw = null;
      }
    } else {
      const postRef = mi.containers?.posts?.[0];
      if (postRef) {
        rawKind = 'post';
        const index = getIndex();
        const post = index.posts.find(p => p.id === postRef.id);
        raw = await loadPostRaw(post);
      } else {
        const comicRef = mi.containers?.comics?.[0];
        if (comicRef) {
          rawKind = 'comic';
          const comic = (getIndex().comics || []).find(c => c.id === comicRef.id);
          raw = await loadComicRaw(comic);
        }
      }
    }
  }

  const browsingLevel = await imageLevelForMediaDetail(mi, raw, rawKind);

  const hydrated = stampOwnResources(hydrateItemForDisplay(payload, getModelVersionFromCache));
  const origin = attachMediaOrigin(url, mi.id);
  const usedInPreview = projectUsedInPreview(hydrated.usedAsInput, getMediaItemById);
  const importDate = isInputOnlyItem(hydrated)
    ? earliestUsedInDate(hydrated.usedAsInput, getMediaItemById)
    : '';
  let detailIndex = {
    ...hydrated,
    browsingLevel,
    inputs: projectInputsForDetail(hydrated.inputs, getMediaItemById),
    usedAsInput: usedInPreview.rows.slice(0, 3),
    usedAsInputTotal: usedInPreview.total,
    ...(importDate ? { usedInEarliestAt: importDate } : {}),
    origin
  };
  if (detailIndex.type === 'model3d') {
    detailIndex = await attachModel3dFileBytes(detailIndex);
    const generationId = (overlayEntry && overlayEntry.id != null && overlayEntry.id !== '')
      ? overlayEntry.id
      : mi.containers?.generation?.id;
    if (generationId != null && generationId !== '') {
      const row = model3dForGeneration(getIndex().model3ds || [], generationId);
      const summary = model3dSummary(row);
      if (summary) detailIndex = { ...detailIndex, model3d: summary };
    }
  }
  sendJson(res, {
    index: projectMediaItem(detailIndex),
    raw
  });
}

// --- Media ---

function mediaRelative (pathname, prefix, { single = false } = {}) {
  if (!pathname.startsWith(prefix)) return null;
  const rel = pathname.slice(prefix.length);
  if (!rel) return null;
  const parts = rel.split(/[/\\]/);
  if (parts.some(part => part === '' || part === '.' || part === '..')) return null;
  if (single && parts.length !== 1) return null;
  return rel;
}

// Filepath for a media URL, or null when the URL is not one file inside a
// media root. Inputs are a single segment. Every prefix rejects `.` and `..`.
export function resolveMediaFile (pathname) {
  const routes = [
    ['/media/generations/', generationsMediaDir(), false],
    ['/media/posts/', postsMediaDir(), false],
    ['/media/inputs/', inputsMediaDir(), true],
    ['/media/comics/', comicsMediaDir(), false],
    ['/media/model3ds/', model3dsMediaDir(), false]
  ];
  for (const [prefix, root, single] of routes) {
    const rel = mediaRelative(pathname, prefix, { single });
    if (rel == null) continue;
    if (!root) return null;
    const full = path.join(root, rel);
    if (!isInsideRoot(root, full)) return null;
    return full;
  }
  return null;
}

async function serveMedia (req, res, pathname) {
  const filepath = resolveMediaFile(pathname);
  if (!filepath) return sendError(res, 404, 'Not found');
  return serveFile(res, filepath, { acceptRanges: true, range: req.headers.range });
}

// --- Static ---

// A media page is one segment under /media/. File bytes are the prefixes
// handleRequest already sent to serveMedia, so they never reach here.
// An old bookmark may still carry a container suffix (.glb, .jpeg).
function isMediaPagePath (pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/media/')) return false;
  const rest = pathname.slice('/media/'.length);
  return rest.length > 0 && !rest.includes('/');
}

async function serveStatic (res, pathname) {
  let filepath;

  if (pathname === '/' || pathname === '/index.html') {
    filepath = path.join(UI_DIR, 'index.html');
  } else {
    filepath = path.join(UI_DIR, pathname);
  }

  const resolved = path.resolve(filepath);
  if (!resolved.startsWith(path.resolve(UI_DIR))) {
    return sendError(res, 403, 'Forbidden');
  }

  // SPA fallback: if file doesn't exist and it's not a file extension request,
  // serve index.html for client-side routing
  try {
    await fs.promises.access(resolved, fs.constants.R_OK);
  } catch {
    if (!path.extname(pathname) || isMediaPagePath(pathname)) {
      return serveFile(res, path.join(UI_DIR, 'index.html'));
    }
    return sendError(res, 404, 'Not found');
  }

  return serveFile(res, resolved);
}

// A byte stream is not a page gesture. The promise settles when the status
// is sent and the file is piped, not when the bytes finish. The browser
// closing the response destroys the file stream, so a dropped video does
// not stay open at byte 0 and does not keep the idle gate held.
function releaseStreamOnClose (res, stream, done) {
  res.on('close', () => {
    if (!stream.destroyed) stream.destroy();
    done();
  });
}

function serveFile (res, filepath, { acceptRanges = false, range } = {}) {
  const ext = path.extname(filepath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const fail = (err) => {
      if (!res.headersSent) {
        if (err?.code === 'ENOENT') sendError(res, 404, 'Not found');
        else sendError(res, 500, err?.message || 'Read failed');
      } else if (!res.destroyed) {
        res.destroy();
      }
      done();
    };

    const attach = (stream) => {
      stream.on('error', fail);
      releaseStreamOnClose(res, stream, done);
      if (res.closed || res.destroyed) {
        stream.destroy();
        done();
        return;
      }
      stream.pipe(res);
      done();
    };

    if (!acceptRanges) {
      const stream = fs.createReadStream(filepath);
      stream.on('error', fail);
      releaseStreamOnClose(res, stream, done);
      stream.on('open', () => {
        if (res.headersSent || res.closed || res.destroyed) {
          if (!stream.destroyed) stream.destroy();
          done();
          return;
        }
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'no-cache'
        });
        stream.pipe(res);
        done();
      });
      return;
    }

    fs.stat(filepath, (err, st) => {
      if (err) {
        fail(err);
        return;
      }
      if (!st.isFile()) {
        sendError(res, 404, 'Not found');
        done();
        return;
      }

      const total = st.size;
      const parsed = parseByteRange(range, total);
      if (parsed === 'unsatisfiable') {
        res.writeHead(416, {
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes */${total}`
        });
        res.end();
        done();
        return;
      }

      const headers = {
        'Content-Type': mime,
        'Cache-Control': 'no-cache',
        'Accept-Ranges': 'bytes'
      };
      let streamOpts;
      if (parsed) {
        const length = parsed.end - parsed.start + 1;
        headers['Content-Length'] = length;
        headers['Content-Range'] = `bytes ${parsed.start}-${parsed.end}/${total}`;
        streamOpts = { start: parsed.start, end: parsed.end };
      } else {
        headers['Content-Length'] = total;
      }

      if (total === 0 || (parsed && headers['Content-Length'] === 0)) {
        res.writeHead(parsed ? 206 : 200, headers);
        res.end();
        done();
        return;
      }

      const stream = fs.createReadStream(filepath, streamOpts);
      if (res.destroyed) {
        stream.destroy();
        done();
        return;
      }
      res.writeHead(parsed ? 206 : 200, headers);
      attach(stream);
    });
  });
}

// --- Config Update ---

function passwordsDisagree (body) {
  const password = body && body.password;
  const confirm = body && body.confirmPassword;
  const left = typeof password === 'string' ? password : '';
  const right = typeof confirm === 'string' ? confirm : '';
  if (!left && !right) return null;
  if (!left || !right || left !== right) return 'Passwords do not match.';
  return null;
}

async function handleKeySave (req, res) {
  const body = await readBody(req);
  const mismatch = passwordsDisagree(body);
  if (mismatch) return sendJson(res, { ok: false, message: mismatch }, 400);
  const password = body && body.password ? body.password : null;
  const { saveTestedKey } = await import('./keyActions.mjs');
  const result = await saveTestedKey({ key: body && body.key, password });
  if (!result.ok) return sendJson(res, { ok: false, message: result.message }, 400);
  const payload = {
    ok: true,
    kind: result.kind,
    hasKey: true,
    keyEncrypted: CONFIG.keyEncrypt === true,
    keyUnlocked: true,
    username: CONFIG.username || ''
  };
  if (result.kind === 'blocked') {
    payload.libraryUsername = result.libraryUsername;
    payload.keyUsername = result.keyUsername;
  }
  return sendJson(res, payload);
}

async function handleKeyPassword (req, res) {
  const body = await readBody(req);
  const mismatch = passwordsDisagree(body);
  if (mismatch) return sendJson(res, { ok: false, message: mismatch }, 400);
  const secretKey = getAvailableSecretKey();
  if (!secretKey) return sendJson(res, { ok: false, message: 'Unlock the API key to download.' }, 400);
  const { encryptAES } = await import('./crypto.mjs');
  let stored;
  try {
    stored = encryptAES(secretKey, body.password);
  } catch {
    return sendJson(res, { ok: false, message: 'Could not encrypt key' }, 400);
  }
  if (!stored) return sendJson(res, { ok: false, message: 'Could not encrypt key' }, 400);
  await setConfig({ secretKey: stored, keyEncrypt: true });
  setMemoizedSecretKey(secretKey);
  return sendJson(res, { ok: true, keyEncrypted: true, keyUnlocked: true });
}

async function handleKeyUnprotect (req, res) {
  const body = await readBody(req);
  const password = body && body.password;
  if (!password || !CONFIG.keyEncrypt) {
    return sendJson(res, { ok: false, message: 'Password required' }, 400);
  }
  let decrypted;
  try {
    decrypted = decryptAES(CONFIG.secretKey, password);
  } catch {
    decrypted = null;
  }
  if (!decrypted) return sendJson(res, { ok: false, message: 'Wrong password' }, 401);
  await setConfig({ secretKey: decrypted, keyEncrypt: false });
  setMemoizedSecretKey(decrypted);
  return sendJson(res, { ok: true, keyEncrypted: false, keyUnlocked: true });
}

const CONFIG_WHITELIST = ['downloadMedia', 'generationReactions', 'dataPath', 'mediaPath', 'domain'];

async function handleConfigUpdate (req, res) {
  const body = await readBody(req);
  const updates = {};

  for (const key of CONFIG_WHITELIST) {
    if (key in body) updates[key] = body[key];
  }

  // Validate domain against the allow-list. Reject rather than silently
  // correct so clients notice misconfiguration.
  if ('domain' in updates && !CIVITAI_DOMAINS.includes(updates.domain)) {
    return sendError(res, 400, `Invalid domain. Allowed: ${CIVITAI_DOMAINS.join(', ')}`);
  }

  if ('downloadMedia' in updates && typeof updates.downloadMedia !== 'boolean') {
    return sendError(res, 400, 'downloadMedia must be a boolean');
  }

  if ('generationReactions' in updates) {
    updates.generationReactions = normalizeGenerationReactions(updates.generationReactions);
  }

  if (!Object.keys(updates).length) {
    return sendError(res, 400, 'No valid fields to update');
  }

  await setConfig(updates);
  return sendJson(res, { ok: true, updated: Object.keys(updates) });
}

// --- Reactions (local-canonical overrides) ---
//
// These routes let the Explorer set favorite / liked / disliked on a media
// item. The override store records only divergence from Civitai's current
// state; the downloaded JSON is never mutated. After an override write the
// affected index record is refreshed (generation upsert, post upsert, or
// input-only reproject) so gallery badges and stats update without a refetch,
// and the Exports subsystem is notified — it owns the on-disk projection, of
// which this plan performs none. See
// .cursor/plans/local-canonical-reactions_0d07d6d0.plan.md.

// Pick + validate the editable reaction fields out of a request body.
// `favorite` must be boolean; `feedback` must be 'liked' | 'disliked' | null.
// Anything else is ignored — PATCH semantics: an absent field is unchanged.
function pickReactionEdit (body) {
  const edit = {};
  if (typeof body?.favorite === 'boolean') edit.favorite = body.favorite;
  if (body && 'feedback' in body) {
    const fb = body.feedback;
    if (fb === 'liked' || fb === 'disliked' || fb === null) edit.feedback = fb;
  }
  return edit;
}

// Resolve a NORMALIZED media-item id to a known local item so PATCH can
// write an override on any indexed record: a generation (existing path),
// a post-only image (empty server reactions + post upsert), or an
// input-only item (empty server reactions + media-item reproject).
// Unknown ids 404. Post-only items are no longer out of scope.
async function resolveGenerationForMedia (id) {
  const mi = getMediaItemById(id);
  if (!mi) {
    return { error: 'Media item not found', status: 404 };
  }

  const genRef = mi.containers?.generation;
  if (genRef) {
    const generation = await getGeneration(genRef.batchDate, genRef.id);
    if (!generation) {
      return { error: 'Generation not found', status: 404 };
    }
    return { kind: 'generation', mediaItem: mi, generation };
  }

  const postRef = mi.containers?.posts?.[0];
  if (postRef) {
    return { kind: 'post', mediaItem: mi, postRef };
  }

  return { kind: 'input', mediaItem: mi };
}

// Server baseline for one media item: the union of every saved occurrence's
// tag block. A job with no block contributes nothing. Post-only and
// input-only items have no generation file, so the baseline is empty.
// Index entry tags are not this baseline — an upsert may already have
// baked an override into them.
async function serverUnionForMedia (mediaItem, id) {
  const occs = Array.isArray(mediaItem?.containers?.generations)
    ? mediaItem.containers.generations
    : [];
  if (!occs.length) return { favorite: false, feedback: null };
  const rows = [];
  for (const occ of occs) {
    if (!occ || occ.id == null || occ.batchDate == null) continue;
    const gen = await getGeneration(occ.batchDate, occ.id);
    const server = readServerReactions(gen, id);
    rows.push({
      sortKey: occ.sortKey || '',
      favorite: server.favorite,
      feedback: server.feedback
    });
  }
  return mergeOccurrenceReactions(rows);
}

// Apply one media-item's edit, writing or clearing the override per the
// converge-on-server rule. The server state is the occurrence union, not
// the primary job alone. Does NOT refresh the index or notify Exports —
// the caller batches those so a multi-item edit collapses to one index
// refresh per affected generation. Returns the effective reaction tags +
// whether an override now exists.
async function applyReactionEdit (mediaItem, id, edit) {
  const serverReactions = await serverUnionForMedia(mediaItem, id);
  const currentLocal = getMediaOverride(id) || serverReactions;
  const nextLocal = { ...currentLocal, ...edit };

  if (reactionsEqual(nextLocal, serverReactions)) {
    await clearMediaOverride(id);
  } else {
    await setMediaOverride(id, nextLocal);
  }

  return { tags: reactionsToTags(nextLocal), hasOverride: getMediaOverride(id) != null };
}

async function loadRawPostForMedia (postRef) {
  const index = getIndex();
  const post = index.posts.find(p => p.id === postRef.id);
  if (!post) return null;
  try {
    const filepath = postFilepath({ id: post.id, publishedAt: post.publishedAt });
    return JSON.parse(await readFile(filepath));
  } catch {
    return null;
  }
}

async function handleReactionPatch (req, res, rawId) {
  const id = normalizeMediaId(rawId);
  const resolved = await resolveGenerationForMedia(id);
  if (resolved.error) {
    return sendError(res, resolved.status, resolved.error);
  }

  const body = await readBody(req);
  const edit = pickReactionEdit(body);
  const canonicalId = resolved.mediaItem.id;
  const { tags, hasOverride } = await applyReactionEdit(resolved.mediaItem, canonicalId, edit);

  if (resolved.kind === 'generation') {
    await upsertIndexEntries({ generations: [resolved.generation] });
  } else if (resolved.kind === 'post') {
    const rawPost = await loadRawPostForMedia(resolved.postRef);
    if (rawPost) await upsertIndexEntries({ posts: [rawPost] });
  } else {
    // upsert({}) returns early — reproject the media-items half instead.
    reprojectIndexMediaItems();
  }

  notifyReactionChanged(canonicalId);

  return sendJson(res, { ok: true, mediaItemId: canonicalId, tags, hasOverride });
}

async function handleReactionsBatch (req, res) {
  const body = await readBody(req);
  const items = Array.isArray(body?.items) ? body.items : [];

  // Resolve every item up front. Group generation items by parent generation
  // and post-only items by post id so each file is read once and its index
  // entry refreshed once. Input-only items share one reproject at the end.
  // Do not skip items whose genId is null — post-only and input-only are
  // annotatable.
  const resolved = items.map(item => {
    const lookupId = normalizeMediaId(item?.mediaItemId);
    const mi = getMediaItemById(lookupId);
    const gen = mi?.containers?.generation || null;
    const postRef = !gen && mi?.containers?.posts?.[0] ? mi.containers.posts[0] : null;
    return {
      lookupId,
      id: mi?.id || lookupId,
      edit: pickReactionEdit(item),
      known: mi != null,
      genId: gen ? gen.id : null,
      date: gen ? gen.batchDate : null,
      postRef
    };
  });

  const genCache = new Map();
  const postCache = new Map();
  for (const r of resolved) {
    if (r.genId != null) {
      const key = `${r.date}::${r.genId}`;
      if (!genCache.has(key)) genCache.set(key, await getGeneration(r.date, r.genId));
    } else if (r.postRef && !postCache.has(r.postRef.id)) {
      postCache.set(r.postRef.id, await loadRawPostForMedia(r.postRef));
    }
  }

  const resultById = new Map();
  const affectedIds = [];
  const touchedGens = [];
  const touchedGenKeys = new Set();
  const touchedPosts = [];
  const touchedPostIds = new Set();
  let anyInputOnly = false;

  for (const r of resolved) {
    if (!r.known) {
      resultById.set(r.lookupId, { mediaItemId: r.id, tags: [], hasOverride: false });
      continue;
    }

    if (r.genId != null) {
      const key = `${r.date}::${r.genId}`;
      const generation = genCache.get(key);
      if (!generation) {
        resultById.set(r.lookupId, { mediaItemId: r.id, tags: [], hasOverride: false });
        continue;
      }
      const { tags, hasOverride } = await applyReactionEdit(getMediaItemById(r.id), r.id, r.edit);
      affectedIds.push(r.id);
      if (!touchedGenKeys.has(key)) {
        touchedGenKeys.add(key);
        touchedGens.push(generation);
      }
      resultById.set(r.lookupId, { mediaItemId: r.id, tags, hasOverride });
      continue;
    }

    if (r.postRef) {
      const { tags, hasOverride } = await applyReactionEdit(getMediaItemById(r.id), r.id, r.edit);
      affectedIds.push(r.id);
      const rawPost = postCache.get(r.postRef.id);
      if (rawPost && !touchedPostIds.has(r.postRef.id)) {
        touchedPostIds.add(r.postRef.id);
        touchedPosts.push(rawPost);
      }
      resultById.set(r.lookupId, { mediaItemId: r.id, tags, hasOverride });
      continue;
    }

    const { tags, hasOverride } = await applyReactionEdit(getMediaItemById(r.id), r.id, r.edit);
    affectedIds.push(r.id);
    anyInputOnly = true;
    resultById.set(r.lookupId, { mediaItemId: r.id, tags, hasOverride });
  }

  if (touchedGens.length) await upsertIndexEntries({ generations: touchedGens });
  if (touchedPosts.length) await upsertIndexEntries({ posts: touchedPosts });
  if (anyInputOnly) reprojectIndexMediaItems();
  if (affectedIds.length) notifyReactionsChanged(affectedIds);

  return sendJson(res, { ok: true, items: resolved.map(r => resultById.get(r.lookupId)) });
}

// --- Exports sync ---

// Dry-run (C1d): the exact plan the bulk sync WOULD apply, computed and
// returned WITHOUT scheduling a job or touching disk. Mirrors the
// handleExportSync response field-for-field (mode = the classifyPlan verdict;
// linkMode = hardlink|copy) minus the jobId, so the UI's Save flow can preview
// `+A / −B — bytes` and decide auto-apply vs an explicit confirm.
async function handleExportPlan (res, slug) {
  const result = await planExport(slug);
  if (result.error === 'not-found') return sendError(res, 404, 'Not found');
  if (result.failSoft) {
    // Destination offline at plan time — recorded as Pending, not an error.
    return sendJson(res, { pending: true, reason: result.code });
  }
  return sendJson(res, {
    dryRun: true,
    mode: result.classification,      // 'auto' | 'confirm' (the plan-gate)
    linkMode: result.linkMode,        // 'hardlink' | 'copy'
    add: result.add,
    remove: result.remove,
    bytesNeeded: result.bytesNeeded,
    estimatedSeconds: result.estimatedSeconds,
    warnings: result.warnings
  });
}

async function handleExportSync (res, slug) {
  const result = await startBulkSync(slug);
  if (result.error === 'not-found') return sendError(res, 404, 'Not found');
  if (result.error === 'insufficient-space') {
    return sendJson(res, {
      error: 'Insufficient free space to copy this export',
      bytesNeeded: result.bytesNeeded,
      available: result.available
    }, 400);
  }
  if (result.failSoft) {
    // Destination offline at plan time — recorded as Pending, not an error.
    return sendJson(res, { pending: true, reason: result.code });
  }
  if (result.error) return sendJson(res, { error: result.error }, 400);

  const { plan, jobId } = result;
  return sendJson(res, {
    jobId,
    mode: plan.classification,        // 'auto' | 'confirm' (the plan-gate)
    linkMode: plan.mode,              // 'hardlink' | 'copy'
    add: plan.addKeys.length,
    remove: plan.removeKeys.length,
    bytesNeeded: plan.bytesNeeded,
    estimatedSeconds: plan.estimatedSeconds,
    warnings: plan.warnings
  }, 202);
}

// Per-job SSE — mirrors the /api/download/progress bridge but scoped to one
// sync job. The exports module pushes a snapshot on subscribe and on every
// throttled progress tick; the stream ends on a terminal frame.
function handleExportSyncEvents (req, res, jobId) {
  if (!getSyncJob(jobId)) return sendError(res, 404, 'Unknown sync job');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const unsubscribe = subscribeSyncJob(jobId, (snapshot) => {
    try { res.write(`data: ${JSON.stringify(snapshot)}\n\n`); } catch { /* socket gone */ }
    if (snapshot.final) {
      try { res.end(); } catch { /* already closed */ }
    }
  });

  req.on('close', () => { if (unsubscribe) unsubscribe(); });
}

// --- SSE ---

function handleSSE (req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', active: downloadState.active, downloadType: downloadState.type, preparation: libraryPreparationActive(), phase: libraryPreparationPhase(), queue: liveQueueSnapshot(), auto: autoSnapshot() })}\n\n`);
  sseClients.add(res);

  req.on('close', () => { sseClients.delete(res); });
}

// --- Helpers ---

function readBody (req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

function sendJson (res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(body);
}

function sendError (res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: message }));
}

function sendRemoval (res, result) {
  if (!result || result.ok) return sendJson(res, result || { ok: false });
  if (result.error === 'not-found') return sendJson(res, result, 404);
  if (result.error === 'unsafe-root') return sendJson(res, result, 400);
  if (result.error === 'shared-destination' || result.error === 'incomplete') return sendJson(res, result, 409);
  return sendJson(res, result, 500);
}
