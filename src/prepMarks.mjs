// Coverage marks for the after-listen file walks. One file,
// data/index/prep-marks.json. A mark says a sweep already ran against a
// fingerprint set or a file's size and mtime. It is not a permanent done bit.
// Missing file = nothing covered. Unknown _version = ignore.

import path from 'node:path';
import { readFile, writeFile } from './utils.mjs';
import { CONFIG } from './cli.mjs';

const VERSION = 1;

function marksPath () {
  if (!CONFIG?.dataPath) return null;
  return path.join(CONFIG.dataPath, 'index', 'prep-marks.json');
}

function emptyMarks () {
  return {
    _version: VERSION,
    posted: { epoch: '', count: -1 },
    inputs: { epoch: '', files: {} },
    occurrence: {},
    live: {}
  };
}

let marks = emptyMarks();
let loaded = false;

function coerce (parsed) {
  const next = emptyMarks();
  if (!parsed || parsed._version !== VERSION) return next;
  if (parsed.posted && typeof parsed.posted === 'object') {
    next.posted.epoch = typeof parsed.posted.epoch === 'string' ? parsed.posted.epoch : '';
    const count = Number(parsed.posted.count);
    next.posted.count = Number.isInteger(count) ? count : -1;
  }
  if (parsed.inputs && typeof parsed.inputs === 'object') {
    next.inputs.epoch = typeof parsed.inputs.epoch === 'string' ? parsed.inputs.epoch : '';
    if (parsed.inputs.files && typeof parsed.inputs.files === 'object' && !Array.isArray(parsed.inputs.files)) {
      next.inputs.files = parsed.inputs.files;
    }
  }
  if (parsed.occurrence && typeof parsed.occurrence === 'object' && !Array.isArray(parsed.occurrence)) {
    next.occurrence = parsed.occurrence;
  }
  if (parsed.live && typeof parsed.live === 'object' && !Array.isArray(parsed.live)) {
    next.live = parsed.live;
  }
  return next;
}

export async function loadPrepMarks () {
  if (loaded) return marks;
  const filepath = marksPath();
  if (!filepath) {
    marks = emptyMarks();
    loaded = true;
    return marks;
  }
  try {
    const text = await readFile(filepath);
    marks = coerce(JSON.parse(text));
  } catch {
    marks = emptyMarks();
  }
  loaded = true;
  return marks;
}

export function prepMarks () {
  return marks;
}

export async function savePrepMarks () {
  const filepath = marksPath();
  if (!filepath) return;
  marks._version = VERSION;
  await writeFile(filepath, marks);
}

export function liveMarkKey (absPath) {
  const root = CONFIG?.dataPath;
  if (!root || !absPath) return '';
  const rel = path.relative(root, absPath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return '';
  return rel.split(path.sep).join('/');
}

export function __resetPrepMarksForTest () {
  marks = emptyMarks();
  loaded = true;
}
