/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

import fs from 'node:fs';
import { writeFile, readFile, fileExists, toDateString, listDirectory, isDate, unlink } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { getCivitaiImageBase, getPost, getPostEdit, getImageGenerationData } from './civitaiApi.mjs';
import { WIRE, browsingLevelOf } from './civitaiWire.mjs';
import { postedGenerationView } from './checkpointResolution.mjs';
import { downloadMediaFile } from './mediaDownload.mjs';
import { applyStorageFault } from './downloadFault.mjs';
import { flushFetchMiss } from './fetchMiss.mjs';
import { extractInputDescriptors, saveInputMedia } from './inputMedia.mjs';
import { joinPostedFileIfHashed } from './contentHashBackfill.mjs';
import { postsDataDir, POST_DRAFTS_DIR, hasSavedPosts, postsNeedGenerationData, postsNeedImageResources, postsNeedGenerationResponse } from './postsPresence.mjs';
import { withinLatestWindow } from './latestWindow.mjs';
import { byteMissKeepsOpen, markContainerOpen, commitOpenContainer } from './downloadOpen.mjs';
import { comparableDownloadJson, sameResourceUrl } from './signedUrl.mjs';
import { mapPool, API_POOL_WIDTH, MEDIA_POOL_WIDTH } from './requestScheduler.mjs';

export { postsDataDir, POST_DRAFTS_DIR, hasSavedPosts, postsNeedGenerationData, postsNeedImageResources, postsNeedGenerationResponse };

export function postsMediaDir () { return `${CONFIG.mediaPath}/posts`; }

function postDateDir (publishedAt) {
  return publishedAt ? toDateString(publishedAt) : POST_DRAFTS_DIR;
}

// Posts are keyed on `publishedAt` (post.getInfinite / post.get omit
// top-level `createdAt`, so there is no immutable creation date to use as a
// *storage* key): published and scheduled posts live under their publishedAt
// date dir; a draft (publishedAt: null) lives in the dateless `drafts/`
// bucket (POST_DRAFTS_DIR), keyed on its immutable id. A draft is still
// datable at index-build from `images[].createdAt` / `cursorId − 100yr`.
// A draft that gains a publishedAt relocates to its date dir, and the stale
// bucket copy it left behind is cleaned (see savePostData).
export function postFilepath ({ id, publishedAt }) {
  return `${postsDataDir()}/${postDateDir(publishedAt)}/${id}.json`;
}

// Civitai `post.getInfinite` (`getImagesForPosts`) currently omits `hasMeta`
// and caps `images[]` at 8 (`POST_GETINFINITE_IMAGES_PER_POST`). Historical
// files may still carry `hasMeta` / a longer `images[]`. Capture uses
// `image.getGenerationData` per id until `generationDataCaptured` is set.
export const POST_LISTING_IMAGE_CAP = 8;

// Phase 5a (UNVERIFIED forward-compat): audio-in-posts is currently
// unreachable on Civitai — the post-editor dropzone accepts image+video MIME
// only, and the generator "add to post" flow blocks audio. We therefore have
// no real sample of an audio post image, so the `.mp3` extension and CDN URL
// pattern below are a best-effort guess (mirroring the generation audio
// container) and are UNCONFIRMED. `buildPostEntry` already classifies
// `type:'audio'`. Verify via `node dev/tools/data-shape-probe.mjs posts` when
// upstream enables audio posts, then replace with the confirmed shape.
function audioPostExtension () {
  return '.mp3';
}

function buildPostImageUrl (cdnBase, image) {
  const ext = image.type === 'video' ? '.mp4'
    : image.type === 'audio' ? audioPostExtension()
      : '.jpeg';

  if (!image.name) {
    return `${cdnBase}/${image.url}/original=true/${image.url}${ext}`;
  }

  const baseName = image.name.split('?')[0];
  const stem = baseName.includes('.') ? baseName.split('.').slice(0, -1).join('.') : baseName;
  return `${cdnBase}/${image.url}/original=true/${stem}${ext}`;
}

function mediaExtension (type) {
  // The `audio` case is UNVERIFIED forward-compat — see buildPostImageUrl.
  return type === 'video' ? '.mp4'
    : type === 'audio' ? audioPostExtension()
      : '.jpeg';
}

export function postMediaTargets (post, cdnBase) {
  const images = Array.isArray(post?.images) ? post.images : [];
  const out = [];
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (!image || image.id == null) continue;
    let url = null;
    try {
      url = buildPostImageUrl(cdnBase, image);
    } catch (ignoreErr) {
      url = null;
    }
    if (!url) continue;
    out.push({
      filepath: postImageFilepath({
        postId: post.id,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        index: i + 1,
        imageId: image.id,
        type: image.type
      }),
      url
    });
  }
  return out;
}

export function postImageFilepath ({ postId, publishedAt, index, imageId, type }) {
  // Media is keyed on the same bucket as `postFilepath`: published/scheduled
  // under their publishedAt date dir, drafts in the dateless `drafts/` bucket.
  const date = postDateDir(publishedAt);
  const ext = mediaExtension(type);
  const paddedIndex = String(index).padStart(2, '0');
  const filename = `${paddedIndex}_${imageId}${ext}`;
  return `${postsMediaDir()}/${date}/${postId}/${filename}`;
}

export async function getPostDates () {
  const names = await listDirectory(postsDataDir());
  return names.filter(isDate);
}

export async function getFirstSavedPostCursor () {
  const dates = await getPostDates();

  if (!dates.length) {
    return undefined;
  }

  try {
    const firstDate = dates[0];
    const files = await listDirectory(`${postsDataDir()}/${firstDate}`);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length) {
      return jsonFiles[0].replace('.json', '');
    }
  }

  catch (ignoreErr) {
    return undefined;
  }

  return undefined;
}

// Phase 5c: status is derived from `publishedAt` at every write. A post with a
// `publishedAt` is published; a draft (`publishedAt: null`) is a draft. This is
// authoritative and bidirectional — an unpublished post re-derives to 'draft'
// on its next re-save. `buildPostEntry` reads this field (and falls back to the
// same derivation when older JSON has no `status`).
export function postStatus (post) {
  return post.publishedAt ? 'published' : 'draft';
}

function withDerivedStatus (post) {
  return { ...post, status: postStatus(post) };
}

// Phase 5c/5d shared re-save seam. Given the saved JSON and the freshly-fetched
// post, produces the object that should be persisted. Mirrors the intent of
// `saveGenerations`' overwriteIfModified compare, adapted to posts:
//   - The fresh post (post.getInfinite) carries the authoritative upstream
//     fields (title, stats, images, publishedAt) but NOT the enrichment fields
//     (`tags` / `detail` / `availability` from post.get, per-image `meta` from
//     the images endpoint), so those are preserved from the saved JSON.
  //   - 5d: any image present in the saved set but absent from the fresh set is
  //     appended to `deletedImages` as `{ id, removedAt }` (idempotent — an id
  //     already recorded keeps its original `removedAt`). The media file is left
  //     on disk, mirroring the generation `metadata.images.<id>.hidden` flag.
  //     A truncated getInfinite page (imageCount > images.length) does not
  //     count as a deletion — extras stay on the saved JSON.
// Status is applied at write time by `withDerivedStatus`, so it is intentionally
// not set here; the caller compares `withDerivedStatus(reconcilePost(...))`
// against the saved JSON to decide whether a re-save is needed.
function listingLooksCapped (freshPost, savedImages) {
  const fresh = Array.isArray(freshPost.images) ? freshPost.images : [];
  const saved = Array.isArray(savedImages) ? savedImages : [];
  const imageCount = freshPost.imageCount;
  if (typeof imageCount === 'number') return imageCount > fresh.length;
  return fresh.length === POST_LISTING_IMAGE_CAP && saved.length > fresh.length;
}

// Saved membership no longer matches the listing count. A capped page whose
// saved length already equals imageCount is not drift: the tail is stored.
function membershipDrift (freshPost, saved) {
  if (!saved || !freshPost) return false;
  const savedCount = Array.isArray(saved.images) ? saved.images.length : 0;
  const imageCount = freshPost.imageCount;
  if (typeof imageCount === 'number') return imageCount !== savedCount;
  return listingLooksCapped(freshPost, saved.images);
}

function withPreservedMeta (freshImages, savedImages) {
  const savedById = new Map();
  for (const img of savedImages) {
    if (img && img.id != null) savedById.set(img.id, img);
  }
  if (!savedById.size) return freshImages;
  return freshImages.map(img => {
    if (!img || img.id == null) return img;
    const saved = savedById.get(img.id);
    if (!saved) return img;
    let next = img;
    const ensure = () => {
      if (next === img) next = { ...img };
      return next;
    };
    if (saved.meta && !('meta' in img)) ensure().meta = saved.meta;
    if (('hasMeta' in saved) && !('hasMeta' in img)) ensure().hasMeta = saved.hasMeta;
    if (saved.workflowSourcesCaptured === true && img.workflowSourcesCaptured !== true) {
      ensure().workflowSourcesCaptured = true;
    }
    if (saved.imageResourcesCaptured === true && img.imageResourcesCaptured !== true) {
      ensure().imageResourcesCaptured = true;
    }
    if (saved.process != null && img.process == null) ensure().process = saved.process;
    if (saved.techniques != null && img.techniques == null) ensure().techniques = saved.techniques;
    if (saved.imageResources != null && img.imageResources == null) ensure().imageResources = saved.imageResources;
    if (saved.generationDataCaptured === true && img.generationDataCaptured !== true) {
      ensure().generationDataCaptured = true;
    }
    if (saved.generationData != null && img.generationData == null) {
      ensure().generationData = saved.generationData;
    }
    return next;
  });
}

function reconcilePost (savedJson, freshPost) {
  const next = { ...savedJson, ...freshPost };

  const savedImages = Array.isArray(savedJson.images) ? savedJson.images : [];
  const freshImages = Array.isArray(freshPost.images) ? freshPost.images : [];

  // Preserve per-image meta (post.getInfinite omits `meta`). A capped listing
  // (imageCount > images.length, typically 8) is not a deletion: keep saved
  // rows that are missing from the truncated page.
  if (listingLooksCapped(freshPost, savedImages)) {
    const mergedFresh = withPreservedMeta(freshImages, savedImages);
    const freshIds = new Set(mergedFresh.map(img => img && img.id).filter(id => id != null));
    const extras = savedImages.filter(img => img && img.id != null && !freshIds.has(img.id));
    next.images = extras.length ? [...mergedFresh, ...extras] : (mergedFresh.length ? mergedFresh : savedImages);
  } else if (freshImages.length) {
    next.images = withPreservedMeta(freshImages, savedImages);
  }

  // 5d: diff saved images[] against the membership we will persist. Skip this
  // when the listing is truncated — extras are kept, not deleted.
  const prior = Array.isArray(savedJson.deletedImages) ? savedJson.deletedImages : [];
  const deletedById = new Map();
  for (const entry of prior) {
    if (entry && entry.id != null) deletedById.set(entry.id, entry);
  }

  const persistIds = new Set(
    (Array.isArray(next.images) ? next.images : [])
      .map(img => img && img.id)
      .filter(id => id != null)
  );
  const removedAt = new Date().toISOString();

  if (!listingLooksCapped(freshPost, savedImages)) {
    for (const img of savedImages) {
      const id = img && img.id;
      if (id == null) continue;
      if (!persistIds.has(id) && !deletedById.has(id)) {
        deletedById.set(id, { id, removedAt });
      }
    }
  }

  // Only introduce the field when there is something to record; an unchanged
  // post that never had a deletion stays byte-identical so the compare below
  // is a clean no-op (the `{ ...savedJson }` spread already carries forward an
  // existing `deletedImages`, including an empty array).
  if (deletedById.size) {
    next.deletedImages = [...deletedById.values()];
  }

  return next;
}

const postWriteTail = new Map();

function enqueuePostWrite (filepath, fn) {
  const prev = postWriteTail.get(filepath) || Promise.resolve();
  const run = prev.then(fn, fn);
  postWriteTail.set(filepath, run.then(() => {}, () => {}));
  return run;
}

// `releaseOpen` drops the mark. Any other save keeps a mark already on disk,
// so the generation-data write that overlaps the file walk cannot clear it.
export async function savePostData (post, { releaseOpen = false } = {}) {
  const { id, publishedAt, createdAt } = post;
  const filepath = postFilepath({ id, publishedAt, createdAt });

  return enqueuePostWrite(filepath, async () => {
  try {
    const next = withDerivedStatus(post);
    if (releaseOpen) delete next.downloadOpen;
    else if (next.downloadOpen !== true) {
      try {
        const prev = JSON.parse(await readFile(filepath));
        if (prev && prev.downloadOpen === true) next.downloadOpen = true;
      } catch (ignoreErr) { /* first write, or not JSON yet */ }
    }
    await writeFile(filepath, JSON.stringify(next, null, 2));

    // Draft → published/scheduled cleanup: once a post has a publishedAt it
    // lives under its date dir, so drop any stale copy left in the drafts
    // bucket. O(1), best-effort — a failure here must never fail the save.
    if (publishedAt) {
      try { await unlink(`${postsDataDir()}/${POST_DRAFTS_DIR}/${id}.json`); } catch (ignoreErr) { /* no stale draft JSON to remove */ }
      try { await fs.promises.rm(`${postsMediaDir()}/${POST_DRAFTS_DIR}/${id}`, { recursive: true, force: true }); } catch (ignoreErr) { /* no stale draft media to remove */ }
    }

    return filepath;
  }

  catch (error) {
    console.error(error);
    return '';
  }
  });
}

export async function enrichPostDetail (post, { secretKey, signal } = {}) {
  try {
    const data = await getPost({ id: post.id, secretKey, signal });

    if ('error' in data) {
      return null;
    }

    const detail = data.result?.data?.json;

    if (!detail) {
      return null;
    }

    const enrichedFields = {
      tags: detail.tags ?? [],
      detail: detail.detail ?? null,
      availability: detail.availability ?? null
    };

    const same = comparableDownloadJson({
      tags: post.tags ?? [],
      detail: post.detail ?? null,
      availability: post.availability ?? null
    }) === comparableDownloadJson(enrichedFields);
    if (same) return { changed: false };

    const enrichedPost = { ...post, ...enrichedFields };
    await savePostData(enrichedPost);

    return { changed: true, ...enrichedFields };
  }

  catch (ignoreErr) {
    return null;
  }
}

function generationDataFromResponse (data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.error) return null;
  const body = { ...data };
  delete body.canRemix;
  delete body.onSite;
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) delete body[key];
  }
  return Object.keys(body).length ? body : null;
}

function imageNeedsGenerationCapture (img) {
  if (!img || img.id == null) return false;
  return img.generationDataCaptured !== true;
}

function captureFromGenerationData (img, data) {
  const next = { ...img };
  const body = generationDataFromResponse(data);
  if (body) next.generationData = body;
  else delete next.generationData;
  const meta = body && body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
    && Object.keys(body.meta).length
    ? body.meta
    : null;
  next.hasMeta = !!meta;
  delete next.meta;
  delete next.process;
  delete next.techniques;
  delete next.imageResources;
  next.generationDataCaptured = true;
  return next;
}

// One image.getGenerationData per image that has not stored the body.
// Posts and comics share this walk. The scheduler admits the calls together.
// A transport throw or `data.error` leaves that record out of the map.
export async function collectGenerationSourceUpdates (records, { secretKey, signal, force = false } = {}) {
  const updates = new Map();
  if (!Array.isArray(records) || !records.length) return updates;
  const pending = (force ? records : records.filter(imageNeedsGenerationCapture))
    .filter(img => img && img.id != null);
  if (!pending.length) return updates;

  await mapPool(pending, API_POOL_WIDTH, async (img) => {
    if (signal && signal.aborted) return { stop: true };
    let data;
    try {
      data = await getImageGenerationData({ id: img.id, secretKey, signal });
    } catch (ignoreErr) {
      return null;
    }
    if (signal && signal.aborted) return { stop: true };
    if (!data || data.error) return null;
    updates.set(img.id, captureFromGenerationData(img, data));
    return null;
  }, { signal });

  return updates;
}

export async function enrichPostImageMeta (post, { secretKey, signal } = {}) {
  // Site-parity: one image.getGenerationData per image that lacks
  // generationDataCaptured. Comics use the same collector on Ready panel
  // image ids.
  if (!Array.isArray(post.images) || !post.images.length) return false;

  try {
    const updates = await collectGenerationSourceUpdates(post.images, { secretKey, signal });
    if (!updates.size) return false;

    const images = post.images.map(img => {
      if (!img || img.id == null || !updates.has(img.id)) return img;
      return updates.get(img.id);
    });
    await savePostData({ ...post, images });
    return true;
  }

  catch (ignoreErr) {
    return false;
  }
}

function stableJson (value) {
  return JSON.stringify(value ?? null);
}

function techniquePairs (list) {
  if (!Array.isArray(list)) return [];
  return list.map(row => ({
    id: row && row.id != null ? row.id : null,
    name: row && typeof row.name === 'string' ? row.name : ''
  }));
}

function resourceVersionIds (list) {
  const ids = [];
  for (const row of list || []) {
    const id = row?.modelVersionId ?? row?.versionId;
    if (typeof id === 'number' && Number.isFinite(id)) ids.push(id);
  }
  ids.sort((a, b) => a - b);
  return ids;
}

function editCardDiffers (storedBody, editImage) {
  const storedMeta = storedBody && storedBody.meta ? storedBody.meta : null;
  const editMeta = editImage?.hideMeta ? null : (editImage?.meta ?? null);
  if (stableJson(storedMeta) !== stableJson(editMeta)) return true;
  if (stableJson(techniquePairs(storedBody?.techniques)) !== stableJson(techniquePairs(editImage?.techniques))) {
    return true;
  }
  const storedIds = resourceVersionIds(storedBody?.resources);
  const editIds = resourceVersionIds(editImage?.resourceHelper);
  return stableJson(storedIds) !== stableJson(editIds);
}

function nonEmptyEditMeta (editImage) {
  if (!editImage || editImage.hideMeta) return null;
  const meta = editImage.meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  if (!Object.keys(meta).length) return null;
  return meta;
}

function mapEditResources (helperRows, storedResources) {
  const stored = new Map();
  for (const row of storedResources || []) {
    const id = row?.modelVersionId ?? row?.versionId;
    if (id != null) stored.set(id, row);
  }
  const out = [];
  for (const row of helperRows || []) {
    const id = row?.modelVersionId;
    if (typeof id !== 'number' || !Number.isFinite(id)) continue;
    const prev = stored.get(id);
    const mapped = { modelVersionId: id };
    const type = row.modelType || row.type;
    if (typeof type === 'string' && type) mapped.type = type;
    if (typeof row.modelName === 'string' && row.modelName) mapped.modelName = row.modelName;
    const versionName = row.modelVersionName || row.versionName;
    if (typeof versionName === 'string' && versionName) mapped.modelVersionName = versionName;
    if (row.modelId != null && row.modelId !== '') mapped.modelId = row.modelId;
    const strength = prev?.strength ?? prev?.weight;
    if (typeof strength === 'number' && Number.isFinite(strength)) mapped.strength = strength;
    out.push(mapped);
  }
  return out;
}

function tagIdsFromEdit (editImage) {
  if (!Array.isArray(editImage?.tags)) return [];
  return editImage.tags.map(tag => tag && tag.id).filter(id => typeof id === 'number');
}

function projectEditImage (editImage, saved, listing) {
  const next = saved && typeof saved === 'object' ? { ...saved } : { id: editImage.id };
  next.id = editImage.id;
  if ('url' in editImage) next.url = editImage.url;
  if ('name' in editImage) next.name = editImage.name;
  if ('width' in editImage) next.width = editImage.width;
  if ('height' in editImage) next.height = editImage.height;
  if ('type' in editImage) next.type = editImage.type;
  if ('metadata' in editImage) next.metadata = editImage.metadata;
  if (browsingLevelOf(editImage) != null) next[WIRE.browsingLevel] = browsingLevelOf(editImage);

  if (listing && Array.isArray(listing.tagIds)) next.tagIds = listing.tagIds;
  else next.tagIds = tagIdsFromEdit(editImage);

  const meta = nonEmptyEditMeta(editImage);
  const body = next.generationData && typeof next.generationData === 'object' && !Array.isArray(next.generationData)
    ? { ...next.generationData }
    : null;

  if (meta) {
    next.meta = meta;
    next.hasMeta = true;
    if (editImage.hideMeta === true) next.hideMeta = true;
    else delete next.hideMeta;
    if (body) body.meta = meta;
  } else {
    delete next.meta;
    next.hasMeta = false;
    if (editImage.hideMeta === true) next.hideMeta = true;
    if (body) delete body.meta;
  }

  const techniques = Array.isArray(editImage.techniques) ? editImage.techniques : [];
  next.techniques = techniques;
  if (body) body.techniques = techniques;

  const resources = mapEditResources(editImage.resourceHelper, body?.resources || saved?.imageResources);
  next.imageResources = resources;
  if (body) body.resources = resources;

  const hasProcess = (body && typeof body.process === 'string' && body.process)
    || (typeof next.process === 'string' && next.process);
  if (!hasProcess && typeof editImage.generationProcess === 'string' && editImage.generationProcess) {
    next.process = editImage.generationProcess;
    if (body) body.process = editImage.generationProcess;
  }

  if (body) next.generationData = body;
  return next;
}

// Uncapped owner read. Replaces images[] with the edit order. Listing tag
// ids win for images the page already carried. Does not call generation data.
function applyPostEdit (base, edit, listingImages) {
  const savedImages = Array.isArray(base.images) ? base.images : [];
  const savedById = new Map();
  for (const img of savedImages) {
    if (img && img.id != null) savedById.set(img.id, img);
  }
  const listingById = new Map();
  for (const img of listingImages || []) {
    if (img && img.id != null) listingById.set(img.id, img);
  }

  const editImages = Array.isArray(edit?.images) ? [...edit.images] : [];
  editImages.sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0));
  const images = editImages
    .filter(img => img && img.id != null)
    .map(img => projectEditImage(img, savedById.get(img.id), listingById.get(img.id)));

  const prior = Array.isArray(base.deletedImages) ? base.deletedImages : [];
  const deletedById = new Map();
  for (const entry of prior) {
    if (entry && entry.id != null) deletedById.set(entry.id, entry);
  }
  const persistIds = new Set(images.map(img => img.id));
  const removedAt = new Date().toISOString();
  for (const img of savedImages) {
    const id = img && img.id;
    if (id == null) continue;
    if (!persistIds.has(id) && !deletedById.has(id)) {
      deletedById.set(id, { id, removedAt });
    }
  }

  const next = {
    ...base,
    detail: edit.detail ?? null,
    tags: edit.tags ?? [],
    availability: edit.availability ?? null,
    images
  };
  if (deletedById.size) next.deletedImages = [...deletedById.values()];
  return next;
}

function urlsById (images) {
  const map = new Map();
  for (const img of images || []) {
    if (img && img.id != null && typeof img.url === 'string') map.set(img.id, img.url);
  }
  return map;
}

export async function savePostMedia (post, { signal, secretKey, onProgress, previousUrls } = {}) {
  const report = { imagesSaved: 0, videosSaved: 0, audioSaved: 0, error: undefined, aborted: false };
  try {
  const { id: postId, publishedAt, createdAt, images } = post;

  if (!Array.isArray(images) || !images.length) {
    return report;
  }

  const cdnBase = await getCivitaiImageBase({ secretKey });
  const totalImages = images.length;
  let opening = null;
  const ensureOpen = () => {
    if (CONFIG.downloadMedia === false) return Promise.resolve();
    if (!opening) {
      opening = markContainerOpen(post, (doc) => commitOpenContainer(doc, 'posts', savePostData));
    }
    return opening;
  };

  await mapPool(images, MEDIA_POOL_WIDTH, async (image, i, poolSignal) => {
    const live = poolSignal || signal;
    if (live && live.aborted) {
      report.aborted = true;
      return { stop: true };
    }

    const { id: imageId, type } = image;
    const filepath = postImageFilepath({ postId, publishedAt, createdAt, index: i + 1, imageId, type });
    const previousUrl = previousUrls && imageId != null ? previousUrls.get(imageId) : undefined;
    const urlChanged = typeof previousUrl === 'string' && !sameResourceUrl(previousUrl, image.url);

    if (!urlChanged && await fileExists(filepath)) return null;

    if (onProgress) onProgress({ phase: 'media', index: i + 1, total: totalImages });

    let imageUrl;
    try {
      imageUrl = buildPostImageUrl(cdnBase, image);
    } catch (ignoreErr) {
      console.log(`Warning: skipping image ${imageId} in post ${postId} — ${ignoreErr.message}`);
      return null;
    }

    if (CONFIG.downloadMedia !== false) await ensureOpen();
    const result = await downloadMediaFile(imageUrl, filepath, { signal: live, replace: urlChanged });

    if (applyStorageFault(report, result) || result.status === 'aborted') {
      report.aborted = true;
      return { stop: true };
    }

    if (result.status !== 'published') {
      if (byteMissKeepsOpen(result)) report.incomplete = true;
      return null;
    }

    try {
      await joinPostedFileIfHashed(filepath, imageId);
    } catch (ignoreErr) {
      // Fail-soft: hash/join must not fail the download.
    }

    if (type === 'video') report.videosSaved++;
    else if (type === 'audio') report.audioSaved++;
    else report.imagesSaved++;
    return null;
  }, { signal });

  if (signal?.aborted) report.aborted = true;
  return report;
  } finally {
    await flushFetchMiss();
  }
}

async function readPostEdit (id, { secretKey, signal }) {
  if (signal && signal.aborted) return { aborted: true };
  let data;
  try {
    data = await getPostEdit({ id, secretKey, signal });
  } catch (ignoreErr) {
    return { error: { message: 'Could not read the post editor' } };
  }
  if (signal && signal.aborted) return { aborted: true };
  if (!data || data.error) {
    return { error: data?.error || { message: 'Could not read the post editor' } };
  }
  const edit = data.result?.data?.json;
  if (!edit || !Array.isArray(edit.images)) {
    return { error: { message: 'Unexpected post editor shape' } };
  }
  return { edit };
}

async function writeRefreshedPost (post, filepath) {
  const savedFilepath = await savePostData(post);
  if (!savedFilepath) return null;
  return JSON.parse(await readFile(filepath));
}

// Generation-data calls for images that were never captured, and, on a
// checked run, images whose editor row differs from the stored card.
async function refreshGenerationCards (post, { secretKey, signal, editById, checkAllMedia: check }) {
  const images = Array.isArray(post.images) ? post.images : [];
  const pending = [];
  for (const img of images) {
    if (!img || img.id == null) continue;
    if (img.generationDataCaptured !== true) {
      pending.push(img);
      continue;
    }
    if (check && editById && editById.has(img.id)) pending.push(img);
  }
  if (!pending.length) return { changed: false, incomplete: false };
  const updates = await collectGenerationSourceUpdates(pending, { secretKey, signal, force: true });
  const incomplete = updates.size < pending.length;
  if (!updates.size) return { changed: false, incomplete };
  post.images = images.map(img => {
    if (!img || img.id == null || !updates.has(img.id)) return img;
    return updates.get(img.id);
  });
  return { changed: true, incomplete };
}

export async function savePosts (apiResponse, {
  overwrite = false,
  overwriteIfModified = false,
  refreshSaved = false,
  checkAllMedia = false,
  withImages = true,
  onProgress,
  signal,
  secretKey,
  // Latest frontier. Detail reads are the check set, not every post on the page.
  latestFrontier = false,
  coveredNewestSaved = false,
  forceIds = null
} = {}) {
  const report = {
    postsNew: 0,
    postsUpdated: 0,
    postsSaved: 0,
    imagesSaved: 0,
    videosSaved: 0,
    audioSaved: 0,
    activity: null,
    error: null,
    refreshErrors: [],
    currentPosts: [],
    // Posts that were saved, enriched, or had new media this call. The
    // download orchestrator passes these to upsertIndexEntries() so the
    // server index reflects them without a full filesystem rescan. We push
    // the latest disk JSON (re-read after enrichment) so the index entry
    // includes any tags / image meta that helpers wrote in place.
    savedItems: [],
    frontierCrossed: false,
    coveredNewestSaved: coveredNewestSaved === true,
    editorIds: []
  };
  try {

  function progress (activity) {
    report.activity = activity;
    if (onProgress) onProgress(report);
  }

  const { result } = apiResponse;
  const { data } = result;

  if (!data || !('json' in data) || !Array.isArray(data.json.items)) {
    console.log('Unexpected posts API data', JSON.stringify(data, null, 2));
    return report;
  }

  const { items } = data.json;

  if (!items.length) {
    return report;
  }

  const totalItems = items.length;
  report.currentPosts = items.map(({ id, publishedAt }) => ({ id, publishedAt, status: 'pending' }));

  for (let itemIndex = 0; itemIndex < totalItems; itemIndex++) {
    const post = items[itemIndex];
    const postNum = itemIndex + 1;
    const currentReportItem = report.currentPosts.find(item => item.id === post.id);

    if (signal && signal.aborted) {
      currentReportItem.status = 'aborted';
      return report;
    }

    const { id, publishedAt, createdAt } = post;
    const filepath = postFilepath({ id, publishedAt, createdAt });
    const exists = await fileExists(filepath);
    const existed = exists;
    if (latestFrontier && publishedAt && !withinLatestWindow(publishedAt)) {
      report.frontierCrossed = true;
    }
    let newestSaved = false;
    if (latestFrontier && exists && !report.coveredNewestSaved) {
      newestSaved = true;
      report.coveredNewestSaved = true;
    }
    const forced = !!(forceIds && forceIds.has(id));
    let postChanged = false;
    let working = null;
    let fanOutPromise = null;
    let previousUrls = new Map();
    let editById = null;
    let editFailed = false;

    if (!exists || overwrite) {
      progress({ phase: 'saving', index: postNum, total: totalItems });

      const savedFilepath = await savePostData(post);

      if (!savedFilepath) {
        currentReportItem.status = 'data-error';
        report.error = { message: 'Could not save post data' };
        return report;
      }

      currentReportItem.status = 'data-saved';
      report.postsSaved++;
      postChanged = true;

      if (!exists) {
        report.postsNew++;
      }

      try {
        working = JSON.parse(await readFile(filepath));
      } catch (ignoreErr) {
        working = post;
      }
    } else {
      progress({ phase: 'checking', index: postNum, total: totalItems });

      currentReportItem.status = 'exists';

      try {
        const savedJson = JSON.parse(await readFile(filepath));
        previousUrls = urlsById(savedJson.images);
        working = savedJson;

        // Phase 5c/5d re-save seam. When the freshly-fetched post differs from
        // what is on disk — a status flip, an upstream content change, or an
        // image that was removed from the post — overwrite the saved JSON and
        // mark it changed so the index upserts. This is per-post and never
        // touches the cursor/stop behaviour of the resumed "Download all
        // posts" walk (v5.1.0): `postsNew` only increments in the !exists
        // branch, so latest-mode's stop condition is unaffected.
        if (overwriteIfModified && !(signal && signal.aborted)) {
          const reconciled = reconcilePost(savedJson, post);
          const willWrite = comparableDownloadJson(withDerivedStatus(reconciled));
          const current = comparableDownloadJson(savedJson);

          if (willWrite !== current) {
            progress({ phase: 'saving', index: postNum, total: totalItems });

            const written = await writeRefreshedPost(reconciled, filepath);

            if (!written) {
              currentReportItem.status = 'data-error';
              report.error = { message: 'Could not save post data' };
              return report;
            }

            currentReportItem.status = 'data-saved';
            report.postsSaved++;
            postChanged = true;
            working = written;
          }
        }
      }

      catch (ignoreErr) {
        // Could not read saved post for reconcile / backfill — skip
      }
    }

    const drift = !!(working && membershipDrift(post, working));
    const inCheck = !latestFrontier || forced || !exists || withinLatestWindow(publishedAt) || newestSaved || drift;

    const shouldEdit = !!(
      secretKey && working && !(signal && signal.aborted)
      && (checkAllMedia || (latestFrontier
        ? inCheck
        : (refreshSaved && listingLooksCapped(post, working.images))))
    );

    if (shouldEdit) {
      progress({ phase: 'enriching', index: postNum, total: totalItems });
      const read = await readPostEdit(id, { secretKey, signal });

      if (read.aborted) {
        currentReportItem.status = 'aborted';
        return report;
      }

      if (read.error) {
        report.refreshErrors.push(read.error);
        editFailed = true;
      } else {
        // Compare against the card that is on disk now. applyPostEdit writes
        // the edit meta onto that card, so a later compare would always match.
        const refreshIds = new Set();
        const savedById = new Map();
        for (const img of working.images || []) {
          if (img && img.id != null) savedById.set(img.id, img);
        }
        for (const editImg of read.edit.images || []) {
          if (!editImg || editImg.id == null) continue;
          const saved = savedById.get(editImg.id);
          if (!saved || saved.generationDataCaptured !== true || (checkAllMedia && editCardDiffers(saved.generationData, editImg))) {
            refreshIds.add(editImg.id);
          }
        }
        if (!checkAllMedia) {
          for (const id of [...refreshIds]) {
            const saved = savedById.get(id);
            if (saved && saved.generationDataCaptured === true) refreshIds.delete(id);
          }
        }
        const applied = applyPostEdit(working, read.edit, post.images);
        const willWrite = comparableDownloadJson(withDerivedStatus(applied));
        let currentDoc = null;
        try {
          currentDoc = JSON.parse(await readFile(filepath));
        } catch (ignoreErr) {
          currentDoc = null;
        }

        editById = refreshIds;
        report.editorIds.push(id);
        if (currentDoc == null || willWrite !== comparableDownloadJson(currentDoc)) {
          const written = await writeRefreshedPost(applied, filepath);

          if (!written) {
            currentReportItem.status = 'data-error';
            report.error = { message: 'Could not save post data' };
            return report;
          }

          working = written;
          postChanged = true;
          currentReportItem.status = 'data-saved';
        }
      }
    }

    if (secretKey && working && !(signal && signal.aborted) && (!latestFrontier || inCheck)) {
      const wantDetail = !editById && (latestFrontier
        ? (editFailed && inCheck)
        : (refreshSaved || editFailed || !('tags' in working)));

      if (wantDetail) {
        progress({ phase: 'enriching', index: postNum, total: totalItems });
        const enriched = await enrichPostDetail(working, { secretKey, signal });

        if (!enriched) {
          console.log(`Warning: could not enrich detail for post ${id}`);
        } else if (enriched.changed) {
          postChanged = true;
          try {
            working = JSON.parse(await readFile(filepath));
          } catch (ignoreErr) {
            // Keep the in-memory post; the file write already succeeded.
          }
        }
      }

      const fanOut = !(checkAllMedia && editFailed);
      if (fanOut && !(signal && signal.aborted)) {
        fanOutPromise = (async () => {
          if (checkAllMedia && editById) {
            const cards = await refreshGenerationCards(working, {
              secretKey,
              signal,
              editById,
              checkAllMedia: true
            });
            if (cards.incomplete) {
              report.refreshErrors.push({ message: 'Could not refresh every image' });
            }
            if (cards.changed) {
              const savedFilepath = await savePostData(working);
              if (savedFilepath) postChanged = true;
            }
          } else {
            const merged = await enrichPostImageMeta(working, { secretKey, signal });
            if (merged) postChanged = true;
          }
        })();
      }
    }

    const mediaPost = working && Array.isArray(working.images) && working.images.length ? working : post;

    let mediaReport = null;
    const mediaPromise = (withImages && mediaPost.images && mediaPost.images.length)
      ? savePostMedia(mediaPost, {
        signal,
        secretKey,
        previousUrls,
        onProgress: (mediaActivity) => {
          progress(mediaActivity);
        }
      })
      : null;

    if (fanOutPromise) await fanOutPromise;

    if (mediaPromise) {
      mediaReport = await mediaPromise;

      report.imagesSaved += mediaReport.imagesSaved;
      report.videosSaved += mediaReport.videosSaved;
      report.audioSaved += mediaReport.audioSaved;

      if (mediaReport.fault === 'storage') report.fault = 'storage';
      if (mediaReport.aborted) {
        currentReportItem.status = 'aborted';
        return report;
      }

      if (withImages && CONFIG.downloadMedia !== false) {
        for (const image of mediaPost.images) {
          if (signal && signal.aborted) {
            currentReportItem.status = 'aborted';
            return report;
          }
          const descriptors = extractInputDescriptors(postedGenerationView(image).meta || image, 'post-image');
          const inputs = await saveInputMedia(descriptors, { signal, onProgress: progress, recall: 'download' });
          if (inputs && inputs.fault === 'storage') {
            report.fault = 'storage';
            report.aborted = true;
            currentReportItem.status = 'aborted';
            return report;
          }
        }

        if (signal && signal.aborted) {
          currentReportItem.status = 'aborted';
          return report;
        }
      }

      if (mediaReport.imagesSaved > 0 || mediaReport.videosSaved > 0 || mediaReport.audioSaved > 0) {
        postChanged = true;
      }

      if (currentReportItem.status !== 'aborted') {
        currentReportItem.status = 'media-saved';
      }
    }

    const doc = working || post;
    const membershipOpen = typeof doc.imageCount === 'number'
      && doc.imageCount > (Array.isArray(doc.images) ? doc.images.length : 0);
    const mediaOpen = !!(withImages && CONFIG.downloadMedia !== false && mediaReport && mediaReport.incomplete);
    const shouldOpen = mediaOpen || (inCheck && membershipOpen);
    if (doc && typeof doc === 'object') {
      const hadOpen = doc.downloadOpen === true;
      if (shouldOpen && !hadOpen) {
        doc.downloadOpen = true;
        if (await savePostData(doc)) postChanged = true;
      } else if (!shouldOpen && hadOpen && inCheck) {
        delete doc.downloadOpen;
        if (await savePostData(doc, { releaseOpen: true })) postChanged = true;
      }
    }

    if (postChanged) {
      try {
        const finalJson = JSON.parse(await readFile(filepath));
        report.savedItems.push(finalJson);
      } catch {
        // If we can't re-read, fall back to the raw API post — better than
        // nothing for the index update.
        report.savedItems.push(post);
      }
    }

    if (existed && postChanged) report.postsUpdated++;

    progress(null);
  }

  return report;
  } finally {
    await flushFetchMiss();
  }
}
