/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

import fs from 'node:fs';
import { writeFile, readFile, fileExists, toDateString, listDirectory, isDate, wait, unlink } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { getCivitaiImageBase, getPost, getImageGenerationData } from './civitaiApi.mjs';
import { downloadMediaFile } from './mediaDownload.mjs';
import { extractInputDescriptors, saveInputMedia } from './inputMedia.mjs';
import { joinPostedFileIfHashed } from './contentHashBackfill.mjs';
import { postsDataDir, POST_DRAFTS_DIR, hasSavedPosts, postsNeedGenerationData } from './postsPresence.mjs';

export { postsDataDir, POST_DRAFTS_DIR, hasSavedPosts, postsNeedGenerationData };

const DATA_RATE_LIMIT = 100;

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
// `image.getGenerationData` per id. A local `hasMeta: false` stamp means
// "already checked, nothing to show" for the meta fill. The workflow-source
// stamp (`workflowSourcesCaptured`) is separate and still fetches.
export const POST_LISTING_IMAGE_CAP = 8;

function imageHasUsableMeta (img) {
  return !!(img && img.meta && typeof img.meta === 'object' && Object.keys(img.meta).length > 0);
}

export function imageNeedsGenerationData (img) {
  return !!(img && img.id != null && img.hasMeta !== false && !imageHasUsableMeta(img));
}

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
    if (saved.process != null && img.process == null) ensure().process = saved.process;
    if (saved.techniques != null && img.techniques == null) ensure().techniques = saved.techniques;
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

export async function savePostData (post) {
  const { id, publishedAt, createdAt } = post;
  const filepath = postFilepath({ id, publishedAt, createdAt });

  try {
    await writeFile(filepath, JSON.stringify(withDerivedStatus(post), null, 2));

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
}

export async function enrichPostDetail (post, { secretKey, signal } = {}) {
  try {
    await wait(DATA_RATE_LIMIT);
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

    const enrichedPost = { ...post, ...enrichedFields };
    await savePostData(enrichedPost);

    return enrichedFields;
  }

  catch (ignoreErr) {
    return null;
  }
}

function mapGenerationDataResources (resources) {
  if (!Array.isArray(resources) || !resources.length) return [];
  return resources.map(r => {
    if (!r || typeof r !== 'object') return null;
    const typeRaw = r.modelType ?? r.type;
    const type = typeof typeRaw === 'string' ? typeRaw.toLowerCase() : undefined;
    const modelVersionId = r.modelVersionId ?? r.versionId;
    if (modelVersionId == null && !type) return null;
    return {
      type,
      modelVersionId,
      weight: r.strength ?? r.weight,
      modelVersionName: r.versionName ?? r.modelVersionName,
      modelName: r.modelName,
      modelId: r.modelId,
      baseModel: r.baseModel
    };
  }).filter(Boolean);
}

function metaFromGenerationData (data) {
  if (!data || typeof data !== 'object' || data.error) return null;
  const meta = (data.meta && typeof data.meta === 'object') ? { ...data.meta } : {};
  const hasCivitai = Array.isArray(meta.civitaiResources) && meta.civitaiResources.length > 0;
  if (!hasCivitai) {
    const mapped = mapGenerationDataResources(data.resources);
    if (mapped.length) meta.civitaiResources = mapped;
  }
  return Object.keys(meta).length ? meta : null;
}

function processFromGenerationData (data) {
  if (!data || typeof data.process !== 'string' || !data.process) return undefined;
  return data.process;
}

function techniquesFromGenerationData (data) {
  if (!data || !Array.isArray(data.techniques)) return undefined;
  return data.techniques.filter(t => t && typeof t === 'object').map(t => ({
    id: t.id,
    name: t.name,
    notes: t.notes ?? null
  }));
}

function imageNeedsGenerationCapture (img) {
  if (!img || img.id == null) return false;
  return imageNeedsGenerationData(img) || img.workflowSourcesCaptured !== true;
}

function captureFromGenerationData (img, data) {
  const next = { ...img };
  if (imageNeedsGenerationData(img)) {
    const meta = metaFromGenerationData(data);
    if (meta) {
      next.meta = meta;
      next.hasMeta = true;
    } else {
      next.hasMeta = false;
    }
  }
  const process = processFromGenerationData(data);
  if (process !== undefined) next.process = process;
  const techniques = techniquesFromGenerationData(data);
  if (techniques !== undefined) next.techniques = techniques;
  next.workflowSourcesCaptured = true;
  return next;
}

// One image.getGenerationData per record that still needs meta or a
// workflow-source stamp. Posts and comics share this walk and its delay.
// A transport throw or `data.error` leaves that record out of the map.
export async function collectGenerationSourceUpdates (records, { secretKey, signal } = {}) {
  const updates = new Map();
  if (!Array.isArray(records) || !records.length) return updates;
  const pending = records.filter(imageNeedsGenerationCapture);
  if (!pending.length) return updates;

  for (const img of pending) {
    if (signal && signal.aborted) break;
    await wait(DATA_RATE_LIMIT);
    if (signal && signal.aborted) break;
    let data;
    try {
      data = await getImageGenerationData({ id: img.id, secretKey, signal });
    } catch (ignoreErr) {
      continue;
    }
    if (signal && signal.aborted) break;
    if (!data || data.error) continue;
    updates.set(img.id, captureFromGenerationData(img, data));
  }

  return updates;
}

export async function enrichPostImageMeta (post, { secretKey, signal } = {}) {
  // Site-parity: one image.getGenerationData per image that still needs
  // meta or a workflow-source stamp. hasMeta false skips the meta fill
  // only. A sibling that already has meta does not skip the rest.
  // Comics use the same collector on Ready panel image ids.
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

export async function savePostMedia (post, { signal, secretKey, onProgress } = {}) {
  const report = { imagesSaved: 0, videosSaved: 0, audioSaved: 0, error: undefined, aborted: false };
  const { id: postId, publishedAt, createdAt, images } = post;

  if (!Array.isArray(images) || !images.length) {
    return report;
  }

  const cdnBase = await getCivitaiImageBase({ secretKey });
  const totalImages = images.length;

  for (let i = 0; i < totalImages; i++) {
    if (signal && signal.aborted) {
      report.aborted = true;
      return report;
    }

    const image = images[i];
    const { id: imageId, type } = image;
    const filepath = postImageFilepath({ postId, publishedAt, createdAt, index: i + 1, imageId, type });

    if (await fileExists(filepath)) {
      continue;
    }

    if (onProgress) onProgress({ phase: 'media', index: i + 1, total: totalImages });

    let imageUrl;
    try {
      imageUrl = buildPostImageUrl(cdnBase, image);
    } catch (ignoreErr) {
      console.log(`Warning: skipping image ${imageId} in post ${postId} — ${ignoreErr.message}`);
      continue;
    }

    const result = await downloadMediaFile(imageUrl, filepath, { signal });

    if (result.status === 'aborted') {
      report.aborted = true;
      return report;
    }

    if (result.status !== 'published') {
      continue;
    }

    try {
      await joinPostedFileIfHashed(filepath, imageId);
    } catch (ignoreErr) {
      // Fail-soft: hash/join must not fail the download.
    }

    if (type === 'video') {
      report.videosSaved++;
    } else if (type === 'audio') {
      // Phase 5a: audio-in-posts is currently unreachable on Civitai (see
      // mediaExtension / buildPostImageUrl below), so this branch is
      // forward-compatible only — additive, never breaking the existing
      // image/video counters.
      report.audioSaved++;
    } else {
      report.imagesSaved++;
    }
  }

  return report;
}

export async function savePosts (apiResponse, { overwrite = false, overwriteIfModified = false, withImages = true, onProgress, signal, secretKey } = {}) {
  const report = {
    postsNew: 0,
    postsSaved: 0,
    imagesSaved: 0,
    videosSaved: 0,
    audioSaved: 0,
    activity: null,
    error: null,
    currentPosts: [],
    // Posts that were saved, enriched, or had new media this call. The
    // download orchestrator passes these to upsertIndexEntries() so the
    // server index reflects them without a full filesystem rescan. We push
    // the latest disk JSON (re-read after enrichment) so the index entry
    // includes any tags / image meta that helpers wrote in place.
    savedItems: []
  };

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
    let postChanged = false;

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

      if (secretKey && !(signal && signal.aborted)) {
        progress({ phase: 'enriching', index: postNum, total: totalItems });

        const enriched = await enrichPostDetail(post, { secretKey, signal });

        if (!enriched) {
          console.log(`Warning: could not enrich detail for post ${id}`);
        }

        if (!(signal && signal.aborted)) {
          const latestJson = JSON.parse(await readFile(filepath));
          await enrichPostImageMeta(latestJson, { secretKey, signal });
        }
      }
    } else {
      progress({ phase: 'checking', index: postNum, total: totalItems });

      currentReportItem.status = 'exists';

      try {
        let savedJson = JSON.parse(await readFile(filepath));

        // Phase 5c/5d re-save seam. When the freshly-fetched post differs from
        // what is on disk — a status flip, an upstream content change, or an
        // image that was removed from the post — overwrite the saved JSON and
        // mark it changed so the index upserts. This is per-post and never
        // touches the cursor/stop behaviour of the resumed "Download all
        // posts" walk (v5.1.0): `postsNew` only increments in the !exists
        // branch, so latest-mode's stop condition is unaffected.
        if (overwriteIfModified && !(signal && signal.aborted)) {
          const reconciled = reconcilePost(savedJson, post);
          const current = JSON.stringify(savedJson, null, 2);
          const willWrite = JSON.stringify(withDerivedStatus(reconciled), null, 2);

          if (willWrite !== current) {
            progress({ phase: 'saving', index: postNum, total: totalItems });

            const savedFilepath = await savePostData(reconciled);

            if (!savedFilepath) {
              currentReportItem.status = 'data-error';
              report.error = { message: 'Could not save post data' };
              return report;
            }

            currentReportItem.status = 'data-saved';
            report.postsSaved++;
            postChanged = true;
            savedJson = JSON.parse(await readFile(filepath));
          }
        }

        if (secretKey && !(signal && signal.aborted)) {
          if (!('tags' in savedJson)) {
            progress({ phase: 'enriching', index: postNum, total: totalItems });

            const enriched = await enrichPostDetail(savedJson, { secretKey, signal });

            if (!enriched) {
              console.log(`Warning: could not enrich detail for post ${id}`);
            } else {
              postChanged = true;
            }
          }

          if (!(signal && signal.aborted)) {
            const merged = await enrichPostImageMeta(savedJson, { secretKey, signal });
            if (merged) postChanged = true;
          }
        }
      }

      catch (ignoreErr) {
        // Could not read saved post for reconcile / backfill — skip
      }
    }

    if (withImages && post.images && post.images.length) {
      const mediaReport = await savePostMedia(post, {
        signal,
        secretKey,
        onProgress: (mediaActivity) => {
          progress(mediaActivity);
        }
      });

      report.imagesSaved += mediaReport.imagesSaved;
      report.videosSaved += mediaReport.videosSaved;
      report.audioSaved += mediaReport.audioSaved;

      if (mediaReport.aborted) {
        currentReportItem.status = 'aborted';
        return report;
      }

      if (withImages && CONFIG.downloadMedia !== false) {
        for (const image of post.images) {
          if (signal && signal.aborted) {
            currentReportItem.status = 'aborted';
            return report;
          }
          const descriptors = extractInputDescriptors(image.meta || image, 'post-image');
          await saveInputMedia(descriptors, { signal, onProgress: progress });
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

    progress(null);
  }

  return report;
}
