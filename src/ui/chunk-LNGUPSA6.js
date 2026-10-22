import {
  modelTypeLabel
} from "./chunk-XQGXV6CL.js";

// dev/ui/src/lib/publication.js
var PUBLICATION_OPTIONS = ["published", "scheduled", "draft", "unposted"];
var PUBLICATION_LABELS = {
  published: "Published",
  scheduled: "Scheduled",
  draft: "Draft",
  unposted: "Not in a post or comic"
};
var MODEL3D_PUBLICATION_LABELS = {
  published: "Published",
  draft: "Draft",
  unpublished: "Unpublished"
};
function publicationFacet({ unposted = true } = {}) {
  const options = unposted ? PUBLICATION_OPTIONS : PUBLICATION_OPTIONS.filter((t) => t !== "unposted");
  return { key: "publication", kind: "chips", label: "Publication", options, optionLabels: PUBLICATION_LABELS };
}
var PUBLICATION_FACET = publicationFacet();
var USED_AS_INPUT_FACET = {
  key: "usedAsInput",
  kind: "flag",
  label: "Used as Input"
};
function publicationFromInPost(inPost) {
  if (inPost === true) return ["published", "scheduled", "draft"];
  if (inPost === false) return ["unposted"];
  return [];
}
function effectivePublication(publication, inPost) {
  if (Array.isArray(publication) && publication.length) return publication;
  return publicationFromInPost(inPost);
}
function publicationFromStatus(raw) {
  if (raw == null || raw === "") return [];
  return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
}

// dev/ui/src/lib/date-label.js
var MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];
var EN = "\u2013";
var ELLIPSIS = "\u2026";
function lastUtcDay(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function parseIsoDate(raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return null;
  const last = lastUtcDay(y, mo);
  if (d < 1 || d > last) return null;
  return { y, mo, d, iso: m[0] };
}
function monthName(mo) {
  return MONTHS[mo - 1];
}
function point(p) {
  return `${p.d} ${monthName(p.mo)} ${p.y}`;
}
function dayMonth(p) {
  return `${p.d} ${monthName(p.mo)}`;
}
function sideText(raw, parsed) {
  return parsed ? point(parsed) : raw;
}
function formatMonthSpan(from, to) {
  if (from.mo === 1 && to.mo === 12) {
    if (from.y === to.y) return String(from.y);
    return `${from.y} ${EN} ${to.y}`;
  }
  const fromMon = monthName(from.mo);
  const toMon = monthName(to.mo);
  if (from.y === to.y && from.mo === to.mo) return `${fromMon} ${from.y}`;
  if (from.y === to.y) return `${fromMon} ${EN} ${toMon} ${from.y}`;
  return `${fromMon} ${from.y} ${EN} ${toMon} ${to.y}`;
}
function formatDateRange(dateFrom, dateTo) {
  const fromRaw = String(dateFrom || "").trim();
  const toRaw = String(dateTo || "").trim();
  if (!fromRaw && !toRaw) return "";
  const from = fromRaw ? parseIsoDate(fromRaw) : null;
  const to = toRaw ? parseIsoDate(toRaw) : null;
  if (!fromRaw) return `${ELLIPSIS} ${EN} ${sideText(toRaw, to)}`;
  if (!toRaw) return `${sideText(fromRaw, from)} ${EN} ${ELLIPSIS}`;
  if (!from || !to || from.iso > to.iso) {
    return `${sideText(fromRaw, from)} ${EN} ${sideText(toRaw, to)}`;
  }
  if (from.iso === to.iso) return point(from);
  if (from.d === 1 && to.d === lastUtcDay(to.y, to.mo)) return formatMonthSpan(from, to);
  if (from.y === to.y && from.mo === to.mo) {
    return `${from.d}${EN}${to.d} ${monthName(from.mo)} ${from.y}`;
  }
  if (from.y === to.y) return `${dayMonth(from)} ${EN} ${dayMonth(to)} ${from.y}`;
  return `${point(from)} ${EN} ${point(to)}`;
}

// dev/ui/src/lib/scope.js
var SERIALIZE_ORDER = ["type", "baseModel", "ecosystem", "modelId", "modelName", "versionId", "familyOutput", "familyId", "variant"];
function termDepth(term) {
  if (!term) return 0;
  if (term.versionId) return 4;
  if (term.modelId || term.modelName) return 3;
  if (term.baseModel || term.ecosystem || term.familyId) return 2;
  if (term.type || term.familyOutput) return 1;
  return 0;
}
function termCoversNode(term, node) {
  if (!term || !node) return false;
  for (const k of SERIALIZE_ORDER) {
    if (term[k] == null || term[k] === "") continue;
    if (String(node[k] ?? "") !== String(term[k])) return false;
  }
  return termDepth(term) <= termDepth(node);
}
var FLAT_TAXONOMY_KEYS = [
  "model",
  "version",
  "ecosystem",
  "resourceType",
  "resource",
  "versionId",
  "baseModel"
];
function asCsvList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value == null || value === "") return [];
  return String(value).split(",").map((s) => s.trim()).filter(Boolean);
}
function hasFlatTaxonomy(state) {
  if (!state) return false;
  return FLAT_TAXONOMY_KEYS.some((k) => asCsvList(state[k]).length > 0);
}
function clearedFlatTaxonomy() {
  return {
    model: [],
    version: [],
    ecosystem: [],
    resourceType: [],
    resource: [],
    versionId: [],
    baseModel: []
  };
}
function scopeNodeKey(term) {
  if (!term) return "";
  if (term.familyOutput || term.familyId) {
    const familyParts = [];
    if (term.familyOutput) familyParts.push(`o:${term.familyOutput}`);
    if (term.familyId) familyParts.push(`f:${term.familyId}`);
    return familyParts.join("/");
  }
  const parts = [`t:${term.type || ""}`];
  if (term.baseModel) parts.push(`b:${term.baseModel}`);
  if (term.ecosystem) parts.push(`e:${term.ecosystem}`);
  if (term.modelId) parts.push(`m:${term.modelId}`);
  else if (term.modelName) parts.push(`mn:${term.modelName}`);
  if (term.versionId) parts.push(`v:${term.versionId}`);
  return parts.join("/");
}
function ancestorExpandKeys(term) {
  if (term?.familyId && term?.familyOutput) {
    return [scopeNodeKey({ familyOutput: term.familyOutput })];
  }
  if (!term?.type) return [];
  const keys = [scopeNodeKey({ type: term.type })];
  if (term.baseModel) {
    keys.push(scopeNodeKey({ type: term.type, baseModel: term.baseModel }));
  } else if (term.ecosystem) {
    keys.push(scopeNodeKey({ type: term.type, ecosystem: term.ecosystem }));
  }
  return keys;
}
function keepAsException(holes, remainder) {
  return holes >= 1 && holes <= 3 && remainder > 3;
}
function ownedTerm(node) {
  return {
    type: node.type,
    baseModel: node.baseModel,
    modelId: String(node.modelId)
  };
}
function narrowOwnSelection({ mine, terms, ownedNodes, unchecked } = {}) {
  const current = Array.isArray(terms) ? terms : [];
  if (!mine) return { mine: false, terms: current };
  const owned = Array.isArray(ownedNodes) ? ownedNodes : [];
  const ownedIds = new Set(owned.map((n) => String(n.modelId)));
  const dropId = unchecked?.modelId != null ? String(unchecked.modelId) : "";
  const kept = current.filter((t) => !t?.mine && !(t?.modelId && ownedIds.has(String(t.modelId))));
  const prior = current.filter((t) => t?.mine);
  const seen = /* @__PURE__ */ new Set();
  const holes = [];
  for (const hole of prior.length ? prior[prior.length - 1].except || [] : []) {
    const id = hole?.modelId != null ? String(hole.modelId) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    holes.push(hole);
  }
  if (dropId && !seen.has(dropId)) {
    seen.add(dropId);
    holes.push(unchecked?.type ? ownedTerm(unchecked) : { modelId: dropId });
  }
  const remaining = owned.filter((n) => !seen.has(String(n.modelId)));
  if (keepAsException(holes.length, remaining.length)) {
    return { mine: true, terms: [...kept, { mine: true, except: holes }] };
  }
  const next = kept.slice();
  for (const node of remaining) next.push(ownedTerm(node));
  return { mine: false, terms: next };
}

// dev/ui/src/lib/model-tree-fold.js
var DOT = " \xB7 ";
function structuralChildren(tree, parent) {
  if (!tree || !parent) return [];
  if (parent.familyOutput && !parent.familyId) {
    const sec = (tree.familySections || []).find((s) => s.outputType === parent.familyOutput);
    return (sec?.families || []).map((f) => ({ familyOutput: sec.outputType, familyId: f.key }));
  }
  if (parent.familyId) return [];
  if (!parent.type) return [];
  const type = (tree.types || []).find((t) => t.key === parent.type);
  if (!type) return [];
  if (!parent.baseModel && !parent.ecosystem) {
    return (type.baseModels || []).map((b) => ({ ...parent, baseModel: b.key }));
  }
  if (parent.ecosystem && !parent.baseModel) return [];
  const base = (type.baseModels || []).find((b) => b.key === parent.baseModel);
  if (!base) return [];
  if (!parent.modelId && !parent.modelName) {
    return (base.models || []).map((m) => m.idKind === "name" ? { ...parent, modelName: m.key } : { ...parent, modelId: m.key });
  }
  const model = (base.models || []).find(
    (m) => parent.modelId && m.idKind !== "name" && String(m.key) === String(parent.modelId) || parent.modelName && m.idKind === "name" && m.key === parent.modelName
  );
  if (!model || parent.versionId) return [];
  return (model.versions || []).map((v) => ({ ...parent, versionId: v.key }));
}
function structuralNode(tree, term) {
  if (!tree || !term) return null;
  if (term.familyId || term.familyOutput) {
    for (const sec of tree.familySections || []) {
      if (!term.familyId) {
        if (sec.outputType === term.familyOutput) {
          return { key: sec.outputType, label: sec.label, count: sec.count };
        }
        continue;
      }
      const fam = (sec.families || []).find((f) => f.key === term.familyId);
      if (fam) return fam;
    }
    return null;
  }
  if (!term.type) return null;
  const type = (tree.types || []).find((t) => t.key === term.type);
  if (!type) return null;
  if (!term.baseModel) return type;
  const base = (type.baseModels || []).find((b) => b.key === term.baseModel);
  if (!base) return null;
  if (!term.modelId && !term.modelName) return base;
  const model = (base.models || []).find(
    (m) => term.modelId && m.idKind !== "name" && String(m.key) === String(term.modelId) || term.modelName && m.idKind === "name" && m.key === term.modelName
  );
  if (!model) return null;
  if (!term.versionId) return model;
  return (model.versions || []).find((v) => String(v.key) === String(term.versionId)) || null;
}
function countsEqual(a, b) {
  return a != null && b != null && Number(a.count) === Number(b.count);
}
function omitTypeEcho(label, typeLabel) {
  const prefix = `${typeLabel}${DOT}`;
  if (!typeLabel || !label.startsWith(prefix)) return label;
  return label.slice(prefix.length);
}
function finishRow(tree, term, node, labels, kids) {
  return {
    term,
    label: labels.join(DOT),
    count: node?.count,
    key: scopeNodeKey(term),
    children: kids.map((k) => foldFrom(tree, k))
  };
}
function foldFrom(tree, start) {
  const labels = [];
  let current = start;
  while (current) {
    const node = structuralNode(tree, current);
    if (!node) {
      return finishRow(tree, current, null, labels.length ? labels : [""], []);
    }
    labels.push(node.label || node.key || "");
    const kids = structuralChildren(tree, current);
    if (kids.length !== 1) return finishRow(tree, current, node, labels, kids);
    const childNode = structuralNode(tree, kids[0]);
    if (!countsEqual(node, childNode)) return finishRow(tree, current, node, labels, kids);
    current = kids[0];
  }
  return finishRow(tree, start, null, labels, []);
}
function familyRoots(tree) {
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
        children: fams.map((f) => {
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
function modelDisplayRoots(tree) {
  const roots = [];
  for (const type of tree?.types || []) {
    const term = { type: type.key };
    const typeLabel = type.label || type.key;
    roots.push({
      term,
      label: typeLabel,
      count: type.count,
      key: scopeNodeKey(term),
      children: structuralChildren(tree, term).map((k) => {
        const row = foldFrom(tree, k);
        return { ...row, label: omitTypeEcho(row.label, typeLabel) };
      })
    });
  }
  roots.push(...familyRoots(tree));
  return roots;
}
function soleFoldedChild(tree, row) {
  const kids = row.children || [];
  if (kids.length !== 1) return false;
  const structural = structuralChildren(tree, row.term);
  if (structural.length !== 1) return false;
  return termDepth(kids[0].term) > termDepth(structural[0]);
}
function covered(terms, term) {
  return (terms || []).some((t) => termCoversNode(t, term));
}
function sameTerm(a, b) {
  return termDepth(a) === termDepth(b) && termCoversNode(a, b) && termCoversNode(b, a);
}
function holeCovers(term, rowTerm) {
  return (term?.except || []).some((hole) => termCoversNode(hole, rowTerm));
}
function rowExcluded(terms, rowTerm) {
  return (terms || []).some((t) => termCoversNode(t, rowTerm) && holeCovers(t, rowTerm));
}
function rowHasHoleBelow(terms, rowTerm) {
  return (terms || []).some(
    (t) => termCoversNode(t, rowTerm) && (t.except || []).some((hole) => termCoversNode(rowTerm, hole) && !sameTerm(rowTerm, hole))
  );
}
function modelRowState(tree, terms, row) {
  if (!row) return "unchecked";
  if (rowExcluded(terms, row.term)) return "unchecked";
  if (covered(terms, row.term) && !rowHasHoleBelow(terms, row.term)) return "checked";
  const kids = row.children || [];
  if (!kids.length) return "unchecked";
  const states = kids.map((k) => modelRowState(tree, terms, k));
  if (!soleFoldedChild(tree, row) && states.every((s) => s === "checked")) return "checked";
  if (states.some((s) => s !== "unchecked")) return "indeterminate";
  return "unchecked";
}
function modelStructuralState(tree, terms, term) {
  if (rowExcluded(terms, term)) return "unchecked";
  if (covered(terms, term) && !rowHasHoleBelow(terms, term)) return "checked";
  const kids = structuralChildren(tree, term);
  if (!kids.length) return "unchecked";
  const states = kids.map((k) => modelStructuralState(tree, terms, k));
  if (states.every((s) => s === "checked")) return "checked";
  if (states.some((s) => s !== "unchecked")) return "indeterminate";
  return "unchecked";
}
function shallowestCovering(terms, term) {
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
function markCovered(terms, emitted, into) {
  terms.forEach((t, i) => {
    if (termCoversNode(emitted, t) || termCoversNode(t, emitted)) into.add(i);
  });
}
function blockedTerm(term) {
  return !!(term?.mine || Array.isArray(term?.except) && term.except.length);
}
function redundantPlain(term, blocked) {
  for (const parent of blocked) {
    if (parent?.mine) continue;
    if (!termCoversNode(parent, term)) continue;
    if ((parent.except || []).some((hole) => termCoversNode(hole, term))) return false;
    return true;
  }
  return false;
}
function compactPlain(tree, terms) {
  if (!tree || !Array.isArray(terms) || !terms.length) return [];
  const coveredIdx = /* @__PURE__ */ new Set();
  const out = [];
  function visit(row) {
    const state = modelRowState(tree, terms, row);
    if (state === "checked") {
      const emitted = shallowestCovering(terms, row.term) || row.term;
      out.push(emitted);
      markCovered(terms, emitted, coveredIdx);
      return;
    }
    if (state === "indeterminate") {
      for (const kid of row.children || []) visit(kid);
    }
  }
  for (const root of modelDisplayRoots(tree)) visit(root);
  terms.forEach((t, i) => {
    if (!coveredIdx.has(i)) out.push(t);
  });
  return out;
}
function compactModelSelection(tree, terms) {
  if (!tree || !Array.isArray(terms) || !terms.length) return terms || [];
  const blocked = terms.filter(blockedTerm);
  const plain = terms.filter((t) => !blockedTerm(t) && !redundantPlain(t, blocked));
  const visible = compactPlain(tree, plain).filter((t) => !redundantPlain(t, blocked));
  const holes = blocked.filter((t) => !t?.mine);
  const mines = blocked.filter((t) => t?.mine);
  const mine = mines.length ? mines[mines.length - 1] : null;
  return mine ? [...visible, ...holes, mine] : [...visible, ...holes];
}
function dropOverlap(terms, nodeTerm) {
  return (terms || []).filter((t) => !termCoversNode(nodeTerm, t) && !termCoversNode(t, nodeTerm));
}
function explode(covering, unchecked, tree) {
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
      ...unchecked.baseModel ? { baseModel: unchecked.baseModel } : {},
      ...unchecked.ecosystem ? { ecosystem: unchecked.ecosystem } : {},
      ...unchecked.modelId ? { modelId: unchecked.modelId } : { modelName: unchecked.modelName }
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
function stripExcept(term) {
  if (!term?.except) return term;
  const next = { ...term };
  delete next.except;
  return next;
}
function exactHole(term, rowTerm) {
  return (term?.except || []).some((hole) => sameTerm(hole, rowTerm));
}
function ancestorHole(term, rowTerm) {
  return (term?.except || []).some((hole) => termCoversNode(hole, rowTerm) && !sameTerm(hole, rowTerm));
}
function withoutHole(term, rowTerm) {
  const except = (term.except || []).filter((hole) => !sameTerm(hole, rowTerm));
  const next = { ...term };
  if (except.length) next.except = except;
  else delete next.except;
  return next;
}
function addHole(term, rowTerm) {
  const except = [...term.except || []];
  if (!except.some((hole) => sameTerm(hole, rowTerm))) except.push(rowTerm);
  return { ...stripExcept(term), except };
}
function expandOff(tree, terms, rowTerm) {
  const covering = (terms || []).filter((t) => !t?.mine && termCoversNode(t, rowTerm));
  if (!covering.length) return (terms || []).filter((t) => !termCoversNode(rowTerm, t));
  const next = dropOverlap(terms, rowTerm);
  for (const cov of covering) {
    if (termCoversNode(cov, rowTerm)) next.push(...explode(cov, rowTerm, tree));
  }
  return compactPlain(tree, next);
}
function inclusionTerms(tree, parent, holes) {
  let next = [stripExcept(parent)];
  for (const hole of holes || []) next = expandOff(tree, next, hole);
  return next;
}
function toggleModelRow(tree, terms, rowTerm, turnOn) {
  if (!rowTerm) return terms || [];
  const src = terms || [];
  if (turnOn) {
    if (src.some((t) => exactHole(t, rowTerm))) {
      return src.map((t) => exactHole(t, rowTerm) ? withoutHole(t, rowTerm) : t);
    }
    if (src.some((t) => ancestorHole(t, rowTerm))) {
      return compactModelSelection(tree, src.concat([rowTerm]));
    }
    const next = dropOverlap(src, rowTerm);
    next.push(rowTerm);
    return compactModelSelection(tree, next);
  }
  const covering = src.filter((t) => !t?.mine && termCoversNode(t, rowTerm) && !holeCovers(t, rowTerm));
  if (!covering.length) {
    return compactModelSelection(tree, src.filter((t) => !termCoversNode(rowTerm, t)));
  }
  const holder = covering.reduce((best, t) => termDepth(t) < termDepth(best) ? t : best);
  if (sameTerm(holder, rowTerm)) {
    return compactModelSelection(tree, src.filter((t) => !termCoversNode(rowTerm, t)));
  }
  const punched = addHole(holder, rowTerm);
  const listed = inclusionTerms(tree, holder, punched.except);
  if (keepAsException(punched.except.length, listed.length)) {
    const next = src.map((t) => t === holder ? punched : t);
    return compactModelSelection(tree, next);
  }
  const kept = src.filter((t) => t !== holder && !termCoversNode(holder, t) && !termCoversNode(t, holder));
  return compactModelSelection(tree, [...kept, ...listed]);
}
function termSteps(term) {
  const steps = [{ type: term.type, baseModel: term.baseModel }];
  if (term.modelId || term.modelName) {
    steps.push({
      type: term.type,
      baseModel: term.baseModel,
      ...term.modelId ? { modelId: term.modelId } : { modelName: term.modelName }
    });
  }
  if (term.versionId) steps.push({ ...steps[steps.length - 1], versionId: term.versionId });
  return steps;
}
function modelChoiceLabel(term, tree) {
  if (!tree || !term?.type || !term.baseModel) return "";
  const steps = termSteps(term);
  const labels = [];
  for (let i = 0; i < steps.length; i++) {
    const node = structuralNode(tree, steps[i]);
    if (!node || node.count == null) return "";
    labels.push(node.label || node.key || "");
    if (i === steps.length - 1) break;
    const kids = structuralChildren(tree, steps[i]);
    if (kids.length !== 1) return "";
    const childNode = structuralNode(tree, kids[0]);
    if (!countsEqual(node, childNode) || !sameTerm(kids[0], steps[i + 1])) return "";
  }
  const typeNode = structuralNode(tree, { type: term.type });
  const typeLabel = typeNode?.label || typeNode?.key || "";
  const joined = labels.join(DOT);
  const shortened = omitTypeEcho(joined, typeLabel);
  if (shortened === joined && labels.length < 2) return "";
  return shortened;
}
function pathLabel(term, tree) {
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
  return parts.join(" / ") || "Selection";
}
function modelChipLabel(term, tree) {
  return modelChoiceLabel(term, tree) || pathLabel(term, tree);
}
function modelTermForOwnUncheck(term) {
  if (!term || term.modelId == null || term.modelId === "") return term;
  if (term.versionId == null || term.versionId === "") return term;
  const next = { ...term };
  delete next.versionId;
  return next;
}
function modelRowMatches(row, q) {
  if (!q) return true;
  const needle = String(q).trim().toLowerCase();
  if (!needle) return true;
  if (row?.label && row.label.toLowerCase().includes(needle)) return true;
  if (row?.term?.type && String(row.term.type).toLowerCase().includes(needle)) return true;
  return (row?.children || []).some((k) => modelRowMatches(k, needle));
}

// dev/ui/src/lib/model-chip-groups.js
function sameTerm2(a, b) {
  return !!a && !!b && termDepth(a) === termDepth(b) && termCoversNode(a, b) && termCoversNode(b, a);
}
function pathTail(term, tree) {
  const path = modelChipLabel(term, tree);
  const parts = String(path).split(" / ");
  return parts[parts.length - 1] || path;
}
function rowLabel(tree, term) {
  if (!tree || !term) return pathTail(term, tree);
  let found = "";
  function visit(row) {
    if (found || !row) return;
    if (row.term && sameTerm2(row.term, term)) {
      found = row.label || "";
      return;
    }
    for (const kid of row.children || []) visit(kid);
  }
  for (const root of modelDisplayRoots(tree)) visit(root);
  return found || pathTail(term, tree);
}
function includeGroup(term, index, tree) {
  const text = term?.mine ? "Mine" : modelChipLabel(term, tree);
  const title = term?.mine ? "My models" : "Models";
  return {
    kind: "include",
    text,
    title,
    ariaLabel: `Remove ${title}`,
    termIndexes: [index]
  };
}
function exceptGroup(hole, index, exceptIndex, tree) {
  const name = rowLabel(tree, hole);
  return {
    kind: "except",
    text: `except ${name}`,
    name,
    title: `Not included: ${name}`,
    ariaLabel: `Include ${name}`,
    termIndexes: [index],
    exceptIndex
  };
}
function kindOf(members) {
  if (members.length && members.every((term) => term?.versionId)) return "versions";
  if (members.length && members.every((term) => term?.modelId || term?.modelName)) return "models";
  if (members.length && members.every((term) => (term?.baseModel || term?.ecosystem) && !term?.modelId && !term?.modelName)) {
    return "base models";
  }
  return "selections";
}
function clusterGroup(row, members, terms) {
  const n = members.length;
  const parent = row?.label || "Models";
  const kind = kindOf(members.map((index) => terms[index]));
  return {
    kind: "cluster",
    text: `${parent} \xB7 ${n}`,
    parentLabel: parent,
    count: n,
    title: `${n} ${kind} under ${parent}`,
    ariaLabel: `Remove ${n} ${kind} under ${parent}`,
    termIndexes: members.slice()
  };
}
function coveringIndex(entries, rowTerm) {
  let best = -1;
  let depth = Infinity;
  for (const entry of entries) {
    if (!termCoversNode(entry.term, rowTerm)) continue;
    if ((entry.term.except || []).some((hole) => termCoversNode(hole, rowTerm))) continue;
    const d = termDepth(entry.term);
    if (d < depth) {
      depth = d;
      best = entry.index;
    }
  }
  return best;
}
function shadowed(terms, index) {
  const term = terms[index];
  if (!term || term.mine) return false;
  return terms.some((other, i) => {
    if (i === index || !other || other.mine) return false;
    if (!(termDepth(other) < termDepth(term))) return false;
    if (!termCoversNode(other, term)) return false;
    if ((other.except || []).some((hole) => termCoversNode(hole, term))) return false;
    return true;
  });
}
function collectClusters(row, entries, tree, structural, clusters) {
  if (modelRowState(tree, structural, row) !== "indeterminate") return;
  const direct = [];
  for (const kid of row.children || []) {
    const state = modelRowState(tree, structural, kid);
    if (state === "checked") {
      const idx = coveringIndex(entries, kid.term);
      if (idx >= 0 && !direct.includes(idx)) direct.push(idx);
    } else if (state === "indeterminate") {
      collectClusters(kid, entries, tree, structural, clusters);
    }
  }
  if (direct.length >= 4) clusters.push({ row, members: direct });
}
function flatGroups(terms) {
  const out = [];
  terms.forEach((term, index) => {
    out.push(includeGroup(term, index, null));
    (term.except || []).forEach((hole, n) => out.push(exceptGroup(hole, index, n, null)));
  });
  return out;
}
function modelChipGroups(tree, terms) {
  const src = Array.isArray(terms) ? terms : [];
  if (!src.length) return [];
  if (!tree) return flatGroups(src);
  const entries = [];
  src.forEach((term, index) => {
    if (!term?.mine) entries.push({ term, index });
  });
  const structural = entries.map((entry) => entry.term);
  const clusters = [];
  for (const root of modelDisplayRoots(tree)) collectClusters(root, entries, tree, structural, clusters);
  const memberOf = /* @__PURE__ */ new Map();
  for (const cluster of clusters) {
    for (const index of cluster.members) memberOf.set(index, cluster);
  }
  const seen = /* @__PURE__ */ new Set();
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
function dropModelGroup(terms, group) {
  const src = Array.isArray(terms) ? terms : [];
  if (!group) return src.slice();
  if (group.kind === "except") {
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

export {
  formatDateRange,
  hasFlatTaxonomy,
  clearedFlatTaxonomy,
  scopeNodeKey,
  ancestorExpandKeys,
  narrowOwnSelection,
  modelDisplayRoots,
  modelRowState,
  modelStructuralState,
  compactModelSelection,
  toggleModelRow,
  modelChipLabel,
  modelTermForOwnUncheck,
  modelRowMatches,
  modelChipGroups,
  dropModelGroup,
  PUBLICATION_LABELS,
  MODEL3D_PUBLICATION_LABELS,
  publicationFacet,
  PUBLICATION_FACET,
  USED_AS_INPUT_FACET,
  publicationFromInPost,
  effectivePublication,
  publicationFromStatus
};
