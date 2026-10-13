/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// Container-level "did this file finish?" checks. A true result is a complete
// container. False is a broken download of a type we know. Null is
// inconclusive: the healer must not replace those bytes.
// No pixel decode. No size-versus-resolution guess.

import { Buffer } from 'node:buffer';
import { open } from 'node:fs/promises';
import path from 'node:path';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MPEG1_L3_BITRATE = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG1_SAMPLERATE = [44100, 48000, 32000];

function asBuffer (buf) {
  if (Buffer.isBuffer(buf)) return buf;
  if (buf == null) return Buffer.alloc(0);
  return Buffer.from(buf);
}

/** @returns {boolean|null} */
export function jpegComplete (buf) {
  const data = asBuffer(buf);
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let i = 2;
  while (i + 1 < data.length) {
    if (data[i] !== 0xff) return false;
    while (i < data.length && data[i] === 0xff) i += 1;
    if (i >= data.length) return false;
    const marker = data[i];
    i += 1;
    if (marker === 0xd9) return true;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xda) {
      if (i + 1 >= data.length) return false;
      const seglen = data.readUInt16BE(i);
      if (seglen < 2) return false;
      let j = i + seglen;
      while (j + 1 < data.length) {
        if (data[j] !== 0xff) {
          j += 1;
          continue;
        }
        const next = data[j + 1];
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          j += 2;
          continue;
        }
        if (next === 0xd9) return true;
        if (next === 0xff) {
          j += 1;
          continue;
        }
        return false;
      }
      return false;
    }
    if (i + 1 >= data.length) return false;
    const seglen = data.readUInt16BE(i);
    if (seglen < 2 || i + seglen > data.length) return false;
    i += seglen;
  }
  return false;
}

/** @returns {boolean|null} */
export function pngComplete (buf) {
  const data = asBuffer(buf);
  if (data.length < 8) return null;
  if (!data.subarray(0, 8).equals(PNG_SIG)) return null;
  let i = 8;
  while (i + 8 <= data.length) {
    const len = data.readUInt32BE(i);
    const type = data.toString('ascii', i + 4, i + 8);
    const next = i + 12 + len;
    if (next > data.length) return false;
    if (type === 'IEND') return true;
    i = next;
  }
  return false;
}

/** @returns {boolean|null} */
export function gifComplete (buf) {
  const data = asBuffer(buf);
  if (data.length < 6) return null;
  const head = data.toString('ascii', 0, 6);
  if (head !== 'GIF87a' && head !== 'GIF89a') return null;
  return data[data.length - 1] === 0x3b;
}

/** @returns {boolean|null} */
export function webpComplete (buf) {
  const data = asBuffer(buf);
  if (data.length < 12) return null;
  if (data.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (data.toString('ascii', 8, 12) !== 'WEBP') return null;
  const size = data.readUInt32LE(4);
  return size + 8 === data.length;
}

/**
 * Top-level ISO-BMFF boxes. `size === 0` means the box runs to end of file.
 * @returns {boolean|null}
 */
export function isoBmffComplete (buf) {
  const data = asBuffer(buf);
  if (data.length < 8) return null;
  const brand = data.toString('ascii', 4, 8);
  if (!/^[A-Za-z0-9 ]{4}$/.test(brand)) return null;
  let offset = 0;
  while (offset + 8 <= data.length) {
    let size = data.readUInt32BE(offset);
    let headerLen = 8;
    if (size === 1) {
      if (offset + 16 > data.length) return false;
      const big = data.readBigUInt64BE(offset + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return false;
      size = Number(big);
      headerLen = 16;
    } else if (size === 0) {
      size = data.length - offset;
    }
    if (size < headerLen || offset + size > data.length) return false;
    offset += size;
  }
  return offset === data.length;
}

function mp3FrameLength (header) {
  if (header.length < 4 || header[0] !== 0xff || (header[1] & 0xe0) !== 0xe0) return null;
  const version = (header[1] >> 3) & 0x3;
  const layer = (header[1] >> 1) & 0x3;
  const bitrateIdx = (header[2] >> 4) & 0xf;
  const sampleIdx = (header[2] >> 2) & 0x3;
  const padding = (header[2] >> 1) & 0x1;
  // MPEG1 Layer III only. Other versions are inconclusive for the caller.
  if (version !== 3 || layer !== 1) return null;
  const bitrate = MPEG1_L3_BITRATE[bitrateIdx];
  const sampleRate = MPEG1_SAMPLERATE[sampleIdx];
  if (!bitrate || sampleRate == null || sampleIdx === 3) return null;
  return Math.floor((144 * bitrate * 1000) / sampleRate) + padding;
}

/** @returns {boolean|null} */
export function mp3Complete (buf) {
  const data = asBuffer(buf);
  if (data.length < 4) return null;
  let offset = 0;
  if (data.toString('ascii', 0, 3) === 'ID3' && data.length >= 10) {
    const size = ((data[6] & 0x7f) << 21) | ((data[7] & 0x7f) << 14) | ((data[8] & 0x7f) << 7) | (data[9] & 0x7f);
    offset = 10 + size;
  }
  let frames = 0;
  while (offset + 4 <= data.length) {
    if (data.toString('ascii', offset, offset + 3) === 'TAG' && data.length - offset === 128) {
      return frames > 0;
    }
    const len = mp3FrameLength(data.subarray(offset, offset + 4));
    if (len == null) return frames > 0 ? false : null;
    if (offset + len > data.length) return false;
    offset += len;
    frames += 1;
  }
  return frames > 0 ? offset === data.length || data.length - offset < 4 : null;
}

/** @returns {boolean|null} */
export function mediaBufferComplete (buf, ext) {
  const kind = String(ext || '').toLowerCase();
  if (kind === '.jpeg' || kind === '.jpg') return jpegComplete(buf);
  if (kind === '.png') return pngComplete(buf);
  if (kind === '.gif') return gifComplete(buf);
  if (kind === '.webp') return webpComplete(buf);
  if (kind === '.mp4' || kind === '.m4a' || kind === '.mov') return isoBmffComplete(buf);
  if (kind === '.mp3') return mp3Complete(buf);
  return null;
}

async function readAt (fh, offset, length, fileSize) {
  const size = Math.min(length, Math.max(0, fileSize - offset));
  if (size <= 0) return Buffer.alloc(0);
  const buf = Buffer.alloc(size);
  const { bytesRead } = await fh.read(buf, 0, size, offset);
  return bytesRead === size ? buf : buf.subarray(0, bytesRead);
}

async function isoBmffFileComplete (filepath, fileSize) {
  if (fileSize < 8) return null;
  let fh;
  try {
    fh = await open(filepath, 'r');
    const head = await readAt(fh, 0, 8, fileSize);
    if (head.length < 8) return null;
    const brand = head.toString('ascii', 4, 8);
    if (!/^[A-Za-z0-9 ]{4}$/.test(brand)) return null;
    let offset = 0;
    while (offset + 8 <= fileSize) {
      const header = await readAt(fh, offset, 16, fileSize);
      if (header.length < 8) return false;
      let size = header.readUInt32BE(0);
      let headerLen = 8;
      if (size === 1) {
        if (header.length < 16) return false;
        const big = header.readBigUInt64BE(8);
        if (big > BigInt(Number.MAX_SAFE_INTEGER)) return false;
        size = Number(big);
        headerLen = 16;
      } else if (size === 0) {
        size = fileSize - offset;
      }
      if (size < headerLen || offset + size > fileSize) return false;
      offset += size;
    }
    return offset === fileSize;
  } catch (ignoreErr) {
    return null;
  } finally {
    if (fh) await fh.close().catch(() => {});
  }
}

/**
 * @returns {Promise<boolean|null>} true complete, false broken, null inconclusive
 */
const BUFFER_EXTS = new Set(['.jpeg', '.jpg', '.png', '.gif', '.webp', '.mp3']);
const BOX_EXTS = new Set(['.mp4', '.m4a', '.mov']);

export async function readMediaComplete (filepath) {
  const ext = path.extname(filepath).toLowerCase();
  if (BOX_EXTS.has(ext)) {
    const { stat } = await import('node:fs/promises');
    let st;
    try {
      st = await stat(filepath);
    } catch (ignoreErr) {
      return null;
    }
    return isoBmffFileComplete(filepath, st.size);
  }
  if (!BUFFER_EXTS.has(ext)) return null;
  try {
    const { readFile } = await import('node:fs/promises');
    const buf = await readFile(filepath);
    return mediaBufferComplete(buf, ext);
  } catch (ignoreErr) {
    return null;
  }
}
