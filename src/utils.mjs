/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import fs from 'node:fs/promises';
import { mkdirp } from 'mkdirp';

export function toDateString (isoString) {
  return isoString.slice(0, isoString.indexOf('T'));
}

export function isDate(dateString) {
  return !isNaN((new Date(dateString)).getTime());
}

export function wait (delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function listDirectory (dir) {
  try {
    const files = await fs.readdir(dir);
    return files;
  }

  catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }

    throw err;
  }
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
  return await fs.readFile(filepath);
}

export async function writeFile (filepath, data) {
  if (filepath.includes('/')) {
    const dir = filepath.slice(0, filepath.lastIndexOf('/'));

    if (!(await fileExists(dir))) {
      await mkdirp(dir);
    }
  }

  await fs.writeFile(filepath, data);
}
