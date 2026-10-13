import { useState, useRef, useEffect, useId } from 'preact/hooks';
import { useOwnModelsRevision } from '../lib/own-models-rev.js';
import { tagLabel } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';
import { formatWhenRange } from '../lib/when-label.js';
import { getFacetValues, getModelHierarchy, getListOffer, getTypeWorkflowTree } from '../api.js';
import { modelTypeLabel } from '../lib/modelTypeDisplay.js';
import { RangePicker } from './RangePicker.jsx';
import {
  explicitPathsFromState,
  paramsToTypeWorkflowSelection,
  selectionToAspectParams,
  selectionToTypeWorkflowParams,
  toggleCheckedPaths
} from '../../../../src/nestedTree.mjs';
import { formatWorkflowQueryLabel } from '../../../../src/workflowVocab.mjs';
import {
  parseScope,
  serializeScopeTerms,
  termCoversNode,
  asCsvList,
  hasFlatTaxonomy,
  clearedFlatTaxonomy,
  scopeNodeKey as nodeKey,
  ancestorExpandKeys,
  narrowOwnSelection
} from '../lib/scope.js';

// Schema-driven FacetBar. Membership chrome (facets + More + Search) is the
// default. Arrangement chrome (the Arrange cluster: group-by / group-order /
// item-sort) is opt-in: mount it only when the host passes a non-empty
// `sortFields` and/or `groupAxes`. Galleries (Generations / Posts / Comics)
// opt in. Export hosts must not — an export is a membership set, not a
// sorted gallery page. Each facet is one of: chip group (inline, or a
// labelled compact picker matching TreePicker / When chrome), multi-select,
// hierarchical tree (Models), nested disclosure tree (Media Type and
// Aspect Ratio), When (date), number range,
// boolean toggle, segmented tristate.
// Gallery writes go through the view's single `useUrlState` `update`.
//
// IC items 2/3: facet + sort / groupSort tweaks are replaceState (the hook
// default); changing group-by is a pushState (a meaningful navigation).

function optionLabel (facet, value) {
  if (facet.optionLabels && facet.optionLabels[value]) return facet.optionLabels[value];
  if (facet.source === 'reaction') return tagLabel(value);
  if (facet.key === 'resourceType') return modelTypeLabel(value) || value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function toggleMember (arr, value) {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
}

function facetListKey (facet) {
  return `${facet.kind}:${facet.source || facet.valuesSource || facet.key}`;
}

function useOutsideClose (open, setOpen, panelRef, btnRef) {
  useEffect(() => {
    if (!open) return;
    function onDown (e) {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, setOpen, panelRef, btnRef]);
}

function isoToday () {
  return new Date().toISOString().slice(0, 10);
}

function addDays (iso, delta) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function monthRange (month) {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return { dateFrom: '', dateTo: '' };
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { dateFrom: `${month}-01`, dateTo: `${month}-${String(lastDay).padStart(2, '0')}` };
}

function formatMonthYear (iso) {
  if (!iso) return '';
  const [y, m] = String(iso).slice(0, 7).split('-').map(Number);
  if (!y || !m) return iso;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function monthsBetween (minIso, maxIso) {
  if (!minIso || !maxIso) return [];
  const [y0, m0] = minIso.slice(0, 7).split('-').map(Number);
  const [y1, m1] = maxIso.slice(0, 7).split('-').map(Number);
  if (!y0 || !m0 || !y1 || !m1) return [];
  const out = [];
  let y = y0;
  let m = m0;
  while (y < y1 || (y === y1 && m <= m1)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

// --- Chip group (small enum / pre-canned set) ------------------------------
// Unlabelled: inline chips. Labelled: the same button+panel chrome as
// Models & resources / When — a labelled compact picker matching TreePicker / When chrome.
// Option presence comes from the list offer (intersected with declared options).

function ChipGroup ({ facet, active, update, offerValues }) {
  const fullActive = active || [];
  const displayActive = fullActive;
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  useOutsideClose(open, setOpen, panelRef, btnRef);

  if (offerValues == null) return null;

  const present = new Set(offerValues);
  const shown = (facet.options || []).filter(v => present.has(v) || displayActive.includes(v));
  if (shown.length === 0) return null;

  function toggle (value) {
    update({ [facet.key]: toggleMember(fullActive, value) });
  }

  if (facet.label) {
    return (
      <div class="tag-picker-wrap">
        <button
          ref={btnRef}
          type="button"
          class={`quiet-btn tag-picker-btn${displayActive.length > 0 ? ' has-active' : ''}${open ? ' open' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          {facet.label}{displayActive.length > 0 ? ` (${displayActive.length})` : ''} {open ? '\u25B4' : '\u25BE'}
        </button>
        {open && (
          <div ref={panelRef} class="tag-picker-panel enum-picker-panel">
            <div class="tree-picker-list">
              {shown.map(value => (
                <div key={value} class="tree-picker-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={displayActive.includes(value)}
                      onChange={() => toggle(value)}
                    />
                    <span class="tree-picker-label">{optionLabel(facet, value)}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div class="filter-tags">
      {shown.map(value => {
        const cls = value === 'favorite' ? 'favorite' : value === 'feedback:liked' ? 'liked' : '';
        return (
          <button
            key={value}
            type="button"
            class={`tag-chip ${cls}${displayActive.includes(value) ? ' active' : ''}`}
            onClick={() => toggle(value)}
          >
            {optionLabel(facet, value)}
          </button>
        );
      })}
    </div>
  );
}

// --- Multi-select panel (large / open-ended enum) --------------------------

function MultiSelect ({ facet, active, update, facetParams, offerShow }) {
  const fullActive = active || [];
  const displayActive = fullActive;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(facet.options ? facet.options.map(v => ({ value: v, label: optionLabel(facet, v) })) : null);
  const [tagTotal, setTagTotal] = useState(null);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  useOutsideClose(open, setOpen, panelRef, btnRef);

  useEffect(() => {
    if (!open || loaded != null || !facet.source) return;
    let cancelled = false;
    getFacetValues(facet.source, facetParams)
      .then(data => {
        if (cancelled) return;
        setTagTotal(typeof data.total === 'number' ? data.total : null);
        setLoaded((data.values || []).map(v => ({
          value: v.value,
          label: v.label || v.value,
          count: v.count
        })));
      })
      .catch(() => { if (!cancelled) setLoaded([]); });
    return () => { cancelled = true; };
  }, [open, facet.source, loaded, facetParams]);

  if (offerShow == null) return null;
  if (!offerShow && displayActive.length === 0) return null;

  const options = loaded == null
    ? null
    : (() => {
      const filtered = loaded.filter(o => {
        if (typeof o.count !== 'number') return true;
        if (o.count <= 0) return false;
        if (tagTotal != null && o.count === tagTotal) return false;
        return true;
      });
      const have = new Set(filtered.map(o => o.value));
      const extras = displayActive.filter(v => !have.has(v)).map(v => ({ value: v, label: optionLabel(facet, v) }));
      return extras.length ? [...extras, ...filtered] : filtered;
    })();

  const visible = (options || []).filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase()));

  return (
    <div class="tag-picker-wrap">
      <button
        ref={btnRef}
        type="button"
        class={`quiet-btn tag-picker-btn${displayActive.length > 0 ? ' has-active' : ''}${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {facet.label}{displayActive.length > 0 ? ` (${displayActive.length})` : ''} {open ? '\u25B4' : '\u25BE'}
      </button>

      {open && (
        <div ref={panelRef} class="tag-picker-panel">
          <input
            class="tag-picker-search"
            type="search"
            placeholder={`Filter ${facet.label.toLowerCase()}…`}
            value={search}
            onInput={e => setSearch(e.target.value)}
            autoFocus
          />
          <div class="tag-picker-list">
            {options == null && <span class="tag-picker-empty">Loading…</span>}
            {options != null && visible.length === 0 && <span class="tag-picker-empty">No matches</span>}
            {visible.map(o => (
              <button
                key={o.value}
                type="button"
                class={`tag-chip${displayActive.includes(o.value) ? ' active' : ''}`}
                onClick={() => update({ [facet.key]: toggleMember(fullActive, o.value) })}
                title={o.value}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Hierarchical tree picker (`kind: 'tree'`, `scope=` grammar) -----------

function familyRootTerms (tree) {
  const terms = [];
  for (const sec of tree?.familySections || []) {
    const fams = sec.families || [];
    if (fams.length === 1) terms.push({ familyId: fams[0].key });
    else if (fams.length > 1) terms.push({ familyOutput: sec.outputType });
  }
  return terms;
}

function childTerms (tree, parent) {
  if (!tree) return [];
  if (parent?.familyOutput && !parent.familyId) {
    const sec = (tree.familySections || []).find(s => s.outputType === parent.familyOutput);
    return (sec?.families || []).map(f => ({ familyOutput: sec.outputType, familyId: f.key }));
  }
  if (parent?.familyId) return [];
  if (!parent.type) return (tree.types || []).map(t => ({ type: t.key }));
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

function findNode (tree, term) {
  if (!tree) return null;
  if (term?.familyId || term?.familyOutput) {
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
  if (!term?.type) return null;
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

function checkState (nodeTerm, terms, tree) {
  if ((terms || []).some(t => termCoversNode(t, nodeTerm))) return 'checked';
  const kids = childTerms(tree, nodeTerm);
  if (!kids.length) return 'unchecked';
  const states = kids.map(k => checkState(k, terms, tree));
  if (states.every(s => s === 'checked')) return 'checked';
  if (states.some(s => s !== 'unchecked')) return 'indeterminate';
  return 'unchecked';
}

function explode (covering, unchecked, tree) {
  const coverDepth = (() => {
    if (covering.versionId) return 4;
    if (covering.modelId || covering.modelName) return 3;
    if (covering.baseModel || covering.ecosystem) return 2;
    if (covering.type) return 1;
    return 0;
  })();
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
  const added = [];
  for (let depth = coverDepth; depth < path.length; depth++) {
    const parent = depth === 0 ? {} : path[depth - 1];
    const exclude = path[depth];
    for (const child of childTerms(tree, parent)) {
      if (termCoversNode(child, exclude) && termCoversNode(exclude, child)) continue;
      added.push(child);
    }
  }
  return added;
}

function compactTerms (tree, terms) {
  if (!tree || !Array.isArray(terms) || !terms.length) return terms || [];
  const covered = new Set();
  const out = [];
  function visit (nodeTerm) {
    const state = checkState(nodeTerm, terms, tree);
    if (state === 'checked') {
      out.push(nodeTerm);
      terms.forEach((t, i) => {
        if (termCoversNode(nodeTerm, t) || termCoversNode(t, nodeTerm)) covered.add(i);
      });
      return;
    }
    if (state === 'indeterminate') {
      for (const k of childTerms(tree, nodeTerm)) visit(k);
    }
  }
  for (const t of (tree.types || [])) visit({ type: t.key });
  for (const root of familyRootTerms(tree)) visit(root);
  terms.forEach((t, i) => { if (!covered.has(i)) out.push(t); });
  return out;
}

function addNodeTerm (terms, nodeTerm, tree) {
  const next = (terms || []).filter(t => !termCoversNode(nodeTerm, t) && !termCoversNode(t, nodeTerm));
  next.push(nodeTerm);
  return compactTerms(tree, next);
}

function removeNodeTerm (terms, nodeTerm, tree) {
  const covering = (terms || []).filter(t => termCoversNode(t, nodeTerm));
  if (!covering.length) {
    return compactTerms(tree, (terms || []).filter(t => !termCoversNode(nodeTerm, t)));
  }
  let next = (terms || []).filter(t => !termCoversNode(t, nodeTerm) && !termCoversNode(nodeTerm, t));
  for (const cov of covering) {
    next.push(...explode(cov, nodeTerm, tree));
  }
  return compactTerms(tree, next);
}

function termChipLabel (term, tree) {
  if (term?.familyId || term?.familyOutput) {
    const n = findNode(tree, term);
    if (term.familyId) return n?.label || term.familyId;
    return n?.label || term.familyOutput;
  }
  const parts = [];
  if (term.type) {
    const n = findNode(tree, { type: term.type });
    parts.push(n?.label || modelTypeLabel(term.type) || term.type);
  }
  if (term.baseModel) {
    const n = findNode(tree, { type: term.type, baseModel: term.baseModel });
    parts.push(n?.label || term.baseModel);
  } else if (term.ecosystem) {
    parts.push(term.ecosystem);
  }
  if (term.modelId || term.modelName) {
    const n = findNode(tree, term);
    parts.push(n?.label || term.modelName || `Model ${term.modelId}`);
  }
  if (term.versionId) {
    const n = findNode(tree, term);
    parts.push(n?.label || `Version ${term.versionId}`);
  }
  return parts.join(' / ') || 'Selection';
}

function nodeMatchesSearch (tree, term, q) {
  if (!q) return true;
  const node = findNode(tree, term);
  if (node?.label && node.label.toLowerCase().includes(q)) return true;
  if (term.type && String(term.type).toLowerCase().includes(q)) return true;
  return childTerms(tree, term).some(k => nodeMatchesSearch(tree, k, q));
}

function findVersionTerm (tree, versionId) {
  if (!tree) return null;
  for (const type of tree.types || []) {
    for (const base of type.baseModels || []) {
      for (const model of base.models || []) {
        const hit = (model.versions || []).find(v => String(v.key) === String(versionId));
        if (hit) {
          return model.idKind === 'name'
            ? { type: type.key, baseModel: base.key, modelName: model.key, versionId: String(versionId) }
            : { type: type.key, baseModel: base.key, modelId: model.key, versionId: String(versionId) };
        }
      }
    }
  }
  return null;
}

function resolveModelInTree (tree, name, type) {
  if (!tree || !name) return null;
  const types = type
    ? (tree.types || []).filter(t => t.key === type)
    : (tree.types || []);
  for (const t of types) {
    for (const b of t.baseModels || []) {
      const m = (b.models || []).find(n => n.label === name || n.key === name);
      if (m) {
        return m.idKind === 'name'
          ? { type: t.key, baseModel: b.key, modelName: m.key }
          : { type: t.key, baseModel: b.key, modelId: m.key };
      }
    }
  }
  return null;
}

function resolveVersionByName (tree, name, hint) {
  if (!tree || !name) return null;
  const types = hint.type
    ? (tree.types || []).filter(t => t.key === hint.type)
    : (tree.types || []);
  const hits = [];
  for (const t of types) {
    for (const b of t.baseModels || []) {
      const models = hint.model
        ? (b.models || []).filter(m => m.label === hint.model || m.key === hint.model)
        : (b.models || []);
      for (const m of models) {
        for (const v of m.versions || []) {
          if (v.label === name || v.key === name) {
            hits.push(m.idKind === 'name'
              ? { type: t.key, baseModel: b.key, modelName: m.key, versionId: v.key }
              : { type: t.key, baseModel: b.key, modelId: m.key, versionId: v.key });
          }
        }
      }
    }
  }
  return hits;
}

function flatToScopeTerms (state, tree) {
  const types = asCsvList(state.resourceType);
  const ecos = asCsvList(state.ecosystem);
  const models = [...new Set([...asCsvList(state.model), ...asCsvList(state.resource)])];
  const versionNames = asCsvList(state.version);
  const versionIds = asCsvList(state.versionId);

  const onlyVersionIds = versionIds.length && !types.length && !ecos.length && !models.length && !versionNames.length;
  if (onlyVersionIds) {
    return versionIds.map(id => findVersionTerm(tree, id) || { versionId: String(id) });
  }

  const typeOpts = types.length ? types : [null];
  const ecoOpts = ecos.length ? ecos : [null];
  const modelOpts = models.length ? models : [null];
  const verNameOpts = versionNames.length ? versionNames : [null];
  const verIdOpts = versionIds.length ? versionIds : [null];
  const terms = [];

  for (const type of typeOpts) {
    for (const eco of ecoOpts) {
      for (const model of modelOpts) {
        for (const vName of verNameOpts) {
          for (const vId of verIdOpts) {
            const term = {};
            if (type) term.type = type;
            if (eco) term.ecosystem = eco;
            if (vId) {
              const found = findVersionTerm(tree, vId);
              if (found) {
                terms.push({ ...term, ...found });
                continue;
              }
              term.versionId = String(vId);
            }
            if (model) {
              const resolved = resolveModelInTree(tree, model, type, eco);
              if (resolved?.modelId) term.modelId = resolved.modelId;
              else if (resolved?.modelName) term.modelName = resolved.modelName;
              else term.modelName = model;
            }
            if (vName && !vId) {
              const hits = resolveVersionByName(tree, vName, { type, eco, model });
              if (hits.length) {
                for (const hit of hits) terms.push({ ...term, ...hit });
                continue;
              }
            }
            if (Object.keys(term).length) terms.push(term);
          }
        }
      }
    }
  }
  return compactTerms(tree, terms);
}

function TreeRow ({ term, tree, terms, search, expanded, toggleExpand, onToggle, depth }) {
  const node = findNode(tree, term);
  if (!node) return null;
  const q = search.trim().toLowerCase();
  if (q && !nodeMatchesSearch(tree, term, q)) return null;
  const kids = childTerms(tree, term);
  const state = checkState(term, terms, tree);
  const key = nodeKey(term);
  const isOpen = expanded.has(key) || !!q;
  const showCaret = kids.length > 0;

  return (
    <>
      <div class="tree-picker-row" data-depth={depth}>
        {showCaret
          ? (
            <button
              type="button"
              class="tree-picker-caret"
              aria-expanded={isOpen}
              onClick={() => toggleExpand(key)}
            >{isOpen ? '\u25BE' : '\u25B8'}</button>
            )
          : <span class="tree-picker-caret-spacer" />}
        <label>
          <input
            type="checkbox"
            checked={state === 'checked'}
            ref={el => { if (el) el.indeterminate = state === 'indeterminate'; }}
            onChange={() => onToggle(term, state !== 'checked')}
          />
          <span class="tree-picker-label">{node.label}</span>
        </label>
        <span class="tree-picker-count">{node.count}</span>
      </div>
      {showCaret && isOpen && kids.map(k => (
        <TreeRow
          key={nodeKey(k)}
          term={k}
          tree={tree}
          terms={terms}
          search={search}
          expanded={expanded}
          toggleExpand={toggleExpand}
          onToggle={onToggle}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

function ownedModelTerms (tree) {
  const out = [];
  for (const type of tree?.types || []) {
    for (const base of type.baseModels || []) {
      for (const model of base.models || []) {
        if (!model.own || model.idKind === 'name') continue;
        out.push({ type: type.key, baseModel: base.key, modelId: String(model.key) });
      }
    }
  }
  return out;
}

function TreePicker ({ facet, state, update, facetParams, offerShow, showOwn, ownRev }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tree, setTree] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const normalizedRef = useRef(false);
  const seenRev = useRef(ownRev);
  useOutsideClose(open, setOpen, panelRef, btnRef);

  const terms = parseScope(state.scope);
  const mine = state.mine === true;

  useEffect(() => {
    if (seenRev.current === ownRev) return;
    seenRev.current = ownRev;
    setTree(null);
  }, [ownRev]);

  useEffect(() => {
    const needsFetch = open || (!normalizedRef.current && hasFlatTaxonomy(state));
    if (!needsFetch || tree != null) return;
    let cancelled = false;
    getModelHierarchy(facetParams)
      .then(data => { if (!cancelled) setTree(data); })
      .catch(() => { if (!cancelled) setTree({ types: [] }); });
    return () => { cancelled = true; };
  }, [open, tree, state, facetParams]);

  useEffect(() => {
    if (normalizedRef.current) return;
    if (state.scope && hasFlatTaxonomy(state)) {
      normalizedRef.current = true;
      update(clearedFlatTaxonomy());
      return;
    }
    if (state.scope || !hasFlatTaxonomy(state)) {
      normalizedRef.current = true;
      return;
    }
    const needsTree = asCsvList(state.version).length > 0 || asCsvList(state.model).length > 0 || asCsvList(state.resource).length > 0;
    if (needsTree && tree == null) return;
    normalizedRef.current = true;
    const next = serializeScopeTerms(flatToScopeTerms(state, tree));
    update({ scope: next, ...clearedFlatTaxonomy() });
  }, [state, tree, update]);

  useEffect(() => {
    if (!tree) return;
    const bag = [];
    for (const term of terms) bag.push(...ancestorExpandKeys(term));
    if (mine) {
      for (const node of ownedModelTerms(tree)) bag.push(...ancestorExpandKeys(node));
    }
    if (!bag.length) return;
    setExpanded(prev => {
      const next = new Set(prev);
      for (const key of bag) next.add(key);
      return next;
    });
  }, [tree, state.scope, mine]);

  if (offerShow == null) return null;
  if (!offerShow && !mine && !terms.length && !hasFlatTaxonomy(state)) return null;

  const owned = ownedModelTerms(tree);
  const displayTerms = mine ? terms.concat(owned) : terms;
  const mineState = mine
    ? 'checked'
    : (!owned.length
      ? 'unchecked'
      : owned.every(n => checkState(n, terms, tree) === 'checked')
        ? 'checked'
        : owned.some(n => checkState(n, terms, tree) !== 'unchecked')
          ? 'indeterminate'
          : 'unchecked');
  const showMineRow = !!showOwn || mine;
  const activeCount = terms.length + (mine ? 1 : 0);

  function commit (nextTerms) {
    update({ scope: serializeScopeTerms(nextTerms), ...clearedFlatTaxonomy() });
  }

  function onMineToggle () {
    if (!tree && !mine) return;
    if (mine) {
      update({ mine: null });
      return;
    }
    if (mineState === 'checked') {
      let next = terms;
      for (const node of owned) next = removeNodeTerm(next, node, tree);
      update({ mine: null, scope: serializeScopeTerms(next), ...clearedFlatTaxonomy() });
      return;
    }
    update({ mine: true });
  }

  function onToggle (term, turnOn) {
    if (!tree) return;
    const isOwnedModel = term.modelId && !term.versionId
      && owned.some(n => String(n.modelId) === String(term.modelId));
    if (!turnOn && mine && isOwnedModel) {
      const next = narrowOwnSelection({
        mine: true,
        terms,
        ownedNodes: owned,
        unchecked: term
      });
      update({
        mine: null,
        scope: serializeScopeTerms(compactTerms(tree, next.terms)),
        ...clearedFlatTaxonomy()
      });
      return;
    }
    commit(turnOn ? addNodeTerm(terms, term, tree) : removeNodeTerm(terms, term, tree));
  }

  function toggleExpand (key) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function removeTerm (idx) {
    commit(terms.filter((_, i) => i !== idx));
  }

  const typeTerms = (tree?.types || []).map(t => ({ type: t.key }));
  const familyTerms = familyRootTerms(tree);

  return (
    <div class="tag-picker-wrap tree-picker-wrap">
      <button
        ref={btnRef}
        type="button"
        class={`quiet-btn tag-picker-btn${activeCount > 0 ? ' has-active' : ''}${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {facet.label}{activeCount > 0 ? ` (${activeCount})` : ''} {open ? '\u25B4' : '\u25BE'}
      </button>
      {(mine || terms.length > 0) && (
        <div class="tree-picker-chips">
          {mine && (
            <button
              type="button"
              class="tag-chip active tree-picker-chip remove"
              onClick={() => update({ mine: null })}
              title="Remove this filter"
            >
              Mine {'\u00D7'}
            </button>
          )}
          {terms.map((term, i) => (
            <button
              key={nodeKey(term) + i}
              type="button"
              class="tag-chip active tree-picker-chip remove"
              onClick={() => removeTerm(i)}
              title="Remove this filter"
            >
              {termChipLabel(term, tree)} {'\u00D7'}
            </button>
          ))}
        </div>
      )}
      {open && (
        <div ref={panelRef} class="tag-picker-panel tree-picker-panel">
          <input
            class="tag-picker-search"
            type="search"
            placeholder="Filter models & resources…"
            value={search}
            onInput={e => setSearch(e.target.value)}
            autoFocus
          />
          <div class="tree-picker-list">
            {showMineRow && (
              <div class="tree-picker-row" data-depth="0">
                <span class="tree-picker-caret-spacer" />
                <label>
                  <input
                    type="checkbox"
                    checked={mineState === 'checked'}
                    ref={el => { if (el) el.indeterminate = mineState === 'indeterminate'; }}
                    onChange={onMineToggle}
                  />
                  <span class="tree-picker-label">Mine</span>
                </label>
              </div>
            )}
            {tree == null && <span class="tag-picker-empty">Loading…</span>}
            {tree != null && typeTerms.length === 0 && familyTerms.length === 0 && <span class="tag-picker-empty">No models in the library</span>}
            {tree != null && typeTerms.map(t => (
              <TreeRow
                key={nodeKey(t)}
                term={t}
                tree={tree}
                terms={displayTerms}
                search={search}
                expanded={expanded}
                toggleExpand={toggleExpand}
                onToggle={onToggle}
                depth={0}
              />
            ))}
            {tree != null && familyTerms.map(t => (
              <TreeRow
                key={nodeKey(t)}
                term={t}
                tree={tree}
                terms={displayTerms}
                search={search}
                expanded={expanded}
                toggleExpand={toggleExpand}
                onToggle={onToggle}
                depth={0}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Boolean toggle (true = constrain; null = no constraint) --------------
// Same button chrome as the labelled filter pickers. The label is the
// button text. On uses the active wash; there is no panel.

function Flag ({ facet, value, update, offerShow }) {
  if (offerShow == null) return null;
  if (!offerShow && value !== true) return null;
  const checked = value === true;
  return (
    <button
      type="button"
      class={`quiet-btn tag-picker-btn${checked ? ' has-active' : ''}`}
      aria-pressed={checked}
      onClick={() => update({ [facet.key]: checked ? null : true })}
    >
      {facet.label}
    </button>
  );
}

// --- Segmented tristate (null / true / false) ------------------------------

function Segmented ({ facet, value, update }) {
  const segments = [
    { value: null, label: 'Any' },
    { value: true, label: 'In a post' },
    { value: false, label: 'Not in a post' }
  ];
  return (
    <div class="granularity-toggle status-segmented facet-segmented" role="group" aria-label={facet.label}>
      <span class="granularity-label">{facet.label}</span>
      {segments.map(seg => (
        <button
          key={String(seg.value)}
          type="button"
          class={`granularity-option${value === seg.value ? ' active' : ''}`}
          aria-pressed={value === seg.value}
          onClick={() => update({ [facet.key]: seg.value })}
        >{seg.label}</button>
      ))}
    </div>
  );
}

// --- Arrange cluster (group-by + group-order + item-sort) ------------------

function sortDirChoices (field) {
  if (field === 'date' || field === 'published') {
    return [
      { dir: 'desc', label: 'Newest first' },
      { dir: 'asc', label: 'Oldest first' }
    ];
  }
  if (field === 'name') {
    return [
      { dir: 'asc', label: 'A\u2192Z' },
      { dir: 'desc', label: 'Z\u2192A' }
    ];
  }
  return [
    { dir: 'desc', label: 'Most first' },
    { dir: 'asc', label: 'Fewest first' }
  ];
}

function defaultDir (field) {
  if (field === 'name') return 'asc';
  return 'desc';
}

function Arrange ({ state, sortFields, groupAxes, update }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  useOutsideClose(open, setOpen, panelRef, btnRef);

  const [sortField, sortDir] = (state.sort || 'date:desc').split(':');
  const groupBy = state.groupBy && state.groupBy !== 'none' ? state.groupBy : 'none';
  const [gsField, gsDir] = (state.groupSort || 'count:desc').split(':');
  const grouped = groupBy !== 'none';
  const hasGroupAxes = (groupAxes || []).length > 0;
  const showSortField = (sortFields || []).length >= 2;

  // Keep a URL-selected axis that is not in the offered set until cleared.
  const groupAxesForSelect = (() => {
    const list = groupAxes || [];
    if (groupBy === 'none') return list;
    if (list.some(a => a.value === groupBy)) return list;
    return [...list, { value: groupBy, label: groupBy }];
  })();

  const axisLabel = grouped
    ? (groupAxesForSelect.find(a => a.value === groupBy)?.label || groupBy)
    : '';
  const dirLabel = (sortDirChoices(sortField).find(d => d.dir === (sortDir || 'desc')) || {}).label || '';
  const sortFieldLabel = (sortFields.find(f => f.value === sortField) || {}).label || sortField;

  let btnLabel;
  if (grouped) btnLabel = `Group: ${axisLabel}`;
  else if (hasGroupAxes) btnLabel = 'Arrange';
  else btnLabel = `Sort: ${dirLabel || sortFieldLabel}`;

  const active = grouped || (state.sort && state.sort !== 'date:desc');

  return (
    <div class="tag-picker-wrap arrange-wrap">
      <button
        ref={btnRef}
        type="button"
        class={`quiet-btn${active ? ' has-active' : ''}${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {btnLabel} {open ? '\u25B4' : '\u25BE'}
      </button>
      {open && (
        <div ref={panelRef} class="tag-picker-panel arrange-panel">
          {hasGroupAxes && (
            <label class="arrange-row">
              <span class="arrange-row-label">Group by</span>
              <select
                class="facet-select"
                value={groupBy}
                onChange={e => update({ groupBy: e.target.value }, { history: 'push' })}
              >
                <option value="none">None</option>
                {groupAxesForSelect.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
          )}
          {hasGroupAxes && grouped && (
            <label class="arrange-row">
              <span class="arrange-row-label">Order groups by</span>
              <select
                class="facet-select"
                value={`${gsField === 'name' ? 'name' : 'count'}:${gsDir === 'asc' ? 'asc' : 'desc'}`}
                onChange={e => update({ groupSort: e.target.value })}
              >
                <option value="count:desc">Count (Most first)</option>
                <option value="count:asc">Count (Fewest first)</option>
                <option value="name:asc">Name (A{'\u2192'}Z)</option>
                <option value="name:desc">Name (Z{'\u2192'}A)</option>
              </select>
            </label>
          )}
          <label class="arrange-row">
            {showSortField && <span class="arrange-row-label">Sort items by</span>}
            {showSortField && (
              <select
                class="facet-select"
                value={sortField}
                onChange={e => update({ sort: `${e.target.value}:${defaultDir(e.target.value)}` })}
              >
                {sortFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            )}
            {!showSortField && <span class="arrange-row-label">Sort</span>}
            <select
              class="facet-select"
              value={sortDir === 'asc' ? 'asc' : 'desc'}
              onChange={e => update({ sort: `${sortField}:${e.target.value}` })}
            >
              {sortDirChoices(sortField).map(d => (
                <option key={d.dir} value={d.dir}>{d.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

// --- When (date range: presets / corpus months / custom) -------------------

const DATE_PRESETS = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-30', label: 'Last 30 days' },
  { id: 'last-90', label: 'Last 90 days' },
  { id: 'this-year', label: 'This year' },
  { id: 'last-12', label: 'Last 12 months' },
  { id: 'all', label: 'All time' }
];

function presetRange (id, today) {
  const [y, m] = today.split('-').map(Number);
  switch (id) {
    case 'this-month':
      return { dateFrom: `${y}-${String(m).padStart(2, '0')}-01`, dateTo: today };
    case 'last-30':
      return { dateFrom: addDays(today, -29), dateTo: today };
    case 'last-90':
      return { dateFrom: addDays(today, -89), dateTo: today };
    case 'this-year':
      return { dateFrom: `${y}-01-01`, dateTo: today };
    case 'last-12': {
      const from = new Date(`${today}T00:00:00.000Z`);
      from.setUTCFullYear(from.getUTCFullYear() - 1);
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: today };
    }
    case 'all':
      return { dateFrom: '', dateTo: '' };
    default:
      return null;
  }
}

function When ({ facet, state, update, offerWhen }) {
  const [open, setOpen] = useState(false);
  const [fromBuf, setFromBuf] = useState(state[facet.key] || '');
  const [toBuf, setToBuf] = useState(state[facet.key2] || '');
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const fromMonthId = useId();
  const toMonthId = useId();
  const fromDateId = useId();
  const toDateId = useId();
  useOutsideClose(open, setOpen, panelRef, btnRef);

  const dateFrom = state[facet.key] || '';
  const dateTo = state[facet.key2] || '';
  const active = !!(dateFrom || dateTo);

  useEffect(() => { setFromBuf(dateFrom); }, [dateFrom]);
  useEffect(() => { setToBuf(dateTo); }, [dateTo]);

  if (offerWhen == null && !active) return null;
  const bounds = offerWhen || { min: null, max: null };

  function setRange (from, to) {
    update({ [facet.key]: from || '', [facet.key2]: to || '' });
  }

  const months = monthsBetween(bounds?.min, bounds?.max);
  const fromMonth = dateFrom ? dateFrom.slice(0, 7) : (months[0] || '');
  const toMonth = dateTo ? dateTo.slice(0, 7) : (months[months.length - 1] || '');

  const rangeLabel = formatWhenRange(dateFrom, dateTo);
  const btnLabel = rangeLabel || facet.label;

  return (
    <div class="tag-picker-wrap when-wrap">
      <button
        ref={btnRef}
        type="button"
        class={`quiet-btn tag-picker-btn${active ? ' has-active' : ''}${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {btnLabel} {open ? '\u25B4' : '\u25BE'}
      </button>
      {open && (
        <div ref={panelRef} class="tag-picker-panel when-panel">
          {bounds?.min && bounds?.max && (
            <div class="when-bounds">Your library: <TimeText at={String(bounds.min).slice(0, 7)}>{formatMonthYear(bounds.min)}</TimeText> {'\u2013'} <TimeText at={String(bounds.max).slice(0, 7)}>{formatMonthYear(bounds.max)}</TimeText></div>
          )}
          <div class="when-section-label">Period</div>
          <div class="when-presets">
            {DATE_PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                class="quiet-btn"
                onClick={() => {
                  const r = presetRange(p.id, isoToday());
                  if (r) setRange(r.dateFrom, r.dateTo);
                }}
              >{p.label}</button>
            ))}
          </div>
          {months.length > 0 && (
            <>
              <div class="when-section-label">Month</div>
              <div class="arrange-row">
                <label class="visually-hidden" for={fromMonthId}>From month</label>
                <select
                  id={fromMonthId}
                  class="facet-select"
                  value={fromMonth}
                  onChange={e => {
                    const start = monthRange(e.target.value);
                    const end = monthRange(toMonth || e.target.value);
                    setRange(start.dateFrom, end.dateTo);
                  }}
                >
                  {months.map(m => <option key={m} value={m}>{formatMonthYear(m)}</option>)}
                </select>
                <span class="facet-range-sep">{'\u2013'}</span>
                <label class="visually-hidden" for={toMonthId}>To month</label>
                <select
                  id={toMonthId}
                  class="facet-select"
                  value={toMonth}
                  onChange={e => {
                    const start = monthRange(fromMonth || e.target.value);
                    const end = monthRange(e.target.value);
                    setRange(start.dateFrom, end.dateTo);
                  }}
                >
                  {months.map(m => <option key={m} value={m}>{formatMonthYear(m)}</option>)}
                </select>
              </div>
              <div class="when-presets">
                {months.slice(-6).map(m => (
                  <button
                    key={`one-${m}`}
                    type="button"
                    class="quiet-btn"
                    onClick={() => {
                      const r = monthRange(m);
                      setRange(r.dateFrom, r.dateTo);
                    }}
                  ><TimeText at={String(m).slice(0, 7)}>{formatMonthYear(m)}</TimeText></button>
                ))}
              </div>
            </>
          )}
          <div class="when-section-label">Date</div>
          <div class="facet-range">
            <label class="visually-hidden" for={fromDateId}>From date</label>
            <input
              id={fromDateId}
              class="facet-range-input"
              type="date"
              value={fromBuf}
              onInput={e => setFromBuf(e.target.value)}
              onBlur={e => setRange(e.target.value, dateTo)}
              onKeyDown={e => { if (e.key === 'Enter') setRange(e.target.value, dateTo); }}
            />
            <span class="facet-range-sep">{'\u2013'}</span>
            <label class="visually-hidden" for={toDateId}>To date</label>
            <input
              id={toDateId}
              class="facet-range-input"
              type="date"
              value={toBuf}
              onInput={e => setToBuf(e.target.value)}
              onBlur={e => setRange(dateFrom, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setRange(dateFrom, e.target.value); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Nested disclosure tree (`kind: 'nested-tree'`) -------------------------
// Media Type (`tree: 'type-workflow'`) and Aspect Ratio (`tree: 'aspect'`).
// No search. The Models filter stays `kind: 'tree'`. Rows start collapsed; opening
// the panel expands ancestors of checked or indeterminate nodes.

const CLOSED_ASPECT = {
  classes: [
    { key: 'portrait', label: 'Portrait', count: 0, ratios: [] },
    { key: 'landscape', label: 'Landscape', count: 0, ratios: [] },
    { key: 'square', label: 'Square', count: 0, ratios: [] }
  ]
};

function withPaths (nodes, prefix) {
  return (nodes || []).map(node => {
    const path = prefix ? `${prefix}/${node.key}` : node.key;
    const children = withPaths(node.children, path);
    return children.length ? { ...node, path, children } : { ...node, path };
  });
}

function aspectToNodes (payload) {
  return (payload?.classes || []).map(cls => {
    const ratios = cls.ratios || [];
    const sole = ratios.length === 1 ? ratios[0] : null;
    // One named ratio that accounts for the whole class is the class row.
    // A leftover unnamed size keeps the parent and that child.
    const collapse = sole != null && Number(sole.count) === Number(cls.count);
    const node = {
      key: cls.key,
      path: cls.key,
      label: cls.label,
      count: cls.count
    };
    if (collapse || ratios.length === 0) return node;
    node.children = ratios.map(ratio => ({
      key: ratio.value,
      path: `${cls.key}/${ratio.value}`,
      label: ratio.label || ratio.value,
      count: ratio.count
    }));
    return node;
  });
}

function aspectSelection (payload, tokens) {
  const active = new Set(tokens || []);
  const states = new Map();
  const matched = new Set();
  for (const cls of payload?.classes || []) {
    const ratios = (cls.ratios || []).map(r => r.value);
    const classOn = active.has(cls.key);
    if (classOn) matched.add(cls.key);
    const selected = ratios.filter(v => active.has(v));
    for (const v of selected) matched.add(v);
    const all = ratios.length > 0 && selected.length === ratios.length;
    if (classOn || all) {
      states.set(cls.key, 'checked');
      for (const v of ratios) states.set(`${cls.key}/${v}`, 'checked');
    } else if (selected.length > 0) {
      states.set(cls.key, 'indeterminate');
      for (const v of ratios) {
        states.set(`${cls.key}/${v}`, active.has(v) ? 'checked' : 'unchecked');
      }
    } else {
      states.set(cls.key, 'unchecked');
      for (const v of ratios) states.set(`${cls.key}/${v}`, 'unchecked');
    }
  }
  return {
    state (path) {
      return states.get(path) || 'unchecked';
    },
    extras: [...active].filter(t => !matched.has(t))
  };
}

function expandAncestors (nodes, stateOf) {
  const next = new Set();
  function walk (list) {
    for (const node of list || []) {
      const st = stateOf(node.path);
      if (st === 'checked' || st === 'indeterminate') {
        const parts = node.path.split('/');
        let acc = '';
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? `${acc}/${parts[i]}` : parts[i];
          next.add(acc);
        }
      }
      walk(node.children);
    }
  }
  walk(nodes);
  return next;
}

function csvTokens (value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

function uniqTokens (list) {
  const out = [];
  for (const v of list) {
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

function DisclosureTreeRow ({ node, depth, expanded, toggleExpand, stateOf, onToggle }) {
  const kids = node.children || [];
  const showCaret = kids.length > 0;
  const isOpen = expanded.has(node.path);
  const state = stateOf(node.path);
  const title = node.title || undefined;
  return (
    <>
      <div class="tree-picker-row" data-depth={depth}>
        {showCaret
          ? (
            <button
              type="button"
              class="tree-picker-caret"
              aria-expanded={isOpen}
              onClick={() => toggleExpand(node.path)}
            >{isOpen ? '\u25BE' : '\u25B8'}</button>
            )
          : <span class="tree-picker-caret-spacer" />}
        <label>
          <input
            type="checkbox"
            checked={state === 'checked'}
            ref={el => { if (el) el.indeterminate = state === 'indeterminate'; }}
            onChange={() => onToggle(node.path, state !== 'checked')}
          />
          <span class="tree-picker-label" title={title}>{node.label}</span>
        </label>
        {node.count > 0 && <span class="tree-picker-count">{node.count}</span>}
      </div>
      {showCaret && isOpen && kids.map(kid => (
        <DisclosureTreeRow
          key={kid.path}
          node={kid}
          depth={depth + 1}
          expanded={expanded}
          toggleExpand={toggleExpand}
          stateOf={stateOf}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

function NestedTreePicker ({ facet, state, update, facetParams, offer }) {
  const isAspect = facet.tree === 'aspect';
  const [open, setOpen] = useState(false);
  const [openGen, setOpenGen] = useState(0);
  const [tree, setTree] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [appliedExpand, setAppliedExpand] = useState('');
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  useOutsideClose(open, setOpen, panelRef, btnRef);

  const paramsKey = facetParamsKey(facetParams);
  const offeredAspect = offer?.aspect;
  const hasAspectClasses = Array.isArray(offeredAspect?.classes) && offeredAspect.classes.length > 0;
  // alwaysShowRoots lists the three orientation names only when the offer
  // has no classes (an active bookmark on a list that no longer discriminates).
  // It does not put zero-count parents back onto an offer that omitted them.
  const aspectPayload = hasAspectClasses
    ? offeredAspect
    : (facet.alwaysShowRoots ? CLOSED_ASPECT : { classes: [] });
  const paramsSeen = useRef(paramsKey);

  useEffect(() => {
    if (paramsSeen.current === paramsKey) return;
    paramsSeen.current = paramsKey;
    setTree(null);
  }, [paramsKey]);

  useEffect(() => {
    if (isAspect || !open || tree != null) return;
    let cancelled = false;
    getTypeWorkflowTree(facetParams)
      .then(data => { if (!cancelled) setTree(data || { types: [] }); })
      .catch(() => { if (!cancelled) setTree({ types: [] }); });
    return () => { cancelled = true; };
  }, [isAspect, open, tree, paramsKey]);

  const rowNodes = isAspect ? aspectToNodes(aspectPayload) : withPaths(tree?.types);
  const selection = isAspect
    ? aspectSelection(aspectPayload, state.aspect || [])
    : (tree
      ? paramsToTypeWorkflowSelection(tree, {
        type: state.type || [],
        workflowMode: state.workflowMode || [],
        workflow: state.workflow || []
      })
      : { state: () => 'unchecked', extras: [] });

  const readyKey = isAspect
    ? `aspect:${(aspectPayload.classes || []).map(c => c.key).join(',')}`
    : `type:${paramsKey}:${tree ? 'ready' : 'wait'}`;
  const expandStamp = open && (isAspect || tree) ? `${openGen}:${readyKey}` : '';
  if (expandStamp && appliedExpand !== expandStamp) {
    setAppliedExpand(expandStamp);
    setExpanded(expandAncestors(rowNodes, selection.state));
  }

  function toggleOpen () {
    setOpen(current => {
      if (!current) setOpenGen(g => g + 1);
      return !current;
    });
  }

  const tokenCount = isAspect
    ? (state.aspect || []).length
    : (state.type || []).length + (state.workflowMode || []).length + (state.workflow || []).length;

  const extraRows = (selection.extras || []).map(token => ({
    token,
    label: isAspect || !(state.workflow || []).includes(token)
      ? token
      : (formatWorkflowQueryLabel(token) || token)
  }));

  function toggleExpand (path) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function commitType (nextExplicit) {
    const written = selectionToTypeWorkflowParams(tree, nextExplicit);
    const extra = new Set(selection.extras || []);
    update({
      type: uniqTokens([...csvTokens(written.type), ...(state.type || []).filter(t => extra.has(t))]),
      workflowMode: uniqTokens([...csvTokens(written.workflowMode), ...(state.workflowMode || []).filter(t => extra.has(t))]),
      workflow: uniqTokens([...csvTokens(written.workflow), ...(state.workflow || []).filter(t => extra.has(t))])
    });
  }

  function commitAspect (nextExplicit) {
    const written = selectionToAspectParams(aspectPayload, nextExplicit);
    const extra = new Set(selection.extras || []);
    update({
      aspect: uniqTokens([...csvTokens(written.aspect), ...(state.aspect || []).filter(t => extra.has(t))])
    });
  }

  function onToggle (path, turnOn) {
    const explicit = explicitPathsFromState(rowNodes, selection.state);
    const next = toggleCheckedPaths(rowNodes, explicit, path, turnOn);
    if (isAspect) commitAspect(next);
    else if (tree) commitType(next);
  }

  function removeExtra (token) {
    if (isAspect) {
      update({ aspect: (state.aspect || []).filter(t => t !== token) });
      return;
    }
    update({
      type: (state.type || []).filter(t => t !== token),
      workflowMode: (state.workflowMode || []).filter(t => t !== token),
      workflow: (state.workflow || []).filter(t => t !== token)
    });
  }

  const loading = !isAspect && open && tree == null;

  return (
    <div class="tag-picker-wrap">
      <button
        ref={btnRef}
        type="button"
        class={`quiet-btn tag-picker-btn${tokenCount > 0 ? ' has-active' : ''}${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {facet.label}{tokenCount > 0 ? ` (${tokenCount})` : ''} {open ? '\u25B4' : '\u25BE'}
      </button>
      {open && (
        <div ref={panelRef} class="tag-picker-panel nested-tree-panel">
          <div class="tree-picker-list">
            {loading && <span class="tag-picker-empty">Loading…</span>}
            {!loading && rowNodes.length === 0 && extraRows.length === 0 && (
              <span class="tag-picker-empty">Nothing in this list</span>
            )}
            {!loading && rowNodes.map(node => (
              <DisclosureTreeRow
                key={node.path}
                node={node}
                depth={0}
                expanded={expanded}
                toggleExpand={toggleExpand}
                stateOf={selection.state}
                onToggle={onToggle}
              />
            ))}
            {!loading && extraRows.map((row, i) => (
              <div key={`extra:${row.token}:${i}`} class="tree-picker-row" data-depth="0">
                <span class="tree-picker-caret-spacer" />
                <label>
                  <input
                    type="checkbox"
                    checked
                    onChange={() => removeExtra(row.token)}
                  />
                  <span class="tree-picker-label">{row.label}</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- FacetBar --------------------------------------------------------------

const EMPTY_FACET_PARAMS = {};

function facetParamsKey (params) {
  if (!params || typeof params !== 'object') return '';
  return Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
}

function chipOfferValues (facet, offer) {
  if (!offer) return null;
  if (facet.valuesSource === 'types') return offer.show.type ? (offer.types || []) : [];
  if (facet.valuesSource === 'reactionTags') return offer.show.reaction ? (offer.reaction || []) : [];
  if (facet.key === 'publication') return offer.show.publication ? (offer.publication || []) : [];
  // Closed options with no offer slice: treat as all declared options once offer is ready.
  return facet.options || [];
}

export function FacetBar ({
  facets, state, update,
  sortFields = [],
  groupAxes = [],
  search, onSearchInput, searchRef,
  titleSearch, onTitleSearchInput,
  facetParams,
  showSearch = true
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const promptSearchId = useId();
  const titleSearchId = useId();
  const [offer, setOffer] = useState(null);
  const effectiveParams = facetParams || EMPTY_FACET_PARAMS;
  const paramsKey = facetParamsKey(effectiveParams);
  const ownRev = useOwnModelsRevision();
  const offerKey = useRef(paramsKey);

  useEffect(() => {
    let cancelled = false;
    if (offerKey.current !== paramsKey) {
      offerKey.current = paramsKey;
      setOffer(null);
    }
    getListOffer(effectiveParams)
      .then(data => { if (!cancelled) setOffer(data || { show: {}, groupAxes: [] }); })
      .catch(() => { if (!cancelled) setOffer({ show: {}, groupAxes: [] }); });
    return () => { cancelled = true; };
  }, [paramsKey, ownRev]);

  const isPrimary = f => f.kind === 'chips' || f.kind === 'multi' || f.kind === 'tree' || f.kind === 'nested-tree' || f.kind === 'tristate' || f.kind === 'date-range' || f.kind === 'flag';
  const primary = facets.filter(isPrimary);
  const advanced = facets.filter(f => !isPrimary(f));

  const offeredGroupAxes = (() => {
    if (offer == null) return null;
    const allowed = new Set(offer.groupAxes || []);
    const list = (groupAxes || []).filter(a => allowed.has(a.value));
    const gb = state.groupBy && state.groupBy !== 'none' ? state.groupBy : null;
    if (gb && !list.some(a => a.value === gb)) {
      const fromProp = (groupAxes || []).find(a => a.value === gb);
      list.push(fromProp || { value: gb, label: gb });
    }
    return list;
  })();

  const advancedVisible = advanced.filter(facet => {
    if (offer == null) return false;
    if (facet.kind === 'number-range') {
      if (facet.key === 'cfgMin') {
        return offer.show.cfg || state.cfgMin != null || state.cfgMax != null;
      }
      if (facet.key === 'stepsMin') {
        return offer.show.steps || state.stepsMin != null || state.stepsMax != null;
      }
    }
    return true;
  });

  const renderFacet = (facet) => {
    const listKey = facetListKey(facet);
    switch (facet.kind) {
      case 'chips':
        return (
          <ChipGroup
            key={listKey}
            facet={facet}
            active={state[facet.key] || []}
            update={update}
            offerValues={chipOfferValues(facet, offer)}
          />
        );
      case 'multi':
        return (
          <MultiSelect
            key={listKey}
            facet={facet}
            active={state[facet.key] || []}
            update={update}
            facetParams={effectiveParams}
            offerShow={offer == null ? null : !!offer.show.tags}
          />
        );
      case 'tree':
        return (
          <TreePicker
            key={listKey}
            facet={facet}
            state={state}
            update={update}
            facetParams={effectiveParams}
            offerShow={offer == null ? null : !!offer.show.resources}
            showOwn={offer == null ? false : !!offer.show.ownModels}
            ownRev={ownRev}
          />
        );
      case 'nested-tree': {
        if (offer == null) return null;
        if (facet.tree === 'type-workflow') {
          const active = (state.type || []).length
            || (state.workflowMode || []).length
            || (state.workflow || []).length;
          if (!offer.show.typeTree && !active) return null;
        } else if (facet.tree === 'aspect') {
          const active = (state.aspect || []).length;
          if (!offer.show.aspect && !active) return null;
        } else {
          return null;
        }
        return (
          <NestedTreePicker
            key={listKey}
            facet={facet}
            state={state}
            update={update}
            facetParams={effectiveParams}
            offer={offer}
          />
        );
      }
      case 'date-range':
        if (offer == null) return null;
        if (!offer.show.when && !(state[facet.key] || state[facet.key2])) return null;
        return (
          <When
            key={listKey}
            facet={facet}
            state={state}
            update={update}
            offerWhen={offer.when || { min: null, max: null }}
          />
        );
      case 'number-range': {
        if (offer == null) return null;
        const isCfg = facet.key === 'cfgMin';
        const shown = isCfg
          ? (offer.show.cfg || state.cfgMin != null || state.cfgMax != null)
          : (offer.show.steps || state.stepsMin != null || state.stepsMax != null);
        if (!shown) return null;
        return <RangePicker key={listKey} label={facet.label} minKey={facet.key} maxKey={facet.key2} state={state} update={update} type="number" />;
      }
      case 'tristate':
        return <Segmented key={listKey} facet={facet} value={state[facet.key]} update={update} />;
      case 'flag':
        return (
          <Flag
            key={listKey}
            facet={facet}
            value={state[facet.key]}
            update={update}
            offerShow={offer == null ? null : !!offer.show.usedAsInput}
          />
        );
      default:
        return null;
    }
  };

  const showArrange = (sortFields || []).length > 0 || (groupAxes || []).length > 0;
  // While offer loads, omit group-by axes (do not flash the full set). Sort direction stays.
  const arrangeGroupAxes = offeredGroupAxes == null
    ? []
    : offeredGroupAxes;

  return (
    <search class="filter-bar facet-bar">
      <div class="facet-primary">
        {primary.map(renderFacet)}
      </div>
      <div class="filter-controls">
        {showArrange && (
          <Arrange
            state={state}
            sortFields={sortFields}
            groupAxes={arrangeGroupAxes}
            update={update}
          />
        )}
        {advancedVisible.length > 0 && (
          <button
            type="button"
            class={`quiet-btn${moreOpen ? ' open' : ''}`}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(o => !o)}
          >
            More {moreOpen ? '\u25B4' : '\u25BE'}
          </button>
        )}
        {showSearch && (
          <>
            <label class="visually-hidden" for={promptSearchId}>Search prompts</label>
            <input
              id={promptSearchId}
              ref={searchRef}
              type="search"
              class="search-input"
              placeholder="Search prompts…"
              title="Search prompts"
              value={search || ''}
              onInput={e => onSearchInput(e.target.value)}
            />
          </>
        )}
        {typeof onTitleSearchInput === 'function' && (
          <>
            <label class="visually-hidden" for={titleSearchId}>Search titles</label>
            <input
              id={titleSearchId}
              type="search"
              class="search-input"
              placeholder="Search titles…"
              title="Search titles"
              value={titleSearch || ''}
              onInput={e => onTitleSearchInput(e.target.value)}
            />
          </>
        )}
      </div>
      {moreOpen && advancedVisible.length > 0 && (
        <div class="facet-advanced">
          {advancedVisible.map(renderFacet)}
        </div>
      )}
    </search>
  );
}
