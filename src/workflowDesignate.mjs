// Canonical workflow token for a generation job or a published designation.
// Imports workflowVocab only — not src/vendor/.

import {
  getWorkflowDisplayLabel,
  getWorkflowIdentifiers,
  getWorkflowVocab,
  WORKFLOW_MEDIA_TOKENS
} from './workflowVocab.mjs';

function foldSpelling (value) {
  return value.replace(/[:\-\s+]/g, '');
}

function modeOf (id) {
  const colon = id.indexOf(':');
  return colon === -1 ? id : id.slice(0, colon);
}

function isAllowedToken (id) {
  const vocab = getWorkflowVocab(id);
  if (vocab) return true;
  return vocab == null && getWorkflowDisplayLabel(id) !== '';
}

function longestAllowedHyphenSuffix (candidate) {
  const parts = candidate.split('-');
  for (let i = 1; i < parts.length; i++) {
    const suffix = parts.slice(i).join('-');
    if (isAllowedToken(suffix)) return suffix;
  }
  return '';
}

function foldedEqualIdentifier (folded, identifiers) {
  const hits = identifiers.filter(id => foldSpelling(id) === folded);
  return hits.length === 1 ? hits[0] : '';
}

function foldedSuffixIdentifier (folded, identifiers) {
  const hits = [];
  for (const id of identifiers) {
    const f = foldSpelling(id);
    if (f.length > folded.length && f.endsWith(folded)) hits.push(id);
  }
  return hits.length === 1 ? hits[0] : '';
}

// Longer identity whose folded spelling starts with the candidate, and the
// candidate starts with that identity's mode. Several hits → skip the step
// (null). None → ''.
function longerFoldedIdentifier (folded, identifiers) {
  const hits = [];
  for (const id of identifiers) {
    const f = foldSpelling(id);
    if (f.length <= folded.length || !f.startsWith(folded)) continue;
    if (!folded.startsWith(modeOf(id))) continue;
    hits.push(id);
  }
  if (hits.length > 1) return null;
  return hits.length === 1 ? hits[0] : '';
}

// `txt2img + ControlNet` → txt2img when that bare identity is the only
// folded prefix. Hyphenated strings that are not a real key do not use this
// (`img2img-background-removal` stays '').
function plusPrefixIdentifier (candidate, folded, identifiers) {
  if (!candidate.includes('+')) return '';
  const hits = [];
  for (const id of identifiers) {
    const f = foldSpelling(id);
    if (!f || f.length >= folded.length || !folded.startsWith(f)) continue;
    if (!folded.startsWith(modeOf(id))) continue;
    hits.push(id);
  }
  return hits.length === 1 ? hits[0] : '';
}

function mediaTokenForType (mediaType) {
  if (typeof mediaType !== 'string' || !mediaType.trim()) return '';
  const want = mediaType.trim().toLowerCase();
  const hits = [];
  for (const [token, keyword] of Object.entries(WORKFLOW_MEDIA_TOKENS)) {
    if (typeof keyword === 'string' && keyword.toLowerCase() === want) hits.push(token);
  }
  return hits.length === 1 ? hits[0] : '';
}

function bareUpscale (mediaType, identifiers) {
  const token = mediaTokenForType(mediaType);
  if (!token) return '';
  const hits = identifiers.filter(id => id.endsWith(':upscale') && modeOf(id).startsWith(token));
  return hits.length === 1 ? hits[0] : '';
}

/**
 * Map a raw workflow, process badge, or technique name onto one identity
 * identifier or an allowed mode (`vid2vid`). Missing input and anything
 * that does not canonicalize return `''`. Never throws.
 *
 * @param {unknown} raw
 * @param {{ mediaType?: string }} [options]
 * @returns {string}
 */
export function canonicalizeWorkflow (raw, options = {}) {
  if (typeof raw !== 'string') return '';
  const candidate = raw.trim().toLowerCase();
  if (!candidate) return '';
  const mediaType = options && typeof options.mediaType === 'string' ? options.mediaType : '';

  if (isAllowedToken(candidate)) return candidate;

  const suffix = longestAllowedHyphenSuffix(candidate);
  if (suffix) return suffix;

  const identifiers = getWorkflowIdentifiers();
  const folded = foldSpelling(candidate);

  const equal = foldedEqualIdentifier(folded, identifiers);
  if (equal) return equal;

  const suffixId = foldedSuffixIdentifier(folded, identifiers);
  if (suffixId) return suffixId;

  const longer = longerFoldedIdentifier(folded, identifiers);
  if (longer === null) {
    // Two longer identities matched; do not guess.
  } else if (longer) {
    return longer;
  } else {
    const prefixed = plusPrefixIdentifier(candidate, folded, identifiers);
    if (prefixed) return prefixed;
  }

  if (candidate === 'upscale') return bareUpscale(mediaType, identifiers);
  return '';
}

/**
 * Canonical job kind for one coalesced generation params object.
 * `params.workflow` wins when it canonicalizes. Otherwise `params.process`,
 * then `params.type` — the generation-data badge order when `engine` is set.
 * Generation tags are not an input. Missing params return `''`. Never throws.
 *
 * @param {unknown} params
 * @param {{ mediaType?: string }} [options]
 * @returns {string}
 */
export function workflowFromGenerationParams (params, options = {}) {
  if (!params || typeof params !== 'object') return '';
  const mediaType = options && typeof options.mediaType === 'string' ? options.mediaType : '';
  const fromWorkflow = canonicalizeWorkflow(params.workflow, { mediaType });
  if (fromWorkflow) return fromWorkflow;
  const fromProcess = canonicalizeWorkflow(params.process, { mediaType });
  if (fromProcess) return fromProcess;
  return canonicalizeWorkflow(params.type, { mediaType });
}

/**
 * Keep the fullest canonical token. A value containing `:` beats a bare
 * identifier or mode. Equal rank → lexicographically first. Empty in → `''`.
 *
 * @param {unknown} candidates
 * @returns {string}
 */
export function fullestWorkflow (candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return '';
  const survivors = candidates.filter(c => typeof c === 'string' && c !== '');
  if (!survivors.length) return '';
  const specific = survivors.filter(s => s.includes(':'));
  const pool = (specific.length ? specific : survivors).slice().sort();
  return pool[0];
}
