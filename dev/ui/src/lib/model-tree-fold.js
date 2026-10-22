// Display fold for the Models picker. The model-tree payload stays
// type → base model → model → version. A category with one child whose
// count equals the category's count is not its own row: the row text is
// those labels joined with " · ", and the row's term is the deepest node.
// The type root is always a row. Checking a folded row does not become
// the type. A stored model term is not narrowed to its only version.

import { keepAsException, scopeNodeKey, termCoversNode, termDepth } from './scope.js';
import { modelTypeLabel } from './modelTypeDisplay.js';

const DOT = ' \u00B7 ';

function structuralChildren (tree, parent) {
  if (!tree || !parent) return [];
  if (parent.familyOutput && !parent.familyId) {
    const sec = (tree.familySections || []).find(s => s.outputType === parent.familyOutput);
    return (sec?.families || []).map(f => ({ familyOutput: sec.outputType, familyId: f.key }));
  }
  if (parent.familyId) return [];
  if (!parent.type) return [];
  const type = (tree.types || []).find(t => t.key === parent.type);
  if (!type) return [];
  if (!parent.baseModel && !parent.ecosystem) {
    return (type.baseModels || []).map(b => ({ ...parent, baseModel: b.key }));
  }
  if (parent.ecosystem && !parent.baseModel) return [];
  const base = (type.baseModels || []).find(b => b.key === parent.baseModel);
  if (!base) return [];
  if (!parent.modelId && !parent.modelName) {
    return (base.models || []).map(m => (
      m.idKind === 'name'
        ? { ...parent, modelName: m.key }
        : { ...parent, modelId: m.key }
    ));
  }
  const model = (base.models || []).find(m =>
    (parent.modelId && m.idKind !== 'name' && String(m.key) === String(parent.modelId)) ||
    (parent.modelName && m.idKind === 'name' && m.key === parent.modelName)
  );
  if (!model || parent.versionId) return [];
  return (model.versions || []).map(v => ({ ...parent, versionId: v.key }));
}

function structuralNode (tree, term) {
  if (!tree || !term) return null;
  if (term.familyId || term.familyOutput) {
    for (const sec of tree.familySections || []) {
      if (!term.familyId) {
        if (sec.outputType === term.familyOutput) {
          return { key: sec.outputType, label: sec.label, count: sec.count };
        }
        continue;
      }
      const fam = (sec.families || []).find(f => f.key === term.familyId);
      if (fam) return fam;
    }
    return null;
  }
  if (!term.type) return null;
  const type = (tree.types || []).find(t => t.key === term.type);
  if (!type) return null;
  if (!term.baseModel) return type;
  const base = (type.baseModels || []).find(b => b.key === term.baseModel);
  if (!base) return null;
  if (!term.modelId && !term.modelName) return base;
  const model = (base.models || []).find(m =>
    (term.modelId && m.idKind !== 'name' && String(m.key) === String(term.modelId)) ||
    (term.modelName && m.idKind === 'name' && m.key === term.modelName)
  );
  if (!model) return null;
  if (!term.versionId) return model;
  return (model.versions || []).find(v => String(v.key) === String(term.versionId)) || null;
}

function countsEqual (a, b) {
  return a != null && b != null && Number(a.count) === Number(b.count);
}

// A leading segment that repeats the type row is noise. A base model whose
// name differs from the type stays. A row that is only that repeated word
// stays, so a count gap still has a label.
function omitTypeEcho (label, typeLabel) {
  const prefix = `${typeLabel}${DOT}`;
  if (!typeLabel || !label.startsWith(prefix)) return label;
  return label.slice(prefix.length);
}

function finishRow (tree, term, node, labels, kids) {
  return {
    term,
    label: labels.join(DOT),
    count: node?.count,
    key: scopeNodeKey(term),
    children: kids.map(k => foldFrom(tree, k))
  };
}

// Walk from a structural node. One equal-count child is consumed into
// this row. The type root is not passed here. modelDisplayRoots removes a
// first segment equal to the type label from these children.
function foldFrom (tree, start) {
  const labels = [];
  let current = start;
  while (current) {
    const node = structuralNode(tree, current);
    if (!node) {
      return finishRow(tree, current, null, labels.length ? labels : [''], []);
    }
    labels.push(node.label || node.key || '');
    const kids = structuralChildren(tree, current);
    if (kids.length !== 1) return finishRow(tree, current, node, labels, kids);
    const childNode = structuralNode(tree, kids[0]);
    if (!countsEqual(node, childNode)) return finishRow(tree, current, node, labels, kids);
    current = kids[0];
  }
  return finishRow(tree, start, null, labels, []);
}

function familyRoots (tree) {
  const roots = [];
  for (const sec of tree?.familySections || []) {
    const fams = sec.families || [];
    if (fams.length === 1) {
      const term = { familyId: fams[0].key };
      roots.push({
        term,
        label: fams[0].label || fams[0].key,
        count: fams[0].count,
        key: scopeNodeKey(term),
        children: []
      });
    } else if (fams.length > 1) {
      const term = { familyOutput: sec.outputType };
      roots.push({
        term,
        label: sec.label || sec.outputType,
        count: sec.count,
        key: scopeNodeKey(term),
        children: fams.map(f => {
          const child = { familyOutput: sec.outputType, familyId: f.key };
          return {
            term: child,
            label: f.label || f.key,
            count: f.count,
            key: scopeNodeKey(child),
            children: []
          };
        })
      });
    }
  }
  return roots;
}

/** Type rows plus family rows. Children are folded. */
export function modelDisplayRoots (tree) {
  const roots = [];
  for (const type of tree?.types || []) {
    const term = { type: type.key };
    const typeLabel = type.label || type.key;
    roots.push({
      term,
      label: typeLabel,
      count: type.count,
      key: scopeNodeKey(term),
      children: structuralChildren(tree, term).map(k => {
        const row = foldFrom(tree, k);
        return { ...row, label: omitTypeEcho(row.label, typeLabel) };
      })
    });
  }
  roots.push(...familyRoots(tree));
  return roots;
}

function soleFoldedChild (tree, row) {
  const kids = row.children || [];
  if (kids.length !== 1) return false;
  const structural = structuralChildren(tree, row.term);
  if (structural.length !== 1) return false;
  return termDepth(kids[0].term) > termDepth(structural[0]);
}

function covered (terms, term) {
  return (terms || []).some(t => termCoversNode(t, term));
}

function sameTerm (a, b) {
  return termDepth(a) === termDepth(b) && termCoversNode(a, b) && termCoversNode(b, a);
}

function holeCovers (term, rowTerm) {
  return (term?.except || []).some(hole => termCoversNode(hole, rowTerm));
}

function rowExcluded (terms, rowTerm) {
  return (terms || []).some(t => termCoversNode(t, rowTerm) && holeCovers(t, rowTerm));
}

function rowHasHoleBelow (terms, rowTerm) {
  return (terms || []).some(t =>
    termCoversNode(t, rowTerm) &&
    (t.except || []).some(hole => termCoversNode(rowTerm, hole) && !sameTerm(rowTerm, hole))
  );
}

/**
 * Checkbox state of one display row.
 * A type whose only child was folded stays indeterminate when that child
 * is checked. A parent whose children were all checked, and that child
 * was not a fold, is checked. A row covered by an exception is unchecked.
 * A parent of a visible hole is not fully checked.
 */
export function modelRowState (tree, terms, row) {
  if (!row) return 'unchecked';
  if (rowExcluded(terms, row.term)) return 'unchecked';
  if (covered(terms, row.term) && !rowHasHoleBelow(terms, row.term)) return 'checked';
  const kids = row.children || [];
  if (!kids.length) return 'unchecked';
  const states = kids.map(k => modelRowState(tree, terms, k));
  if (!soleFoldedChild(tree, row) && states.every(s => s === 'checked')) return 'checked';
  if (states.some(s => s !== 'unchecked')) return 'indeterminate';
  return 'unchecked';
}

/** Structural coverage. The Mine aggregate still uses this, not the folded row. */
export function modelStructuralState (tree, terms, term) {
  if (rowExcluded(terms, term)) return 'unchecked';
  if (covered(terms, term) && !rowHasHoleBelow(terms, term)) return 'checked';
  const kids = structuralChildren(tree, term);
  if (!kids.length) return 'unchecked';
  const states = kids.map(k => modelStructuralState(tree, terms, k));
  if (states.every(s => s === 'checked')) return 'checked';
  if (states.some(s => s !== 'unchecked')) return 'indeterminate';
  return 'unchecked';
}

function shallowestCovering (terms, term) {
  let best = null;
  let bestDepth = Infinity;
  for (const t of terms || []) {
    if (!termCoversNode(t, term)) continue;
    const d = termDepth(t);
    if (d < bestDepth) {
      best = t;
      bestDepth = d;
    }
  }
  return best;
}

function markCovered (terms, emitted, into) {
  terms.forEach((t, i) => {
    if (termCoversNode(emitted, t) || termCoversNode(t, emitted)) into.add(i);
  });
}

function blockedTerm (term) {
  return !!(term?.mine || (Array.isArray(term?.except) && term.except.length));
}

function redundantPlain (term, blocked) {
  for (const parent of blocked) {
    if (parent?.mine) continue;
    if (!termCoversNode(parent, term)) continue;
    if ((parent.except || []).some(hole => termCoversNode(hole, term))) return false;
    return true;
  }
  return false;
}

/**
 * Compact stored terms to what a check would keep.
 * Does not narrow a model term to a folded version.
 * Does not widen a folded row to its type.
 * A type with one non-folded base still becomes the type when that base
 * is fully checked. An exception-bearing term passes through. A mine term
 * is kept once, at the end.
 */
function compactPlain (tree, terms) {
  if (!tree || !Array.isArray(terms) || !terms.length) return [];
  const coveredIdx = new Set();
  const out = [];
  function visit (row) {
    const state = modelRowState(tree, terms, row);
    if (state === 'checked') {
      const emitted = shallowestCovering(terms, row.term) || row.term;
      out.push(emitted);
      markCovered(terms, emitted, coveredIdx);
      return;
    }
    if (state === 'indeterminate') {
      for (const kid of row.children || []) visit(kid);
    }
  }
  for (const root of modelDisplayRoots(tree)) visit(root);
  terms.forEach((t, i) => { if (!coveredIdx.has(i)) out.push(t); });
  return out;
}

export function compactModelSelection (tree, terms) {
  if (!tree || !Array.isArray(terms) || !terms.length) return terms || [];
  const blocked = terms.filter(blockedTerm);
  const plain = terms.filter(t => !blockedTerm(t) && !redundantPlain(t, blocked));
  const visible = compactPlain(tree, plain).filter(t => !redundantPlain(t, blocked));
  const holes = blocked.filter(t => !t?.mine);
  const mines = blocked.filter(t => t?.mine);
  const mine = mines.length ? mines[mines.length - 1] : null;
  return mine ? [...visible, ...holes, mine] : [...visible, ...holes];
}

function dropOverlap (terms, nodeTerm) {
  return (terms || []).filter(t => !termCoversNode(nodeTerm, t) && !termCoversNode(t, nodeTerm));
}

function explode (covering, unchecked, tree) {
  const coverDepth = termDepth(covering);
  const path = [];
  if (unchecked.type) path.push({ type: unchecked.type });
  if (unchecked.baseModel) {
    path.push({ type: unchecked.type, baseModel: unchecked.baseModel });
  } else if (unchecked.ecosystem) {
    path.push({ type: unchecked.type, ecosystem: unchecked.ecosystem });
  }
  if (unchecked.modelId || unchecked.modelName) {
    path.push({
      type: unchecked.type,
      ...(unchecked.baseModel ? { baseModel: unchecked.baseModel } : {}),
      ...(unchecked.ecosystem ? { ecosystem: unchecked.ecosystem } : {}),
      ...(unchecked.modelId ? { modelId: unchecked.modelId } : { modelName: unchecked.modelName })
    });
  }
  if (unchecked.versionId) {
    path.push({ ...path[path.length - 1], versionId: unchecked.versionId });
  }
  if (unchecked.familyOutput && !unchecked.type) {
    path.push({ familyOutput: unchecked.familyOutput });
    if (unchecked.familyId) {
      path.push({ familyOutput: unchecked.familyOutput, familyId: unchecked.familyId });
    }
  }
  const added = [];
  for (let depth = coverDepth; depth < path.length; depth++) {
    const parent = path[depth - 1];
    const exclude = path[depth];
    if (!parent) continue;
    for (const child of structuralChildren(tree, parent)) {
      if (termCoversNode(child, exclude) && termCoversNode(exclude, child)) continue;
      added.push(child);
    }
  }
  return added;
}

function stripExcept (term) {
  if (!term?.except) return term;
  const next = { ...term };
  delete next.except;
  return next;
}

function exactHole (term, rowTerm) {
  return (term?.except || []).some(hole => sameTerm(hole, rowTerm));
}

function ancestorHole (term, rowTerm) {
  return (term?.except || []).some(hole => termCoversNode(hole, rowTerm) && !sameTerm(hole, rowTerm));
}

function withoutHole (term, rowTerm) {
  const except = (term.except || []).filter(hole => !sameTerm(hole, rowTerm));
  const next = { ...term };
  if (except.length) next.except = except;
  else delete next.except;
  return next;
}

function addHole (term, rowTerm) {
  const except = [...(term.except || [])];
  if (!except.some(hole => sameTerm(hole, rowTerm))) except.push(rowTerm);
  return { ...stripExcept(term), except };
}

function expandOff (tree, terms, rowTerm) {
  const covering = (terms || []).filter(t => !t?.mine && termCoversNode(t, rowTerm));
  if (!covering.length) return (terms || []).filter(t => !termCoversNode(rowTerm, t));
  const next = dropOverlap(terms, rowTerm);
  for (const cov of covering) {
    if (termCoversNode(cov, rowTerm)) next.push(...explode(cov, rowTerm, tree));
  }
  return compactPlain(tree, next);
}

function inclusionTerms (tree, parent, holes) {
  let next = [stripExcept(parent)];
  for (const hole of holes || []) next = expandOff(tree, next, hole);
  return next;
}

/** Check or uncheck a display-row term. Result is already compact. */
export function toggleModelRow (tree, terms, rowTerm, turnOn) {
  if (!rowTerm) return terms || [];
  const src = terms || [];
  if (turnOn) {
    if (src.some(t => exactHole(t, rowTerm))) {
      return src.map(t => exactHole(t, rowTerm) ? withoutHole(t, rowTerm) : t);
    }
    if (src.some(t => ancestorHole(t, rowTerm))) {
      return compactModelSelection(tree, src.concat([rowTerm]));
    }
    const next = dropOverlap(src, rowTerm);
    next.push(rowTerm);
    return compactModelSelection(tree, next);
  }
  const covering = src.filter(t => !t?.mine && termCoversNode(t, rowTerm) && !holeCovers(t, rowTerm));
  if (!covering.length) {
    return compactModelSelection(tree, src.filter(t => !termCoversNode(rowTerm, t)));
  }
  const holder = covering.reduce((best, t) => (termDepth(t) < termDepth(best) ? t : best));
  if (sameTerm(holder, rowTerm)) {
    return compactModelSelection(tree, src.filter(t => !termCoversNode(rowTerm, t)));
  }
  const punched = addHole(holder, rowTerm);
  const listed = inclusionTerms(tree, holder, punched.except);
  if (keepAsException(punched.except.length, listed.length)) {
    const next = src.map(t => (t === holder ? punched : t));
    return compactModelSelection(tree, next);
  }
  const kept = src.filter(t => t !== holder && !termCoversNode(holder, t) && !termCoversNode(t, holder));
  return compactModelSelection(tree, [...kept, ...listed]);
}

function termSteps (term) {
  const steps = [{ type: term.type, baseModel: term.baseModel }];
  if (term.modelId || term.modelName) {
    steps.push({
      type: term.type,
      baseModel: term.baseModel,
      ...(term.modelId ? { modelId: term.modelId } : { modelName: term.modelName })
    });
  }
  if (term.versionId) steps.push({ ...steps[steps.length - 1], versionId: term.versionId });
  return steps;
}

/**
 * Joined label for a stored term. Empty unless each step of that term is
 * the sole equal-count child of the previous step. Missing counts do not join.
 * A version that still has a sibling stays on the slash path.
 */
export function modelChoiceLabel (term, tree) {
  if (!tree || !term?.type || !term.baseModel) return '';
  const steps = termSteps(term);
  const labels = [];
  for (let i = 0; i < steps.length; i++) {
    const node = structuralNode(tree, steps[i]);
    if (!node || node.count == null) return '';
    labels.push(node.label || node.key || '');
    if (i === steps.length - 1) break;
    const kids = structuralChildren(tree, steps[i]);
    if (kids.length !== 1) return '';
    const childNode = structuralNode(tree, kids[0]);
    if (!countsEqual(node, childNode) || !sameTerm(kids[0], steps[i + 1])) return '';
  }
  const typeNode = structuralNode(tree, { type: term.type });
  const typeLabel = typeNode?.label || typeNode?.key || '';
  const joined = labels.join(DOT);
  const shortened = omitTypeEcho(joined, typeLabel);
  if (shortened === joined && labels.length < 2) return '';
  return shortened;
}

function pathLabel (term, tree) {
  if (term?.familyId || term?.familyOutput) {
    const n = structuralNode(tree, term);
    if (term.familyId) return n?.label || term.familyId;
    return n?.label || term.familyOutput;
  }
  const parts = [];
  if (term?.type) {
    const n = structuralNode(tree, { type: term.type });
    parts.push(n?.label || modelTypeLabel(term.type) || term.type);
  }
  if (term?.baseModel) {
    const n = structuralNode(tree, { type: term.type, baseModel: term.baseModel });
    parts.push(n?.label || term.baseModel);
  } else if (term?.ecosystem) {
    parts.push(term.ecosystem);
  }
  if (term?.modelId || term?.modelName) {
    const n = structuralNode(tree, term);
    parts.push(n?.label || term.modelName || `Model ${term.modelId}`);
  }
  if (term?.versionId) {
    const n = structuralNode(tree, term);
    parts.push(n?.label || `Version ${term.versionId}`);
  }
  return parts.join(' / ') || 'Selection';
}

/** Picker chip. The join when this term is a folded row; otherwise the slash path. */
export function modelChipLabel (term, tree) {
  return modelChoiceLabel(term, tree) || pathLabel(term, tree);
}

/** Mine uncheck of a version-shaped row. Drops versionId when modelId is set. */
export function modelTermForOwnUncheck (term) {
  if (!term || term.modelId == null || term.modelId === '') return term;
  if (term.versionId == null || term.versionId === '') return term;
  const next = { ...term };
  delete next.versionId;
  return next;
}

/** Search. A joined segment or a descendant label matches. The type key matches too. */
export function modelRowMatches (row, q) {
  if (!q) return true;
  const needle = String(q).trim().toLowerCase();
  if (!needle) return true;
  if (row?.label && row.label.toLowerCase().includes(needle)) return true;
  if (row?.term?.type && String(row.term.type).toLowerCase().includes(needle)) return true;
  return (row?.children || []).some(k => modelRowMatches(k, needle));
}
