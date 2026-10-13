// Media-page Workflow row. Phrase, optional display-label qualifier, abbreviation
// chip. Name and chip hrefs are generations, posts, or comics. A real origin
// stays on that list. A Models origin uses container preference: non-empty
// generations, else posts, else comics. Imports, no origin, and a Models
// origin with no container leave both unlinked.

import {
  getWorkflowModePhrase,
  getWorkflowModeAbbreviation,
  getWorkflowAbbreviationExpansion,
  getWorkflowDisplayLabel
} from '../../../../src/workflowVocab.mjs';
import { formatUrl } from './url-state.js';

const HREF_VIEWS = new Set(['generations', 'posts', 'comics']);

function hasMembers (containers, key) {
  const list = containers && containers[key];
  return Array.isArray(list) && list.length > 0;
}

// Container preference. A Models list cannot host workflow / workflowMode.
// generation, else post, else comic. Imports is not a destination.
function modelsWorkflowView (containers) {
  if (hasMembers(containers, 'generations')) return 'generations';
  if (hasMembers(containers, 'posts')) return 'posts';
  if (hasMembers(containers, 'comics')) return 'comics';
  return '';
}

function workflowHrefView (originScope, containers) {
  if (HREF_VIEWS.has(originScope)) return originScope;
  if (originScope === 'models') return modelsWorkflowView(containers);
  return '';
}

/**
 * @param {unknown} workflowId
 * @param {string|null|undefined} originScope
 * @param {{ generations?: unknown, posts?: unknown, comics?: unknown }|null|undefined} [containers]
 * @returns {{
 *   id: string,
 *   name: string,
 *   version: string,
 *   typeLabel: string,
 *   typeTitle: string,
 *   href: string,
 *   modeHref: string
 * } | null}
 */
export function workflowSidebarLine (workflowId, originScope, containers) {
  if (typeof workflowId !== 'string') return null;
  const id = workflowId.trim();
  if (!id) return null;

  const phrase = getWorkflowModePhrase(id);
  const name = phrase || id;
  const display = getWorkflowDisplayLabel(id);
  const version = display && display !== name ? display : '';
  const abbreviation = getWorkflowModeAbbreviation(id);
  const typeLabel = abbreviation || '';
  const expansion = getWorkflowAbbreviationExpansion(id);
  const typeTitle = expansion || '';

  const view = workflowHrefView(originScope, containers);
  const href = view
    ? formatUrl({ view, params: { workflow: id } })
    : '';
  const modeHref = href && abbreviation
    ? formatUrl({ view, params: { workflowMode: abbreviation } })
    : '';

  return { id, name, version, typeLabel, typeTitle, href, modeHref };
}

/**
 * First-seen workflow ids across container members, in member order.
 * Blank and non-string values are skipped. `img2img` and `img2img:upscale`
 * are different ids.
 *
 * @param {Array<{ workflow?: unknown }>|null|undefined} members
 * @returns {string[]}
 */
export function unionContainerWorkflows (members) {
  const seen = new Set();
  const ids = [];
  const list = Array.isArray(members) ? members : [];
  for (const member of list) {
    if (typeof member?.workflow !== 'string') continue;
    const id = member.workflow.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

const USED_IN_DOT = ' \u00B7 ';

/**
 * Used in… thumb caption from the consuming generation's workflow id.
 * Abbreviation and display label; the title is the abbreviation expansion.
 *
 * @param {unknown} workflowId
 * @returns {{ caption: string, abbreviation: string, title: string }}
 */
export function usedInCaption (workflowId) {
  if (typeof workflowId !== 'string') {
    return { caption: '', abbreviation: '', title: '' };
  }
  const id = workflowId.trim();
  if (!id) return { caption: '', abbreviation: '', title: '' };

  const abbreviation = getWorkflowModeAbbreviation(id);
  const display = getWorkflowDisplayLabel(id);
  const title = getWorkflowAbbreviationExpansion(id);
  let caption = id;
  if (abbreviation && display) caption = abbreviation + USED_IN_DOT + display;
  else if (abbreviation) caption = abbreviation;

  return { caption, abbreviation, title };
}
