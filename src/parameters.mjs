// Parameters subsystem. One gather for image, video, audio, and 3D.
//
// Membership is the queue Additional Details filter: drop arrays and objects,
// the key `priority`, an empty string, the placeholder token `undefined`, and
// any other falsy value. A surviving boolean is the word `true`. Labels are
// titleCase(splitUppercase(key)), which lowercases the tail.
//
// Header chips are the facts that define the medium. A key that became a
// header chip is claimed and leaves the rows. Pure: no I/O.

import { normalizeMediaId } from './mediaId.mjs';

const ALWAYS_OMIT = new Set([
  'prompt',
  'Prompt',
  'negativePrompt',
  'Negative prompt',
  'musicDescription',
  'lyrics',
  'simplePrompt',
  'songConcept',
  'title',
  'workflow',
  'Model',
  'width',
  'height',
  'Size',
  'upscaleWidth',
  'upscaleHeight'
]);

const TEXT_LIMIT = 80;

const MODEL_IDENTITY = new Set(['ecosystem', 'engine', 'version', 'baseModel']);

function isPlainObject (value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function splitUppercase (value) {
  return String(value)
    .trim()
    .split(/([A-Z][a-z]+|[0-9]+)/)
    .map(word => word.trim())
    .filter(Boolean)
    .join(' ');
}

function titleCase (value) {
  const s = String(value);
  if (!s) return '';
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

function paramLabel (key) {
  return titleCase(splitUppercase(key));
}

function undefinedToken (value) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'undefined';
}

function blankString (value) {
  return typeof value === 'string' && value.trim() === '';
}

function positivePair (pair) {
  const w = Number(pair && pair.width);
  const h = Number(pair && pair.height);
  if (!(w > 0) || !(h > 0)) return null;
  return { width: w, height: h };
}

function resolutionString (value) {
  if (typeof value !== 'string') return '';
  const s = value.trim();
  if (!s || s.toLowerCase() === 'undefined') return '';
  return s;
}

function durationChip (seconds) {
  const n = Number(seconds);
  if (!(n > 0)) return '';
  return `${Math.round(n)}s`;
}

function finitePositive (value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function shownKey (value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  return s !== '' && s.toLowerCase() !== 'undefined';
}

function memberSeedShown (value) {
  if (value == null || value === '') return false;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s || s.toLowerCase() === 'undefined') return false;
    if (Number(s) === 0) return false;
    return true;
  }
  return true;
}

function seedText (value) {
  if (typeof value === 'number') return `Seed ${String(value)}`;
  if (typeof value === 'string') return `Seed ${value.trim()}`;
  return `Seed ${String(value)}`;
}

function displayValue (value) {
  if (typeof value === 'boolean') return 'true';
  if (typeof value === 'number') return String(value);
  return String(value);
}

function droppedValue (value) {
  if (Array.isArray(value) || typeof value === 'object') return true;
  if (typeof value === 'string') return blankString(value) || undefinedToken(value);
  return !value;
}

function variantMotion (files) {
  let animated = false;
  let rigged = false;
  const list = Array.isArray(files) ? files : [];
  for (const file of list) {
    if (!file || typeof file !== 'object') continue;
    const variant = typeof file.variant === 'string' ? file.variant.trim().toLowerCase() : '';
    if (!variant) continue;
    if (variant === 'animated' || variant.startsWith('walking') || variant.startsWith('running')) {
      animated = true;
    } else if (variant === 'rigged') {
      rigged = true;
    }
  }
  return { animated, rigged };
}

function audioField (snapshot, audio, key) {
  // A saved job can omit tempo and key. The index fills those from the file.
  // A snapshot value, including 0, wins. A missing key uses the index.
  if (isPlainObject(snapshot) && Object.prototype.hasOwnProperty.call(snapshot, key)) {
    return snapshot[key];
  }
  if (isPlainObject(audio) && Object.prototype.hasOwnProperty.call(audio, key)) {
    return audio[key];
  }
  return undefined;
}

function headerChip (text, title) {
  return { text, title };
}

function polycountText (value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}K`;
  return String(n);
}

function headerFrom (input) {
  const type = input && input.type;
  const snapshot = isPlainObject(input && input.snapshot) ? input.snapshot : null;
  const chips = [];
  const claimed = [];

  if (type === 'image' || type === 'video') {
    const size = positivePair(input.produced);
    if (size) {
      chips.push(headerChip(`${size.width}\u00D7${size.height}`, 'Size'));
      claimed.push('aspectRatio');
      if (type === 'image') claimed.push('resolution');
    }
  }
  if (type === 'video') {
    const res = resolutionString(input.resolution);
    if (res) {
      chips.push(headerChip(res, 'Resolution'));
      claimed.push('resolution');
    }
    const dur = durationChip(input.durationSeconds);
    if (dur) {
      chips.push(headerChip(dur, 'Duration'));
      claimed.push('duration');
    }
  }
  if (type === 'audio') {
    const bpm = finitePositive(audioField(snapshot, input.audio, 'bpm'));
    if (bpm != null) {
      chips.push(headerChip(`${bpm} BPM`, 'BPM'));
      claimed.push('bpm');
    }
    const key = audioField(snapshot, input.audio, 'key');
    if (shownKey(key)) {
      chips.push(headerChip(String(key).trim(), 'Key'));
      claimed.push('key');
    }
    const dur = durationChip(input.durationSeconds);
    if (dur) {
      chips.push(headerChip(dur, 'Duration'));
      claimed.push('duration');
    }
  }
  if (type === 'model3d' && snapshot) {
    if (snapshot.modelType !== 'lowpoly') {
      const count = polycountText(snapshot.targetPolycount) || polycountText(snapshot.faceLimit);
      if (count) {
        chips.push(headerChip(count, 'Polycount'));
        claimed.push('targetPolycount', 'faceLimit');
      }
    }
    const topology = snapshot.topology;
    if (topology === 'triangle' || topology === 'quad') {
      chips.push(headerChip(topology === 'quad' ? 'Quads' : 'Triangles', 'Topology'));
      claimed.push('topology', 'quad');
    } else if (snapshot.quad === true || snapshot.quad === false) {
      chips.push(headerChip(snapshot.quad === true ? 'Quads' : 'Triangles', 'Topology'));
      claimed.push('topology', 'quad');
    }
    const motion = variantMotion(input.files);
    const animated = motion.animated || snapshot.enableAnimation === true;
    const rigged = motion.rigged || snapshot.enableRigging === true;
    if (animated || rigged) {
      chips.push(headerChip(animated ? 'Animated' : 'Rigged', animated ? 'Animation' : 'Rigging'));
      claimed.push('enableAnimation', 'enableRigging');
    }
  }
  return { chips, claimed };
}

function holeFill (gen) {
  const step = Array.isArray(gen.steps) ? gen.steps[0] : undefined;
  const fromMeta = gen.metadata && isPlainObject(gen.metadata.params) ? gen.metadata.params : null;
  const fromStep = step && isPlainObject(step.params) ? step.params : null;
  const primary = fromMeta || fromStep || {};
  const fill = step && step.metadata && isPlainObject(step.metadata.params)
    ? step.metadata.params
    : {};
  const params = { ...primary };
  for (const [key, value] of Object.entries(fill)) {
    if (params[key] == null || params[key] === '') params[key] = value;
  }
  return params;
}

function idsOf (record) {
  if (!record || typeof record !== 'object') return [];
  const image = record.image;
  return [record.id, record.imageId, image && image.id, image && image.name, record.name];
}

function recordMatches (record, want) {
  for (const id of idsOf(record)) {
    if (id == null || id === '') continue;
    if (normalizeMediaId(id) === want) return true;
  }
  return false;
}

function metaOf (record) {
  if (!record || typeof record !== 'object') return null;
  if (isPlainObject(record.meta)) return record.meta;
  if (record.image && isPlainObject(record.image.meta)) return record.image.meta;
  return null;
}

/**
 * The parameter object on a detail payload.
 * A generation wins over a post or comic shape. Hole-fill copies step
 * metadata only into null or empty primary values. The string `undefined`
 * is not a hole. A post or comic matches one image or panel; a cover is
 * not walked. No match is null.
 *
 * @param {object|null|undefined} raw
 * @param {string|number} [mediaId]
 * @returns {object|null}
 */
export function snapshotFromRaw (raw, mediaId) {
  if (!isPlainObject(raw)) return null;
  if (Array.isArray(raw.steps) || isPlainObject(raw.metadata)) return holeFill(raw);

  const want = mediaId == null || mediaId === '' ? '' : normalizeMediaId(mediaId);
  if (!want) return null;

  if (Array.isArray(raw.images)) {
    for (const image of raw.images) {
      if (recordMatches(image, want)) return metaOf(image);
    }
    return null;
  }

  if (Array.isArray(raw.chapters)) {
    for (const chapter of raw.chapters) {
      const panels = chapter && Array.isArray(chapter.panels) ? chapter.panels : [];
      for (const panel of panels) {
        if (recordMatches(panel, want)) return metaOf(panel);
      }
    }
    return null;
  }

  return null;
}

function sourceObject (snapshot, fallback) {
  if (isPlainObject(snapshot)) return snapshot;
  if (isPlainObject(fallback)) return fallback;
  return null;
}

function titleLine (snapshot) {
  if (!isPlainObject(snapshot)) return '';
  const title = snapshot.title;
  if (!shownKey(title)) return '';
  return String(title).trim();
}

/**
 * Header chips and parameter rows for one detail page.
 * `snapshot` null uses `fallback` for rows and `audio` for tempo and key.
 * A non-null snapshot is not merged with the fallback.
 *
 * @returns {{
 *   headerChips: { text: string, title: string }[],
 *   claimedKeys: string[],
 *   title: string,
 *   texts: { label: string, value: string }[],
 *   chips: string[],
 *   rows: { kind: 'chip'|'text', label: string, value: string, text: string }[]
 * }}
 */
export function detailFacts (input = {}) {
  const snapshot = isPlainObject(input.snapshot) ? input.snapshot : null;
  const header = headerFrom({ ...input, snapshot });
  const claimed = new Set(header.claimed);
  const source = sourceObject(snapshot, input.fallback);
  const showSeed = input.showSeed === true;
  const seedValue = input.seed;
  const rows = [];
  const texts = [];
  const chips = [];
  let seedKeyPresent = false;
  let seedPlaced = false;

  const pushChip = (text) => {
    chips.push(text);
    rows.push({ kind: 'chip', label: '', value: '', text });
  };
  const pushText = (label, value) => {
    texts.push({ label, value });
    rows.push({ kind: 'text', label, value, text: '' });
  };
  const pushSeed = () => {
    if (!showSeed || seedPlaced || !memberSeedShown(seedValue)) return;
    seedPlaced = true;
    pushChip(seedText(seedValue));
  };

  if (source) {
    for (const [key, value] of Object.entries(source)) {
      if (key === 'seed' || key === 'Seed') {
        seedKeyPresent = true;
        pushSeed();
        continue;
      }
      if (ALWAYS_OMIT.has(key)) continue;
      if (key.toLowerCase().includes('hash')) continue;
      if (input.omitModelIdentity === true && MODEL_IDENTITY.has(key)) continue;
      if (input.omitQuantity === true && key === 'quantity') continue;
      if (input.omitWorkflowAliases === true && (key === 'process' || key === 'type')) continue;
      if (claimed.has(key)) continue;
      if (key === 'priority' || droppedValue(value)) continue;
      const label = paramLabel(key);
      const shown = displayValue(value);
      if (shown.length > TEXT_LIMIT || shown.includes('\n')) pushText(label, shown);
      else pushChip(`${label} ${shown}`);
    }
  }

  if (showSeed && !seedKeyPresent) pushSeed();

  return {
    headerChips: header.chips,
    claimedKeys: header.claimed,
    title: titleLine(snapshot),
    texts,
    chips,
    rows
  };
}
