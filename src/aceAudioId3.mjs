/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// ACE consumed-text sidecar (`data/index/ace-audio-id3.json`):
// ID3v2.4 TXXX `prompt` (MP3) and orchestrator.getWorkflow fills (cover .mp4).
// Apply only when item.audio exists and JSON musicDescription is empty.
// Fail-soft: unreadable buffer → null. No ffmpeg, no serverIndex import.

import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { writeFile } from './utils.mjs';
import { searchPromptFromAudio } from './aceAudioParams.mjs';

const ACE_NODE = 'TextEncodeAceStepAudio1.5';
const MAX_TAG_BYTES = 2 * 1024 * 1024;

export function sidecarFilePath (dataPath) {
  if (!dataPath) return null;
  return path.join(dataPath, 'index', 'ace-audio-id3.json');
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

export async function upsertAceAudioSidecar (dataPath, updates) {
  if (!dataPath || !updates || typeof updates !== 'object') return;
  const sidecar = readSidecarSync(dataPath);
  let dirty = false;
  for (const [id, row] of Object.entries(updates)) {
    if (!id || !row || typeof row !== 'object' || Array.isArray(row)) continue;
    sidecar[id] = { ...(sidecar[id] || {}), ...row };
    dirty = true;
  }
  if (dirty) await writeFile(sidecarFilePath(dataPath), sidecar);
}

export function applyAceAudioSidecar (items, sidecar) {
  if (!Array.isArray(items) || !sidecar || typeof sidecar !== 'object') return;
  for (const item of items) {
    if (!item?.audio || item.audio.musicDescription) continue;
    const row = sidecar[item.id];
    if (!row) continue;
    // Clone so ID3 fill cannot mutate the generation entry's `audio`
    // (buildMediaItems may share that object). File-derived fields belong
    // on the projected media item + sidecar, not generations.ndjson.
    const audio = { ...item.audio };
    if (row.musicDescription) audio.musicDescription = row.musicDescription;
    if (row.lyrics && !audio.lyrics) audio.lyrics = row.lyrics;
    if (
      row.bpm != null && row.bpm !== '' &&
      (audio.bpm == null || audio.bpm === '')
    ) {
      audio.bpm = row.bpm;
    }
    if (row.key && !audio.key) audio.key = row.key;
    item.audio = audio;
    item.prompt = searchPromptFromAudio(audio);
  }
}

export function readAceAudioFromMp3 (buf) {
  if (!buf || buf.length < 10) return null;
  try {
    const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    const tag = sliceId3Tag(bytes);
    if (!tag) return null;
    const promptJson = findPromptTxxx(tag);
    if (!promptJson) return null;
    const parsed = JSON.parse(promptJson.replace(/\0+$/g, '').trim());
    const inputs = findAceInputs(parsed);
    if (!inputs || typeof inputs !== 'object') return null;
    const bpmN = Number(inputs.bpm);
    return {
      musicDescription: inputs.tags == null ? '' : String(inputs.tags),
      lyrics: inputs.lyrics == null ? '' : String(inputs.lyrics),
      bpm: Number.isFinite(bpmN) ? bpmN : '',
      key: inputs.keyscale == null ? '' : String(inputs.keyscale)
    };
  } catch (ignoreErr) {
    return null;
  }
}

function synchsafe (bytes, offset) {
  return ((bytes[offset] & 0x7f) << 21)
    | ((bytes[offset + 1] & 0x7f) << 14)
    | ((bytes[offset + 2] & 0x7f) << 7)
    | (bytes[offset + 3] & 0x7f);
}

export function id3TagByteLength (header) {
  if (!header || header.length < 10) return 0;
  const bytes = Buffer.isBuffer(header) ? header : Buffer.from(header);
  if (bytes.toString('ascii', 0, 3) !== 'ID3') return 0;
  const major = bytes[3];
  if (major !== 3 && major !== 4) return 0;
  const tagSize = synchsafe(bytes, 6);
  if (tagSize < 1 || tagSize > MAX_TAG_BYTES) return 0;
  return 10 + tagSize;
}

function sliceId3Tag (bytes) {
  if (bytes.toString('ascii', 0, 3) !== 'ID3') return null;
  const major = bytes[3];
  if (major !== 3 && major !== 4) return null;
  const tagSize = synchsafe(bytes, 6);
  if (tagSize < 1 || 10 + tagSize > bytes.length) return null;
  let body = bytes.subarray(10, 10 + tagSize);
  const flags = bytes[5];
  if (major === 4 && (flags & 0x40)) {
    if (body.length < 4) return null;
    const extSize = synchsafe(body, 0);
    if (extSize < 4 || extSize > body.length) return null;
    body = body.subarray(extSize);
  }
  return { major, body };
}

function frameSize (tag, offset) {
  if (tag.major === 4) return synchsafe(tag.body, offset + 4);
  return tag.body.readUInt32BE(offset + 4);
}

function findPromptTxxx (tag) {
  let offset = 0;
  const body = tag.body;
  while (offset + 10 <= body.length) {
    const id = body.toString('ascii', offset, offset + 4);
    if (id === '\u0000\u0000\u0000\u0000' || !/^[A-Z0-9]{4}$/.test(id)) break;
    const size = frameSize(tag, offset);
    if (size < 1 || offset + 10 + size > body.length) break;
    const data = body.subarray(offset + 10, offset + 10 + size);
    offset += 10 + size;
    if (id !== 'TXXX') continue;
    const parsed = parseTxxx(data);
    if (!parsed) continue;
    if (parsed.description.toLowerCase() !== 'prompt') continue;
    return parsed.value;
  }
  return null;
}

function parseTxxx (data) {
  if (data.length < 2) return null;
  const encoding = data[0];
  const rest = data.subarray(1);
  if (encoding === 1 || encoding === 2) {
    const term = findUtf16Term(rest);
    if (term < 0) return null;
    const desc = stripId3Text(decodeUtf16(rest.subarray(0, term), encoding));
    const value = stripId3Text(decodeUtf16(rest.subarray(term + 2), encoding));
    return { description: desc, value };
  }
  const term = rest.indexOf(0);
  if (term < 0) return null;
  const desc = stripId3Text(rest.subarray(0, term).toString(encoding === 3 ? 'utf8' : 'latin1'));
  const value = stripId3Text(rest.subarray(term + 1).toString(encoding === 3 ? 'utf8' : 'latin1'));
  return { description: desc, value };
}

function stripId3Text (s) {
  return String(s || '').replace(/\0+$/g, '');
}

function findUtf16Term (buf) {
  for (let i = 0; i + 1 < buf.length; i += 2) {
    if (buf[i] === 0 && buf[i + 1] === 0) return i;
  }
  return -1;
}

function decodeUtf16 (buf, encoding) {
  if (buf.length === 0) return '';
  if (encoding === 2) return buf.toString('utf16le'); // BE without BOM is uncommon; tests use UTF-8
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le');
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return swapped.toString('utf16le');
  }
  return buf.toString('utf16le');
}

function findAceInputs (value, depth = 0) {
  if (depth > 24 || value == null || typeof value !== 'object') return null;
  if (!Array.isArray(value)) {
    const direct = value[ACE_NODE];
    if (direct && typeof direct === 'object' && direct.inputs) return direct.inputs;
    if (value.class_type === ACE_NODE && value.inputs && typeof value.inputs === 'object') {
      return value.inputs;
    }
  }
  const kids = Array.isArray(value) ? value : Object.values(value);
  for (const child of kids) {
    const found = findAceInputs(child, depth + 1);
    if (found) return found;
  }
  return null;
}
