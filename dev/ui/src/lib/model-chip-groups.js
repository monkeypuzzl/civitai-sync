// Display groups for a models= term list. One inclusion, one except per
// hole, or one cluster when four or more siblings are hand-picked.
// No Preact. The header, the Models row, and the export sentence share this.

import { termCoversNode, termDepth } from './scope.js';
import {
  modelChipLabel,
  modelDisplayRoots,
  modelRowState
} from './model-tree-fold.js';

function sameTerm (a, b) {
  return !!a && !!b && termDepth(a) === termDepth(b) && termCoversNode(a, b) && termCoversNode(b, a);
}

function pathTail (term, tree) {
  const path = modelChipLabel(term, tree);
  const parts = String(path).split(' / ');
  return parts[parts.length - 1] || path;
}

function rowLabel (tree, term) {
  if (!tree || !term) return pathTail(term, tree);
  let found = '';
  function visit (row) {
    if (found || !row) return;
    if (row.term && sameTerm(row.term, term)) {
      found = row.label || '';
      return;
    }
    for (const kid of row.children || []) visit(kid);
  }
  for (const root of modelDisplayRoots(tree)) visit(root);
  return found || pathTail(term, tree);
}

function includeGroup (term, index, tree) {
  const text = term?.mine ? 'Mine' : modelChipLabel(term, tree);
  const title = term?.mine ? 'My models' : 'Models';
  return {
    kind: 'include',
    text,
    title,
    ariaLabel: `Remove ${title}`,
    termIndexes: [index]
  };
}

function exceptGroup (hole, index, exceptIndex, tree) {
  const name = rowLabel(tree, hole);
  return {
    kind: 'except',
    text: `except ${name}`,
    name,
    title: `Not included: ${name}`,
    ariaLabel: `Include ${name}`,
    termIndexes: [index],
    exceptIndex
  };
}

function kindOf (members) {
  if (members.length && members.every(term => term?.versionId)) return 'versions';
  if (members.length && members.every(term => term?.modelId || term?.modelName)) return 'models';
  if (members.length && members.every(term => (term?.baseModel || term?.ecosystem) && !term?.modelId && !term?.modelName)) {
    return 'base models';
  }
  return 'selections';
}

function clusterGroup (row, members, terms) {
  const n = members.length;
  const parent = row?.label || 'Models';
  const kind = kindOf(members.map(index => terms[index]));
  return {
    kind: 'cluster',
    text: `${parent} \u00B7 ${n}`,
    parentLabel: parent,
    count: n,
    title: `${n} ${kind} under ${parent}`,
    ariaLabel: `Remove ${n} ${kind} under ${parent}`,
    termIndexes: members.slice()
  };
}

function coveringIndex (entries, rowTerm) {
  let best = -1;
  let depth = Infinity;
  for (const entry of entries) {
    if (!termCoversNode(entry.term, rowTerm)) continue;
    if ((entry.term.except || []).some(hole => termCoversNode(hole, rowTerm))) continue;
    const d = termDepth(entry.term);
    if (d < depth) {
      depth = d;
      best = entry.index;
    }
  }
  return best;
}

function shadowed (terms, index) {
  const term = terms[index];
  if (!term || term.mine) return false;
  return terms.some((other, i) => {
    if (i === index || !other || other.mine) return false;
    if (!(termDepth(other) < termDepth(term))) return false;
    if (!termCoversNode(other, term)) return false;
    if ((other.except || []).some(hole => termCoversNode(hole, term))) return false;
    return true;
  });
}

function collectClusters (row, entries, tree, structural, clusters) {
  if (modelRowState(tree, structural, row) !== 'indeterminate') return;
  const direct = [];
  for (const kid of row.children || []) {
    const state = modelRowState(tree, structural, kid);
    if (state === 'checked') {
      const idx = coveringIndex(entries, kid.term);
      if (idx >= 0 && !direct.includes(idx)) direct.push(idx);
    } else if (state === 'indeterminate') {
      collectClusters(kid, entries, tree, structural, clusters);
    }
  }
  if (direct.length >= 4) clusters.push({ row, members: direct });
}

function flatGroups (terms) {
  const out = [];
  terms.forEach((term, index) => {
    out.push(includeGroup(term, index, null));
    (term.except || []).forEach((hole, n) => out.push(exceptGroup(hole, index, n, null)));
  });
  return out;
}

/**
 * @param {object|null|undefined} tree
 * @param {object[]} terms Parsed models terms, mine included.
 * @returns {{ kind: string, text: string, title: string, ariaLabel: string, termIndexes: number[], exceptIndex?: number, name?: string, parentLabel?: string, count?: number }[]}
 */
export function modelChipGroups (tree, terms) {
  const src = Array.isArray(terms) ? terms : [];
  if (!src.length) return [];
  if (!tree) return flatGroups(src);
  const entries = [];
  src.forEach((term, index) => {
    if (!term?.mine) entries.push({ term, index });
  });
  const structural = entries.map(entry => entry.term);
  const clusters = [];
  for (const root of modelDisplayRoots(tree)) collectClusters(root, entries, tree, structural, clusters);
  const memberOf = new Map();
  for (const cluster of clusters) {
    for (const index of cluster.members) memberOf.set(index, cluster);
  }
  const seen = new Set();
  const out = [];
  src.forEach((term, index) => {
    if (term?.mine) {
      out.push(includeGroup(term, index, tree));
      (term.except || []).forEach((hole, n) => out.push(exceptGroup(hole, index, n, tree)));
      return;
    }
    const cluster = memberOf.get(index);
    if (cluster) {
      if (seen.has(cluster)) return;
      seen.add(cluster);
      out.push(clusterGroup(cluster.row, cluster.members, src));
      return;
    }
    if (shadowed(src, index)) return;
    out.push(includeGroup(term, index, tree));
    (term.except || []).forEach((hole, n) => out.push(exceptGroup(hole, index, n, tree)));
  });
  return out;
}

/** Terms after dismissing one display group. */
export function dropModelGroup (terms, group) {
  const src = Array.isArray(terms) ? terms : [];
  if (!group) return src.slice();
  if (group.kind === 'except') {
    const index = group.termIndexes?.[0];
    return src.map((term, i) => {
      if (i !== index) return term;
      const except = (term.except || []).filter((_, n) => n !== group.exceptIndex);
      const next = { ...term };
      if (except.length) next.except = except;
      else delete next.except;
      return next;
    });
  }
  const drop = new Set(group.termIndexes || []);
  return src.filter((_, i) => !drop.has(i));
}
