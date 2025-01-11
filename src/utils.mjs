/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import fs from 'node:fs/promises';
import { mkdirp } from 'mkdirp';
import { dirname } from 'node:path';

export function toDateString (input) {
  if (typeof input === 'string') {
    return input.slice(0, input.indexOf('T'));
  }

  else if (input === undefined) {
    return toDateString((new Date()).toISOString());
  }

  else if (input.constructor === Date) {
    return toDateString(input.toISOString());
  }

  return '';
}

export function dateIsOlderThanDays (isoString, numDays) {
  const d = new Date();

  d.setDate(d.getDate() - numDays);
  
  return toDateString(isoString) < toDateString(d.toISOString());
}

export function isDate (dateString) {
  return !isNaN((new Date(dateString)).getTime());
}

export function wait (delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function listDirectory (dir, options) {
  try {
    const files = await fs.readdir(dir, options);
    return files;
  }

  catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

export async function listFiles (dir, options = {}) {
  const dirList = await listDirectory(dir, { ...options, withFileTypes: true });
  return dirList
  .filter(f => f.isFile())
  .map(({ name }) => name);
}

export async function listDirectories (dir, options = {}) {
  const dirList = await listDirectory(dir, { ...options, withFileTypes: true });
  return dirList
  .filter(f => f.isDirectory())
  .map(({ name }) => name);
}

export async function removeDirectoryIfEmpty (dir, { removeDotFiles = true } = {}) {
  if (!(await fileExists (dir))) {
    return true;
  }

  const files = await listDirectory(dir);
  const dotFiles = removeDotFiles ? files.filter(filename => filename.startsWith('.')) : [];

  // e.g. operating system thumbnail/metadata
  if (removeDotFiles) {
    for (let filename of dotFiles) {
      const filepath = `${dir}/${filename}`;
      await fs.promises.unlink(filepath);
    }
  }

  if ((files.length - dotFiles.length) === 0) {
    try {
      await fs.rmdir(dir);
      return true;
    }

    catch (err) {
      console.error(err);
      return false;
    }
  }

  return false;
}

export async function fileExists (filepath) {
  try {
    await fs.access(filepath, fs.constants.R_OK);
    return true;
  }

  catch (ignoreErr) {
    return false;
  }
}

export async function readFile (filepath) {
  return await fs.readFile(filepath, 'utf-8');
}

export async function writeFile (filepath, contents) {
  if (filepath.includes('/') || filepath.includes('\\')) {
    const dir = dirname(filepath);

    if (!(await fileExists(dir))) {
      await mkdirp(dir);
    }
  }

  let data = contents;

  if (typeof contents !== 'string') {
    data = JSON.stringify(contents, null, 2);
  }

  await fs.writeFile(filepath, data);
}
