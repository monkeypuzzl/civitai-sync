// The line under an export's name. Same labels as the filter controls.
// Computed when the list or the editor draws. Not stored on the export.
//
// Models (including Mine) join with " or ". Other multi-selects keep the
// comma those controls already use. Filters join with " · ".
// A Models choice is the checked row. A version is "{model} / {version}".
// A shared label in that segment gains the nearest parent.

import { tagLabel } from './format.js';
import { formatDateRange } from './date-label.js';
import { modelTypeLabel } from './modelTypeDisplay.js';
import { PUBLICATION_LABELS, USED_AS_INPUT_FACET } from './publication.js';
import { parseModels, stringLiftQuery } from '../../../../src/modelsQuery.mjs';
import { describeTypeWorkflowQuery } from '../../../../src/workflowVocab.mjs';
import { aspectTokenLabel } from '../../../../src/mediaAspect.mjs';
import { getEcosystemDisplayName } from '../../../../src/ecosystemDisplay.mjs';
import { getModelFamily, sectionLabel } from '../../../../src/modelFamily.mjs';
import { modelChipGroups } from './model-chip-groups.js';

const MID = ' \u00B7 ';
const OR = ' or ';
const SLASH = ' / ';

function termHasId (term) {
  if (!term) return false;
  if (term.modelId != null && term.modelId !== '') return true;
  if (term.versionId != null && term.versionId !== '') return true;
  return (term.except || []).some(termHasId);
}

/** True when the models string carries a model id or a version id. A name term is already the label. */
export function scopeNeedsNames (value) {
  const s = value == null ? '' : String(value);
  if (/(?:^|[~/])m\./.test(s) || /(?:^|[~/])v\./.test(s)) return true;
  if (/(?:^|[,/])model\./.test(s) || /(?:^|[,/])version\./.test(s)) return true;
  return parseModels(s).some(termHasId);
}

/** Id → label index from a `GET /api/facets/model-tree` payload. */
export function scopeNamesFromTree (tree) {
  const modelById = {};
  const modelByName = {};
  const versionById = {};
  for (const type of tree?.types || []) {
    for (const base of type.baseModels || []) {
      for (const model of base.models || []) {
        if (model?.key == null || model.key === '') continue;
        const rec = { label: model.label || String(model.key) };
        if (model.idKind === 'name') modelByName[String(model.key)] = rec;
        else modelById[String(model.key)] = rec;
        for (const version of model.versions || []) {
          if (version?.key == null || version.key === '') continue;
          versionById[String(version.key)] = {
            label: version.label || `Version ${version.key}`,
            modelLabel: rec.label
          };
        }
      }
    }
  }
  return { modelById, modelByName, versionById };
}

function csv (value) {
  if (value == null || value === '') return [];
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

function modelLabelOf (term, names) {
  const id = term.modelId != null && term.modelId !== '' ? String(term.modelId) : '';
  if (id && names?.modelById?.[id]?.label) return names.modelById[id].label;
  const byName = term.modelName ? names?.modelByName?.[term.modelName] : null;
  if (byName?.label) return byName.label;
  const verId = term.versionId != null && term.versionId !== '' ? String(term.versionId) : '';
  const ver = verId ? names?.versionById?.[verId] : null;
  if (ver?.modelLabel) return ver.modelLabel;
  if (term.modelName) return String(term.modelName);
  if (id) return `Model ${id}`;
  return '';
}

function versionLabelOf (term, names) {
  if (term.versionId == null || term.versionId === '') return '';
  const hit = names?.versionById?.[String(term.versionId)];
  if (hit?.label) return hit.label;
  return `Version ${term.versionId}`;
}

function termPresentation (term, names) {
  if (term?.familyId) {
    const fam = getModelFamily(String(term.familyId));
    const text = fam?.label || String(term.familyId);
    return { text, ancestors: [] };
  }
  if (term?.familyOutput) {
    return { text: sectionLabel(term.familyOutput) || String(term.familyOutput), ancestors: [] };
  }
  const chain = [];
  if (term.type) chain.push(modelTypeLabel(term.type) || String(term.type));
  if (term.baseModel) chain.push(String(term.baseModel));
  else if (term.ecosystem) {
    const eco = getEcosystemDisplayName(term.ecosystem) || String(term.ecosystem);
    if (eco) chain.push(eco);
  }
  const modelLabel = modelLabelOf(term, names);
  const versionLabel = versionLabelOf(term, names);
  if (modelLabel) chain.push(modelLabel);
  if (versionLabel) chain.push(versionLabel);
  if (!chain.length) return null;
  if (versionLabel && chain.length >= 2) {
    return {
      text: `${chain[chain.length - 2]}${SLASH}${chain[chain.length - 1]}`,
      ancestors: chain.slice(0, -2).reverse()
    };
  }
  return {
    text: chain[chain.length - 1],
    ancestors: chain.slice(0, -1).reverse()
  };
}

function disambiguate (items) {
  const counts = new Map();
  for (const item of items) {
    if (!item?.text) continue;
    counts.set(item.text, (counts.get(item.text) || 0) + 1);
  }
  const out = [];
  for (const item of items) {
    if (!item?.text) continue;
    if ((counts.get(item.text) || 0) < 2) {
      out.push(item.text);
      continue;
    }
    let text = item.text;
    for (const ancestor of item.ancestors || []) {
      if (!ancestor || text === ancestor || text.startsWith(`${ancestor}${SLASH}`)) continue;
      text = `${ancestor}${SLASH}${text}`;
      break;
    }
    out.push(text);
  }
  return out;
}

function joinAnd (names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function groupSentence (groups) {
  const parts = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (group.kind === 'except') continue;
    if (group.kind === 'cluster') {
      parts.push(`${group.parentLabel} (${group.count})`);
      continue;
    }
    const holes = [];
    for (let n = i + 1; n < groups.length && groups[n].kind === 'except'; n++) {
      holes.push(groups[n].name || group.text);
    }
    parts.push(holes.length ? `${group.text} except ${joinAnd(holes)}` : group.text);
  }
  return parts.join(OR);
}

function modelsSegment (query, names, tree) {
  const terms = parseModels(stringLiftQuery(query).models);
  if (!terms.length) return '';
  const hasExcept = terms.some(term => (term.except || []).length);
  if (!tree && !hasExcept && terms.length > 3) return `Models (${terms.length})`;
  if (tree || hasExcept) return groupSentence(modelChipGroups(tree, terms));
  const items = [];
  for (const term of terms) {
    if (term.mine) {
      items.push({ text: 'Mine', ancestors: [] });
      continue;
    }
    const presented = termPresentation(term, names);
    if (presented) items.push(presented);
  }
  return disambiguate(items).join(OR);
}

function boundPresent (value) {
  return value != null && value !== '';
}

function rangeSegment (label, min, max) {
  if (!boundPresent(min) && !boundPresent(max)) return '';
  return `${label} ${boundPresent(min) ? min : ''}\u2013${boundPresent(max) ? max : ''}`;
}

/**
 * One-line summary of an export filter.
 * @param {object} [query] Protocol form (comma strings). Mine is a `models` term.
 * @param {{ modelById?: object, modelByName?: object, versionById?: object }|null} [names]
 * @param {object|null} [tree] Model-tree payload. A folded row uses its joined label. Names alone keep the last-segment line.
 */
export function describeQuery (query = {}, names = null, tree = null) {
  const parts = [];
  const reactions = csv(query.reaction);
  if (reactions.length) parts.push(reactions.map(tagLabel).join(', '));
  const tags = csv(query.tag);
  if (tags.length) parts.push(tags.map(tagLabel).join(', '));
  for (const segment of describeTypeWorkflowQuery(query)) {
    if (segment) parts.push(segment);
  }
  const aspects = csv(query.aspect);
  if (aspects.length) parts.push(aspects.map(aspectTokenLabel).join(', '));
  const models = modelsSegment(query, names, tree);
  if (models) parts.push(models);
  const range = formatDateRange(query.dateFrom, query.dateTo);
  if (range) parts.push(range);
  const cfg = rangeSegment('CFG', query.cfgMin, query.cfgMax);
  if (cfg) parts.push(cfg);
  const steps = rangeSegment('Steps', query.stepsMin, query.stepsMax);
  if (steps) parts.push(steps);
  const pubs = csv(query.publication);
  if (pubs.length) parts.push(pubs.map(t => PUBLICATION_LABELS[t] || t).join(', '));
  if (query.usedAsInput === '1' || query.usedAsInput === true) parts.push(USED_AS_INPUT_FACET.label);
  if (query.q) parts.push(`\u201C${query.q}\u201D`);
  return parts.length ? parts.join(MID) : 'All media';
}
