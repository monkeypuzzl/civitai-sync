/*eslint no-unused-vars: ["error", { "ignoreRestSiblings": true }]*/

import fsLib from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import path from 'node:path';
import { mkdirp } from 'mkdirp';
import { writeFile, fileExists, wait, toDateString } from './utils.mjs';
import { readFile, listDirectory, isDate } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { fetchCivitaiImage } from './civitaiApi.mjs';

export function filenameFromURL(url, defaultExtension) {
  const { pathname } = new URL(url);
  let filename = pathname.slice(pathname.lastIndexOf('/') + 1);

  if (defaultExtension && !filename.includes('.')) {
    filename += `.${defaultExtension}`;
  }

  return filename;
}

export function imageFilepath (date, url) {
  const filename = filenameFromURL(url, 'jpeg');
  const mediaDirectory = `${CONFIG.generationsMediaPath}/${date}`;
  const destination = path.resolve(mediaDirectory, filename);

  return destination;
}

export async function getGenerationDates() {
  const names = await listDirectory(`${CONFIG.generationsDataPath}`);
  const dates = names.filter(isDate);

  return dates;
}

export async function getGenerationIdsByDate(date) {
  const filenames = await listDirectory(`${CONFIG.generationsDataPath}/${date}`);
  const ids = filenames
    .filter(f => f.endsWith('.json'))  
    .map(f => Number(f.slice(0, f.lastIndexOf('.json'))))
    .filter(id => !isNaN(id));

  return ids;
} 

export async function getFirstGenerationId() {
  const dates = await getGenerationDates();
  const ids = await getGenerationIdsByDate(dates[0]);

  return ids[0];
}

export async function getGeneration (date, id) {
  const filename = `${CONFIG.generationsDataPath}/${date}/${id}.json`;

  try {
    const contents = await readFile(filename);

    if (!contents) {
      throw new Error('File empty');
    }

    const item = JSON.parse(contents);
    return item;
  }

  catch (err) {
    console.log(`Error retrieving generation, "${filename}", ${err.message}`);
    return null;
  }
}

export async function forEachGeneration (fn) {
  const dates = await getGenerationDates();

  for (let date of dates) {
    const ids = await getGenerationIdsByDate(date);

    for (let id of ids) {
      const item = await getGeneration(date, id);

      if (item) {
        await fn(item, { date });
      }
    }
  }
}

export async function saveGenerations (data, { overwrite = false, checkImages = true } = false) {
  const savedItems = [];

  if (data.error) {
    console.log('Error in generation data', data.error.json);
    return savedItems;
  }

  const { items } = data.result.data.json;

  if (!items.length) {
    return savedItems;
  }

  for (let item of items) {
    const { id, createdAt } = item;
    const date = toDateString(createdAt);
    const filepath = `${CONFIG.generationsDataPath}/${date}/${id}.json`;
    const exists = await fileExists(filepath);

    // TODO: check status for images previously unavailable,
    // e.g. downloading while on-site queue is pending
    // -> update generation data and download missing media
    // Current workaround, use 'Download missing' option
    if (exists && !overwrite) {
      if (checkImages) {
        savedItems.push(item);
      }
      
      continue;
    }

    // Discard verbose `jobToken`
    item.images = item.images.map(({ jobToken, ...imageData }) => imageData);

    savedItems.push(item);

    try {
      await writeFile(filepath, JSON.stringify(item, null, 2));
    }

    catch (err) {
      console.err(err.message);
    }
  }

  return savedItems;
}

export async function saveGenerationImages (item, { secretKey, overwrite = false }) {
  const date = toDateString(item.createdAt);
  const mediaDirectory = `${CONFIG.generationsMediaPath}/${date}`;

  if (!(await fileExists(mediaDirectory))) {
    await mkdirp(mediaDirectory);
  }

  const filepaths = [];
  
  for (let image of item.images) {
    const destination = imageFilepath(date, image.url);

    // TODO: Use image.available and re-cache if needed,
    // e.g. connection closed saves a partial download
    if (!overwrite && await fileExists(destination)) {
      continue;
    }

    const responseBody = await fetchCivitaiImage(image.url, secretKey);

    if (!responseBody) {
      continue;
    }

    const fileStream = fsLib.createWriteStream(destination, { flags: 'wx' });

    await finished(Readable.fromWeb(responseBody).pipe(fileStream));

    filepaths.push(`${date}/${destination}`);

    await wait(CONFIG.imageRateLimit);
  }

  return filepaths;
}
