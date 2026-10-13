/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// Embedded onsite / A1111 generation details. JPEG UserComment and PNG
// `parameters` only — no Comfy / Swarm / Fooocus, no exifreader.
//
// Leaf of the identity chain (blob-id → content-hash → this). Callers must
// apply the result only to leftover input-only records. This module does
// not invent a generation container and must not import serverIndex or
// generations.

import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import { inflateSync } from 'node:zlib';

const USER_COMMENT_TAG = 0x9286;
const EXIF_IFD_TAG = 0x8769;
const TIFF_MAGIC = 42;
const MAX_IFD_HOPS = 8;

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const automaticSDKeyMap = new Map([
  ['Seed', 'seed'],
  ['CFG scale', 'cfgScale'],
  ['Sampler', 'sampler'],
  ['Steps', 'steps'],
  ['Clip skip', 'clipSkip']
]);

const NUMERIC_META_KEYS = new Set(['steps', 'cfgScale', 'seed', 'clipSkip']);

const TIFF_TYPE_SIZE = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  7: 1,
  9: 4,
  10: 8
};

function getSDKey (key) {
  return automaticSDKeyMap.get(key.trim()) ?? key.trim();
}

/**
 * Decode an EXIF UserComment value (8-byte charset header + payload).
 * Port of civitai-src `decodeUserComment`.
 *
 * @param {Uint8Array|Buffer} buffer
 * @returns {string}
 */
export function decodeUserComment (buffer) {
  if (!buffer || buffer.length < 8) return '';

  const header = new TextDecoder('ascii').decode(buffer.subarray(0, 8));
  const content = buffer.subarray(8);

  if (header.startsWith('ASCII')) return new TextDecoder('ascii').decode(content);
  if (header.startsWith('UTF8')) return new TextDecoder('utf-8').decode(content);

  if (content.length >= 2) {
    if (content[0] === 0xFE && content[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(content.subarray(2)).replace(/\0/g, '');
    }
    if (content[0] === 0xFF && content[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(content.subarray(2)).replace(/\0/g, '');
    }
  }

  let evenZeros = 0;
  let oddZeros = 0;
  const limit = Math.min(content.length, 1000);
  for (let i = 0; i + 1 < limit; i += 2) {
    if (content[i] === 0) evenZeros++;
    if (content[i + 1] === 0) oddZeros++;
  }

  const encoding = oddZeros > evenZeros ? 'utf-16le' : 'utf-16be';
  return new TextDecoder(encoding).decode(content).replace(/\0/g, '');
}

/**
 * ReDoS-safe port of civitai-src `normalizeGenerationDetails`.
 * Quantifiers stay bounded (`{0,7}`, not `*`).
 *
 * @param {string} details
 * @returns {string}
 */
export function normalizeGenerationDetails (details) {
  if (!details) return '';
  const clean = details.replace(/^Parameters\s*:\s*/, '');

  if (/(^|\n)Steps: ?\d/.test(clean)) return clean;

  return clean
    .replace(/[ \t\r]{0,7}[.,][ \t\r.,]{0,7}(Negative prompt:)/gi, '\n$1')
    .replace(/[ \t\r]{0,7}[.,][ \t\r.,]{0,7}(Steps:)(?=\s*\d)/gi, '\n$1');
}

/** Extract a balanced JSON object or array after `prefix`. */
function extractBalancedJson (str, prefix, open = '{', close = '}') {
  const prefixIndex = str.indexOf(prefix);
  if (prefixIndex === -1) return null;

  const jsonStart = str.indexOf(open, prefixIndex + prefix.length);
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = jsonStart; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) {
        return { json: str.slice(jsonStart, i + 1), start: prefixIndex, end: i + 1 };
      }
    }
  }

  return null;
}

function isPartialDate (date) {
  return date.length === 14 && date[11] === 'T';
}

function parseDetailsLine (line) {
  const result = {};
  if (!line) return result;
  let currentKey = '';
  let currentValue = '';
  let insideQuotes = false;
  let insideDate = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes) {
        result[currentKey] = parseDetailsLine(currentValue.trim());
        currentKey = '';
      }
      insideQuotes = !insideQuotes;
    } else if (char === ':' && !insideQuotes && !insideDate) {
      if (isPartialDate(currentValue)) insideDate = true;
      else {
        currentKey = getSDKey(currentValue.trim());
        currentValue = '';
      }
    } else if (char === ',' && !insideQuotes) {
      if (insideDate) insideDate = false;
      if (currentKey) result[currentKey] = currentValue.trim();
      currentKey = '';
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  if (currentKey) result[currentKey] = currentValue.trim();

  return result;
}

function coerceMetaValue (key, value) {
  if (!NUMERIC_META_KEYS.has(key)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return value;
}

function tryParseJson (text) {
  try {
    return JSON.parse(text);
  } catch (ignoreErr) {
    return null;
  }
}

function stripExtracted (line, extracted) {
  if (!line || !extracted) return line;
  let start = extracted.start;
  while (start > 0 && /[,\s]/.test(line[start - 1])) start--;
  return line.slice(0, start) + line.slice(extracted.end);
}

function extractCivitaiResources (line) {
  const balanced = extractBalancedJson(line, 'Civitai resources:', '[', ']');
  if (balanced) {
    const parsed = tryParseJson(balanced.json);
    if (Array.isArray(parsed)) return { value: parsed, extracted: balanced };
  }
  const match = line.match(/Civitai resources:\s*(\[\{.*?\}\])/);
  if (!match) return null;
  const parsed = tryParseJson(match[1]);
  if (!Array.isArray(parsed)) return null;
  const start = line.indexOf(match[0]);
  return {
    value: parsed,
    extracted: { start, end: start + match[0].length }
  };
}

/**
 * Parse an A1111 / Civitai-onsite details string.
 * Returns an ImageMeta-shaped object, or null when the shape is not
 * automatic (`Steps:` absent after normalize).
 *
 * Merge: A1111 line supplies prompt / params / civitaiResources. Keys on
 * the `Civitai metadata:` object win only when that object itself carries
 * `prompt` and/or `civitaiResources`. Extra existing without those keys
 * does not drop the A1111 prompt.
 *
 * @param {string} details
 * @returns {object|null}
 */
export function parseAutomaticDetails (details) {
  if (typeof details !== 'string' || !details) return null;

  let normalized;
  try {
    normalized = normalizeGenerationDetails(details);
  } catch (ignoreErr) {
    return null;
  }
  if (!normalized.includes('Steps:')) return null;

  const metaLines = normalized.split('\n').filter(line => line.trim() !== '');
  let detailsLineIdx = metaLines.findIndex(line => /^Steps:\s*\d/.test(line));
  let detailsLine = detailsLineIdx === -1
    ? ''
    : metaLines[detailsLineIdx].replace(/,\s*$/, '');
  const promptLines = detailsLineIdx === -1
    ? metaLines
    : metaLines.filter((_, i) => i !== detailsLineIdx);

  const searchLine = detailsLine || normalized;

  const resourcesHit = extractCivitaiResources(searchLine);
  if (resourcesHit && detailsLine) detailsLine = stripExtracted(detailsLine, resourcesHit.extracted);

  const metadataHit = extractBalancedJson(detailsLine || searchLine, 'Civitai metadata:');
  if (metadataHit && detailsLine) detailsLine = stripExtracted(detailsLine, metadataHit.extracted);

  const parsedLine = parseDetailsLine(detailsLine);
  const result = {};
  for (const [k, v] of Object.entries(parsedLine)) {
    const key = automaticSDKeyMap.get(k) ?? k;
    result[key] = coerceMetaValue(key, v);
  }
  if (resourcesHit?.value) result.civitaiResources = resourcesHit.value;

  const [prompt, ...negativeParts] = promptLines
    .join('\n')
    .split('Negative prompt:')
    .map(x => x.trim());
  result.prompt = prompt || '';
  result.negativePrompt = negativeParts.join(' ').trim();

  const civitaiMeta = metadataHit ? tryParseJson(metadataHit.json) : null;
  if (civitaiMeta && typeof civitaiMeta === 'object' && !Array.isArray(civitaiMeta)) {
    if (civitaiMeta.prompt) result.prompt = civitaiMeta.prompt;
    if (Array.isArray(civitaiMeta.civitaiResources) && civitaiMeta.civitaiResources.length) {
      result.civitaiResources = civitaiMeta.civitaiResources;
    }
    for (const [k, v] of Object.entries(civitaiMeta)) {
      if (k === 'prompt' || k === 'civitaiResources') continue;
      if (result[k] === undefined) result[k] = coerceMetaValue(k, v);
    }
  }

  const usable = result.prompt
    || result.civitaiResources?.length
    || result.steps != null
    || result.sampler;
  if (!usable) return null;
  return result;
}

function readU16 (buf, off, le) {
  if (off + 2 > buf.length) return 0;
  return le ? buf.readUInt16LE(off) : buf.readUInt16BE(off);
}

function readU32 (buf, off, le) {
  if (off + 4 > buf.length) return 0;
  return le ? buf.readUInt32LE(off) : buf.readUInt32BE(off);
}

function ifdEntryBytes (tiff, entryOff, le) {
  const type = readU16(tiff, entryOff + 2, le);
  const count = readU32(tiff, entryOff + 4, le);
  const size = TIFF_TYPE_SIZE[type] || 1;
  const nbytes = size * count;
  if (nbytes <= 4) return tiff.subarray(entryOff + 8, entryOff + 8 + nbytes);
  const offset = readU32(tiff, entryOff + 8, le);
  if (offset < 0 || offset + nbytes > tiff.length) return null;
  return tiff.subarray(offset, offset + nbytes);
}

function userCommentFromIfd (tiff, ifdOff, le) {
  if (ifdOff < 8 || ifdOff + 2 > tiff.length) return { comment: null, exifOff: 0, nextOff: 0 };
  const count = readU16(tiff, ifdOff, le);
  let comment = null;
  let exifOff = 0;
  for (let i = 0; i < count; i++) {
    const entryOff = ifdOff + 2 + i * 12;
    if (entryOff + 12 > tiff.length) break;
    const tag = readU16(tiff, entryOff, le);
    if (tag === USER_COMMENT_TAG) {
      const bytes = ifdEntryBytes(tiff, entryOff, le);
      if (bytes && bytes.length) comment = bytes;
    } else if (tag === EXIF_IFD_TAG) {
      exifOff = readU32(tiff, entryOff + 8, le);
    }
  }
  const nextOff = ifdOff + 2 + count * 12;
  return {
    comment,
    exifOff,
    nextOff: nextOff + 4 <= tiff.length ? readU32(tiff, nextOff, le) : 0
  };
}

function decodeUserCommentValue (bytes) {
  if (!bytes || !bytes.length) return '';
  const decoded = decodeUserComment(bytes);
  if (decoded && decoded.trim()) return decoded;
  try {
    return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();
  } catch (ignoreErr) {
    return '';
  }
}

function userCommentFromTiff (tiff) {
  if (tiff.length < 8) return '';
  let le;
  if (tiff[0] === 0x49 && tiff[1] === 0x49) le = true;
  else if (tiff[0] === 0x4d && tiff[1] === 0x4d) le = false;
  else return '';
  if (readU16(tiff, 2, le) !== TIFF_MAGIC) return '';

  let ifdOff = readU32(tiff, 4, le);
  let ifd0Comment = null;
  for (let hop = 0; hop < MAX_IFD_HOPS && ifdOff; hop++) {
    const walked = userCommentFromIfd(tiff, ifdOff, le);
    if (hop === 0) ifd0Comment = walked.comment;
    if (walked.exifOff) {
      const exif = userCommentFromIfd(tiff, walked.exifOff, le);
      if (exif.comment) return decodeUserCommentValue(exif.comment);
    }
    if (walked.comment) return decodeUserCommentValue(walked.comment);
    ifdOff = walked.nextOff;
  }
  return ifd0Comment ? decodeUserCommentValue(ifd0Comment) : '';
}

function jpegExifPayloads (buf) {
  const out = [];
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return out;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (len < 2) break;
    const dataStart = i + 4;
    const dataEnd = dataStart + (len - 2);
    if (dataEnd > buf.length) break;
    if (marker === 0xe1 && len - 2 >= 6) {
      if (
        buf[dataStart] === 0x45 && buf[dataStart + 1] === 0x78
        && buf[dataStart + 2] === 0x69 && buf[dataStart + 3] === 0x66
        && buf[dataStart + 4] === 0 && buf[dataStart + 5] === 0
      ) {
        out.push(buf.subarray(dataStart + 6, dataEnd));
      }
    }
    i = dataEnd;
  }
  return out;
}

function readJpegUserComment (buf) {
  for (const tiff of jpegExifPayloads(buf)) {
    const text = userCommentFromTiff(tiff);
    if (text) return text;
  }
  return null;
}

function splitPngKeyword (data) {
  const z = data.indexOf(0);
  if (z <= 0) return null;
  return {
    keyword: data.subarray(0, z).toString('latin1'),
    rest: data.subarray(z + 1)
  };
}

function readPngTextChunk (type, data) {
  if (type === 'tEXt') {
    const parts = splitPngKeyword(data);
    if (!parts) return null;
    return { keyword: parts.keyword, value: parts.rest.toString('latin1') };
  }
  if (type !== 'iTXt') return null;
  const parts = splitPngKeyword(data);
  if (!parts) return null;
  const rest = parts.rest;
  if (rest.length < 2) return null;
  const compressed = rest[0] === 1;
  let cursor = 2;
  const skipNul = () => {
    const z = rest.indexOf(0, cursor);
    if (z === -1) return false;
    cursor = z + 1;
    return true;
  };
  if (!skipNul() || !skipNul()) return null;
  let textBytes = rest.subarray(cursor);
  if (compressed) {
    try {
      textBytes = inflateSync(textBytes);
    } catch (ignoreErr) {
      return null;
    }
  }
  return { keyword: parts.keyword, value: textBytes.toString('utf8') };
}

function readPngParameters (buf) {
  if (buf.length < 8 || !PNG_SIG.equals(buf.subarray(0, 8))) return null;
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const dataStart = i + 8;
    if (dataStart + len + 4 > buf.length) break;
    if (type === 'tEXt' || type === 'iTXt') {
      const text = readPngTextChunk(type, buf.subarray(dataStart, dataStart + len));
      if (text?.keyword === 'parameters' && text.value) return text.value;
    }
    if (type === 'IEND') break;
    i = dataStart + len + 4;
  }
  return null;
}

function readEmbeddedGenerationDetails (filepath) {
  if (!filepath) return null;
  let buf;
  try {
    buf = fs.readFileSync(filepath);
  } catch (ignoreErr) {
    return null;
  }
  if (!buf || !buf.length) return null;
  try {
    if (buf[0] === 0xff && buf[1] === 0xd8) return readJpegUserComment(buf);
    if (buf[0] === 0x89 && buf[1] === 0x50) return readPngParameters(buf);
  } catch (ignoreErr) {
    return null;
  }
  return null;
}

/**
 * Read leftover embedded details from a JPEG or PNG and parse them.
 * Fail-soft: missing file, unknown format, or non-automatic payload → null.
 *
 * @param {string} filepath
 * @returns {object|null}
 */
export function extractEmbeddedMeta (filepath) {
  try {
    const details = readEmbeddedGenerationDetails(filepath);
    if (!details) return null;
    return parseAutomaticDetails(details);
  } catch (ignoreErr) {
    return null;
  }
}


