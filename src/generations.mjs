/*eslint no-unused-vars: "error"*/

import fs from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import path from 'node:path';
import { mkdirp } from 'mkdirp';
import { writeFile, fileExists, wait, toDateString } from './utils.mjs';
import { readFile, listDirectory, isDate } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { fetchCivitaiImage } from './civitaiApi.mjs';

// const BROKEN_IMAGE_MAX_SIZE = 1024 * 100;

export function filenameFromURL (url = '', defaultExtension = '') {
  const { pathname } = new URL(url);
  let filename = pathname.slice(pathname.lastIndexOf('/') + 1);

  if (defaultExtension && !filename.includes('.')) {
    filename += `.${defaultExtension}`;
  }

  return filename;
}

export function generationFilepath ({ id = 0, createdAt = '' }) {
  const date = toDateString(createdAt);
  const filepath = `${CONFIG.generationsDataPath}/${date}/${id}.json`;

  return filepath;
}

export function imageFilepathWithId ({ date = '', url = '' }) {
  const filename = filenameFromURL(url, 'jpeg');
  const mediaDirectory = `${CONFIG.generationsMediaPath}/${date}`;
  const filepath = path.resolve(mediaDirectory, filename);

  return filepath;
}

export function imageFilepath ({ date = '', generationId = '', seed = 0 }) {
  const filename = `${generationId}_${String(seed)}.jpeg`;
  const mediaDirectory = `${CONFIG.generationsMediaPath}/${date}`;
  const filepath = path.resolve(mediaDirectory, filename);

  return filepath;
}

export async function getGenerationDates () {
  const names = await listDirectory(`${CONFIG.generationsDataPath}`);
  const dates = names.filter(isDate);

  return dates;
}

export async function getGenerationIdsByDate (date = '', includeLegacy = false) {
  const LEGACY_GENERATION_ID_LENGTH = 8 + '.json'.length;
  const filenames = await listDirectory(`${CONFIG.generationsDataPath}/${date}`);
  const ids = filenames
    .filter(f => f.endsWith('.json'))
    .filter(f => includeLegacy ? true : f.length > LEGACY_GENERATION_ID_LENGTH)
    .map(f => f.slice(0, f.lastIndexOf('.json')));

  return ids;
} 

export async function getFirstGenerationId (includeLegacy = false) {
  const dates = await getGenerationDates();

  if (!dates.length) {
    return undefined;
  }

  const ids = await getGenerationIdsByDate(dates[0], includeLegacy);
  
  if (ids.length) {
    return ids[0];
  }

  // Find oldest generation
  // E.g. in data folder of mixed legacy API and new API generations.
  for (let date of dates) {
    const ids = await getGenerationIdsByDate(date, false);

    if (ids.length) {
      return ids[0];
    }
  }

  return undefined;
}

export async function getGeneration (date = '', id) {
  const filename = `${CONFIG.generationsDataPath}/${date}/${id}.json`;

  try {
    const contents = await readFile(filename);

    if (!contents) {
      throw new Error('File empty');
    }

    const generation = JSON.parse(contents);
    return generation;
  }

  catch (error) {
    console.log(`Error retrieving generation, "${filename}", ${error.message}`);
    return null;
  }
}

export async function forEachGeneration (fn, includeLegacy = false) {
  try {
    const dates = await getGenerationDates();

    for (let date of dates) {
      const ids = await getGenerationIdsByDate(date, includeLegacy);

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
export async function saveGeneration (generation) {
  const { id, createdAt } = generation;
  const filepath = generationFilepath({ id, createdAt });
  
  try {
    await writeFile(filepath, JSON.stringify(generation, null, 2));
    return true;
  }

  catch (error) {
    console.error(error);
    return false;
  }
}

// TODO: check status for images previously unavailable,
// e.g. downloading while on-site queue is , it should
// -> refresh the generation data and download missing media.
// Workaround, use 'Download missing'
export async function saveGenerations (apiGenerationsResponse, {
    overwrite = false,
    withImages = true,
    checkImages = false
  } = {},
  progressFn = () => {}
) {
  const { result, error } = apiGenerationsResponse;
  const report = { generationsDownloaded: 0, generationsSaved: 0, imagesSaved: 0, error: null };

  if (error) {
    console.log('Error in generation data', error.json);
    report.error = error;
    return report;
  }

  const { data } = result;

  if (!data || !('json' in data) || !Array.isArray(data.json.items)) {
    console.log('Unexpected API data', JSON.stringify(data, null, 2));
    return report;
  }

  const { items } = data.json;

  if (!items.length) {
    return report;
  }

  report.generationsDownloaded += items.length;

  for (let generation of items) {
    const { id, createdAt } = generation;
    const filepath = generationFilepath({ id, createdAt });
    const exists = await fileExists(filepath);

    if (!exists || overwrite) {
      const success = await saveGeneration(generation, { overwrite });

      if (!success) {
        report.error = 'Could not save generation';
        return report;
      }

      report.generationsSaved ++;
      progressFn({ generationsSaved: 1 });
    }

    if (withImages && (!exists || overwrite || checkImages)) {
      const filepaths = await saveGenerationImages(generation, { overwrite });

      report.imagesSaved += filepaths.length;
      progressFn({ imagesSaved: filepaths.length });
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

export async function saveGenerationImages (generation, { overwrite = false }) {
  const date = toDateString(generation.createdAt);
  const mediaDirectory = `${CONFIG.generationsMediaPath}/${date}`;

  if (!(await fileExists(mediaDirectory))) {
    await mkdirp(mediaDirectory);
  }

  const filepaths = [];
  const images = getGenerationImages(generation);
  
  for (let image of images) {
    const { seed, url } = image;
    const filepath = imageFilepath({ date, generationId: generation.id, seed });
    const filepathWithId = imageFilepathWithId({ date, url });

    if (await fileExists(filepath)) {
      if (overwrite) {
        await fs.promises.unlink(filepath);
      }

      // TODO: Use image.available and re-cache if needed,
      // and check byte size to see if it needs
      // overwriting, e.g. partial download
    
      // const fileSize = (await fs.promises.stat(filepath)).size;
      // const isBrokenImage = fileSize < BROKEN_IMAGE_MAX_SIZE;

      // if (isBrokenImage) {
      //   await fs.promises.unlink(filepath);
      // }

      else {
        continue;
      }
    }

    else {
      if (await fileExists(filepathWithId)) {
        await fs.promises.rename(filepathWithId, filepath);
        continue;
      }
    }

    const responseBody = await fetchCivitaiImage(image.url);

    if (!responseBody) {
      // console.error('No response for image', image.url);
      continue;
    }

    const fileStream = fs.createWriteStream(filepath, { flags: 'wx' });

    await finished(Readable.fromWeb(responseBody).pipe(fileStream));

    filepaths.push(`${date}/${filepath}`);

    await wait(CONFIG.imageRateLimit);
  }

  return filepaths;
}

export async function renameImages (chronological = true) {
  await forEachGeneration(async (generation, { date }) => {
    const images = getGenerationImages(generation);
    
    for (let image of images) {
      const { seed, url } = image;
      const filepath = imageFilepath({ date, generationId: generation.id, seed });
      const legacyFilepath = imageFilepathWithId({ date, url });

      if (chronological) {
        if (await fileExists(legacyFilepath)) {
          // Duplicate images
          // if (await fileExists(filepath)) {
          //   await fs.promises.unlink(legacyFilepath);
          // }

          // else {
            await fs.promises.rename(legacyFilepath, filepath);
          // }
        }
      }

      else {
        if (await fileExists(filepath)) {
          await fs.promises.rename(filepath, legacyFilepath);
        }
      }
    }
  });
}
