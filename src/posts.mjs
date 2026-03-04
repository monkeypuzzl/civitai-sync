/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

import fs from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import path from 'node:path';
import { mkdirp } from 'mkdirp';
import { writeFile, readFile, fileExists, toDateString, listDirectory, isDate, wait } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { fetchCivitaiImage, getCivitaiImageBase, getPost, getPostImageMeta } from './civitaiApi.mjs';

const DATA_RATE_LIMIT = 100;

export function postsDataDir () { return `${CONFIG.dataPath}/posts`; }
export function postsMediaDir () { return `${CONFIG.mediaPath}/posts`; }

export function postFilepath ({ id, publishedAt }) {
  const date = toDateString(publishedAt);
  return `${postsDataDir()}/${date}/${id}.json`;
}

function buildPostImageUrl (cdnBase, image) {
  // Strip any ?token=... query string from name, then normalise extension to .jpeg / .mp4
  const baseName = image.name.split('?')[0];
  const stem = baseName.includes('.') ? baseName.split('.').slice(0, -1).join('.') : baseName;
  const ext = image.type === 'video' ? '.mp4' : '.jpeg';
  return `${cdnBase}/${image.url}/original=true/${stem}${ext}`;
}

function mediaExtension (type) {
  return type === 'video' ? '.mp4' : '.jpeg';
}

export function postImageFilepath ({ postId, publishedAt, index, imageId, type }) {
  const date = toDateString(publishedAt);
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

export async function savePostData (post) {
  const { id, publishedAt } = post;
  const filepath = postFilepath({ id, publishedAt });

  try {
    await writeFile(filepath, JSON.stringify(post, null, 2));
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

export async function enrichPostImageMeta (post, { secretKey, signal } = {}) {
  const hasAnyMeta = Array.isArray(post.images) && post.images.some(img => img.hasMeta);
  if (!hasAnyMeta) return false;

  const alreadyEnriched = post.images.some(img => img.meta && typeof img.meta === 'object');
  if (alreadyEnriched) return false;

  try {
    await wait(DATA_RATE_LIMIT);
    const imageItems = await getPostImageMeta({ postId: post.id, secretKey, signal });
    if (!imageItems.length) return false;

    const metaById = new Map();
    for (const item of imageItems) {
      if (item.meta) metaById.set(item.id, item.meta);
    }

    if (!metaById.size) return false;

    let merged = 0;
    const enrichedImages = post.images.map(img => {
      const meta = metaById.get(img.id);
      if (meta) {
        merged++;
        return { ...img, meta };
      }
      return img;
    });

    if (merged > 0) {
      const enrichedPost = { ...post, images: enrichedImages };
      await savePostData(enrichedPost);
      return true;
    }

    return false;
  }

  catch (ignoreErr) {
    return false;
  }
}

export async function savePostMedia (post, { signal, secretKey } = {}) {
  const report = { imagesSaved: 0, videosSaved: 0, error: undefined, aborted: false };
  const { id: postId, publishedAt, images } = post;

  if (!Array.isArray(images) || !images.length) {
    return report;
  }

  const cdnBase = await getCivitaiImageBase({ secretKey });

  for (let i = 0; i < images.length; i++) {
    if (signal && signal.aborted) {
      report.aborted = true;
      return report;
    }

    const image = images[i];
    const { id: imageId, type } = image;
    const filepath = postImageFilepath({ postId, publishedAt, index: i + 1, imageId, type });

    if (await fileExists(filepath)) {
      continue;
    }

    const itemDirectory = path.dirname(filepath);

    if (!(await fileExists(itemDirectory))) {
      await mkdirp(itemDirectory);
    }

    const responseBody = await fetchCivitaiImage(buildPostImageUrl(cdnBase, image), { signal });

    if (signal && signal.aborted) {
      if (await fileExists(filepath)) {
        await fs.promises.unlink(filepath);
      }
      report.aborted = true;
      return report;
    }

    if (!responseBody) {
      continue;
    }

    try {
      const fileStream = fs.createWriteStream(filepath, { flags: 'wx' });
      await finished(Readable.fromWeb(responseBody).pipe(fileStream));
    }

    catch (error) {
      report.error = { message: error.message };
      return report;
    }

    if (type === 'video') {
      report.videosSaved++;
    } else {
      report.imagesSaved++;
    }
  }

  return report;
}

export async function savePosts (apiResponse, { overwrite = false, withImages = true, onProgress, signal, secretKey } = {}) {
  const report = {
    postsNew: 0,
    postsSaved: 0,
    imagesSaved: 0,
    videosSaved: 0,
    error: null,
    currentPosts: []
  };

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

  report.currentPosts = items.map(({ id, publishedAt }) => ({ id, publishedAt, status: 'pending' }));

  for (const post of items) {
    const currentReportItem = report.currentPosts.find(item => item.id === post.id);

    if (signal && signal.aborted) {
      currentReportItem.status = 'aborted';
      return report;
    }

    const { id, publishedAt } = post;
    const filepath = postFilepath({ id, publishedAt });
    const exists = await fileExists(filepath);

    if (!exists || overwrite) {
      const savedFilepath = await savePostData(post);

      if (!savedFilepath) {
        currentReportItem.status = 'data-error';
        report.error = { message: 'Could not save post data' };
        return report;
      }

      currentReportItem.status = 'data-saved';
      report.postsSaved++;

      if (!exists) {
        report.postsNew++;
      }

      if (secretKey && !(signal && signal.aborted)) {
        const enriched = await enrichPostDetail(post, { secretKey, signal });

        if (!enriched) {
          console.log(`Warning: could not enrich detail for post ${id}`);
        }

        // Fetch image generation metadata (prompt, model, seed, etc.)
        if (!(signal && signal.aborted)) {
          const latestJson = JSON.parse(await readFile(filepath));
          await enrichPostImageMeta(latestJson, { secretKey, signal });
        }
      }
    } else {
      currentReportItem.status = 'exists';

      if (secretKey && !(signal && signal.aborted)) {
        try {
          const savedJson = JSON.parse(await readFile(filepath));

          if (!('tags' in savedJson)) {
            const enriched = await enrichPostDetail(savedJson, { secretKey, signal });

            if (!enriched) {
              console.log(`Warning: could not enrich detail for post ${id}`);
            }
          }

          // Backfill: enrich existing posts that lack image generation metadata
          if (!(signal && signal.aborted)) {
            await enrichPostImageMeta(savedJson, { secretKey, signal });
          }
        }

        catch (ignoreErr) {
          // Could not read saved post for backfill — skip
        }
      }
    }

    // Always attempt media — savePostMedia skips individual files that already exist
    if (withImages && post.images && post.images.length) {
      const mediaReport = await savePostMedia(post, { signal, secretKey });
      report.imagesSaved += mediaReport.imagesSaved;
      report.videosSaved += mediaReport.videosSaved;

      if (mediaReport.aborted) {
        currentReportItem.status = 'aborted';
        return report;
      }

      if (mediaReport.error) {
        currentReportItem.status = 'media-error';
        report.error = mediaReport.error;
        return report;
      }

      if (currentReportItem.status !== 'aborted') {
        currentReportItem.status = 'media-saved';
      }
    }

    if (onProgress) {
      onProgress({ imagesSaved: report.imagesSaved, videosSaved: report.videosSaved });
    }
  }

  return report;
}
