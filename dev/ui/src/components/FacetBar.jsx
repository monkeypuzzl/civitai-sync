import { useState, useRef, useEffect, useId } from 'preact/hooks';
import { useOwnModelsRevision } from '../lib/own-models-rev.js';
import { useIndexEpoch } from '../lib/index-settle.js';
import { tagLabel } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';
import { formatDateRange } from '../lib/date-label.js';
import { getFacetValues, getModelHierarchy, getListOffer, getTypeWorkflowTree } from '../api.js';
import { modelTypeLabel } from '../lib/modelTypeDisplay.js';
import { RangePicker } from './RangePicker.jsx';
import { ChipOverflow } from './ChipOverflow.jsx';
import {
  explicitPathsFromState,
  paramsToTypeWorkflowSelection,
  selectionToAspectParams,
  selectionToTypeWorkflowParams,
  toggleCheckedPaths
} from '../../../../src/nestedTree.mjs';
import { filterExtraParts, typeWorkflowRowParts } from '../lib/type-workflow-label.js';
import { arrangeTagOptions } from '../lib/tag-picker.js';
import { parseModels, serializeModels, stringLiftQuery } from '../../../../src/modelsQuery.mjs';
import {
  hasFlatTaxonomy,
  clearedFlatTaxonomy,
  scopeNodeKey as nodeKey,
  ancestorExpandKeys,
  narrowOwnSelection
} from '../lib/scope.js';
import {
  compactModelSelection,
  modelDisplayRoots,
  modelRowMatches,
  modelRowState,
  modelStructuralState,
  modelTermForOwnUncheck,
  toggleModelRow
} from '../lib/model-tree-fold.js';
import { dropModelGroup, modelChipGroups } from '../lib/model-chip-groups.js';

// Schema-driven FacetBar. Membership chrome (facets + More + Search) is the
// default. Arrangement chrome (the Arrange cluster: group-by / group-order /
// item-sort) is opt-in: mount it only when the host passes a non-empty
// `sortFields` and/or `groupAxes`. Galleries (Generations / Posts / Comics)
// opt in. Export hosts must not — an export is a membership set, not a
// sorted gallery page. Each facet is one of: chip group (inline, or a
// labelled compact picker matching TreePicker / Date chrome), multi-select,
// hierarchical tree (Models), nested disclosure tree (Media Type and
// Aspect Ratio), Date (date range), number range,
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

function useOutsideClose (open, setOpen, panelRef, btnRef, extraRef) {
  useEffect(() => {
    if (!open) return undefined;
    function onDown (e) {
      const target = e.target;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (btnRef.current && btnRef.current.contains(target)) return;
      if (extraRef && extraRef.current && extraRef.current.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, setOpen, panelRef, btnRef, extraRef]);
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
// Models & resources / Date — a labelled compact picker matching TreePicker / Date chrome.
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

function ratingParamKey (params) {
  const rating = params && params.rating;
  if (Array.isArray(rating)) return rating.join(',');
  return rating == null ? '' : String(rating);
}

function offeredRows (rows, total) {
  return (rows || []).filter(o => {
    if (typeof o.count !== 'number') return true;
    if (o.count <= 0) return false;
    if (total != null && o.count === total) return false;
    return true;
  });
}

function MultiSelect ({ facet, active, ratingActive, postTagActive, update, facetParams, offerShow }) {
  const fullActive = active || [];
  const fullRating = ratingActive || [];
  const fullPost = postTagActive || [];
  const displayActive = fullActive;
  const isTags = facet.key === 'tag';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('content');
  const [loaded, setLoaded] = useState(facet.options ? facet.options.map(v => ({ value: v, label: optionLabel(facet, v) })) : null);
  const [tagTotal, setTagTotal] = useState(null);
  const [ratingRows, setRatingRows] = useState(null);
  const [ratingTotal, setRatingTotal] = useState(null);
  const [postRows, setPostRows] = useState(null);
  const [postTotal, setPostTotal] = useState(null);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const activeRef = useRef(fullActive);
  const postRef = useRef(fullPost);
  const updateRef = useRef(update);
  const seenRating = useRef(null);
  activeRef.current = fullActive;
  postRef.current = fullPost;
  updateRef.current = update;
  const paramsKey = JSON.stringify(facetParams || {});
  const ratingKey = ratingParamKey(facetParams);
  useOutsideClose(open, setOpen, panelRef, btnRef);

  useEffect(() => {
    if (!open || !facet.source) return undefined;
    let cancelled = false;
    const requestedRating = ratingKey;
    getFacetValues(facet.source, facetParams)
      .then(data => {
        if (cancelled) return;
        const values = (data.values || []).map(v => ({
          value: v.value,
          label: v.label || v.value,
          count: v.count
        }));
        setTagTotal(typeof data.total === 'number' ? data.total : null);
        setLoaded(values);
        if (isTags) {
          setRatingTotal(typeof data.ratingTotal === 'number' ? data.ratingTotal : null);
          setRatingRows((data.ratings || []).map(v => ({
            value: v.value,
            label: v.label || v.value,
            count: v.count
          })));
          setPostTotal(typeof data.postTotal === 'number' ? data.postTotal : null);
          setPostRows((data.postTags || []).map(v => ({
            value: v.value,
            label: v.label || v.value,
            count: v.count
          })));
          const previous = seenRating.current;
          seenRating.current = requestedRating;
          if (previous != null && previous !== requestedRating) {
            const offered = new Set(values.map(v => v.value));
            const current = activeRef.current;
            const next = current.filter(v => offered.has(v));
            const postOffered = new Set((data.postTags || []).map(v => v.value));
            const currentPost = postRef.current;
            const nextPost = currentPost.filter(v => postOffered.has(v));
            const patch = {};
            if (next.length !== current.length) patch[facet.key] = next;
            if (nextPost.length !== currentPost.length) patch.postTag = nextPost;
            if (Object.keys(patch).length) updateRef.current(patch);
          }
        }
      })
      .catch(() => { if (!cancelled) setLoaded([]); });
    return () => { cancelled = true; };
  }, [open, facet.source, paramsKey, ratingKey, isTags, facet.key]);

  if (offerShow == null) return null;
  if (!offerShow && displayActive.length === 0 && fullRating.length === 0) return null;

  const options = loaded == null
    ? null
    : (() => {
      const filtered = offeredRows(loaded, tagTotal);
      const have = new Set(filtered.map(o => o.value));
      const extras = displayActive.filter(v => !have.has(v)).map(v => ({ value: v, label: optionLabel(facet, v) }));
      return extras.length ? [...extras, ...filtered] : filtered;
    })();
  const ratingOptions = !isTags || ratingRows == null
    ? null
    : (() => {
      const filtered = offeredRows(ratingRows, ratingTotal);
      const have = new Set(filtered.map(o => o.value));
      const extras = fullRating.filter(v => !have.has(v)).map(v => ({ value: v, label: optionLabel(facet, v) }));
      return extras.length ? [...extras, ...filtered] : filtered;
    })();

  const postOptions = !isTags || postRows == null
    ? null
    : (() => {
      const filtered = offeredRows(postRows, postTotal);
      const have = new Set(filtered.map(o => o.value));
      const extras = fullPost.filter(v => !have.has(v)).map(v => ({ value: v, label: optionLabel(facet, v) }));
      return extras.length ? [...extras, ...filtered] : filtered;
    })();
  const arranged = options == null
    ? null
    : arrangeTagOptions(
      options,
      search,
      isTags ? (ratingOptions || []) : undefined,
      isTags ? (postOptions || []) : undefined,
      section
    );
  const showNoMatches = arranged != null && section === 'content' && arranged.general.length === 0
    && (search !== '' || arranged.ratings.length === 0);
  const showPostEmpty = arranged != null && section === 'posts' && (arranged.posts || []).length === 0 && search !== '';
  const selectedCount = displayActive.length + (isTags ? fullRating.length + fullPost.length : 0);
  const showPosts = isTags && ((postOptions && postOptions.length > 0) || fullPost.length > 0);

  const tagChip = (list, keyName) => (o) => (
    <button
      key={o.value}
      type="button"
      class={`tag-chip${list.includes(o.value) ? ' active' : ''}`}
      onClick={() => update({ [keyName]: toggleMember(list, o.value) })}
      title={o.value}
    >
      {o.label}
    </button>
  );

  return (
    <div class="tag-picker-wrap">
      <button
        ref={btnRef}
        type="button"
        class={`quiet-btn tag-picker-btn${selectedCount > 0 ? ' has-active' : ''}${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {facet.label}{selectedCount > 0 ? ` (${selectedCount})` : ''} {open ? '\u25B4' : '\u25BE'}
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
          {arranged == null && <span class="tag-picker-empty">Loading…</span>}
          {arranged != null && arranged.ratings.length > 0 && (
            <div class="tag-picker-section tag-picker-rating">
              <div class="tag-picker-section-label">Rating</div>
              <div class="tag-picker-chips">
                {arranged.ratings.map(tagChip(fullRating, 'rating'))}
              </div>
            </div>
          )}
          <div class="tag-picker-list">
            {showPosts && (
              <div class="tag-picker-section">
                <button
                  type="button"
                  class="tag-picker-section-label tag-picker-disclosure"
                  aria-expanded={section === 'posts'}
                  onClick={() => setSection(current => current === 'posts' ? 'content' : 'posts')}
                >
                  Posts {section === 'posts' ? '\u25BE' : '\u25B8'}
                </button>
                {section === 'posts'
                  ? (showPostEmpty
                    ? <span class="tag-picker-empty">No matches</span>
                    : <div class="tag-picker-scroll"><div class="tag-picker-chips">{(arranged.posts || []).map(tagChip(fullPost, 'postTag'))}</div></div>)
                  : (fullPost.length > 0 && (
                    <div class="tag-picker-chips">{fullPost.map(value => tagChip(fullPost, 'postTag')({ value, label: optionLabel(facet, value) }))}</div>
                  ))}
              </div>
            )}
            {arranged != null && (arranged.general.length > 0 || showNoMatches || displayActive.length > 0) && (
              <div class="tag-picker-section">
                <button
                  type="button"
                  class="tag-picker-section-label tag-picker-disclosure"
                  aria-expanded={section === 'content'}
                  onClick={() => setSection('content')}
                >
                  Content {section === 'content' ? '\u25BE' : '\u25B8'}
                </button>
                {section === 'content'
                  ? (arranged.general.length === 0
                    ? <span class="tag-picker-empty">No matches</span>
                    : <div class="tag-picker-scroll"><div class="tag-picker-chips">{arranged.general.map(tagChip(displayActive, facet.key))}</div></div>)
                  : (displayActive.length > 0 && (
                    <div class="tag-picker-chips">{displayActive.map(value => tagChip(displayActive, facet.key)({ value, label: optionLabel(facet, value) }))}</div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Hierarchical tree picker (`kind: 'tree'`, `models=` grammar) ---------

function TreeRow ({ row, tree, terms, search, expanded, toggleExpand, onToggle, depth, registerRow }) {
  if (!row) return null;
  const q = search.trim().toLowerCase();
  if (q && !modelRowMatches(row, q)) return null;
  const kids = row.children || [];
  const state = modelRowState(tree, terms, row);
  const key = row.key;
  const isOpen = expanded.has(key) || !!q;
  const showCaret = kids.length > 0;

  return (
    <>
      <div
        class="tree-picker-row"
        data-depth={depth}
        ref={el => { if (registerRow) registerRow(key, el); }}
      >
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
            onChange={() => onToggle(row.term, state !== 'checked')}
          />
          <span class="tree-picker-label">{row.label}</span>
        </label>
        <span class="tree-picker-count">{row.count}</span>
      </div>
      {showCaret && isOpen && kids.map(kid => (
        <TreeRow
          key={kid.key}
          row={kid}
          tree={tree}
          terms={terms}
          search={search}
          expanded={expanded}
          toggleExpand={toggleExpand}
          onToggle={onToggle}
          depth={depth + 1}
          registerRow={registerRow}
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

function TreePicker ({ facet, state, update, facetParams, offerShow, showOwn, ownKnown, ownRev }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tree, setTree] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [scrollKey, setScrollKey] = useState('');
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const moreRef = useRef(null);
  const rowRefs = useRef(new Map());
  const normalizedRef = useRef(false);
  const seenRev = useRef(ownRev);
  const indexEpoch = useIndexEpoch();
  const seenIndex = useRef(indexEpoch);
  useOutsideClose(open, setOpen, panelRef, btnRef, moreRef);

  const parsedModels = parseModels(state.models);
  const terms = parsedModels.filter(term => !term.mine);
  const mineTerm = parsedModels.find(term => term.mine) || null;
  const mine = !!mineTerm && !!ownKnown;
  const mineHoles = mine && Array.isArray(mineTerm.except) ? mineTerm.except : [];

  useEffect(() => {
    if (seenRev.current === ownRev) return;
    seenRev.current = ownRev;
    setTree(null);
  }, [ownRev]);

  useEffect(() => {
    if (seenIndex.current === indexEpoch) return;
    seenIndex.current = indexEpoch;
    setTree(null);
  }, [indexEpoch]);

  useEffect(() => {
    const needsFetch = open || parsedModels.length > 0;
    if (!needsFetch || tree != null) return;
    let cancelled = false;
    getModelHierarchy(facetParams)
      .then(data => { if (!cancelled) setTree(data); })
      .catch(() => { if (!cancelled) setTree({ types: [] }); });
    return () => { cancelled = true; };
  }, [open, tree, state, facetParams]);

  useEffect(() => {
    if (normalizedRef.current) return;
    const dirty = state.scope || hasFlatTaxonomy(state) || (state.familyId != null && state.familyId !== '');
    if (!dirty) {
      normalizedRef.current = true;
      return;
    }
    normalizedRef.current = true;
    const lifted = stringLiftQuery({
      models: state.models,
      scope: state.scope,
      model: state.model,
      version: state.version,
      ecosystem: state.ecosystem,
      resourceType: state.resourceType,
      resource: state.resource,
      versionId: state.versionId,
      familyId: state.familyId
    });
    update({
      models: lifted.models || '',
      scope: '',
      familyId: '',
      ...clearedFlatTaxonomy()
    });
  }, [state, update]);

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
  }, [tree, state.models, mine]);

  useEffect(() => {
    if (!open || !scrollKey) return;
    const el = rowRefs.current.get(scrollKey);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [open, scrollKey, tree, expanded]);

  if (offerShow == null) return null;
  if (!offerShow && !mine && !terms.length && !hasFlatTaxonomy(state)) return null;

  const owned = ownedModelTerms(tree);
  const ownedKept = owned.filter(node => !mineHoles.some(hole => String(hole.modelId) === String(node.modelId)));
  const displayTerms = mine ? terms.concat(ownedKept) : terms;
  const mineState = mine
    ? (mineHoles.length ? 'indeterminate' : 'checked')
    : (!owned.length
      ? 'unchecked'
      : owned.every(n => modelStructuralState(tree, terms, n) === 'checked')
        ? 'checked'
        : owned.some(n => modelStructuralState(tree, terms, n) !== 'unchecked')
          ? 'indeterminate'
          : 'unchecked');
  const showMineRow = !!showOwn || mine;
  const activeCount = terms.length + (mine ? 1 : 0);

  function commit (nextTerms) {
    update({ models: serializeModels(nextTerms), ...clearedFlatTaxonomy() });
  }

  function onMineToggle () {
    if (!tree && !mine) return;
    if (mine) {
      commit(terms);
      return;
    }
    if (mineState === 'checked') {
      let next = terms;
      for (const node of owned) next = toggleModelRow(tree, next, node, false);
      commit(next);
      return;
    }
    commit([...terms, { mine: true }]);
  }

  function onToggle (term, turnOn) {
    if (!tree) return;
    const ownTerm = modelTermForOwnUncheck(term);
    const isOwnedModel = ownTerm?.modelId && !ownTerm.versionId
      && owned.some(n => String(n.modelId) === String(ownTerm.modelId));
    if (!turnOn && mine && isOwnedModel) {
      const next = narrowOwnSelection({
        mine: true,
        terms: mineTerm ? [...terms, mineTerm] : terms,
        ownedNodes: owned,
        unchecked: ownTerm
      });
      commit(compactModelSelection(tree, next.terms));
      return;
    }
    commit(toggleModelRow(tree, terms, term, turnOn));
  }

  function toggleExpand (key) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function registerRow (key, el) {
    if (el) rowRefs.current.set(key, el);
    else rowRefs.current.delete(key);
  }

  function focusTerm (term, parent) {
    if (term) {
      const keys = ancestorExpandKeys(term);
      setExpanded(prev => {
        const next = new Set(prev);
        for (const key of keys) next.add(key);
        return next;
      });
      setScrollKey(parent && keys.length ? keys[keys.length - 1] : nodeKey(term));
    }
    setOpen(true);
  }

  const roots = tree ? modelDisplayRoots(tree) : [];
  const chipGroups = (() => {
    const groups = modelChipGroups(tree, parsedModels).filter(group => {
      if (ownKnown === false && parsedModels[group.termIndexes[0]]?.mine) return false;
      return true;
    });
    const mineFirst = [];
    const rest = [];
    for (const group of groups) {
      if (parsedModels[group.termIndexes[0]]?.mine) mineFirst.push(group);
      else rest.push(group);
    }
    return [...mineFirst, ...rest];
  })();

  function renderGroup (group, index) {
    const dismiss = () => commit(dropModelGroup(parsedModels, group));
    if (group.kind === 'cluster') {
      return (
        <span key={`${group.text}:${index}`} class="tag-chip active tree-picker-chip chip-cluster">
          <button
            type="button"
            class="chip-cluster-show"
            onClick={() => focusTerm(parsedModels[group.termIndexes[0]], true)}
          >
            {group.text}
          </button>
          <button
            type="button"
            class="chip-cluster-remove"
            aria-label={group.ariaLabel}
            title={group.title}
            onClick={dismiss}
          >
            {'\u00D7'}
          </button>
        </span>
      );
    }
    const except = group.kind === 'except';
    return (
      <button
        key={`${group.text}:${index}`}
        type="button"
        class={`tag-chip tree-picker-chip remove${except ? ' exception' : ' active'}`}
        title={group.title}
        aria-label={group.ariaLabel}
        onClick={dismiss}
      >
        {group.text} {'\u00D7'}
      </button>
    );
  }

  return (
    <div class="tag-picker-wrap tree-picker-wrap">
      <button
        ref={btnRef}
        type="button"
        class={`quiet-btn tag-picker-btn${activeCount > 0 ? ' has-active' : ''}${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {facet.label} {open ? '\u25B4' : '\u25BE'}
      </button>
      {chipGroups.length > 0 && (
        <ChipOverflow
          maxLines={1}
          panelOpen={open}
          anchorRef={moreRef}
          onMore={index => {
            if (open) {
              setOpen(false);
              return;
            }
            const group = chipGroups[index];
            focusTerm(parsedModels[group?.termIndexes?.[0]], group?.kind === 'cluster');
          }}
        >
          {chipGroups.map(renderGroup)}
        </ChipOverflow>
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
              <div class="tree-picker-row" data-depth="0" title="My models">
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
            {tree != null && roots.length === 0 && <span class="tag-picker-empty">No models in the library</span>}
            {tree != null && roots.map(row => (
              <TreeRow
                key={row.key}
                row={row}
                tree={tree}
                terms={displayTerms}
                search={search}
                expanded={expanded}
                toggleExpand={toggleExpand}
                onToggle={onToggle}
                depth={0}
                registerRow={registerRow}
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

// --- Date (date range: presets / corpus months / custom) -------------------

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

function DateRange ({ facet, state, update, dateBounds }) {
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

  if (dateBounds == null && !active) return null;
  const bounds = dateBounds || { min: null, max: null };

  function setRange (from, to) {
    update({ [facet.key]: from || '', [facet.key2]: to || '' });
  }

  const months = monthsBetween(bounds?.min, bounds?.max);
  const fromMonth = dateFrom ? dateFrom.slice(0, 7) : (months[0] || '');
  const toMonth = dateTo ? dateTo.slice(0, 7) : (months[months.length - 1] || '');

  const rangeLabel = formatDateRange(dateFrom, dateTo);
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

function FilterText ({ parts }) {
  const abbr = parts.abbreviation
    ? (parts.expansion
        ? <abbr title={parts.expansion}>{parts.abbreviation}</abbr>
        : parts.abbreviation)
    : null;
  if (abbr && parts.label) return <>{abbr}{' \u00B7 '}{parts.label}</>;
  if (abbr) return abbr;
  return parts.label;
}

function DisclosureTreeRow ({ node, depth, expanded, toggleExpand, stateOf, onToggle }) {
  const kids = node.children || [];
  const showCaret = kids.length > 0;
  const isOpen = expanded.has(node.path);
  const state = stateOf(node.path);
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
          <span class="tree-picker-label">
            <FilterText parts={typeWorkflowRowParts(node, depth)} />
          </span>
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
        type: state.mediaType || [],
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
    : (state.mediaType || []).length + (state.workflowMode || []).length + (state.workflow || []).length;

  const extraRows = (selection.extras || []).map(token => ({
    token,
    parts: isAspect
      ? { abbreviation: '', expansion: '', label: token }
      : filterExtraParts(token, { workflow: (state.workflow || []).includes(token) })
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
      mediaType: uniqTokens([...csvTokens(written.type), ...(state.mediaType || []).filter(t => extra.has(t))]),
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
      mediaType: (state.mediaType || []).filter(t => t !== token),
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
                  <span class="tree-picker-label"><FilterText parts={row.parts} /></span>
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
  const indexEpoch = useIndexEpoch();
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
  }, [paramsKey, ownRev, indexEpoch]);

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
            ratingActive={state.rating || []}
            postTagActive={state.postTag || []}
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
            ownKnown={offer == null ? false : offer.ownKnown === true}
            ownRev={ownRev}
          />
        );
      case 'nested-tree': {
        if (offer == null) return null;
        if (facet.tree === 'type-workflow') {
          const active = (state.mediaType || []).length
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
          <DateRange
            key={listKey}
            facet={facet}
            state={state}
            update={update}
            dateBounds={offer.when || { min: null, max: null }}
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
