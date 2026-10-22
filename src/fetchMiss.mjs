/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// One record of fetch misses, keyed by the exact URL. A terminal row (404
// or 410) is not requested again by an automatic walk or an ordinary
// download. A transient row is retried. The file on disk is still the sign
// that the bytes arrived. This module does not import mediaDownload,
// serverIndex, or aceAudioWorkflow.

import path from 'node:path';
import { createHash } from 'node:crypto';
import { CONFIG } from './cli.mjs';
import { readFile, writeFile } from './utils.mjs';

let boundPath = '';
let urls = null;
let dirty = false;

function sidecarPath () {
  if (!CONFIG?.dataPath) return '';
  return path.join(CONFIG.dataPath, 'index', 'fetch-miss.json');
}

export function fetchMissKey (url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  const hash = raw.indexOf('#');
  const key = hash === -1 ? raw : raw.slice(0, hash);
  if (!key) return '';
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function mediaFetchLabel (url) {
  try {
    const parsed = new URL(String(url));
    return parsed.origin + parsed.pathname;
  } catch (ignoreErr) {
    const s = String(url ?? '');
    const q = s.indexOf('?');
    return q === -1 ? s : s.slice(0, q);
  }
}

export function failureCause (error) {
  const cause = error && error.cause && typeof error.cause === 'object' ? error.cause : null;
  if (!cause) return '';
  const message = error && typeof error.message === 'string' ? error.message : '';
  const code = typeof cause.code === 'string' ? cause.code : '';
  const msg = typeof cause.message === 'string' ? cause.message : '';
  if (code && msg && msg !== message) return `${code}: ${msg}`;
  if (code) return code;
  if (msg && msg !== message) return msg;
  return '';
}

export function formatFetchWarning (prefix, url, message, cause) {
  const extra = cause ? ` (${cause})` : '';
  return `${prefix} ${mediaFetchLabel(url)} — ${message}${extra}`;
}

async function ensureLoaded () {
  const file = sidecarPath();
  if (!file) {
    boundPath = '';
    urls = {};
    dirty = false;
    return;
  }
  if (boundPath === file && urls) return;
  boundPath = file;
  dirty = false;
  urls = {};
  try {
    const parsed = JSON.parse(await readFile(file));
    if (parsed && parsed.urls && typeof parsed.urls === 'object' && !Array.isArray(parsed.urls)) {
      urls = parsed.urls;
    }
  } catch (ignoreErr) {
    urls = {};
  }
}

export async function recallFetchMiss (url) {
  const key = fetchMissKey(url);
  if (!key) return null;
  await ensureLoaded();
  const row = urls[key];
  if (!row || typeof row !== 'object') return null;
  return row;
}

export async function recordFetchMiss (url, row) {
  const key = fetchMissKey(url);
  if (!key || !row || (row.outcome !== 'terminal' && row.outcome !== 'transient')) return;
  await ensureLoaded();
  const next = {
    outcome: row.outcome,
    httpStatus: Number(row.httpStatus) || 0,
    message: row.message || '',
    cause: row.cause || '',
    at: row.at || new Date().toISOString()
  };
  const prev = urls[key];
  if (prev
    && prev.outcome === next.outcome
    && prev.httpStatus === next.httpStatus
    && prev.message === next.message
    && prev.cause === next.cause) {
    return;
  }
  urls[key] = next;
  dirty = true;
}

export async function clearFetchMiss (url) {
  const key = fetchMissKey(url);
  if (!key) return;
  await ensureLoaded();
  if (!Object.prototype.hasOwnProperty.call(urls, key)) return;
  delete urls[key];
  dirty = true;
}

export async function reportTransientFetch (url, { message, cause = '', recall = 'download', prefix } = {}) {
  const prior = await recallFetchMiss(url);
  const same = prior
    && prior.outcome === 'transient'
    && prior.message === message
    && prior.cause === cause;
  if (!(recall === 'auto' && same)) {
    await recordFetchMiss(url, { outcome: 'transient', httpStatus: 0, message, cause });
  }
  if (recall === 'download' || recall === 'recheck' || !same) {
    console.log(formatFetchWarning(prefix, url, message, cause));
  }
}

export async function flushFetchMiss () {
  const file = sidecarPath();
  if (!file || !dirty || !urls) return;
  const body = { _version: 1, urls };
  try {
    await writeFile(file, body);
    dirty = false;
  } catch (ignoreErr) {
    // Leave dirty so the next flush retries. A sidecar write must not fail the download.
  }
}
