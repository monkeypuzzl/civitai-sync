// Header helpers and mesh file rows for the batch page and the media page.
// Parameter rows live in src/parameters.mjs. Post and comic pages do not
// render them. Saved JSON and the index keep the Flux sampler token
// "undefined"; posted-identity still reads it as an empty sampler.

import { detailFacts } from '../../../../src/parameters.mjs';

/**
 * A parameter value is showable when it is present and is not the placeholder
 * token "undefined" (any case, surrounding space ignored). Numeric 0 is
 * showable here. The Parameters gather treats 0 as unset.
 */
export function paramValueShown (value) {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    const s = value.trim();
    return s !== '' && s.toLowerCase() !== 'undefined';
  }
  return true;
}

function positivePair (pair) {
  const w = Number(pair && pair.width);
  const h = Number(pair && pair.height);
  if (!(w > 0) || !(h > 0)) return null;
  return { width: w, height: h };
}

/**
 * One produced size when every member has that same positive pair.
 * Null when the list is empty, a member has no size, or two sizes differ.
 */
export function agreedProducedPair (members) {
  const list = Array.isArray(members) ? members : [];
  if (!list.length) return null;
  let agreed = null;
  for (const member of list) {
    const pair = positivePair(member);
    if (!pair) return null;
    if (!agreed) {
      agreed = pair;
      continue;
    }
    if (agreed.width !== pair.width || agreed.height !== pair.height) return null;
  }
  return agreed;
}

const TYPE_WORD = { image: 'Image', video: 'Video', audio: 'Audio', model3d: '3D' };

function resolutionString (value) {
  if (typeof value !== 'string') return '';
  const s = value.trim();
  if (!s || s.toLowerCase() === 'undefined') return '';
  return s;
}

/**
 * Kind label for the entity header. A batch with one logical type is
 * `Generation · Image`. Mixed or unknown members stay `Generation`.
 */
export function entityHeaderLabel (place, mediaType) {
  if (place === 'post') return 'Post';
  if (place === 'comic') return 'Comic';
  if (place === 'media') return TYPE_WORD[mediaType] || '';
  if (place === 'generation') {
    const word = TYPE_WORD[mediaType] || '';
    return word ? `Generation \u00B7 ${word}` : 'Generation';
  }
  return '';
}

/** The shared logical type, or '' when the list is empty or disagrees. */
export function sharedMediaType (members) {
  const list = Array.isArray(members) ? members : [];
  if (!list.length) return '';
  const type = list[0] && list[0].type;
  if (!TYPE_WORD[type]) return '';
  for (const member of list) {
    if (!member || member.type !== type) return '';
  }
  return type;
}

/**
 * One file duration in whole seconds when every member has that same
 * positive length. Null when the list is empty, a member has none, or
 * two rounded lengths differ.
 */
export function agreedDurationSeconds (members) {
  const list = Array.isArray(members) ? members : [];
  if (!list.length) return null;
  let agreed = null;
  for (const member of list) {
    const n = Number(member && member.duration);
    if (!(n > 0)) return null;
    const rounded = Math.round(n);
    if (agreed == null) agreed = rounded;
    else if (agreed !== rounded) return null;
  }
  return agreed;
}

/**
 * String resolution bucket from a saved generation job (`720p`).
 * A number is not a label. A post or comic document has no steps and
 * no `metadata.params`, and returns ''.
 */
export function jobResolutionLabel (raw) {
  if (!raw || typeof raw !== 'object') return '';
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  const sources = [
    raw.metadata && raw.metadata.params,
    steps[0] && steps[0].params,
    steps[0] && steps[0].metadata && steps[0].metadata.params
  ];
  if (!sources.some(Boolean)) return '';
  for (const src of sources) {
    const label = resolutionString(src && src.resolution);
    if (label) return label;
  }
  return '';
}

/**
 * Defining properties for the entity header. Delegates to detailFacts so
 * the header and the Parameters rows share one claim set.
 * @returns {{ text: string, title: string }[]}
 */
export function entityPropertyChips (opts = {}) {
  return detailFacts({
    type: opts.type,
    snapshot: opts.snapshot === undefined ? null : opts.snapshot,
    produced: opts.produced,
    resolution: opts.resolution,
    durationSeconds: opts.durationSeconds,
    audio: opts.audio,
    files: opts.files,
    showSeed: false
  }).headerChips;
}

function pathBasename (value) {
  const s = String(value || '').replace(/\\/g, '/');
  const cut = s.lastIndexOf('/');
  return cut >= 0 ? s.slice(cut + 1) : s;
}

function extensionFormat (value) {
  const base = pathBasename(value);
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

function storedFormat (value, pathFallback) {
  if (typeof value === 'string') {
    const s = value.trim().replace(/^\./, '').toLowerCase();
    if (s) return s;
  }
  return extensionFormat(pathFallback);
}

function storedLabel (value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function formatDisplayName (format) {
  return format ? format.toUpperCase() : '';
}

// A stored variant the person can tell from the base mesh. `primary` is the
// base mesh in another format, so it contributes no extra name.
function variantDisplayName (variant) {
  const raw = storedLabel(variant);
  if (!raw || raw.toLowerCase() === 'primary') return '';
  return raw.split('-').filter(Boolean).map(part => {
    const lower = part.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

function isPreviewFile (file) {
  return storedLabel(file && file.role).toLowerCase() === 'thumb';
}

/**
 * Default mesh first, then each other mesh. The preview is omitted. A
 * basename that repeats the default mesh is omitted. The base mesh is named
 * by its format (`GLB`, `FBX`). A rig, an animation, or a motion keeps that
 * name. Empty input is [].
 * @returns {{ label: string, format: string, path: string }[]}
 */
export function model3dFileRows ({ mediaPath, files } = {}) {
  const rows = [];
  const primary = typeof mediaPath === 'string' ? mediaPath : '';
  const primaryBase = primary ? pathBasename(primary) : '';
  if (primary) {
    const format = extensionFormat(primary);
    rows.push({
      label: formatDisplayName(format),
      format,
      path: primary
    });
  }
  const list = Array.isArray(files) ? files : [];
  for (const file of list) {
    if (!file || typeof file !== 'object') continue;
    if (isPreviewFile(file)) continue;
    const filePath = typeof file.path === 'string' ? file.path : '';
    if (!filePath) continue;
    if (primaryBase && pathBasename(filePath) === primaryBase) continue;
    const format = storedFormat(file.format, filePath);
    const label = variantDisplayName(file.variant) || formatDisplayName(format);
    rows.push({ label, format, path: filePath });
  }
  return rows;
}

/**
 * Format token beside the row name. Empty when the name is already that
 * format, so a GLB row does not also say glb. Otherwise the format in
 * capitals.
 */
export function model3dShownFormat (row) {
  const format = storedFormat(row && row.format, '');
  if (!format) return '';
  if (storedLabel(row && row.label).toLowerCase() === format) return '';
  return format.toUpperCase();
}

const VIEWABLE_MESH_EXT = new Set(['glb', 'gltf']);

function variantIsArmature (file) {
  return storedLabel(file && file.variant).toLowerCase().endsWith('-armature');
}

/**
 * GLB and glTF the viewer can open. Primary first. Armature variants and a
 * basename that repeats the primary are omitted. Empty input is [].
 * @returns {{ label: string, path: string }[]}
 */
export function viewableMeshFiles ({ mediaPath, files } = {}) {
  const rows = [];
  const primary = typeof mediaPath === 'string' ? mediaPath : '';
  const primaryBase = primary ? pathBasename(primary) : '';
  if (primary && VIEWABLE_MESH_EXT.has(extensionFormat(primary))) {
    rows.push({ label: 'Primary', path: primary });
  }
  const list = Array.isArray(files) ? files : [];
  for (const file of list) {
    if (!file || typeof file !== 'object') continue;
    const filePath = typeof file.path === 'string' ? file.path : '';
    if (!filePath) continue;
    const format = storedFormat(file.format, filePath);
    if (!VIEWABLE_MESH_EXT.has(format)) continue;
    if (variantIsArmature(file)) continue;
    if (primaryBase && pathBasename(filePath) === primaryBase) continue;
    const label = storedLabel(file.variant) || storedLabel(file.role) || format;
    rows.push({ label, path: filePath });
  }
  return rows;
}

/**
 * Positive file size. Under 1024 bytes is `N B`; otherwise whole `N KB`
 * or one-decimal `N.N MB`. Missing or non-positive bytes is ''.
 */
export function model3dSizeText (bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
