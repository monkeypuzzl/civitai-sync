// Offered media-workflow family for one canonical params.workflow token.
// Imports workflowVocab only. No token tables — phrase, category, and
// abbreviation come from the frozen maps.

import {
  getWorkflowCategory,
  getWorkflowModeAbbreviation,
  getWorkflowModePhrase
} from './workflowVocab.mjs';

export const WORKFLOW_REMAINDER_PREFIX = 'none';

const OFFERED_CATEGORIES = new Set(['image', 'video', 'audio', 'model3d']);

/**
 * `none:<type>` is a workflowMode value (the Unknown row). It is never a
 * workflow= identifier.
 *
 * @param {string|null|undefined} type
 * @returns {string}
 */
export function remainderTokenFor (type) {
  if (!type || typeof type !== 'string') return '';
  return `${WORKFLOW_REMAINDER_PREFIX}:${type}`;
}

/**
 * @param {string|null|undefined} token
 * @returns {boolean}
 */
export function isWorkflowRemainderToken (token) {
  if (!token || typeof token !== 'string') return false;
  const prefix = `${WORKFLOW_REMAINDER_PREFIX}:`;
  if (!token.startsWith(prefix)) return false;
  const rest = token.slice(prefix.length);
  return rest.length > 0 && !rest.includes(':');
}

/**
 * Gallery type inside a remainder token, or ''.
 *
 * @param {string|null|undefined} token
 * @returns {string}
 */
export function remainderTypeOf (token) {
  if (!isWorkflowRemainderToken(token)) return '';
  return token.slice(WORKFLOW_REMAINDER_PREFIX.length + 1);
}

/**
 * @param {string|null|undefined} id
 * @returns {boolean}
 */
export function isOfferedMediaWorkflow (id) {
  return parseWorkflowFamily(id).offered;
}

/**
 * Parse one stored workflow identifier.
 *
 * `offered` is a non-empty mode phrase and a category of image, video,
 * audio, or model3d. That drops `prompt:enhance`, `img2meta`, and an
 * engine-prefixed string. `txt2model3d` / `img2model3d` are offered.
 * `vid2vid` is offered: the phrase is set and the
 * category is the shared category of the `vid2vid:*` identity rows.
 * `abbreviation` is set only when offered.
 *
 * @param {string|null|undefined} id
 * @returns {{ mode: string, suffix: string, category: string, abbreviation: string, offered: boolean }}
 */
export function parseWorkflowFamily (id) {
  if (!id || typeof id !== 'string') {
    return { mode: '', suffix: '', category: '', abbreviation: '', offered: false };
  }
  const colon = id.indexOf(':');
  const mode = colon === -1 ? id : id.slice(0, colon);
  const suffix = colon === -1 ? '' : id.slice(colon + 1);
  const category = getWorkflowCategory(id);
  const offered = getWorkflowModePhrase(id) !== '' && OFFERED_CATEGORIES.has(category);
  const abbreviation = offered ? (getWorkflowModeAbbreviation(id) || '') : '';
  return { mode, suffix, category, abbreviation, offered };
}
