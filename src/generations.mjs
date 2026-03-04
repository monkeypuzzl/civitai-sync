/*eslint no-unused-vars: "error"*/

import fs from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import path from 'node:path';
import { mkdirp } from 'mkdirp';
import { writeFile, fileExists, toDateString } from './utils.mjs';
import { readFile, listDirectory, removeDirectoryIfEmpty, isDate } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { fetchCivitaiImage } from './civitaiApi.mjs';

export function generationsDataDir () { return `${CONFIG.dataPath}/generations`; }
export function generationsMediaDir () { return `${CONFIG.mediaPath}/generations`; }

export const WORKFLOW_TAGS = [ 'favorite', 'feedback:liked', 'feedback:disliked' ];
export const WORKFLOW_TAG_DIRECTORIES = { 'favorite': 'favorite', 'feedback:liked': 'liked', 'feedback:disliked': 'disliked' };
export const MEDIA_DIRECTORIES = { 'all': 'all', ...WORKFLOW_TAG_DIRECTORIES };

export const DOWNLOAD_TYPES_MOD = {
  ...WORKFLOW_TAG_DIRECTORIES,
  'favorite': 'favorited', // ♥️
  'liked': 'liked', // 👍
  'disliked': 'disliked' // 👎
};

export function getDownloadTypes (dataOrMedia = 'data') {
  let ref = CONFIG.generationDataTypes;

  if (dataOrMedia === 'media') {
    ref = CONFIG.generationMediaTypes;
  }

  return Object.keys(WORKFLOW_TAG_DIRECTORIES)
  .filter(type => ref.includes(type))
  .map(type => WORKFLOW_TAG_DIRECTORIES[type])
  .map(name => name in DOWNLOAD_TYPES_MOD ? DOWNLOAD_TYPES_MOD[name] : name );
}

export function generationFilepath ({ id = 0, createdAt = '' }) {
  const date = toDateString(createdAt);
  const filepath = `${generationsDataDir()}/${date}/${id}.json`;

  return filepath;
}

export function mediaFilepath ({ date = '', generationId = '', mediaId = '', seed = 0, directory = MEDIA_DIRECTORIES['all'] }) {
  const hasExtension = mediaId.includes('.');
  const suffix = hasExtension ? '' : '.jpeg';
  const filename = `${generationId}_${String(seed)}_${mediaId}${suffix}`;
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

export async function getFirstGenerationId ({ includeLegacy = false } = {}) {
  const dates = await getGenerationDates();

  if (!dates.length) {
    return undefined;
  }

  const ids = await getGenerationIdsByDate(dates[0], { includeLegacy });
  
  if (ids.length) {
    return ids[0];
  }

  // Find oldest generation
  // E.g. in data folder of mixed legacy API and new API generations.
  for (let date of dates) {
    const ids = await getGenerationIdsByDate(date, { includeLegacy: false });

    if (ids.length) {
      return ids[0];
    }
  }

  return undefined;
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

export function getGeneratedMediaInfo (generation, { hidden = false } = {}) {
  const { createdAt, steps } = generation;
  const date = toDateString(createdAt);
  const media = [];

  if (!steps) {
    return media;
  }
  
  steps.forEach(({ images, metadata }) => {
    images.forEach(({ id, status, seed, url }) => {
      const mediaInfo = {
        date,
        generationId: generation.id,
        mediaId: id,
        seed,
        status,
        url,
        tags: []
      };

      if (status === 'failed' || status === 'expired') {
        return;
      }

      if (metadata && 'images' in metadata && metadata.images && id in metadata.images) {
        const mediaTags = metadata.images[id];

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
export async function saveGenerations (apiGenerationsResponse, {
    overwrite = false,
    overwriteIfModified = false,
    withImages = true,
    log,
    signal
  } = {}
) {
  const { result } = apiGenerationsResponse;

  const report = {
    generationsNew: 0,
    generationsSaved: 0,
    imagesSaved: 0,
    videosSaved: 0,
    error: null,
    lastSavedGenerationId: undefined,
    currentGenerations: [],
    currentMedia: undefined
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

  report.currentGenerations = items.map(({ id, createdAt }) => ({
    date: toDateString(createdAt),
    id,
    status: 'data-downloaded'
  }));

  for (let generation of items) {
    const currentReportItem = report.currentGenerations.find(item => item.id === generation.id);

    if (signal && signal.aborted) {
      currentReportItem.status = 'aborted';
      return report;
    }

    const { id, createdAt } = generation;
    const date = toDateString(createdAt);
    const filepath = generationFilepath({ id, createdAt });
    const exists = await fileExists(filepath);
    let shouldOverwrite = exists && overwrite;

    if (exists && overwriteIfModified) {
      const savedGenerationString = await getGeneration(date, id, { stringType: true });

      if (savedGenerationString !== JSON.stringify(generation, null, 2)) {
        shouldOverwrite = true;

        // If "all" images are being saved as well as tags, then when untagged on-site -> remove from tag directory
        if (!CONFIG.excludeImages &&  CONFIG.generationMediaTypes.length > 1 && CONFIG.generationMediaTypes.includes('all')) {
          const previousMedia = getGeneratedMediaInfo(JSON.parse(savedGenerationString));
          const currentMedia = getGeneratedMediaInfo(generation);

          for (let previousMediaInfo of previousMedia) {
            if (!previousMediaInfo.tags.length) {
              continue;
            }

            const currentMediaInfo = currentMedia.find(({ mediaId }) => mediaId === previousMediaInfo.mediaId);

            for (let tag of previousMediaInfo.tags) {
              if (!currentMediaInfo || !currentMediaInfo.tags.includes(tag)) {
                // Remove tagged image
                const itemFilepath = mediaFilepath({ ...previousMediaInfo, directory: MEDIA_DIRECTORIES[tag] });
                await fs.promises.unlink(itemFilepath);
              }
            }
          }
        }
      }
    }

    if (shouldOverwrite) {
      currentReportItem.status = 'data-updating';
      await fs.promises.unlink(filepath);
    }

    else if (exists) {
      currentReportItem.status = 'data-exists';
    }

    if (!exists || shouldOverwrite) {
      const filepath = await saveGenerationData(generation);

      if (!filepath) {
        currentReportItem.status = 'data-error';
        report.error = { message: 'Could not save generation' };
        return report;
      }

      currentReportItem.status = 'data-saved';
      report.lastSavedGenerationId = { date, id };
      report.generationsSaved ++;

      if (!exists) {
        report.generationsNew ++;
      }
    }

    if (withImages && (!exists || overwrite || shouldOverwrite)) {
      const mediaReport = await saveGenerationMedia(generation, { signal });
      const { error, aborted, complete } = mediaReport;

      report.imagesSaved += mediaReport.imagesSaved;
      report.videosSaved += mediaReport.videosSaved;
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

    // Unchanged since download
    if (currentReportItem.status === 'data-downloaded') {
      if (report.currentMedia && (report.currentMedia.imagesSaved > 0 || report.currentMedia.videosSaved > 0)) {
        currentReportItem.status = 'media-exists';
      }

      else {
        currentReportItem.status = 'done';
      }
    }

    if (log) {
      log(report);
    }
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

export async function fetchMedia (url, filepath, { signal }) {
  const responseBody = await fetchCivitaiImage(url, { signal });

  // Probably deleted from on-site generator
  if (!responseBody) {
    return false;
  }

  try {
    const fileStream = fs.createWriteStream(filepath, { flags: 'wx' });

    await finished(Readable.fromWeb(responseBody).pipe(fileStream));
    return true;
  }

  catch (error) {
    return new Error(`Error fetching media from ${url} to ${filepath}, ${error.message}`);
  }
}

export async function saveGenerationMedia (generation, { doFetch = true, signal } = {}) {
  const media = getGeneratedMediaInfo(generation);
  const report = { imagesSaved: 0, videosSaved: 0, error: undefined, aborted: false, complete: false };

  for (let mediaInfo of media) {
    const foundFilepaths = [];
    const missingFilepaths = [];
    const generationTypes = ['all', ...mediaInfo.tags]
    .filter(type => CONFIG.generationMediaTypes.includes(type));
    
    if (!generationTypes.length) {
      continue;
    }

    for (let type of generationTypes) {
      const itemFilepath = mediaFilepath({ ...mediaInfo, directory: MEDIA_DIRECTORIES[type] });

      if (await fileExists(itemFilepath)) {
        foundFilepaths.push(itemFilepath);
      }

      else {
        missingFilepaths.push(itemFilepath);

        const itemDirectory = path.dirname(itemFilepath);

        if (!(await fileExists(itemDirectory))) {
          await mkdirp(itemDirectory);
        }
      }
    }

    if (!missingFilepaths.length) {
      continue;
    }

    if (!foundFilepaths.length) {
      if (!doFetch) {
        continue;
      }

      const itemFilepath = missingFilepaths[0];
      const result = await fetchMedia(mediaInfo.url, itemFilepath, { signal });

      // Could be partial download
      if (signal && signal.aborted && await fileExists(itemFilepath)) {
        await fs.promises.unlink(itemFilepath);
        report.aborted = true;
        return report;
      }

      // Probably deleted from on-site generator
      if (result === false) {
        continue;
      }

      else if (result.constructor === Error) {
        report.error = { message: result.message, mediaInfo };
        return report;
      }

      if (mediaInfo.mediaId.includes('.')) {
        report.videosSaved++;
      } else {
        report.imagesSaved++;
      }
      missingFilepaths.splice(0, 1);
      foundFilepaths.push(itemFilepath);

      if (!missingFilepaths.length) {
        continue;
      }
    }

    const sourceFilepath = foundFilepaths[0];

    for (let itemFilepath of missingFilepaths) {
      await fs.promises.copyFile(sourceFilepath, itemFilepath);
    }
  }
  
  report.complete = true;
  return report;
}

export async function setupWorkflowTags () {
  // Move date-ordered folders in /media to /media/all
  const mediaDirectoryAll = `${generationsMediaDir()}/${MEDIA_DIRECTORIES['all']}`;

  if (!(await fileExists(mediaDirectoryAll))) {
    await mkdirp(mediaDirectoryAll);
  }

  await renameAllGenerationImages();
  await copyAllGeneratedMediaTypes();
}


export async function copyAllGeneratedMediaTypes () {
  await forEachGeneration(async (generation) => {
    await saveGenerationMedia(generation, { doFetch: false });
  }, { includeLegacy: true });
}

export async function deleteAllDeletedMedia () {
  console.log('Deleting saved media that has been deleted from the onsite generator...');
  let count = 0;

  await forEachGeneration(async (generation) => {
    const { steps } = generation;

    if (!steps) {
      return;
    }

    for (const { metadata } of steps) {
      if (metadata && 'images' in metadata) {
        const hiddenMedia = getGeneratedMediaInfo(generation, { hidden: true });

        if (!hiddenMedia.length) {
          continue;
        }

        for (const mediaInfo of hiddenMedia) {
          const directories = ['all', ...mediaInfo.tags.map(tag => MEDIA_DIRECTORIES[tag])];

          for (const directory of directories) {
            const filepath = mediaFilepath({ ...mediaInfo, directory });

            if (await fileExists(filepath)) {
              await fs.promises.unlink(filepath);
              count ++;
            }
          }
        }
      }
    }
  }, { includeLegacy: true });

  console.log(`${count} images were deleted.`);
}

export async function renameGenerationImages (generation) {
  const date = toDateString(generation.createdAt);
  const mediaDirectory = `${generationsMediaDir()}/${MEDIA_DIRECTORIES['all']}/${date}`;

  if (!(await fileExists(mediaDirectory))) {
    await mkdirp(mediaDirectory);
  }

  const images = getGenerationImages(generation);
  let renamedCount = 0;
  
  for (let image of images) {
    const { id, seed } = image;
    const mediaInfo = { directory: MEDIA_DIRECTORIES['all'], date, generationId: generation.id, mediaId: id, seed };
    const filepath = mediaFilepath(mediaInfo);

    if (await fileExists(filepath)) {
      continue;
    }

    else {
      const legacyFilepaths = legacyMediaFilepaths(mediaInfo);

      for (let legacyFilepath of legacyFilepaths) {
        if (await fileExists(legacyFilepath)) {
          await fs.promises.rename(legacyFilepath, filepath);
          renamedCount ++;
          continue;
        }
      }
    }
  }

  return renamedCount;
}

export async function renameAllGenerationImages () {
  let totalRenamedCount = 0;

  await forEachGeneration(async (generation) => {
    const renamedCount = await renameGenerationImages(generation);
    totalRenamedCount += renamedCount;
  }, { includeLegacy: true });

  // Remove empty directories
  const dates = await getGenerationDates();

  for (let date of dates) {
    const legacyMediaDirectory = `${generationsMediaDir()}/${date}`;
    await removeDirectoryIfEmpty(legacyMediaDirectory);
  }

  return totalRenamedCount;
}
