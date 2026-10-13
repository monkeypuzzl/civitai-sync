/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// Explicit sweep for media files that were stored short. Generation date
// dirs older than 30 days are not opened. The first completed Posts All
// after install runs this once for posts and live generations
// (`includeComics: false`). Later All runs do not. A sidecar remembers
// complete files and files Civitai can no longer serve, keyed by path.

import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from './cli.mjs';
import { fileExists, readFile, writeFile, unlink, listDirectory, isDate } from './utils.mjs';
import {
  getGenerationDates,
  getGenerationIdsByDate,
  getGeneration,
  getGeneratedMediaInfo,
  mediaFilepath
} from './generations.mjs';
import { postsDataDir, POST_DRAFTS_DIR, postMediaTargets } from './posts.mjs';
import { comicsDataDir, comicMediaTargets } from './comics.mjs';
import { extractInputDescriptors, blobIdFromUrl, inputMediaFilepath } from './inputMedia.mjs';
import { getCivitaiImageBase } from './civitaiApi.mjs';
import { downloadMediaFile } from './mediaDownload.mjs';
import { readMediaComplete } from './mediaIntegrity.mjs';
import { listExports, resolveExportRoot } from './exports.mjs';

export const MEDIA_HEAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function sidecarPath () {
  return path.join(CONFIG.dataPath, 'index', 'media-heal.json');
}

function inWindow (iso, nowMs) {
  if (typeof iso !== 'string' || !iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t >= nowMs - MEDIA_HEAL_WINDOW_MS;
}

function relativeMediaKey (filepath) {
  if (!CONFIG.mediaPath) return null;
  const rel = path.relative(path.resolve(CONFIG.mediaPath), path.resolve(filepath));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function extFromUrl (url) {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    const dot = last.lastIndexOf('.');
    if (dot <= 0 || dot === last.length - 1) return 'jpeg';
    return last.slice(dot + 1).toLowerCase();
  } catch (ignoreErr) {
    return 'jpeg';
  }
}

function inputTarget (descriptor, recoverable) {
  if (!descriptor?.url) return null;
  const id = blobIdFromUrl(descriptor.url);
  if (!id) return null;
  return {
    filepath: inputMediaFilepath(id, extFromUrl(descriptor.url)),
    url: descriptor.url,
    recoverable
  };
}

async function readSidecar () {
  const filepath = sidecarPath();
  if (!(await fileExists(filepath))) return { _version: 1, files: {} };
  try {
    const parsed = JSON.parse(await readFile(filepath));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { _version: 1, files: {} };
    if (!parsed.files || typeof parsed.files !== 'object') parsed.files = {};
    parsed._version = 1;
    return parsed;
  } catch (ignoreErr) {
    return { _version: 1, files: {} };
  }
}

async function forEachPost (fn) {
  const root = postsDataDir();
  const names = await listDirectory(root);
  const dirs = names.filter(name => isDate(name) || name === POST_DRAFTS_DIR);
  for (const dir of dirs) {
    const files = await listDirectory(`${root}/${dir}`);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const post = JSON.parse(await readFile(`${root}/${dir}/${file}`));
        await fn(post);
      } catch (ignoreErr) {
        // Unreadable post JSON is not a media file.
      }
    }
  }
}

async function forEachComic (fn) {
  const root = comicsDataDir();
  const names = await listDirectory(root);
  for (const date of names.filter(isDate)) {
    const files = await listDirectory(`${root}/${date}`);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const comic = JSON.parse(await readFile(`${root}/${date}/${file}`));
        await fn(comic);
      } catch (ignoreErr) {
        // Unreadable comic JSON is not a media file.
      }
    }
  }
}

async function collectTargets ({ secretKey, nowMs, includeComics }) {
  const byPath = new Map();

  function push (row) {
    if (!row?.filepath || !row.url) return;
    const filepath = path.resolve(row.filepath);
    const prev = byPath.get(filepath);
    if (!prev) {
      byPath.set(filepath, { filepath, url: row.url, recoverable: row.recoverable === true });
      return;
    }
    if (row.recoverable && !prev.recoverable) {
      byPath.set(filepath, { filepath, url: row.url || prev.url, recoverable: true });
    }
  }

  // Generation dirs are createdAt-keyed. A dir before the window cannot hold
  // a job that can still be fetched, so those files are not opened.
  const windowStartDay = new Date(nowMs - MEDIA_HEAL_WINDOW_MS).toISOString().slice(0, 10);
  const dates = await getGenerationDates();
  for (const date of dates) {
    if (date < windowStartDay) continue;
    const ids = await getGenerationIdsByDate(date);
    for (const id of ids) {
      const generation = await getGeneration(date, id);
      if (!generation || !inWindow(generation.createdAt, nowMs)) continue;
      for (const media of getGeneratedMediaInfo(generation)) {
        if (!media?.url) continue;
        push({ filepath: mediaFilepath(media), url: media.url, recoverable: true });
      }
      for (const descriptor of extractInputDescriptors(generation, 'generation')) {
        push(inputTarget(descriptor, true));
      }
    }
  }

  let cdnBase = null;
  async function base () {
    if (!cdnBase) cdnBase = await getCivitaiImageBase({ secretKey });
    return cdnBase;
  }

  await forEachPost(async (post) => {
    const targets = postMediaTargets(post, await base());
    for (const target of targets) push({ ...target, recoverable: true });
    const images = Array.isArray(post?.images) ? post.images : [];
    for (const image of images) {
      if (!inWindow(image?.createdAt, nowMs)) continue;
      for (const descriptor of extractInputDescriptors(image?.meta || image, 'post-image')) {
        push(inputTarget(descriptor, true));
      }
    }
  });

  if (includeComics) {
    await forEachComic(async (comic) => {
      for (const target of comicMediaTargets(comic, await base())) {
        push({ ...target, recoverable: true });
      }
      for (const descriptor of extractInputDescriptors(comic, 'comic-reference')) {
        push(inputTarget(descriptor, true));
      }
    });
  }

  return [...byPath.values()];
}

function sameFile (a, b) {
  return a.ino !== 0 && b.ino !== 0 && a.ino === b.ino && a.dev === b.dev;
}

async function dropDivergentExportCopies (relKey, canonicalPath, exports) {
  let canon;
  try {
    canon = await fs.stat(canonicalPath);
  } catch (ignoreErr) {
    return;
  }
  for (const exp of exports) {
    const dest = path.join(resolveExportRoot(exp), ...relKey.split('/'));
    let st;
    try {
      st = await fs.stat(dest);
    } catch (ignoreErr) {
      continue;
    }
    if (sameFile(canon, st)) continue;
    try {
      await unlink(dest);
    } catch (ignoreErr) {
      // A locked export copy stays until the next run.
    }
  }
}

function stamp (sidecar, key, stat, verdict, reason) {
  sidecar.files[key] = {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    verdict,
    reason: reason || null
  };
}

/**
 * @returns {Promise<{ healed: number, unrecoverable: number, failed: number, unchanged: number, aborted: boolean }>}
 */
export async function healMedia ({
  secretKey,
  now = () => new Date(),
  signal,
  includeComics = true
} = {}) {
  const nowMs = now().getTime();
  const report = { healed: 0, unrecoverable: 0, failed: 0, unchanged: 0, aborted: false };
  const sidecar = await readSidecar();
  const targets = await collectTargets({ secretKey, nowMs, includeComics });
  const exports = await listExports();
  let dirty = false;

  for (const target of targets) {
    if (signal?.aborted) {
      report.aborted = true;
      break;
    }
    if (!(await fileExists(target.filepath))) continue;

    let st;
    try {
      st = await fs.stat(target.filepath);
    } catch (ignoreErr) {
      continue;
    }
    const key = relativeMediaKey(target.filepath);
    if (!key) continue;

    const prev = sidecar.files[key];
    const sameStat = prev && prev.size === st.size && prev.mtimeMs === st.mtimeMs;

    if (sameStat && (prev.verdict === 'ok' || prev.verdict === 'unrecoverable')) {
      report.unchanged += 1;
      continue;
    }

    if (!(sameStat && prev.verdict === 'broken')) {
      const complete = await readMediaComplete(target.filepath);
      if (complete === null) continue;
      if (complete === true) {
        stamp(sidecar, key, st, 'ok', null);
        dirty = true;
        report.unchanged += 1;
        continue;
      }
    }

    if (!target.recoverable) {
      stamp(sidecar, key, st, 'unrecoverable', 'expired');
      dirty = true;
      report.unrecoverable += 1;
      continue;
    }

    const result = await downloadMediaFile(target.url, target.filepath, {
      replace: true,
      attempts: 1,
      signal
    });

    if (result.status === 'aborted') {
      report.aborted = true;
      break;
    }

    if (result.status === 'published') {
      let next = st;
      try {
        next = await fs.stat(target.filepath);
      } catch (ignoreErr) {
        next = st;
      }
      stamp(sidecar, key, next, 'ok', null);
      await dropDivergentExportCopies(key, target.filepath, exports);
      dirty = true;
      report.healed += 1;
      continue;
    }

    if (result.status === 'unavailable' && (result.httpStatus === 404 || result.httpStatus === 410)) {
      stamp(sidecar, key, st, 'unrecoverable', 'not-found');
      dirty = true;
      report.unrecoverable += 1;
      continue;
    }

    stamp(sidecar, key, st, 'broken', null);
    dirty = true;
    report.failed += 1;
  }

  if (dirty) await writeFile(sidecarPath(), sidecar);
  return report;
}
