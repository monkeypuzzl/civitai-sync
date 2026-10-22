// Filename of an input id. Not a second media-item id.
// Kept out of mediaId.mjs so the Explorer bundle, which imports
// normalizeMediaId, does not pull node:crypto.

import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

// Room for `.<ext>.partial` (ext up to 8) under a 255-byte filename.
const SEGMENT_BUDGET = 255 - 1 - 8 - '.partial'.length;
const DENIED_SEGMENT = /[\\/:*?"<>|#%]/;
const RESERVED_STEM = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function hasControlChar (value) {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

function isPortableSegment (value) {
  if (!value || value === '.' || value === '..') return false;
  if (DENIED_SEGMENT.test(value) || hasControlChar(value)) return false;
  if (value.endsWith(' ') || value.endsWith('.')) return false;
  if (Buffer.byteLength(value) > SEGMENT_BUDGET) return false;
  const stem = value.includes('.') ? value.slice(0, value.indexOf('.')) : value;
  if (RESERVED_STEM.test(stem)) return false;
  return true;
}

// A portable id is returned unchanged so files already on disk keep their
// names. `url:` plus a hash, a Windows device stem, and any other
// non-portable id become `_` plus 32 hex chars.
export function portableFileSegment (id) {
  const s = String(id ?? '');
  if (isPortableSegment(s)) return s;
  return '_' + createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 32);
}
