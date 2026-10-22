// Media Type row text. The tree payload label stays the display label.
// A mode row is the abbreviation. A lone workflow under a type combines
// the abbreviation and the display label. A child under a mode is the
// display label alone.

import {
  WORKFLOW_ABBREVIATION_EXPANSIONS,
  formatWorkflowQueryLabel,
  getWorkflowAbbreviationExpansion,
  getWorkflowDisplayLabel,
  getWorkflowModeAbbreviation
} from '../../../../src/workflowVocab.mjs';

const DOT = ' \u00B7 ';

function parts (abbreviation, expansion, label) {
  return {
    abbreviation: abbreviation || '',
    expansion: expansion || '',
    label: label || ''
  };
}

/**
 * @param {{ kind?: string, key?: string, label?: string, title?: string }|null|undefined} node
 * @param {number} depth
 * @returns {{ abbreviation: string, expansion: string, label: string }}
 */
export function typeWorkflowRowParts (node, depth) {
  if (!node) return parts('', '', '');
  if (node.kind === 'mode') {
    return parts(node.label, node.title, '');
  }
  if (node.kind === 'workflow' && depth === 1) {
    const abbreviation = getWorkflowModeAbbreviation(node.key);
    if (abbreviation) {
      return parts(abbreviation, getWorkflowAbbreviationExpansion(node.key), node.label);
    }
  }
  return parts('', '', node.label);
}

/**
 * Bookmark extra in the Media Type panel.
 * A workflow id shows the abbreviation only when the export summary
 * already prefixes a shared display label. A mode abbreviation token
 * is the abbreviation. Anything else stays the raw token.
 *
 * @param {string} token
 * @param {{ workflow?: boolean }} [opts]
 * @returns {{ abbreviation: string, expansion: string, label: string }}
 */
export function filterExtraParts (token, { workflow = false } = {}) {
  const value = token == null ? '' : String(token);
  if (workflow) {
    const label = getWorkflowDisplayLabel(value) || value;
    const abbreviation = getWorkflowModeAbbreviation(value);
    const formatted = formatWorkflowQueryLabel(value);
    if (abbreviation && formatted === `${abbreviation}${DOT}${label}`) {
      return parts(abbreviation, getWorkflowAbbreviationExpansion(value), label);
    }
    return parts('', '', formatted || value);
  }
  const expansion = WORKFLOW_ABBREVIATION_EXPANSIONS[value] || '';
  if (expansion) return parts(value, expansion, '');
  return parts('', '', value);
}
