/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// Input-media capture: extract descriptors from generation/post/comic records
// and download novel blobs into media/inputs/<id>.<ext>, reusing a produced
// generation file when the blob id is already a local media-item id.
//
// Top-level imports stay free of serverIndex / generations / posts so this
// module can be imported from those without a cycle. resolveInputSource
// dynamic-imports the index at call time.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdirp } from 'mkdirp';
import { fileExists, unlink } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { MEDIA_FILE_EXTS, normalizeMediaId } from './mediaId.mjs';
import { downloadMediaFile } from './mediaDownload.mjs';
import { isAceAudioParams } from './aceAudioParams.mjs';
import {
  loadAliasStore,
  recordAlias,
  resolveCanonicalId,
  contentKey,
  hashFileSha256
} from './mediaIdentity.mjs';

const IMAGE_EXTS = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif']);
const VIDEO_EXTS = new Set(['mp4', 'webm']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'ogg']);
const INPUT_PROBE_EXTS = [...new Set([...MEDIA_FILE_EXTS, 'jpeg'])];
const BLOB_PATH_MARKER = '/v2/consumer/blobs/';
const ORCH_BLOB_RE = /^https:\/\/orchestration[^/]*\.civitai\.[^/]+\/v2\/consumer\/blobs\//i;

function sha12 (value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, 12);
}

function isHttpUrl (url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

function pathnameOf (url) {
  try {
    return new URL(url).pathname;
  } catch (ignoreErr) {
    const q = String(url).indexOf('?');
    return q === -1 ? String(url) : String(url).slice(0, q);
  }
}

function lastPathSegment (url) {
  const pathname = pathnameOf(url);
  const last = pathname.split('/').filter(Boolean).pop() || '';
  const q = last.indexOf('?');
  return q === -1 ? last : last.slice(0, q);
}

function extFromUrl (url) {
  const last = lastPathSegment(url);
  const dot = last.lastIndexOf('.');
  if (dot <= 0 || dot === last.length - 1) return '';
  return last.slice(dot + 1).toLowerCase();
}

function isOrchestrationBlobUrl (url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ORCH_BLOB_RE.test(url) || parsed.pathname.includes(BLOB_PATH_MARKER);
  } catch (ignoreErr) {
    return url.includes(BLOB_PATH_MARKER);
  }
}

function kindFromUrl (url) {
  const ext = extFromUrl(url);
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (isOrchestrationBlobUrl(url)) return 'file';
  return 'image';
}

export function blobIdFromUrl (url) {
  try {
    const raw = typeof url === 'string' ? url : String(url ?? '');
    const pathname = pathnameOf(raw);
    if (!pathname.includes(BLOB_PATH_MARKER)) {
      return 'url:' + sha12(raw);
    }
    return normalizeMediaId(lastPathSegment(raw));
  } catch (ignoreErr) {
    return 'url:' + sha12(url ?? '');
  }
}

export function inputMediaFilepath (id, ext) {
  const safeExt = String(ext || 'jpeg').replace(/^\./, '');
  return `${CONFIG.mediaPath}/inputs/${normalizeMediaId(id)}.${safeExt}`;
}

export function inputsMediaDir () {
  return `${CONFIG.mediaPath}/inputs`;
}

// Sync probe for index builders (buildMediaItems pass 3). Mirrors
// resolveInputSource's inputs/ walk without making the projection async.
export function existingInputFilepath (id) {
  const norm = normalizeMediaId(id);
  if (!norm) return null;
  if (!CONFIG?.mediaPath) return null;
  for (const ext of INPUT_PROBE_EXTS) {
    const filepath = inputMediaFilepath(norm, ext);
    if (fs.existsSync(filepath)) return filepath;
  }
  return null;
}

function roleHint (record, params) {
  return [
    record?.workflow,
    record?.process,
    params?.engine,
    params?.workflow,
    params?.process
  ].filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
}

function imagesRole (hint, index, { isAce } = {}) {
  if (/img2model3d|txt2model3d|polygen|model3d/i.test(hint)) return 'source';
  if (isAce || /txt2music|\bace\b/i.test(hint)) return 'cover';
  if (/img2vid|i2v|first-last|firstlast|kling/i.test(hint)) {
    const kling = /kling/i.test(hint);
    if (index === 0) return kling ? 'start-image' : 'first-frame';
    if (index === 1) return kling ? 'end-image' : 'last-frame';
    return 'input';
  }
  if (/ref2vid|reference/i.test(hint)) return 'reference';
  return 'input';
}

function urlFields (value) {
  if (typeof value === 'string') return { url: value, width: 0, height: 0 };
  if (value && typeof value === 'object' && typeof value.url === 'string') {
    return {
      url: value.url,
      width: Number(value.width) || 0,
      height: Number(value.height) || 0
    };
  }
  return null;
}

function pushDescriptor (out, seen, { url, width, height, role, slot, kind }) {
  if (!isHttpUrl(url)) return;
  const trimmed = url.trim();
  if (seen.has(trimmed)) return;
  seen.add(trimmed);
  const descriptor = {
    url: trimmed,
    width: Number(width) || 0,
    height: Number(height) || 0,
    role,
    kind: kind || kindFromUrl(trimmed)
  };
  if (slot != null) descriptor.slot = slot;
  out.push(descriptor);
}

function looksLikeMeta (record) {
  return record.image != null
    || record.sourceImage != null
    || Array.isArray(record.images);
}

function paramsForOrigin (record, origin) {
  if (origin === 'generation') {
    const params = record.metadata?.params || record.steps?.[0]?.params || {};
    return { params, extras: [] };
  }
  if (origin === 'post-image') {
    const params = looksLikeMeta(record)
      ? record
      : (record.meta && typeof record.meta === 'object' ? record.meta : record);
    const extras = params !== record ? [record] : [];
    return { params, extras };
  }
  // comic-reference / comic-panel / unknown: walk the record itself.
  return { params: record, extras: [] };
}

function collectNamed (root, hint, out, seen, { isAce } = {}) {
  if (!root || typeof root !== 'object') return;

  if (Array.isArray(root.images)) {
    root.images.forEach((item, index) => {
      const fields = urlFields(item);
      if (!fields) return;
      pushDescriptor(out, seen, {
        ...fields,
        role: imagesRole(hint, index, { isAce }),
        slot: index,
        kind: kindFromUrl(fields.url)
      });
    });
  }

  if (root.sourceImage != null) {
    const fields = urlFields(root.sourceImage);
    if (fields) {
      pushDescriptor(out, seen, { ...fields, role: 'source', kind: kindFromUrl(fields.url) });
    }
  }

  if (typeof root.sourceImageUrl === 'string') {
    pushDescriptor(out, seen, {
      url: root.sourceImageUrl,
      width: 0,
      height: 0,
      role: 'source',
      kind: kindFromUrl(root.sourceImageUrl)
    });
  }

  if (typeof root.image === 'string') {
    pushDescriptor(out, seen, {
      url: root.image,
      width: 0,
      height: 0,
      role: 'source',
      kind: kindFromUrl(root.image)
    });
  }

  if (Array.isArray(root.controlNets)) {
    root.controlNets.forEach((net, index) => {
      const fields = urlFields(net?.image);
      if (!fields) return;
      pushDescriptor(out, seen, {
        ...fields,
        role: 'controlnet',
        slot: index,
        kind: kindFromUrl(fields.url)
      });
    });
  }

  for (const field of ['video', 'videoUrl']) {
    const fields = urlFields(root[field]);
    if (!fields) continue;
    pushDescriptor(out, seen, { ...fields, role: 'source-video', kind: 'video' });
  }

  if (Array.isArray(root.klingElements)) {
    root.klingElements.forEach((el, index) => {
      const frontal = urlFields(el?.frontalImage);
      if (frontal) {
        pushDescriptor(out, seen, {
          ...frontal,
          role: 'reference',
          slot: index,
          kind: kindFromUrl(frontal.url)
        });
      }
      if (Array.isArray(el?.referenceImages)) {
        el.referenceImages.forEach((img, inner) => {
          const fields = urlFields(img);
          if (!fields) return;
          pushDescriptor(out, seen, {
            ...fields,
            role: 'reference',
            slot: inner,
            kind: kindFromUrl(fields.url)
          });
        });
      }
    });
  }
}

function walkOrphanBlobs (value, out, seen, depth = 0) {
  if (depth > 12 || value == null) return;
  if (typeof value === 'string') {
    if (ORCH_BLOB_RE.test(value.trim()) || (isHttpUrl(value) && value.includes(BLOB_PATH_MARKER))) {
      pushDescriptor(out, seen, {
        url: value,
        width: 0,
        height: 0,
        role: 'input',
        kind: kindFromUrl(value)
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkOrphanBlobs(item, out, seen, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const nested of Object.values(value)) walkOrphanBlobs(nested, out, seen, depth + 1);
  }
}

function walkSuppressedAceCovers (record, out, seen) {
  const steps = Array.isArray(record?.steps) ? record.steps : [];
  for (const step of steps) {
    if (step?.$type !== 'imageGen') continue;
    if (step?.metadata?.suppressOutput !== true) continue;
    const items = step.output ?? step.images;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const fields = urlFields(item);
      if (!fields) continue;
      pushDescriptor(out, seen, {
        ...fields,
        role: 'cover',
        kind: kindFromUrl(fields.url)
      });
    }
  }
}

export function extractInputDescriptors (record, origin) {
  if (!record || typeof record !== 'object') return [];
  try {
    const { params, extras } = paramsForOrigin(record, origin);
    const hint = roleHint(record, params);
    const isAce = isAceAudioParams(params);
    const out = [];
    const seen = new Set();
    const roots = [params, ...extras];
    for (const root of roots) collectNamed(root, hint, out, seen, { isAce });
    for (const root of roots) walkOrphanBlobs(root, out, seen);
    if (origin === 'generation' && isAce) {
      walkSuppressedAceCovers(record, out, seen);
    }
    return out;
  } catch (ignoreErr) {
    return [];
  }
}

export async function resolveInputSource (descriptor) {
  const url = descriptor?.url;
  if (!isHttpUrl(url)) return null;

  const id = blobIdFromUrl(url);
  const ext = extFromUrl(url) || 'jpeg';

  try {
    const { ensureIndexLoaded, getMediaItemById } = await import('./serverIndex.mjs');
    await ensureIndexLoaded();
    const existing = getMediaItemById(id);
    if (existing?.thumbnailPath) {
      const rel = existing.thumbnailPath.replace(/^\/media\/?/, '');
      const filepath = path.join(CONFIG.mediaPath, rel);
      if (await fileExists(filepath)) {
        return { id, filepath, thumbnailPath: existing.thumbnailPath, reused: true };
      }
    }
  } catch (ignoreErr) {
    // Index unavailable — fall through to on-disk inputs/ then download.
  }

  for (const probeExt of INPUT_PROBE_EXTS) {
    const filepath = inputMediaFilepath(id, probeExt);
    if (await fileExists(filepath)) {
      return {
        id,
        filepath,
        thumbnailPath: `/media/inputs/${id}.${probeExt}`,
        reused: true
      };
    }
  }

  const filepath = inputMediaFilepath(id, ext);
  return {
    id,
    filepath,
    thumbnailPath: `/media/inputs/${id}.${ext}`,
    reused: false
  };
}

// After a new inputs/ write: join onto a produced generation when the bytes
// already exist. Unlink the inputs/ copy only when hashes match. Fail-soft.
async function joinWrittenInputIfDuplicate (resolved, filepath) {
  try {
    await loadAliasStore();
    const hex = await hashFileSha256(filepath);
    const canonical = resolveCanonicalId([contentKey(hex)]);
    if (!canonical) return false;

    const { getMediaItemById, ensureIndexLoaded, isProduced } = await import('./serverIndex.mjs');
    await ensureIndexLoaded();
    const item = getMediaItemById(canonical);
    if (!item || !isProduced(item)) return false;

    await recordAlias(canonical, 'blob:' + resolved.id);
    // content: hit means these bytes already exist as a generation file
    // (possibly an older occurrence, not the newest thumbnail). Unlink the
    // inputs/ copy; never unlink generation files from this path.
    await unlink(filepath);
    return true;
  } catch (ignoreErr) {
    return false;
  }
}

export async function saveInputMedia (descriptors, { signal, onProgress } = {}) {
  const report = { saved: 0, reused: 0, skipped: 0 };
  if (!Array.isArray(descriptors) || descriptors.length === 0) return report;

  const inputsDir = `${CONFIG.mediaPath}/inputs`;
  if (!(await fileExists(inputsDir))) {
    await mkdirp(inputsDir);
  }

  const total = descriptors.length;
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break;

    let resolved;
    try {
      resolved = await resolveInputSource(descriptors[i]);
    } catch (ignoreErr) {
      report.skipped++;
      continue;
    }

    if (!resolved) {
      report.skipped++;
      continue;
    }

    if (resolved.reused) {
      report.reused++;
      continue;
    }

    if (onProgress) onProgress({ phase: 'input-media', index: i + 1, total });

    const { filepath } = resolved;
    const result = await downloadMediaFile(descriptors[i].url, filepath, { signal });

    if (result.status === 'aborted') break;

    if (result.status !== 'published') {
      report.skipped++;
      continue;
    }

    const joined = await joinWrittenInputIfDuplicate(resolved, filepath);
    if (joined) report.reused++;
    else report.saved++;
  }

  return report;
}
