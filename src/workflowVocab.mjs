// Lookup module for on-site generator workflow vocabulary.
//
// Reads the vendored flavour-2 identity table under `src/vendor/` and
// applies the identifier-as-label fallback for keys not in the snapshot.
// This module is the single approved consumer of
// `src/vendor/civitai-workflows.mjs` — see `src/vendor/README.md` and
// `docs/guides/civitai-sync/internal/vendored-snapshots.md` for the
// isolation policy. The lint test in `tests/vendor-isolation.test.mjs`
// enforces it.
//
// Usage:
//   import { getWorkflowVocab, getWorkflowLabel } from './workflowVocab.mjs';
//   getWorkflowLabel('txt2img');            // → 'Create Image'
//   getWorkflowLabel('txt2img:hires-fix');  // → 'Create + Hires Fix'
//   getWorkflowLabel('not-a-workflow');     // → 'not-a-workflow' (no title-case)
//   getWorkflowLabel('');                   // → ''
//   getWorkflowVocab('txt2music');          // → { identifier, label, category, modeLabel? }
//   getWorkflowVocab('not-a-workflow');     // → null
//   getWorkflowModePhrase('vid2vid:upscale');          // → 'Video to Video'
//   getWorkflowModeAbbreviation('txt2music');          // → 'T2A'
//   getWorkflowAbbreviationExpansion('txt2music');     // → 'Text to Audio'
//   getWorkflowDisplayLabel('img2img');                // → 'Image Variations'
//   getWorkflowCategory('vid2vid');                    // → 'video' (shared by vid2vid:*)
//   getWorkflowCategory('txt2img');                    // → 'image'
//   formatWorkflowQueryLabel('img2img:upscale');       // → 'I2I · Upscale'
//   getWorkflowMediaToken('audio');                    // → 'Audio'
//   getWorkflowMediaToken('image');                    // → ''
//   getWorkflowIdentifiers();                          // sorted identity keys
//
// The identity key is the workflowConfigs object key. A saved job stores
// that key on `params.workflow`, or, when that field is absent, on
// `params.process` or `params.type`. The index canonicalizes one of those
// onto `params.workflow`. Duplicate labels exist (Upscale, Control
// Preprocessor, Create 3D Model); URL tokens stay identifiers.
//
// The five derived maps are frozen at capture. These getters do not
// synthesise a phrase, abbreviation, expansion, or display label.

import { CIVITAI_WORKFLOWS, WORKFLOW_MEDIA_TOKENS, WORKFLOW_MODE_LABELS, WORKFLOW_MODE_ABBREVIATIONS, WORKFLOW_ABBREVIATION_EXPANSIONS, WORKFLOW_DISPLAY_LABELS } from './vendor/civitai-workflows.mjs';

export {
  WORKFLOW_MEDIA_TOKENS,
  WORKFLOW_MODE_LABELS,
  WORKFLOW_MODE_ABBREVIATIONS,
  WORKFLOW_ABBREVIATION_EXPANSIONS,
  WORKFLOW_DISPLAY_LABELS
};

/**
 * Resolve a workflow identifier to the vendored record.
 *
 * @param {string|null|undefined} id
 * @returns {{ identifier: string, label: string, category: string, modeLabel?: string }|null}
 */
export function getWorkflowVocab (id) {
  if (!id || typeof id !== 'string') return null;
  return CIVITAI_WORKFLOWS[id] || null;
}

/**
 * Sorted identity keys (`txt2img`, `img2img:upscale`, …). Display-label-only
 * modes such as `vid2vid` are not in this list.
 *
 * @returns {string[]}
 */
export function getWorkflowIdentifiers () {
  return Object.keys(CIVITAI_WORKFLOWS).sort();
}

/**
 * User-facing label for a workflow identifier.
 *
 * Lookup order:
 *   1. Vendored `label`.
 *   2. The identifier itself (unknown / retired keys).
 *   3. Empty string for falsy / non-string input.
 *
 * Does not title-case unknowns — flavour-2 identity tokens are not
 * display-overlay keys.
 *
 * @param {string|null|undefined} id
 * @returns {string}
 */
export function getWorkflowLabel (id) {
  if (!id || typeof id !== 'string') return '';
  return CIVITAI_WORKFLOWS[id]?.label || id;
}

function modeKeyOf (id) {
  if (!id || typeof id !== 'string') return '';
  const colon = id.indexOf(':');
  return colon === -1 ? id : id.slice(0, colon);
}

/**
 * Display word for a media token taught at capture.
 * `audio` → `Audio`. Category spellings `image` and `video` are not keys.
 *
 * @param {string|null|undefined} token
 * @returns {string}
 */
export function getWorkflowMediaToken (token) {
  if (!token || typeof token !== 'string') return '';
  return WORKFLOW_MEDIA_TOKENS[token] || '';
}

/**
 * Mode phrase for a mode key, or for `mode:suffix` using the segment
 * before the first `:`. Unknown, `img2meta`, and `prompt:enhance` → `''`.
 *
 * @param {string|null|undefined} id
 * @returns {string}
 */
export function getWorkflowModePhrase (id) {
  const mode = modeKeyOf(id);
  if (!mode) return '';
  return WORKFLOW_MODE_LABELS[mode] || '';
}

/**
 * Mode abbreviation for a mode key, or for `mode:suffix` the same way.
 * Unknown → `''`.
 *
 * @param {string|null|undefined} id
 * @returns {string}
 */
export function getWorkflowModeAbbreviation (id) {
  const mode = modeKeyOf(id);
  if (!mode) return '';
  return WORKFLOW_MODE_ABBREVIATIONS[mode] || '';
}

/**
 * Expansion of the mode's badge. Same mode resolution as
 * `getWorkflowModeAbbreviation`. The badge string is not a key
 * (`'T2A'` → `''`). No fallback to the mode phrase, display label,
 * or job label.
 *
 * @param {string|null|undefined} id
 * @returns {string}
 */
export function getWorkflowAbbreviationExpansion (id) {
  const badge = getWorkflowModeAbbreviation(id);
  if (!badge) return '';
  return WORKFLOW_ABBREVIATION_EXPANSIONS[badge] || '';
}

/**
 * Display label for that exact key. Absent keys stay `''`
 * (`img2meta`, unknown ids). No fallback to the mode phrase or job label.
 *
 * @param {string|null|undefined} id
 * @returns {string}
 */
export function getWorkflowDisplayLabel (id) {
  if (!id || typeof id !== 'string') return '';
  return WORKFLOW_DISPLAY_LABELS[id] || '';
}

/**
 * Output category for an identifier.
 *
 * A row in the identity table returns its own `category`. A suffix-only mode
 * (`vid2vid`) returns the category when every identity row with that mode
 * segment shares one. Zero rows or two categories → `''`.
 *
 * @param {string|null|undefined} id
 * @returns {string}
 */
export function getWorkflowCategory (id) {
  if (!id || typeof id !== 'string') return '';
  const direct = getWorkflowVocab(id);
  if (direct?.category) return direct.category;
  const mode = modeKeyOf(id);
  if (!mode) return '';
  let shared = '';
  for (const key of getWorkflowIdentifiers()) {
    if (modeKeyOf(key) !== mode) continue;
    const category = getWorkflowVocab(key)?.category || '';
    if (!category) continue;
    if (!shared) shared = category;
    else if (shared !== category) return '';
  }
  return shared;
}

const TYPE_QUERY_LABELS = Object.freeze({
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  model3d: '3D'
});

const COLLIDING_DISPLAY_LABELS = (() => {
  const counts = new Map();
  for (const label of Object.values(WORKFLOW_DISPLAY_LABELS)) {
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const out = new Set();
  for (const [label, n] of counts) {
    if (n > 1) out.add(label);
  }
  return out;
})();

function queryTokens (value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Export-summary label for one workflow identifier. A display label shared
 * by another identifier in the snapshot is prefixed with the abbreviation
 * (`I2I · Upscale`, `V2V · Upscale`). A unique label stays the display
 * label. No label → the identifier.
 *
 * @param {string|null|undefined} id
 * @returns {string}
 */
export function formatWorkflowQueryLabel (id) {
  const token = id == null ? '' : String(id);
  if (!token) return '';
  const label = getWorkflowDisplayLabel(token);
  if (!label) return token;
  if (!COLLIDING_DISPLAY_LABELS.has(label)) return label;
  const abbrev = getWorkflowModeAbbreviation(token);
  return abbrev ? `${abbrev} \u00B7 ${label}` : label;
}

function formatModeQueryLabel (token, remainderCount) {
  if (typeof token === 'string' && token.startsWith('none:')) {
    const type = token.slice('none:'.length);
    if (remainderCount > 1) return `Unknown (${type})`;
    return 'Unknown';
  }
  return token;
}

/**
 * Summary segments for an export query's type / workflowMode / workflow.
 * A type token is Image / Video / Audio / 3D. A mode abbreviation stays the
 * abbreviation. One remainder token is Unknown; two or more are
 * Unknown (image) and Unknown (video). A leaf uses
 * {@link formatWorkflowQueryLabel}.
 *
 * @param {{ type?: string|string[], workflowMode?: string|string[], workflow?: string|string[] }} [query]
 * @returns {string[]}
 */
export function describeTypeWorkflowQuery (query = {}) {
  const parts = [];
  const types = queryTokens(query.type);
  if (types.length) {
    parts.push(types.map(t => TYPE_QUERY_LABELS[t] || t).join(', '));
  }
  const modes = queryTokens(query.workflowMode);
  if (modes.length) {
    const remainderCount = modes.filter(t => t.startsWith('none:')).length;
    parts.push(modes.map(t => formatModeQueryLabel(t, remainderCount)).join(', '));
  }
  const workflows = queryTokens(query.workflow);
  if (workflows.length) {
    parts.push(workflows.map(id => formatWorkflowQueryLabel(id)).join(', '));
  }
  return parts;
}
