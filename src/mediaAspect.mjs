// Pixels → orientation class + snap-or-exact ratio token.
// Pure: no serverIndex import, no I/O. Named ratios are a label layer over
// stored width/height, not a replacement for them.

export const SNAP_EPSILON = 0.05;

export const ASPECT_CLASSES = Object.freeze(['portrait', 'landscape', 'square']);

export const ASPECT_CLASS_LABELS = Object.freeze({
  portrait: 'Portrait',
  landscape: 'Landscape',
  square: 'Square'
});

// Frozen, always-reduced generator presets. Changing epsilon or retargeting
// a named row after ship is a semantic flip (URL `_v` bump). Adding a new
// pair is non-breaking. Do not store unreduced aliases (14:10 / 6:10).
export const NAMED_ASPECT_RATIOS = Object.freeze([
  '1:1', '4:3', '3:4', '3:2', '2:3', '16:9', '9:16',
  '5:4', '4:5', '2:1', '1:2', '7:5', '5:7', '3:5', '5:3',
  '21:9', '9:21'
]);

const NAMED_PARSED = NAMED_ASPECT_RATIOS.map(token => {
  const [a, b] = token.split(':').map(Number);
  return { token, a, b, ratio: a / b };
});

const CLASS_TOKEN = new Set(ASPECT_CLASSES);
const RATIO_TOKEN_RE = /^\d+:\d+$/;

function gcd (a, b) {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function asPositiveInt (n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v);
}

function dimPair (obj) {
  if (!obj || typeof obj !== 'object') return null;
  const width = asPositiveInt(obj.width);
  const height = asPositiveInt(obj.height);
  if (!width || !height) return null;
  return { width, height };
}

/** Job-request pixels. Object `aspectRatio.{width,height}` only — a string `"16:9"` is not pixels. */
export function paramsPixels (params) {
  if (!params || typeof params !== 'object') return null;
  const flat = dimPair(params);
  if (flat) return flat;
  const ar = params.aspectRatio;
  if (ar && typeof ar === 'object' && !Array.isArray(ar)) return dimPair(ar);
  return null;
}

export function reduceRatio (w, h) {
  const width = asPositiveInt(w);
  const height = asPositiveInt(h);
  if (!width || !height) return null;
  const g = gcd(width, height) || 1;
  return `${width / g}:${height / g}`;
}

function relativeRatioError (actual, named) {
  if (!named) return Infinity;
  return Math.abs(actual - named) / named;
}

/**
 * Snap to the closest named `a:b` whose relative error
 * `|(w/h) - (a/b)| / (a/b)` is ≤ 5%. Else the reduced exact `w:h`.
 */
export function namedAspectToken (w, h) {
  const width = asPositiveInt(w);
  const height = asPositiveInt(h);
  if (!width || !height) return null;
  const actual = width / height;
  let best = null;
  for (const named of NAMED_PARSED) {
    const err = relativeRatioError(actual, named.ratio);
    if (best == null || err < best.err) best = { token: named.token, err };
  }
  if (best && best.err <= SNAP_EPSILON) return best.token;
  return reduceRatio(width, height);
}

/** Same ±5% square band as the former `deriveAspectClass`. */
export function aspectClassFromPixels (width, height) {
  const w = asPositiveInt(width);
  const h = asPositiveInt(height);
  if (!w || !h) return '';
  const ratio = w / h;
  if (ratio > 1 + SNAP_EPSILON) return 'landscape';
  if (ratio < 1 - SNAP_EPSILON) return 'portrait';
  return 'square';
}

export function pixelsDisagree (a, b) {
  const left = dimPair(a);
  const right = dimPair(b);
  if (!left || !right) return false;
  const r1 = left.width / left.height;
  const r2 = right.width / right.height;
  return relativeRatioError(r1, r2) > SNAP_EPSILON;
}

/**
 * Pixel source order: produced JSON (output / post image) → job params → sidecar.
 * Sidecar is used only for a hole or a produced-vs-params disagreement beyond
 * the snap band. Callers that must not consult the file pass no sidecar
 * (`buildGenerationEntry` of raw JSON).
 */
export function resolveMediaPixels ({ output, params, postImage, sidecar } = {}) {
  const produced = dimPair(output) || dimPair(postImage);
  const fromParams = paramsPixels(params);
  const fromFile = dimPair(sidecar);
  const hole = !produced && !fromParams;
  const disagree = produced && fromParams && pixelsDisagree(produced, fromParams);
  if (fromFile && (hole || disagree)) {
    return { width: fromFile.width, height: fromFile.height, source: 'file' };
  }
  if (produced) return { width: produced.width, height: produced.height, source: 'produced' };
  if (fromParams) return { width: fromParams.width, height: fromParams.height, source: 'params' };
  return { width: 0, height: 0, source: null };
}

function multiplier (n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n === 1) return 0;
  return n;
}

function explicitOverride ({ override, upscaleWidth, upscaleHeight, upscale, scaleFactor } = {}, request) {
  const absolute = dimPair(override) || dimPair({ width: upscaleWidth, height: upscaleHeight });
  if (absolute) return absolute;
  const factor = multiplier(upscale) || multiplier(scaleFactor);
  if (!factor || !request) return null;
  return {
    width: Math.round(request.width * factor),
    height: Math.round(request.height * factor)
  };
}

function asInputPairs (input) {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  const pairs = [];
  for (const item of list) {
    const pair = dimPair(item);
    if (pair) pairs.push(pair);
  }
  return pairs;
}

function samePixels (a, b) {
  return !!a && !!b && a.width === b.width && a.height === b.height;
}

function aspectStringPair (aspect) {
  if (typeof aspect !== 'string' || !RATIO_TOKEN_RE.test(aspect)) return null;
  const [a, b] = aspect.split(':').map(Number);
  if (!a || !b) return null;
  return { width: a, height: b };
}

function blobPair (blob) {
  const pair = dimPair(blob);
  if (!pair) return null;
  return { ...pair, aspectRatio: blob.aspectRatio };
}

/**
 * A blob that already has pixels is untrusted when it repeats an input, an
 * explicit output size is a different pair, its ratio contradicts the job
 * aspect, or a numeric resolution matches neither side. Ratio checks use the
 * existing 5% band. Output-size mismatch is exact: 1024 and 3072 share a
 * ratio and are still different files.
 */
function blobIsUntrusted (blob, inputPairs, override, aspect, resolution) {
  if (!blob) return false;
  if (inputPairs.some(pair => samePixels(blob, pair))) return true;
  if (override && !samePixels(blob, override)) return true;
  const fromAspect = aspectStringPair(aspect);
  if (fromAspect && pixelsDisagree(blob, fromAspect)) return true;
  const numericAspect = Number(blob.aspectRatio);
  if (Number.isFinite(numericAspect) && numericAspect > 0) {
    const blobRatio = blob.width / blob.height;
    if (relativeRatioError(blobRatio, numericAspect) > SNAP_EPSILON) return true;
  }
  if (typeof resolution === 'number' && Number.isFinite(resolution) && resolution > 0) {
    if (resolution !== blob.width && resolution !== blob.height) return true;
  }
  return false;
}

function entryProducedSize ({ blob, request, input, override, aspect, resolution, upscaleWidth, upscaleHeight, upscale, scaleFactor }) {
  const blobPx = blobPair(blob);
  const requestPx = dimPair(request);
  const output = explicitOverride({ override, upscaleWidth, upscaleHeight, upscale, scaleFactor }, requestPx);
  const inputs = asInputPairs(input);
  if (blobPx && !blobIsUntrusted(blobPx, inputs, output, aspect, resolution)) {
    return { width: blobPx.width, height: blobPx.height, pixelSource: 'blob' };
  }
  if (output) return { width: output.width, height: output.height, pixelSource: 'override' };
  const aspectPresent = !!aspectStringPair(aspect);
  const resolutionPresent = typeof resolution === 'number' && Number.isFinite(resolution) && resolution > 0;
  const inputEqualsRequest = !!(requestPx && inputs.some(pair => samePixels(pair, requestPx)));
  if (!blobPx && !output && !inputEqualsRequest && !resolutionPresent && !aspectPresent && requestPx) {
    return { width: requestPx.width, height: requestPx.height, pixelSource: 'blob' };
  }
  return { width: 0, height: 0, pixelSource: 'none' };
}

/**
 * Produced file size. No workflow id. `params.width` / `height` stay on the
 * caller as the request canvas; this return value is the file.
 *
 * Entry build omits `current`, `post`, and `file`. Join passes `current`
 * plus `post`. The sidecar passes `current` plus `file`. A trusted blob is
 * not replaced by a header. A header replaces a post measurement, an
 * override, and a hole.
 */
export function resolveProducedSize (opts = {}) {
  const current = opts.current;
  let result = (current && typeof current.pixelSource === 'string')
    ? {
        width: asPositiveInt(current.width),
        height: asPositiveInt(current.height),
        pixelSource: current.pixelSource
      }
    : entryProducedSize(opts);
  if (!result.width || !result.height) {
    result = { width: 0, height: 0, pixelSource: result.pixelSource || 'none' };
  }

  const post = dimPair(opts.post);
  if (
    post &&
    result.pixelSource !== 'file' &&
    (result.pixelSource === 'none' || !samePixels(result, post))
  ) {
    result = { width: post.width, height: post.height, pixelSource: 'post' };
  }

  const file = dimPair(opts.file);
  if (file && result.pixelSource !== 'blob') {
    result = { width: file.width, height: file.height, pixelSource: 'file' };
  }
  return result;
}

/** File duration, then a post measurement, then the output item. Never the request or the wall clock. */
export function resolveProducedDuration ({ fileDuration, postDuration, itemDuration } = {}) {
  for (const candidate of [fileDuration, postDuration, itemDuration]) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

export function isAspectClassToken (token) {
  return CLASS_TOKEN.has(token);
}

export function isAspectRatioToken (token) {
  return typeof token === 'string' && RATIO_TOKEN_RE.test(token);
}

export function aspectTokenLabel (token) {
  if (ASPECT_CLASS_LABELS[token]) return ASPECT_CLASS_LABELS[token];
  return token;
}
