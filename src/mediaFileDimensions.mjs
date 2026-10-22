/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// After-listen hole-fill for media width/height. Reads JPEG SOF, PNG IHDR,
// and ISO-BMFF `tkhd` (seek — `moov` may sit after `mdat`). A readable `mvhd`
// adds duration for video. No ffmpeg, no new dependencies. WebM is left as a
// hole. Fail-soft: unreadable file → no sidecar row.
//
// Must not top-level-import serverIndex (DAG). Never blocks Explorer listen:
// startServer queues this after bind; rebuildIndex awaits it.

import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from './cli.mjs';
import { writeFile } from './utils.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import {
  aspectClassFromPixels,
  resolveProducedDuration,
  resolveProducedSize
} from './mediaAspect.mjs';
import { waitForExplorerIdle } from './explorerIdle.mjs';

const HEADER_READ = 64 * 1024;
const SKIP_EXT = new Set([
  '.mp3', '.wav', '.webm', '.ogg', '.flac',
  '.glb', '.gltf', '.fbx', '.obj', '.usdz', '.stl'
]);

export function sidecarFilePath (dataPath) {
  if (!dataPath) return null;
  return path.join(dataPath, 'index', 'media-file-dims.json');
}

export function readSidecarSync (dataPath) {
  const filepath = sidecarFilePath(dataPath);
  if (!filepath) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch (ignoreErr) {
    return {};
  }
}

export function applySidecarToMediaItems (items, sidecar) {
  if (!Array.isArray(items) || !sidecar || typeof sidecar !== 'object') return;
  for (const item of items) {
    if (item?.type === 'model3d') continue;
    const row = sidecar[item.id];
    if (!row) continue;
    const next = resolveProducedSize({
      current: {
        width: item.width,
        height: item.height,
        pixelSource: item.pixelSource || 'none'
      },
      file: { width: row.width, height: row.height }
    });
    if (next.pixelSource !== 'file') continue;
    item.width = next.width;
    item.height = next.height;
    item.pixelSource = 'file';
    item.aspectClass = aspectClassFromPixels(next.width, next.height);
    if (item.type === 'video' && Number(row.duration) > 0) {
      const dur = resolveProducedDuration({
        fileDuration: row.duration,
        itemDuration: item.duration
      });
      if (dur) item.duration = dur;
    }
  }
}

function needsFileProbe (item) {
  const source = item?.pixelSource;
  if (source === 'blob' || source === 'post' || source === 'file') return false;
  if (source === 'none' || source === 'override') return true;
  const w = Number(item?.width);
  const h = Number(item?.height);
  return !(w > 0) || !(h > 0);
}

function diskPathFromThumbnail (thumbnailPath, mediaPath) {
  if (!mediaPath) return null;
  const rel = String(thumbnailPath || '').replace(/^\/media\/?/, '');
  if (!rel) return null;
  return path.join(mediaPath, rel);
}

function isJpeg (buf) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isPng (buf) {
  return buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
}

function isWebm (buf) {
  return buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

function boxType (buf, offset) {
  if (offset + 8 > buf.length) return '';
  return buf.toString('ascii', offset + 4, offset + 8);
}

function parseJpegDimensions (buf) {
  if (!isJpeg(buf)) return null;
  let i = 2;
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    if (marker === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    const isSof = marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof && i + 8 < buf.length) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      if (width && height) return { width, height };
    }
    i += 2 + len;
  }
  return null;
}

function parsePngDimensions (buf) {
  if (!isPng(buf) || buf.length < 24) return null;
  const type = buf.toString('ascii', 12, 16);
  if (type !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (!width || !height) return null;
  return { width, height };
}

function parseTkhd (payload) {
  if (!payload || payload.length < 80) return null;
  const version = payload[0];
  const widthOff = version === 1 ? 88 : 76;
  if (payload.length < widthOff + 8) return null;
  const width = payload.readUInt32BE(widthOff) >>> 16;
  const height = payload.readUInt32BE(widthOff + 4) >>> 16;
  if (!width || !height) return null;
  return { width, height };
}

function walkBoxes (buf, start, end, visit) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = buf.readUInt32BE(offset);
    const type = boxType(buf, offset);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      const big = buf.readBigUInt64BE(offset + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) break;
    visit({ type, offset, size, header, payloadStart: offset + header, payloadEnd: offset + size });
    offset += size;
  }
}

function parseMvhd (payload) {
  if (!payload || payload.length < 20) return null;
  const version = payload[0];
  let timescale = 0;
  let duration = 0;
  if (version === 1) {
    if (payload.length < 32) return null;
    timescale = payload.readUInt32BE(20);
    const raw = payload.readBigUInt64BE(24);
    if (raw > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    duration = Number(raw);
  } else {
    timescale = payload.readUInt32BE(12);
    duration = payload.readUInt32BE(16);
  }
  if (!timescale || !duration) return null;
  const seconds = duration / timescale;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds;
}

function parseMoov (buf, start, end) {
  let dims = null;
  let duration = null;
  walkBoxes(buf, start, end, (moovChild) => {
    if (moovChild.type === 'mvhd' && duration == null) {
      duration = parseMvhd(buf.subarray(moovChild.payloadStart, moovChild.payloadEnd));
    }
    if (moovChild.type !== 'trak' || dims) return;
    walkBoxes(buf, moovChild.payloadStart, moovChild.payloadEnd, (trakChild) => {
      if (dims || trakChild.type !== 'tkhd') return;
      dims = parseTkhd(buf.subarray(trakChild.payloadStart, trakChild.payloadEnd));
    });
  });
  if (!dims) return null;
  if (duration) return { ...dims, duration };
  return dims;
}

function parseIsoBmffDimensions (buf) {
  if (buf.length < 8) return null;
  let found = null;
  walkBoxes(buf, 0, buf.length, (box) => {
    if (found) return;
    if (box.type === 'moov') {
      found = parseMoov(buf, box.payloadStart, box.payloadEnd);
    }
  });
  return found;
}

/**
 * In-memory header parse (JPEG SOF / PNG IHDR / ISO-BMFF `tkhd` when `moov`
 * is inside the buffer). A readable `mvhd` adds `duration` in seconds.
 * Returns `{ width, height, duration? }` or `null`.
 */
export function readMediaFileDimensions (buf) {
  if (!buf || buf.length < 8) return null;
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (isWebm(bytes)) return null;
  if (isJpeg(bytes)) return parseJpegDimensions(bytes);
  if (isPng(bytes)) return parsePngDimensions(bytes);
  return parseIsoBmffDimensions(bytes);
}

async function readAt (fh, offset, length, fileSize) {
  const size = Math.min(length, Math.max(0, fileSize - offset));
  if (size <= 0) return Buffer.alloc(0);
  const buf = Buffer.alloc(size);
  const { bytesRead } = await fh.read(buf, 0, size, offset);
  return bytesRead === size ? buf : buf.subarray(0, bytesRead);
}

async function parseIsoBmffFromFile (fh, fileSize) {
  let offset = 0;
  while (offset + 8 <= fileSize) {
    const header = await readAt(fh, offset, 16, fileSize);
    if (header.length < 8) break;
    let size = header.readUInt32BE(0);
    const type = header.toString('ascii', 4, 8);
    let headerLen = 8;
    if (size === 1) {
      if (header.length < 16) break;
      const big = header.readBigUInt64BE(8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(big);
      headerLen = 16;
    } else if (size === 0) {
      size = fileSize - offset;
    }
    if (size < headerLen) break;
    if (type === 'moov') {
      const moov = await readAt(fh, offset, size, fileSize);
      return parseIsoBmffDimensions(moov);
    }
    offset += size;
  }
  return null;
}

async function probeFile (filepath) {
  let st;
  try {
    st = await stat(filepath);
  } catch (ignoreErr) {
    return null;
  }
  if (!st.isFile() || st.size < 8) return null;

  const ext = path.extname(filepath).toLowerCase();
  if (SKIP_EXT.has(ext)) return null;

  let fh;
  try {
    fh = await open(filepath, 'r');
    const head = await readAt(fh, 0, Math.min(HEADER_READ, st.size), st.size);
    if (isWebm(head)) return null;
    if (isJpeg(head) || isPng(head)) {
      const dims = readMediaFileDimensions(head);
      if (!dims) return null;
      return { ...dims, mtimeMs: st.mtimeMs };
    }
    const dims = await parseIsoBmffFromFile(fh, st.size);
    if (!dims) return null;
    return { ...dims, mtimeMs: st.mtimeMs };
  } catch (ignoreErr) {
    return null;
  } finally {
    if (fh) await fh.close().catch(() => {});
  }
}

async function mediaItemsFromIndex () {
  try {
    const { ensureIndexLoaded, getIndex } = await import('./serverIndex.mjs');
    await ensureIndexLoaded();
    return getIndex().mediaItems || [];
  } catch (ignoreErr) {
    return [];
  }
}

/**
 * Walk media items that still have a pixel hole (or produced-vs-params
 * disagreement), write `data/index/media-file-dims.json`, skip items whose
 * JSON already supplied pixels and skip re-probe when sidecar mtime matches.
 */
export async function backfillAspectFileDims ({
  mediaItems,
  dataPath = CONFIG?.dataPath,
  mediaPath = CONFIG?.mediaPath
} = {}) {
  await waitForExplorerIdle();
  if (!dataPath || !mediaPath) return { wrote: false };
  const items = mediaItems == null ? await mediaItemsFromIndex() : mediaItems;
  const sidecar = readSidecarSync(dataPath);
  let dirty = false;
  const holes = [];
  for (const item of items || []) {
    if (item?.type === 'model3d') continue;
    const id = normalizeMediaId(item?.id);
    if (!id) continue;
    if (!needsFileProbe(item)) continue;
    holes.push(item);
  }

  for (const item of holes) {
    await waitForExplorerIdle();
    const id = normalizeMediaId(item?.id);
    if (!id) continue;
    const filepath = diskPathFromThumbnail(item.thumbnailPath, mediaPath);
    if (!filepath) continue;

    let st;
    try {
      st = await stat(filepath);
    } catch (ignoreErr) {
      continue;
    }
    const prev = sidecar[id];
    if (
      prev &&
      Number(prev.width) > 0 &&
      Number(prev.height) > 0 &&
      prev.mtimeMs === st.mtimeMs
    ) {
      continue;
    }

    const probed = await probeFile(filepath);
    if (!probed) continue;
    sidecar[id] = {
      width: probed.width,
      height: probed.height,
      path: filepath,
      mtimeMs: probed.mtimeMs,
      source: 'file',
      ...(Number(probed.duration) > 0 ? { duration: probed.duration } : {})
    };
    dirty = true;
  }

  if (dirty) await writeFile(sidecarFilePath(dataPath), sidecar);
  return { wrote: dirty };
}
