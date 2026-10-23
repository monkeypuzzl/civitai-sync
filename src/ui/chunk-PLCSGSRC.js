import {
  ancestorExpandKeys,
  clearedFlatTaxonomy,
  compactModelSelection,
  dropModelGroup,
  formatDateRange,
  hasFlatTaxonomy,
  modelChipGroups,
  modelDisplayRoots,
  modelRowMatches,
  modelRowState,
  modelStructuralState,
  modelTermForOwnUncheck,
  narrowOwnSelection,
  scopeNodeKey,
  toggleModelRow
} from "./chunk-LNGUPSA6.js";
import {
  ChipOverflow,
  WORKFLOW_ABBREVIATION_EXPANSIONS,
  formatWorkflowQueryLabel,
  getWorkflowAbbreviationExpansion,
  getWorkflowDisplayLabel,
  getWorkflowModeAbbreviation
} from "./chunk-TQWSKHC6.js";
import {
  modelTypeLabel
} from "./chunk-XQGXV6CL.js";
import {
  useOwnModelsRevision
} from "./chunk-JLH4BCQU.js";
import {
  TimeText
} from "./chunk-X3SNRSQH.js";
import {
  useIndexEpoch
} from "./chunk-ECN4OFEF.js";
import {
  A,
  d,
  g,
  getFacetValues,
  getListOffer,
  getModelHierarchy,
  getTypeWorkflowTree,
  k,
  parseModels,
  ratingTagLabel,
  ratingTagRank,
  serializeModels,
  stringLiftQuery,
  tagLabel,
  u,
  y
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/components/RangePicker.jsx
function RangePicker({ label, minKey, maxKey, state, update, type = "number" }) {
  const fmt = (v) => v == null || v === "" || typeof v === "number" && Number.isNaN(v) ? "" : String(v);
  const [min, setMin] = d(fmt(state[minKey]));
  const [max, setMax] = d(fmt(state[maxKey]));
  y(() => {
    setMin(fmt(state[minKey]));
  }, [state[minKey]]);
  y(() => {
    setMax(fmt(state[maxKey]));
  }, [state[maxKey]]);
  function commit(key, raw) {
    if (type === "date") {
      update({ [key]: raw || null });
      return;
    }
    const n = raw === "" ? null : Number(raw);
    update({ [key]: n == null || Number.isNaN(n) ? null : n });
  }
  const inputType = type === "date" ? "date" : "number";
  const minId = g();
  const maxId = g();
  const minCaption = type === "date" ? `${label} from` : `${label} minimum`;
  const maxCaption = type === "date" ? `${label} to` : `${label} maximum`;
  const onBound = (key, setter) => ({
    value: key === minKey ? min : max,
    onInput: (e) => setter(e.target.value),
    onBlur: (e) => commit(key, e.target.value),
    onKeyDown: (e) => {
      if (e.key === "Enter") commit(key, e.target.value);
    }
  });
  return /* @__PURE__ */ u("div", { class: "facet-range", children: [
    /* @__PURE__ */ u("span", { class: "facet-range-label", children: label }),
    /* @__PURE__ */ u("label", { class: "visually-hidden", for: minId, children: minCaption }),
    /* @__PURE__ */ u(
      "input",
      {
        id: minId,
        class: "facet-range-input",
        type: inputType,
        placeholder: type === "date" ? "from" : "min",
        ...onBound(minKey, setMin)
      }
    ),
    /* @__PURE__ */ u("span", { class: "facet-range-sep", children: "\u2013" }),
    /* @__PURE__ */ u("label", { class: "visually-hidden", for: maxId, children: maxCaption }),
    /* @__PURE__ */ u(
      "input",
      {
        id: maxId,
        class: "facet-range-input",
        type: inputType,
        placeholder: type === "date" ? "to" : "max",
        ...onBound(maxKey, setMax)
      }
    )
  ] });
}

// src/nestedTree.mjs
function csvList(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value).split(",").map((s) => s.trim()).filter(Boolean);
}
function childPath(parent, key) {
  return parent ? `${parent}/${key}` : key;
}
function checkState(node, explicit, path, ancestorChecked = false) {
  if (ancestorChecked || explicit.has(path)) return "checked";
  const kids = node.children || [];
  if (!kids.length) return "unchecked";
  const states = kids.map((k2) => checkState(k2, explicit, childPath(path, k2.key), false));
  if (node.kind === "type") {
    return states.some((s) => s !== "unchecked") ? "indeterminate" : "unchecked";
  }
  if (states.every((s) => s === "checked")) return "checked";
  if (states.some((s) => s !== "unchecked")) return "indeterminate";
  return "unchecked";
}
function modeFullySelected(node, path, explicit) {
  if (explicit.has(path)) return true;
  const leaves = node.children || [];
  if (!leaves.length) return false;
  return leaves.every((leaf) => explicit.has(childPath(path, leaf.key)));
}
function childFullySelected(node, path, explicit) {
  if (node.kind === "mode") return modeFullySelected(node, path, explicit);
  return explicit.has(path);
}
function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}
function selectionToTypeWorkflowParams(tree, checkedPaths) {
  const explicit = checkedPaths instanceof Set ? checkedPaths : new Set(checkedPaths || []);
  const types = [];
  const modes = [];
  const workflows = [];
  for (const typeNode of tree?.types || []) {
    const typePath = typeNode.key;
    const children = typeNode.children || [];
    const allChildren = children.length > 0 && children.every((child) => childFullySelected(child, childPath(typePath, child.key), explicit));
    const soleUnary = children.length === 1 && children[0].kind === "workflow";
    if (explicit.has(typePath) || allChildren && !soleUnary) {
      pushUnique(types, typeNode.key);
      continue;
    }
    for (const child of children) {
      const path = childPath(typePath, child.key);
      if (child.kind === "mode") {
        if (modeFullySelected(child, path, explicit)) {
          pushUnique(modes, child.key);
          continue;
        }
        for (const leaf of child.children || []) {
          if (explicit.has(childPath(path, leaf.key))) pushUnique(workflows, leaf.key);
        }
      } else if (child.kind === "workflow") {
        if (explicit.has(path)) pushUnique(workflows, child.key);
      } else if (child.kind === "remainder") {
        if (explicit.has(path)) pushUnique(modes, child.key);
      }
    }
  }
  const out = {};
  if (types.length) out.type = types.join(",");
  if (modes.length) out.workflowMode = modes.join(",");
  if (workflows.length) out.workflow = workflows.join(",");
  return out;
}
function indexTree(tree) {
  const typeKeys = /* @__PURE__ */ new Set();
  const modePaths = /* @__PURE__ */ new Map();
  const workflowPaths = /* @__PURE__ */ new Map();
  const add = (map, key, path) => {
    const list = map.get(key);
    if (list) list.push(path);
    else map.set(key, [path]);
  };
  for (const typeNode of tree?.types || []) {
    typeKeys.add(typeNode.key);
    for (const child of typeNode.children || []) {
      const path = childPath(typeNode.key, child.key);
      if (child.kind === "mode" || child.kind === "remainder") add(modePaths, child.key, path);
      if (child.kind === "workflow") add(workflowPaths, child.key, path);
      for (const leaf of child.children || []) {
        add(workflowPaths, leaf.key, childPath(path, leaf.key));
      }
    }
  }
  return { typeKeys, modePaths, workflowPaths };
}
function underExplicit(path, explicit) {
  const parts2 = path.split("/");
  let acc = "";
  for (let i = 0; i < parts2.length - 1; i++) {
    acc = acc ? `${acc}/${parts2[i]}` : parts2[i];
    if (explicit.has(acc)) return true;
  }
  return false;
}
function fillStates(nodes, explicit, ancestorChecked, prefix, into) {
  for (const node of nodes || []) {
    const path = prefix ? childPath(prefix, node.key) : node.key;
    const selfChecked = ancestorChecked || explicit.has(path);
    if (selfChecked) {
      into.set(path, "checked");
      fillStates(node.children || [], explicit, true, path, into);
      continue;
    }
    fillStates(node.children || [], explicit, false, path, into);
    into.set(path, checkState(node, explicit, path, false));
  }
}
function paramsToTypeWorkflowSelection(tree, params = {}) {
  const typeTokens = csvList(params.type);
  const modeTokens = csvList(params.workflowMode);
  const workflowTokens = csvList(params.workflow);
  const { typeKeys, modePaths, workflowPaths } = indexTree(tree);
  const explicit = /* @__PURE__ */ new Set();
  const matchedTypes = /* @__PURE__ */ new Set();
  const matchedModes = /* @__PURE__ */ new Set();
  const matchedWorkflows = /* @__PURE__ */ new Set();
  for (const token of typeTokens) {
    if (!typeKeys.has(token)) continue;
    explicit.add(token);
    matchedTypes.add(token);
  }
  for (const token of modeTokens) {
    const paths = modePaths.get(token);
    if (!paths) continue;
    matchedModes.add(token);
    for (const path of paths) {
      if (!underExplicit(path, explicit)) explicit.add(path);
    }
  }
  for (const token of workflowTokens) {
    const paths = workflowPaths.get(token);
    if (!paths) continue;
    matchedWorkflows.add(token);
    for (const path of paths) {
      if (!underExplicit(path, explicit)) explicit.add(path);
    }
  }
  const states = /* @__PURE__ */ new Map();
  fillStates(tree?.types || [], explicit, false, "", states);
  const extras = [
    ...typeTokens.filter((t) => !matchedTypes.has(t)),
    ...modeTokens.filter((t) => !matchedModes.has(t)),
    ...workflowTokens.filter((t) => !matchedWorkflows.has(t))
  ];
  return {
    state(path) {
      return states.get(path) || "unchecked";
    },
    extras
  };
}
function selectionToAspectParams(tree, checkedPaths) {
  const explicit = checkedPaths instanceof Set ? checkedPaths : new Set(checkedPaths || []);
  const tokens = [];
  for (const cls of tree?.classes || []) {
    const ratios = cls.ratios || [];
    const allRatios = ratios.length > 0 && ratios.every((ratio) => explicit.has(childPath(cls.key, ratio.value)));
    if (explicit.has(cls.key) || allRatios) {
      pushUnique(tokens, cls.key);
      continue;
    }
    for (const ratio of ratios) {
      if (explicit.has(childPath(cls.key, ratio.value))) pushUnique(tokens, ratio.value);
    }
  }
  return tokens.length ? { aspect: tokens.join(",") } : {};
}
function findByPath(nodes, path) {
  for (const node of nodes || []) {
    if (node.path === path) return node;
    const hit = findByPath(node.children, path);
    if (hit) return hit;
  }
  return null;
}
function pathOfChild(cover, kid) {
  if (kid.path) return kid.path;
  if (!kid.key) return "";
  return cover ? `${cover}/${kid.key}` : kid.key;
}
function explicitPathsFromState(roots, stateOf) {
  const out = /* @__PURE__ */ new Set();
  function walk(nodes, parentChecked) {
    for (const node of nodes || []) {
      const checked = stateOf(node.path) === "checked";
      if (checked && !parentChecked) out.add(node.path);
      walk(node.children, checked || parentChecked);
    }
  }
  walk(roots, false);
  return out;
}
function explodeUncheck(roots, explicit, cover, target) {
  const node = findByPath(roots, cover);
  for (const kid of node?.children || []) {
    const childPath2 = pathOfChild(cover, kid);
    if (!childPath2 || childPath2 === target) continue;
    if (target.startsWith(`${childPath2}/`)) explodeUncheck(roots, explicit, childPath2, target);
    else explicit.add(childPath2);
  }
}
function toggleCheckedPaths(roots, explicitPaths, path, turnOn) {
  const explicit = new Set(explicitPaths || []);
  if (turnOn) {
    for (const p of explicit) {
      if (path === p || path.startsWith(`${p}/`)) return explicit;
    }
    const drop2 = [];
    for (const p of explicit) {
      if (p.startsWith(`${path}/`)) drop2.push(p);
    }
    for (const p of drop2) explicit.delete(p);
    explicit.add(path);
    return explicit;
  }
  let cover = null;
  if (explicit.has(path)) cover = path;
  else {
    const parts2 = path.split("/");
    let acc = "";
    for (let i = 0; i < parts2.length - 1; i++) {
      acc = acc ? `${acc}/${parts2[i]}` : parts2[i];
      if (explicit.has(acc)) cover = acc;
    }
  }
  if (!cover) return explicit;
  explicit.delete(cover);
  const drop = [];
  for (const p of explicit) {
    if (p === cover || p.startsWith(`${cover}/`)) drop.push(p);
  }
  for (const p of drop) explicit.delete(p);
  if (cover !== path) explodeUncheck(roots, explicit, cover, path);
  return explicit;
}

// dev/ui/src/lib/type-workflow-label.js
var DOT = " \xB7 ";
function parts(abbreviation, expansion, label) {
  return {
    abbreviation: abbreviation || "",
    expansion: expansion || "",
    label: label || ""
  };
}
function typeWorkflowRowParts(node, depth) {
  if (!node) return parts("", "", "");
  if (node.kind === "mode") {
    return parts(node.label, node.title, "");
  }
  if (node.kind === "workflow" && depth === 1) {
    const abbreviation = getWorkflowModeAbbreviation(node.key);
    if (abbreviation) {
      return parts(abbreviation, getWorkflowAbbreviationExpansion(node.key), node.label);
    }
  }
  return parts("", "", node.label);
}
function filterExtraParts(token, { workflow = false } = {}) {
  const value = token == null ? "" : String(token);
  if (workflow) {
    const label = getWorkflowDisplayLabel(value) || value;
    const abbreviation = getWorkflowModeAbbreviation(value);
    const formatted = formatWorkflowQueryLabel(value);
    if (abbreviation && formatted === `${abbreviation}${DOT}${label}`) {
      return parts(abbreviation, getWorkflowAbbreviationExpansion(value), label);
    }
    return parts("", "", formatted || value);
  }
  const expansion = WORKFLOW_ABBREVIATION_EXPANSIONS[value] || "";
  if (expansion) return parts(value, expansion, "");
  return parts("", "", value);
}

// dev/ui/src/lib/tag-picker.js
function chipText(option) {
  const label = option?.label;
  if (label != null && String(label) !== "") return String(label);
  return String(option?.value ?? "");
}
function compareTagText(a, b) {
  const byLabel = chipText(a).localeCompare(chipText(b), void 0, { sensitivity: "base" });
  if (byLabel !== 0) return byLabel;
  return String(a.value).localeCompare(String(b.value));
}
function arrangeNameList(options, query, applyQuery) {
  const pool = [];
  for (const option of Array.isArray(options) ? options : []) {
    if (!option || option.value == null) continue;
    pool.push(option);
  }
  const needle = applyQuery ? String(query ?? "").toLowerCase() : "";
  const visible = needle ? pool.filter((option) => {
    const text = chipText(option).toLowerCase();
    return text.includes(needle) || String(option.value).toLowerCase().includes(needle);
  }) : pool.slice();
  if (!needle) {
    visible.sort(compareTagText);
    return visible;
  }
  const prefix = [];
  const rest = [];
  for (const option of visible) {
    if (chipText(option).toLowerCase().startsWith(needle)) prefix.push(option);
    else rest.push(option);
  }
  prefix.sort(compareTagText);
  rest.sort(compareTagText);
  return prefix.concat(rest);
}
function arrangeTagOptions(options, query, ratingOptions, postOptions, searchTarget = "content") {
  const usePayload = Array.isArray(ratingOptions);
  const ratings = [];
  const general = [];
  if (usePayload) {
    for (const option of ratingOptions) {
      if (!option || option.value == null) continue;
      ratings.push({
        ...option,
        label: ratingTagLabel(option.value) || option.label
      });
    }
    ratings.sort((a, b) => ratingTagRank(a.value) - ratingTagRank(b.value) || compareTagText(a, b));
  }
  for (const option of Array.isArray(options) ? options : []) {
    if (!option || option.value == null) continue;
    const rank = ratingTagRank(option.value);
    if (!usePayload && rank != null) {
      ratings.push({ ...option, label: ratingTagLabel(option.value) });
    } else if (rank == null) {
      general.push(option);
    }
  }
  if (!usePayload) {
    ratings.sort((a, b) => ratingTagRank(a.value) - ratingTagRank(b.value) || compareTagText(a, b));
  }
  const posts = arrangeNameList(postOptions, query, searchTarget === "posts");
  const content = arrangeNameList(general, query, searchTarget !== "posts");
  return { ratings, general: content, posts };
}

// dev/ui/src/components/FacetBar.jsx
function optionLabel(facet, value) {
  if (facet.optionLabels && facet.optionLabels[value]) return facet.optionLabels[value];
  if (facet.source === "reaction") return tagLabel(value);
  if (facet.key === "resourceType") return modelTypeLabel(value) || value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
var MONTH_NAMES = [
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
function toggleMember(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}
function facetListKey(facet) {
  return `${facet.kind}:${facet.source || facet.valuesSource || facet.key}`;
}
function useOutsideClose(open, setOpen, panelRef, btnRef, extraRef) {
  y(() => {
    if (!open) return void 0;
    function onDown(e) {
      const target = e.target;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (btnRef.current && btnRef.current.contains(target)) return;
      if (extraRef && extraRef.current && extraRef.current.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, setOpen, panelRef, btnRef, extraRef]);
}
function isoToday() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function addDays(iso, delta) {
  const d2 = /* @__PURE__ */ new Date(`${iso}T00:00:00.000Z`);
  d2.setUTCDate(d2.getUTCDate() + delta);
  return d2.toISOString().slice(0, 10);
}
function monthRange(month) {
  const [y2, m] = String(month).split("-").map(Number);
  if (!y2 || !m) return { dateFrom: "", dateTo: "" };
  const lastDay = new Date(Date.UTC(y2, m, 0)).getUTCDate();
  return { dateFrom: `${month}-01`, dateTo: `${month}-${String(lastDay).padStart(2, "0")}` };
}
function formatMonthYear(iso) {
  if (!iso) return "";
  const [y2, m] = String(iso).slice(0, 7).split("-").map(Number);
  if (!y2 || !m) return iso;
  return `${MONTH_NAMES[m - 1]} ${y2}`;
}
function monthsBetween(minIso, maxIso) {
  if (!minIso || !maxIso) return [];
  const [y0, m0] = minIso.slice(0, 7).split("-").map(Number);
  const [y1, m1] = maxIso.slice(0, 7).split("-").map(Number);
  if (!y0 || !m0 || !y1 || !m1) return [];
  const out = [];
  let y2 = y0;
  let m = m0;
  while (y2 < y1 || y2 === y1 && m <= m1) {
    out.push(`${y2}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y2 += 1;
    }
  }
  return out;
}
function ChipGroup({ facet, active, update, offerValues }) {
  const fullActive = active || [];
  const displayActive = fullActive;
  const [open, setOpen] = d(false);
  const panelRef = A(null);
  const btnRef = A(null);
  useOutsideClose(open, setOpen, panelRef, btnRef);
  if (offerValues == null) return null;
  const present = new Set(offerValues);
  const shown = (facet.options || []).filter((v) => present.has(v) || displayActive.includes(v));
  if (shown.length === 0) return null;
  function toggle(value) {
    update({ [facet.key]: toggleMember(fullActive, value) });
  }
  if (facet.label) {
    return /* @__PURE__ */ u("div", { class: "tag-picker-wrap", children: [
      /* @__PURE__ */ u(
        "button",
        {
          ref: btnRef,
          type: "button",
          class: `quiet-btn tag-picker-btn${displayActive.length > 0 ? " has-active" : ""}${open ? " open" : ""}`,
          "aria-expanded": open,
          onClick: () => setOpen((o) => !o),
          children: [
            facet.label,
            displayActive.length > 0 ? ` (${displayActive.length})` : "",
            " ",
            open ? "\u25B4" : "\u25BE"
          ]
        }
      ),
      open && /* @__PURE__ */ u("div", { ref: panelRef, class: "tag-picker-panel enum-picker-panel", children: /* @__PURE__ */ u("div", { class: "tree-picker-list", children: shown.map((value) => /* @__PURE__ */ u("div", { class: "tree-picker-row", children: /* @__PURE__ */ u("label", { children: [
        /* @__PURE__ */ u(
          "input",
          {
            type: "checkbox",
            checked: displayActive.includes(value),
            onChange: () => toggle(value)
          }
        ),
        /* @__PURE__ */ u("span", { class: "tree-picker-label", children: optionLabel(facet, value) })
      ] }) }, value)) }) })
    ] });
  }
  return /* @__PURE__ */ u("div", { class: "filter-tags", children: shown.map((value) => {
    const cls = value === "favorite" ? "favorite" : value === "feedback:liked" ? "liked" : "";
    return /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        class: `tag-chip ${cls}${displayActive.includes(value) ? " active" : ""}`,
        onClick: () => toggle(value),
        children: optionLabel(facet, value)
      },
      value
    );
  }) });
}
function ratingParamKey(params) {
  const rating = params && params.rating;
  if (Array.isArray(rating)) return rating.join(",");
  return rating == null ? "" : String(rating);
}
function offeredRows(rows, total) {
  return (rows || []).filter((o) => {
    if (typeof o.count !== "number") return true;
    if (o.count <= 0) return false;
    if (total != null && o.count === total) return false;
    return true;
  });
}
function MultiSelect({ facet, active, ratingActive, postTagActive, update, facetParams, offerShow }) {
  const fullActive = active || [];
  const fullRating = ratingActive || [];
  const fullPost = postTagActive || [];
  const displayActive = fullActive;
  const isTags = facet.key === "tag";
  const [open, setOpen] = d(false);
  const [search, setSearch] = d("");
  const [section, setSection] = d("content");
  const [loaded, setLoaded] = d(facet.options ? facet.options.map((v) => ({ value: v, label: optionLabel(facet, v) })) : null);
  const [tagTotal, setTagTotal] = d(null);
  const [ratingRows, setRatingRows] = d(null);
  const [ratingTotal, setRatingTotal] = d(null);
  const [postRows, setPostRows] = d(null);
  const [postTotal, setPostTotal] = d(null);
  const panelRef = A(null);
  const btnRef = A(null);
  const activeRef = A(fullActive);
  const postRef = A(fullPost);
  const updateRef = A(update);
  const seenRating = A(null);
  activeRef.current = fullActive;
  postRef.current = fullPost;
  updateRef.current = update;
  const paramsKey = JSON.stringify(facetParams || {});
  const ratingKey = ratingParamKey(facetParams);
  useOutsideClose(open, setOpen, panelRef, btnRef);
  y(() => {
    if (!open || !facet.source) return void 0;
    let cancelled = false;
    const requestedRating = ratingKey;
    getFacetValues(facet.source, facetParams).then((data) => {
      if (cancelled) return;
      const values = (data.values || []).map((v) => ({
        value: v.value,
        label: v.label || v.value,
        count: v.count
      }));
      setTagTotal(typeof data.total === "number" ? data.total : null);
      setLoaded(values);
      if (isTags) {
        setRatingTotal(typeof data.ratingTotal === "number" ? data.ratingTotal : null);
        setRatingRows((data.ratings || []).map((v) => ({
          value: v.value,
          label: v.label || v.value,
          count: v.count
        })));
        setPostTotal(typeof data.postTotal === "number" ? data.postTotal : null);
        setPostRows((data.postTags || []).map((v) => ({
          value: v.value,
          label: v.label || v.value,
          count: v.count
        })));
        const previous = seenRating.current;
        seenRating.current = requestedRating;
        if (previous != null && previous !== requestedRating) {
          const offered = new Set(values.map((v) => v.value));
          const current = activeRef.current;
          const next = current.filter((v) => offered.has(v));
          const postOffered = new Set((data.postTags || []).map((v) => v.value));
          const currentPost = postRef.current;
          const nextPost = currentPost.filter((v) => postOffered.has(v));
          const patch = {};
          if (next.length !== current.length) patch[facet.key] = next;
          if (nextPost.length !== currentPost.length) patch.postTag = nextPost;
          if (Object.keys(patch).length) updateRef.current(patch);
        }
      }
    }).catch(() => {
      if (!cancelled) setLoaded([]);
    });
    return () => {
      cancelled = true;
    };
  }, [open, facet.source, paramsKey, ratingKey, isTags, facet.key]);
  if (offerShow == null) return null;
  if (!offerShow && displayActive.length === 0 && fullRating.length === 0) return null;
  const options = loaded == null ? null : (() => {
    const filtered = offeredRows(loaded, tagTotal);
    const have = new Set(filtered.map((o) => o.value));
    const extras = displayActive.filter((v) => !have.has(v)).map((v) => ({ value: v, label: optionLabel(facet, v) }));
    return extras.length ? [...extras, ...filtered] : filtered;
  })();
  const ratingOptions = !isTags || ratingRows == null ? null : (() => {
    const filtered = offeredRows(ratingRows, ratingTotal);
    const have = new Set(filtered.map((o) => o.value));
    const extras = fullRating.filter((v) => !have.has(v)).map((v) => ({ value: v, label: optionLabel(facet, v) }));
    return extras.length ? [...extras, ...filtered] : filtered;
  })();
  const postOptions = !isTags || postRows == null ? null : (() => {
    const filtered = offeredRows(postRows, postTotal);
    const have = new Set(filtered.map((o) => o.value));
    const extras = fullPost.filter((v) => !have.has(v)).map((v) => ({ value: v, label: optionLabel(facet, v) }));
    return extras.length ? [...extras, ...filtered] : filtered;
  })();
  const arranged = options == null ? null : arrangeTagOptions(
    options,
    search,
    isTags ? ratingOptions || [] : void 0,
    isTags ? postOptions || [] : void 0,
    section
  );
  const showNoMatches = arranged != null && section === "content" && arranged.general.length === 0 && (search !== "" || arranged.ratings.length === 0);
  const showPostEmpty = arranged != null && section === "posts" && (arranged.posts || []).length === 0 && search !== "";
  const selectedCount = displayActive.length + (isTags ? fullRating.length + fullPost.length : 0);
  const showPosts = isTags && (postOptions && postOptions.length > 0 || fullPost.length > 0);
  const tagChip = (list, keyName) => (o) => /* @__PURE__ */ u(
    "button",
    {
      type: "button",
      class: `tag-chip${list.includes(o.value) ? " active" : ""}`,
      onClick: () => update({ [keyName]: toggleMember(list, o.value) }),
      title: o.value,
      children: o.label
    },
    o.value
  );
  return /* @__PURE__ */ u("div", { class: "tag-picker-wrap", children: [
    /* @__PURE__ */ u(
      "button",
      {
        ref: btnRef,
        type: "button",
        class: `quiet-btn tag-picker-btn${selectedCount > 0 ? " has-active" : ""}${open ? " open" : ""}`,
        "aria-expanded": open,
        onClick: () => setOpen((o) => !o),
        children: [
          facet.label,
          selectedCount > 0 ? ` (${selectedCount})` : "",
          " ",
          open ? "\u25B4" : "\u25BE"
        ]
      }
    ),
    open && /* @__PURE__ */ u("div", { ref: panelRef, class: "tag-picker-panel", children: [
      /* @__PURE__ */ u(
        "input",
        {
          class: "tag-picker-search",
          type: "search",
          placeholder: `Filter ${facet.label.toLowerCase()}\u2026`,
          value: search,
          onInput: (e) => setSearch(e.target.value),
          autoFocus: true
        }
      ),
      arranged == null && /* @__PURE__ */ u("span", { class: "tag-picker-empty", children: "Loading\u2026" }),
      arranged != null && arranged.ratings.length > 0 && /* @__PURE__ */ u("div", { class: "tag-picker-section tag-picker-rating", children: [
        /* @__PURE__ */ u("div", { class: "tag-picker-section-label", children: "Rating" }),
        /* @__PURE__ */ u("div", { class: "tag-picker-chips", children: arranged.ratings.map(tagChip(fullRating, "rating")) })
      ] }),
      /* @__PURE__ */ u("div", { class: "tag-picker-list", children: [
        showPosts && /* @__PURE__ */ u("div", { class: "tag-picker-section", children: [
          /* @__PURE__ */ u(
            "button",
            {
              type: "button",
              class: "tag-picker-section-label tag-picker-disclosure",
              "aria-expanded": section === "posts",
              onClick: () => setSection((current) => current === "posts" ? "content" : "posts"),
              children: [
                "Posts ",
                section === "posts" ? "\u25BE" : "\u25B8"
              ]
            }
          ),
          section === "posts" ? showPostEmpty ? /* @__PURE__ */ u("span", { class: "tag-picker-empty", children: "No matches" }) : /* @__PURE__ */ u("div", { class: "tag-picker-scroll", children: /* @__PURE__ */ u("div", { class: "tag-picker-chips", children: (arranged.posts || []).map(tagChip(fullPost, "postTag")) }) }) : fullPost.length > 0 && /* @__PURE__ */ u("div", { class: "tag-picker-chips", children: fullPost.map((value) => tagChip(fullPost, "postTag")({ value, label: optionLabel(facet, value) })) })
        ] }),
        arranged != null && (arranged.general.length > 0 || showNoMatches || displayActive.length > 0) && /* @__PURE__ */ u("div", { class: "tag-picker-section", children: [
          /* @__PURE__ */ u(
            "button",
            {
              type: "button",
              class: "tag-picker-section-label tag-picker-disclosure",
              "aria-expanded": section === "content",
              onClick: () => setSection("content"),
              children: [
                "Content ",
                section === "content" ? "\u25BE" : "\u25B8"
              ]
            }
          ),
          section === "content" ? arranged.general.length === 0 ? /* @__PURE__ */ u("span", { class: "tag-picker-empty", children: "No matches" }) : /* @__PURE__ */ u("div", { class: "tag-picker-scroll", children: /* @__PURE__ */ u("div", { class: "tag-picker-chips", children: arranged.general.map(tagChip(displayActive, facet.key)) }) }) : displayActive.length > 0 && /* @__PURE__ */ u("div", { class: "tag-picker-chips", children: displayActive.map((value) => tagChip(displayActive, facet.key)({ value, label: optionLabel(facet, value) })) })
        ] })
      ] })
    ] })
  ] });
}
function TreeRow({ row, tree, terms, search, expanded, toggleExpand, onToggle, depth, registerRow }) {
  if (!row) return null;
  const q = search.trim().toLowerCase();
  if (q && !modelRowMatches(row, q)) return null;
  const kids = row.children || [];
  const state = modelRowState(tree, terms, row);
  const key = row.key;
  const isOpen = expanded.has(key) || !!q;
  const showCaret = kids.length > 0;
  return /* @__PURE__ */ u(k, { children: [
    /* @__PURE__ */ u(
      "div",
      {
        class: "tree-picker-row",
        "data-depth": depth,
        ref: (el) => {
          if (registerRow) registerRow(key, el);
        },
        children: [
          showCaret ? /* @__PURE__ */ u(
            "button",
            {
              type: "button",
              class: "tree-picker-caret",
              "aria-expanded": isOpen,
              onClick: () => toggleExpand(key),
              children: isOpen ? "\u25BE" : "\u25B8"
            }
          ) : /* @__PURE__ */ u("span", { class: "tree-picker-caret-spacer" }),
          /* @__PURE__ */ u("label", { children: [
            /* @__PURE__ */ u(
              "input",
              {
                type: "checkbox",
                checked: state === "checked",
                ref: (el) => {
                  if (el) el.indeterminate = state === "indeterminate";
                },
                onChange: () => onToggle(row.term, state !== "checked")
              }
            ),
            /* @__PURE__ */ u("span", { class: "tree-picker-label", children: row.label })
          ] }),
          /* @__PURE__ */ u("span", { class: "tree-picker-count", children: row.count })
        ]
      }
    ),
    showCaret && isOpen && kids.map((kid) => /* @__PURE__ */ u(
      TreeRow,
      {
        row: kid,
        tree,
        terms,
        search,
        expanded,
        toggleExpand,
        onToggle,
        depth: depth + 1,
        registerRow
      },
      kid.key
    ))
  ] });
}
function ownedModelTerms(tree) {
  const out = [];
  for (const type of tree?.types || []) {
    for (const base of type.baseModels || []) {
      for (const model of base.models || []) {
        if (!model.own || model.idKind === "name") continue;
        out.push({ type: type.key, baseModel: base.key, modelId: String(model.key) });
      }
    }
  }
  return out;
}
function TreePicker({ facet, state, update, facetParams, offerShow, showOwn, ownKnown, ownRev }) {
  const [open, setOpen] = d(false);
  const [search, setSearch] = d("");
  const [tree, setTree] = d(null);
  const [expanded, setExpanded] = d(() => /* @__PURE__ */ new Set());
  const [scrollKey, setScrollKey] = d("");
  const panelRef = A(null);
  const btnRef = A(null);
  const moreRef = A(null);
  const rowRefs = A(/* @__PURE__ */ new Map());
  const normalizedRef = A(false);
  const seenRev = A(ownRev);
  const indexEpoch = useIndexEpoch();
  const seenIndex = A(indexEpoch);
  useOutsideClose(open, setOpen, panelRef, btnRef, moreRef);
  const parsedModels = parseModels(state.models);
  const terms = parsedModels.filter((term) => !term.mine);
  const mineTerm = parsedModels.find((term) => term.mine) || null;
  const mine = !!mineTerm && !!ownKnown;
  const mineHoles = mine && Array.isArray(mineTerm.except) ? mineTerm.except : [];
  y(() => {
    if (seenRev.current === ownRev) return;
    seenRev.current = ownRev;
    setTree(null);
  }, [ownRev]);
  y(() => {
    if (seenIndex.current === indexEpoch) return;
    seenIndex.current = indexEpoch;
    setTree(null);
  }, [indexEpoch]);
  y(() => {
    const needsFetch = open || parsedModels.length > 0;
    if (!needsFetch || tree != null) return;
    let cancelled = false;
    getModelHierarchy(facetParams).then((data) => {
      if (!cancelled) setTree(data);
    }).catch(() => {
      if (!cancelled) setTree({ types: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [open, tree, state, facetParams]);
  y(() => {
    if (normalizedRef.current) return;
    const dirty = state.scope || hasFlatTaxonomy(state) || state.familyId != null && state.familyId !== "";
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
      models: lifted.models || "",
      scope: "",
      familyId: "",
      ...clearedFlatTaxonomy()
    });
  }, [state, update]);
  y(() => {
    if (!tree) return;
    const bag = [];
    for (const term of terms) bag.push(...ancestorExpandKeys(term));
    if (mine) {
      for (const node of ownedModelTerms(tree)) bag.push(...ancestorExpandKeys(node));
    }
    if (!bag.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const key of bag) next.add(key);
      return next;
    });
  }, [tree, state.models, mine]);
  y(() => {
    if (!open || !scrollKey) return;
    const el = rowRefs.current.get(scrollKey);
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [open, scrollKey, tree, expanded]);
  if (offerShow == null) return null;
  if (!offerShow && !mine && !terms.length && !hasFlatTaxonomy(state)) return null;
  const owned = ownedModelTerms(tree);
  const ownedKept = owned.filter((node) => !mineHoles.some((hole) => String(hole.modelId) === String(node.modelId)));
  const displayTerms = mine ? terms.concat(ownedKept) : terms;
  const mineState = mine ? mineHoles.length ? "indeterminate" : "checked" : !owned.length ? "unchecked" : owned.every((n) => modelStructuralState(tree, terms, n) === "checked") ? "checked" : owned.some((n) => modelStructuralState(tree, terms, n) !== "unchecked") ? "indeterminate" : "unchecked";
  const showMineRow = !!showOwn || mine;
  const activeCount = terms.length + (mine ? 1 : 0);
  function commit(nextTerms) {
    update({ models: serializeModels(nextTerms), ...clearedFlatTaxonomy() });
  }
  function onMineToggle() {
    if (!tree && !mine) return;
    if (mine) {
      commit(terms);
      return;
    }
    if (mineState === "checked") {
      let next = terms;
      for (const node of owned) next = toggleModelRow(tree, next, node, false);
      commit(next);
      return;
    }
    commit([...terms, { mine: true }]);
  }
  function onToggle(term, turnOn) {
    if (!tree) return;
    const ownTerm = modelTermForOwnUncheck(term);
    const isOwnedModel = ownTerm?.modelId && !ownTerm.versionId && owned.some((n) => String(n.modelId) === String(ownTerm.modelId));
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
  function toggleExpand(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function registerRow(key, el) {
    if (el) rowRefs.current.set(key, el);
    else rowRefs.current.delete(key);
  }
  function focusTerm(term, parent) {
    if (term) {
      const keys = ancestorExpandKeys(term);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const key of keys) next.add(key);
        return next;
      });
      setScrollKey(parent && keys.length ? keys[keys.length - 1] : scopeNodeKey(term));
    }
    setOpen(true);
  }
  const roots = tree ? modelDisplayRoots(tree) : [];
  const chipGroups = (() => {
    const groups = modelChipGroups(tree, parsedModels).filter((group) => {
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
  function renderGroup(group, index) {
    const dismiss = () => commit(dropModelGroup(parsedModels, group));
    if (group.kind === "cluster") {
      return /* @__PURE__ */ u("span", { class: "tag-chip active tree-picker-chip chip-cluster", children: [
        /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            class: "chip-cluster-show",
            onClick: () => focusTerm(parsedModels[group.termIndexes[0]], true),
            children: group.text
          }
        ),
        /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            class: "chip-cluster-remove",
            "aria-label": group.ariaLabel,
            title: group.title,
            onClick: dismiss,
            children: "\xD7"
          }
        )
      ] }, `${group.text}:${index}`);
    }
    const except = group.kind === "except";
    return /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        class: `tag-chip tree-picker-chip remove${except ? " exception" : " active"}`,
        title: group.title,
        "aria-label": group.ariaLabel,
        onClick: dismiss,
        children: [
          group.text,
          " ",
          "\xD7"
        ]
      },
      `${group.text}:${index}`
    );
  }
  return /* @__PURE__ */ u("div", { class: "tag-picker-wrap tree-picker-wrap", children: [
    /* @__PURE__ */ u(
      "button",
      {
        ref: btnRef,
        type: "button",
        class: `quiet-btn tag-picker-btn${activeCount > 0 ? " has-active" : ""}${open ? " open" : ""}`,
        "aria-expanded": open,
        onClick: () => setOpen((o) => !o),
        children: [
          facet.label,
          " ",
          open ? "\u25B4" : "\u25BE"
        ]
      }
    ),
    chipGroups.length > 0 && /* @__PURE__ */ u(
      ChipOverflow,
      {
        maxLines: 1,
        panelOpen: open,
        anchorRef: moreRef,
        onMore: (index) => {
          if (open) {
            setOpen(false);
            return;
          }
          const group = chipGroups[index];
          focusTerm(parsedModels[group?.termIndexes?.[0]], group?.kind === "cluster");
        },
        children: chipGroups.map(renderGroup)
      }
    ),
    open && /* @__PURE__ */ u("div", { ref: panelRef, class: "tag-picker-panel tree-picker-panel", children: [
      /* @__PURE__ */ u(
        "input",
        {
          class: "tag-picker-search",
          type: "search",
          placeholder: "Filter models & resources\u2026",
          value: search,
          onInput: (e) => setSearch(e.target.value),
          autoFocus: true
        }
      ),
      /* @__PURE__ */ u("div", { class: "tree-picker-list", children: [
        showMineRow && /* @__PURE__ */ u("div", { class: "tree-picker-row", "data-depth": "0", title: "My models", children: [
          /* @__PURE__ */ u("span", { class: "tree-picker-caret-spacer" }),
          /* @__PURE__ */ u("label", { children: [
            /* @__PURE__ */ u(
              "input",
              {
                type: "checkbox",
                checked: mineState === "checked",
                ref: (el) => {
                  if (el) el.indeterminate = mineState === "indeterminate";
                },
                onChange: onMineToggle
              }
            ),
            /* @__PURE__ */ u("span", { class: "tree-picker-label", children: "Mine" })
          ] })
        ] }),
        tree == null && /* @__PURE__ */ u("span", { class: "tag-picker-empty", children: "Loading\u2026" }),
        tree != null && roots.length === 0 && /* @__PURE__ */ u("span", { class: "tag-picker-empty", children: "No models in the library" }),
        tree != null && roots.map((row) => /* @__PURE__ */ u(
          TreeRow,
          {
            row,
            tree,
            terms: displayTerms,
            search,
            expanded,
            toggleExpand,
            onToggle,
            depth: 0,
            registerRow
          },
          row.key
        ))
      ] })
    ] })
  ] });
}
function Flag({ facet, value, update, offerShow }) {
  if (offerShow == null) return null;
  if (!offerShow && value !== true) return null;
  const checked = value === true;
  return /* @__PURE__ */ u(
    "button",
    {
      type: "button",
      class: `quiet-btn tag-picker-btn${checked ? " has-active" : ""}`,
      "aria-pressed": checked,
      onClick: () => update({ [facet.key]: checked ? null : true }),
      children: facet.label
    }
  );
}
function Segmented({ facet, value, update }) {
  const segments = [
    { value: null, label: "Any" },
    { value: true, label: "In a post" },
    { value: false, label: "Not in a post" }
  ];
  return /* @__PURE__ */ u("div", { class: "granularity-toggle status-segmented facet-segmented", role: "group", "aria-label": facet.label, children: [
    /* @__PURE__ */ u("span", { class: "granularity-label", children: facet.label }),
    segments.map((seg) => /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        class: `granularity-option${value === seg.value ? " active" : ""}`,
        "aria-pressed": value === seg.value,
        onClick: () => update({ [facet.key]: seg.value }),
        children: seg.label
      },
      String(seg.value)
    ))
  ] });
}
function sortDirChoices(field) {
  if (field === "date" || field === "published") {
    return [
      { dir: "desc", label: "Newest first" },
      { dir: "asc", label: "Oldest first" }
    ];
  }
  if (field === "name") {
    return [
      { dir: "asc", label: "A\u2192Z" },
      { dir: "desc", label: "Z\u2192A" }
    ];
  }
  return [
    { dir: "desc", label: "Most first" },
    { dir: "asc", label: "Fewest first" }
  ];
}
function defaultDir(field) {
  if (field === "name") return "asc";
  return "desc";
}
function Arrange({ state, sortFields, groupAxes, update }) {
  const [open, setOpen] = d(false);
  const panelRef = A(null);
  const btnRef = A(null);
  useOutsideClose(open, setOpen, panelRef, btnRef);
  const [sortField, sortDir] = (state.sort || "date:desc").split(":");
  const groupBy = state.groupBy && state.groupBy !== "none" ? state.groupBy : "none";
  const [gsField, gsDir] = (state.groupSort || "count:desc").split(":");
  const grouped = groupBy !== "none";
  const hasGroupAxes = (groupAxes || []).length > 0;
  const showSortField = (sortFields || []).length >= 2;
  const groupAxesForSelect = (() => {
    const list = groupAxes || [];
    if (groupBy === "none") return list;
    if (list.some((a) => a.value === groupBy)) return list;
    return [...list, { value: groupBy, label: groupBy }];
  })();
  const axisLabel = grouped ? groupAxesForSelect.find((a) => a.value === groupBy)?.label || groupBy : "";
  const dirLabel = (sortDirChoices(sortField).find((d2) => d2.dir === (sortDir || "desc")) || {}).label || "";
  const sortFieldLabel = (sortFields.find((f) => f.value === sortField) || {}).label || sortField;
  let btnLabel;
  if (grouped) btnLabel = `Group: ${axisLabel}`;
  else if (hasGroupAxes) btnLabel = "Arrange";
  else btnLabel = `Sort: ${dirLabel || sortFieldLabel}`;
  const active = grouped || state.sort && state.sort !== "date:desc";
  return /* @__PURE__ */ u("div", { class: "tag-picker-wrap arrange-wrap", children: [
    /* @__PURE__ */ u(
      "button",
      {
        ref: btnRef,
        type: "button",
        class: `quiet-btn${active ? " has-active" : ""}${open ? " open" : ""}`,
        "aria-expanded": open,
        onClick: () => setOpen((o) => !o),
        children: [
          btnLabel,
          " ",
          open ? "\u25B4" : "\u25BE"
        ]
      }
    ),
    open && /* @__PURE__ */ u("div", { ref: panelRef, class: "tag-picker-panel arrange-panel", children: [
      hasGroupAxes && /* @__PURE__ */ u("label", { class: "arrange-row", children: [
        /* @__PURE__ */ u("span", { class: "arrange-row-label", children: "Group by" }),
        /* @__PURE__ */ u(
          "select",
          {
            class: "facet-select",
            value: groupBy,
            onChange: (e) => update({ groupBy: e.target.value }, { history: "push" }),
            children: [
              /* @__PURE__ */ u("option", { value: "none", children: "None" }),
              groupAxesForSelect.map((a) => /* @__PURE__ */ u("option", { value: a.value, children: a.label }, a.value))
            ]
          }
        )
      ] }),
      hasGroupAxes && grouped && /* @__PURE__ */ u("label", { class: "arrange-row", children: [
        /* @__PURE__ */ u("span", { class: "arrange-row-label", children: "Order groups by" }),
        /* @__PURE__ */ u(
          "select",
          {
            class: "facet-select",
            value: `${gsField === "name" ? "name" : "count"}:${gsDir === "asc" ? "asc" : "desc"}`,
            onChange: (e) => update({ groupSort: e.target.value }),
            children: [
              /* @__PURE__ */ u("option", { value: "count:desc", children: "Count (Most first)" }),
              /* @__PURE__ */ u("option", { value: "count:asc", children: "Count (Fewest first)" }),
              /* @__PURE__ */ u("option", { value: "name:asc", children: [
                "Name (A",
                "\u2192",
                "Z)"
              ] }),
              /* @__PURE__ */ u("option", { value: "name:desc", children: [
                "Name (Z",
                "\u2192",
                "A)"
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ u("label", { class: "arrange-row", children: [
        showSortField && /* @__PURE__ */ u("span", { class: "arrange-row-label", children: "Sort items by" }),
        showSortField && /* @__PURE__ */ u(
          "select",
          {
            class: "facet-select",
            value: sortField,
            onChange: (e) => update({ sort: `${e.target.value}:${defaultDir(e.target.value)}` }),
            children: sortFields.map((f) => /* @__PURE__ */ u("option", { value: f.value, children: f.label }, f.value))
          }
        ),
        !showSortField && /* @__PURE__ */ u("span", { class: "arrange-row-label", children: "Sort" }),
        /* @__PURE__ */ u(
          "select",
          {
            class: "facet-select",
            value: sortDir === "asc" ? "asc" : "desc",
            onChange: (e) => update({ sort: `${sortField}:${e.target.value}` }),
            children: sortDirChoices(sortField).map((d2) => /* @__PURE__ */ u("option", { value: d2.dir, children: d2.label }, d2.dir))
          }
        )
      ] })
    ] })
  ] });
}
var DATE_PRESETS = [
  { id: "this-month", label: "This month" },
  { id: "last-30", label: "Last 30 days" },
  { id: "last-90", label: "Last 90 days" },
  { id: "this-year", label: "This year" },
  { id: "last-12", label: "Last 12 months" },
  { id: "all", label: "All time" }
];
function presetRange(id, today) {
  const [y2, m] = today.split("-").map(Number);
  switch (id) {
    case "this-month":
      return { dateFrom: `${y2}-${String(m).padStart(2, "0")}-01`, dateTo: today };
    case "last-30":
      return { dateFrom: addDays(today, -29), dateTo: today };
    case "last-90":
      return { dateFrom: addDays(today, -89), dateTo: today };
    case "this-year":
      return { dateFrom: `${y2}-01-01`, dateTo: today };
    case "last-12": {
      const from = /* @__PURE__ */ new Date(`${today}T00:00:00.000Z`);
      from.setUTCFullYear(from.getUTCFullYear() - 1);
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: today };
    }
    case "all":
      return { dateFrom: "", dateTo: "" };
    default:
      return null;
  }
}
function DateRange({ facet, state, update, dateBounds }) {
  const [open, setOpen] = d(false);
  const [fromBuf, setFromBuf] = d(state[facet.key] || "");
  const [toBuf, setToBuf] = d(state[facet.key2] || "");
  const panelRef = A(null);
  const btnRef = A(null);
  const fromMonthId = g();
  const toMonthId = g();
  const fromDateId = g();
  const toDateId = g();
  useOutsideClose(open, setOpen, panelRef, btnRef);
  const dateFrom = state[facet.key] || "";
  const dateTo = state[facet.key2] || "";
  const active = !!(dateFrom || dateTo);
  y(() => {
    setFromBuf(dateFrom);
  }, [dateFrom]);
  y(() => {
    setToBuf(dateTo);
  }, [dateTo]);
  if (dateBounds == null && !active) return null;
  const bounds = dateBounds || { min: null, max: null };
  function setRange(from, to) {
    update({ [facet.key]: from || "", [facet.key2]: to || "" });
  }
  const months = monthsBetween(bounds?.min, bounds?.max);
  const fromMonth = dateFrom ? dateFrom.slice(0, 7) : months[0] || "";
  const toMonth = dateTo ? dateTo.slice(0, 7) : months[months.length - 1] || "";
  const rangeLabel = formatDateRange(dateFrom, dateTo);
  const btnLabel = rangeLabel || facet.label;
  return /* @__PURE__ */ u("div", { class: "tag-picker-wrap when-wrap", children: [
    /* @__PURE__ */ u(
      "button",
      {
        ref: btnRef,
        type: "button",
        class: `quiet-btn tag-picker-btn${active ? " has-active" : ""}${open ? " open" : ""}`,
        "aria-expanded": open,
        onClick: () => setOpen((o) => !o),
        children: [
          btnLabel,
          " ",
          open ? "\u25B4" : "\u25BE"
        ]
      }
    ),
    open && /* @__PURE__ */ u("div", { ref: panelRef, class: "tag-picker-panel when-panel", children: [
      bounds?.min && bounds?.max && /* @__PURE__ */ u("div", { class: "when-bounds", children: [
        "Your library: ",
        /* @__PURE__ */ u(TimeText, { at: String(bounds.min).slice(0, 7), children: formatMonthYear(bounds.min) }),
        " ",
        "\u2013",
        " ",
        /* @__PURE__ */ u(TimeText, { at: String(bounds.max).slice(0, 7), children: formatMonthYear(bounds.max) })
      ] }),
      /* @__PURE__ */ u("div", { class: "when-section-label", children: "Period" }),
      /* @__PURE__ */ u("div", { class: "when-presets", children: DATE_PRESETS.map((p) => /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: "quiet-btn",
          onClick: () => {
            const r = presetRange(p.id, isoToday());
            if (r) setRange(r.dateFrom, r.dateTo);
          },
          children: p.label
        },
        p.id
      )) }),
      months.length > 0 && /* @__PURE__ */ u(k, { children: [
        /* @__PURE__ */ u("div", { class: "when-section-label", children: "Month" }),
        /* @__PURE__ */ u("div", { class: "arrange-row", children: [
          /* @__PURE__ */ u("label", { class: "visually-hidden", for: fromMonthId, children: "From month" }),
          /* @__PURE__ */ u(
            "select",
            {
              id: fromMonthId,
              class: "facet-select",
              value: fromMonth,
              onChange: (e) => {
                const start = monthRange(e.target.value);
                const end = monthRange(toMonth || e.target.value);
                setRange(start.dateFrom, end.dateTo);
              },
              children: months.map((m) => /* @__PURE__ */ u("option", { value: m, children: formatMonthYear(m) }, m))
            }
          ),
          /* @__PURE__ */ u("span", { class: "facet-range-sep", children: "\u2013" }),
          /* @__PURE__ */ u("label", { class: "visually-hidden", for: toMonthId, children: "To month" }),
          /* @__PURE__ */ u(
            "select",
            {
              id: toMonthId,
              class: "facet-select",
              value: toMonth,
              onChange: (e) => {
                const start = monthRange(fromMonth || e.target.value);
                const end = monthRange(e.target.value);
                setRange(start.dateFrom, end.dateTo);
              },
              children: months.map((m) => /* @__PURE__ */ u("option", { value: m, children: formatMonthYear(m) }, m))
            }
          )
        ] }),
        /* @__PURE__ */ u("div", { class: "when-presets", children: months.slice(-6).map((m) => /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            class: "quiet-btn",
            onClick: () => {
              const r = monthRange(m);
              setRange(r.dateFrom, r.dateTo);
            },
            children: /* @__PURE__ */ u(TimeText, { at: String(m).slice(0, 7), children: formatMonthYear(m) })
          },
          `one-${m}`
        )) })
      ] }),
      /* @__PURE__ */ u("div", { class: "when-section-label", children: "Date" }),
      /* @__PURE__ */ u("div", { class: "facet-range", children: [
        /* @__PURE__ */ u("label", { class: "visually-hidden", for: fromDateId, children: "From date" }),
        /* @__PURE__ */ u(
          "input",
          {
            id: fromDateId,
            class: "facet-range-input",
            type: "date",
            value: fromBuf,
            onInput: (e) => setFromBuf(e.target.value),
            onBlur: (e) => setRange(e.target.value, dateTo),
            onKeyDown: (e) => {
              if (e.key === "Enter") setRange(e.target.value, dateTo);
            }
          }
        ),
        /* @__PURE__ */ u("span", { class: "facet-range-sep", children: "\u2013" }),
        /* @__PURE__ */ u("label", { class: "visually-hidden", for: toDateId, children: "To date" }),
        /* @__PURE__ */ u(
          "input",
          {
            id: toDateId,
            class: "facet-range-input",
            type: "date",
            value: toBuf,
            onInput: (e) => setToBuf(e.target.value),
            onBlur: (e) => setRange(dateFrom, e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") setRange(dateFrom, e.target.value);
            }
          }
        )
      ] })
    ] })
  ] });
}
var CLOSED_ASPECT = {
  classes: [
    { key: "portrait", label: "Portrait", count: 0, ratios: [] },
    { key: "landscape", label: "Landscape", count: 0, ratios: [] },
    { key: "square", label: "Square", count: 0, ratios: [] }
  ]
};
function withPaths(nodes, prefix) {
  return (nodes || []).map((node) => {
    const path = prefix ? `${prefix}/${node.key}` : node.key;
    const children = withPaths(node.children, path);
    return children.length ? { ...node, path, children } : { ...node, path };
  });
}
function aspectToNodes(payload) {
  return (payload?.classes || []).map((cls) => {
    const ratios = cls.ratios || [];
    const sole = ratios.length === 1 ? ratios[0] : null;
    const collapse = sole != null && Number(sole.count) === Number(cls.count);
    const node = {
      key: cls.key,
      path: cls.key,
      label: cls.label,
      count: cls.count
    };
    if (collapse || ratios.length === 0) return node;
    node.children = ratios.map((ratio) => ({
      key: ratio.value,
      path: `${cls.key}/${ratio.value}`,
      label: ratio.label || ratio.value,
      count: ratio.count
    }));
    return node;
  });
}
function aspectSelection(payload, tokens) {
  const active = new Set(tokens || []);
  const states = /* @__PURE__ */ new Map();
  const matched = /* @__PURE__ */ new Set();
  for (const cls of payload?.classes || []) {
    const ratios = (cls.ratios || []).map((r) => r.value);
    const classOn = active.has(cls.key);
    if (classOn) matched.add(cls.key);
    const selected = ratios.filter((v) => active.has(v));
    for (const v of selected) matched.add(v);
    const all = ratios.length > 0 && selected.length === ratios.length;
    if (classOn || all) {
      states.set(cls.key, "checked");
      for (const v of ratios) states.set(`${cls.key}/${v}`, "checked");
    } else if (selected.length > 0) {
      states.set(cls.key, "indeterminate");
      for (const v of ratios) {
        states.set(`${cls.key}/${v}`, active.has(v) ? "checked" : "unchecked");
      }
    } else {
      states.set(cls.key, "unchecked");
      for (const v of ratios) states.set(`${cls.key}/${v}`, "unchecked");
    }
  }
  return {
    state(path) {
      return states.get(path) || "unchecked";
    },
    extras: [...active].filter((t) => !matched.has(t))
  };
}
function expandAncestors(nodes, stateOf) {
  const next = /* @__PURE__ */ new Set();
  function walk(list) {
    for (const node of list || []) {
      const st = stateOf(node.path);
      if (st === "checked" || st === "indeterminate") {
        const parts2 = node.path.split("/");
        let acc = "";
        for (let i = 0; i < parts2.length - 1; i++) {
          acc = acc ? `${acc}/${parts2[i]}` : parts2[i];
          next.add(acc);
        }
      }
      walk(node.children);
    }
  }
  walk(nodes);
  return next;
}
function csvTokens(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value).split(",").map((s) => s.trim()).filter(Boolean);
}
function uniqTokens(list) {
  const out = [];
  for (const v of list) {
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}
function FilterText({ parts: parts2 }) {
  const abbr = parts2.abbreviation ? parts2.expansion ? /* @__PURE__ */ u("abbr", { title: parts2.expansion, children: parts2.abbreviation }) : parts2.abbreviation : null;
  if (abbr && parts2.label) return /* @__PURE__ */ u(k, { children: [
    abbr,
    " \xB7 ",
    parts2.label
  ] });
  if (abbr) return abbr;
  return parts2.label;
}
function DisclosureTreeRow({ node, depth, expanded, toggleExpand, stateOf, onToggle }) {
  const kids = node.children || [];
  const showCaret = kids.length > 0;
  const isOpen = expanded.has(node.path);
  const state = stateOf(node.path);
  return /* @__PURE__ */ u(k, { children: [
    /* @__PURE__ */ u("div", { class: "tree-picker-row", "data-depth": depth, children: [
      showCaret ? /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: "tree-picker-caret",
          "aria-expanded": isOpen,
          onClick: () => toggleExpand(node.path),
          children: isOpen ? "\u25BE" : "\u25B8"
        }
      ) : /* @__PURE__ */ u("span", { class: "tree-picker-caret-spacer" }),
      /* @__PURE__ */ u("label", { children: [
        /* @__PURE__ */ u(
          "input",
          {
            type: "checkbox",
            checked: state === "checked",
            ref: (el) => {
              if (el) el.indeterminate = state === "indeterminate";
            },
            onChange: () => onToggle(node.path, state !== "checked")
          }
        ),
        /* @__PURE__ */ u("span", { class: "tree-picker-label", children: /* @__PURE__ */ u(FilterText, { parts: typeWorkflowRowParts(node, depth) }) })
      ] }),
      node.count > 0 && /* @__PURE__ */ u("span", { class: "tree-picker-count", children: node.count })
    ] }),
    showCaret && isOpen && kids.map((kid) => /* @__PURE__ */ u(
      DisclosureTreeRow,
      {
        node: kid,
        depth: depth + 1,
        expanded,
        toggleExpand,
        stateOf,
        onToggle
      },
      kid.path
    ))
  ] });
}
function NestedTreePicker({ facet, state, update, facetParams, offer }) {
  const isAspect = facet.tree === "aspect";
  const [open, setOpen] = d(false);
  const [openGen, setOpenGen] = d(0);
  const [tree, setTree] = d(null);
  const [expanded, setExpanded] = d(() => /* @__PURE__ */ new Set());
  const [appliedExpand, setAppliedExpand] = d("");
  const panelRef = A(null);
  const btnRef = A(null);
  useOutsideClose(open, setOpen, panelRef, btnRef);
  const paramsKey = facetParamsKey(facetParams);
  const offeredAspect = offer?.aspect;
  const hasAspectClasses = Array.isArray(offeredAspect?.classes) && offeredAspect.classes.length > 0;
  const aspectPayload = hasAspectClasses ? offeredAspect : facet.alwaysShowRoots ? CLOSED_ASPECT : { classes: [] };
  const paramsSeen = A(paramsKey);
  y(() => {
    if (paramsSeen.current === paramsKey) return;
    paramsSeen.current = paramsKey;
    setTree(null);
  }, [paramsKey]);
  y(() => {
    if (isAspect || !open || tree != null) return;
    let cancelled = false;
    getTypeWorkflowTree(facetParams).then((data) => {
      if (!cancelled) setTree(data || { types: [] });
    }).catch(() => {
      if (!cancelled) setTree({ types: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [isAspect, open, tree, paramsKey]);
  const rowNodes = isAspect ? aspectToNodes(aspectPayload) : withPaths(tree?.types);
  const selection = isAspect ? aspectSelection(aspectPayload, state.aspect || []) : tree ? paramsToTypeWorkflowSelection(tree, {
    type: state.mediaType || [],
    workflowMode: state.workflowMode || [],
    workflow: state.workflow || []
  }) : { state: () => "unchecked", extras: [] };
  const readyKey = isAspect ? `aspect:${(aspectPayload.classes || []).map((c) => c.key).join(",")}` : `type:${paramsKey}:${tree ? "ready" : "wait"}`;
  const expandStamp = open && (isAspect || tree) ? `${openGen}:${readyKey}` : "";
  if (expandStamp && appliedExpand !== expandStamp) {
    setAppliedExpand(expandStamp);
    setExpanded(expandAncestors(rowNodes, selection.state));
  }
  function toggleOpen() {
    setOpen((current) => {
      if (!current) setOpenGen((g2) => g2 + 1);
      return !current;
    });
  }
  const tokenCount = isAspect ? (state.aspect || []).length : (state.mediaType || []).length + (state.workflowMode || []).length + (state.workflow || []).length;
  const extraRows = (selection.extras || []).map((token) => ({
    token,
    parts: isAspect ? { abbreviation: "", expansion: "", label: token } : filterExtraParts(token, { workflow: (state.workflow || []).includes(token) })
  }));
  function toggleExpand(path) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }
  function commitType(nextExplicit) {
    const written = selectionToTypeWorkflowParams(tree, nextExplicit);
    const extra = new Set(selection.extras || []);
    update({
      mediaType: uniqTokens([...csvTokens(written.type), ...(state.mediaType || []).filter((t) => extra.has(t))]),
      workflowMode: uniqTokens([...csvTokens(written.workflowMode), ...(state.workflowMode || []).filter((t) => extra.has(t))]),
      workflow: uniqTokens([...csvTokens(written.workflow), ...(state.workflow || []).filter((t) => extra.has(t))])
    });
  }
  function commitAspect(nextExplicit) {
    const written = selectionToAspectParams(aspectPayload, nextExplicit);
    const extra = new Set(selection.extras || []);
    update({
      aspect: uniqTokens([...csvTokens(written.aspect), ...(state.aspect || []).filter((t) => extra.has(t))])
    });
  }
  function onToggle(path, turnOn) {
    const explicit = explicitPathsFromState(rowNodes, selection.state);
    const next = toggleCheckedPaths(rowNodes, explicit, path, turnOn);
    if (isAspect) commitAspect(next);
    else if (tree) commitType(next);
  }
  function removeExtra(token) {
    if (isAspect) {
      update({ aspect: (state.aspect || []).filter((t) => t !== token) });
      return;
    }
    update({
      mediaType: (state.mediaType || []).filter((t) => t !== token),
      workflowMode: (state.workflowMode || []).filter((t) => t !== token),
      workflow: (state.workflow || []).filter((t) => t !== token)
    });
  }
  const loading = !isAspect && open && tree == null;
  return /* @__PURE__ */ u("div", { class: "tag-picker-wrap", children: [
    /* @__PURE__ */ u(
      "button",
      {
        ref: btnRef,
        type: "button",
        class: `quiet-btn tag-picker-btn${tokenCount > 0 ? " has-active" : ""}${open ? " open" : ""}`,
        "aria-expanded": open,
        onClick: toggleOpen,
        children: [
          facet.label,
          tokenCount > 0 ? ` (${tokenCount})` : "",
          " ",
          open ? "\u25B4" : "\u25BE"
        ]
      }
    ),
    open && /* @__PURE__ */ u("div", { ref: panelRef, class: "tag-picker-panel nested-tree-panel", children: /* @__PURE__ */ u("div", { class: "tree-picker-list", children: [
      loading && /* @__PURE__ */ u("span", { class: "tag-picker-empty", children: "Loading\u2026" }),
      !loading && rowNodes.length === 0 && extraRows.length === 0 && /* @__PURE__ */ u("span", { class: "tag-picker-empty", children: "Nothing in this list" }),
      !loading && rowNodes.map((node) => /* @__PURE__ */ u(
        DisclosureTreeRow,
        {
          node,
          depth: 0,
          expanded,
          toggleExpand,
          stateOf: selection.state,
          onToggle
        },
        node.path
      )),
      !loading && extraRows.map((row, i) => /* @__PURE__ */ u("div", { class: "tree-picker-row", "data-depth": "0", children: [
        /* @__PURE__ */ u("span", { class: "tree-picker-caret-spacer" }),
        /* @__PURE__ */ u("label", { children: [
          /* @__PURE__ */ u(
            "input",
            {
              type: "checkbox",
              checked: true,
              onChange: () => removeExtra(row.token)
            }
          ),
          /* @__PURE__ */ u("span", { class: "tree-picker-label", children: /* @__PURE__ */ u(FilterText, { parts: row.parts }) })
        ] })
      ] }, `extra:${row.token}:${i}`))
    ] }) })
  ] });
}
var EMPTY_FACET_PARAMS = {};
function facetParamsKey(params) {
  if (!params || typeof params !== "object") return "";
  return Object.keys(params).sort().map((k2) => `${k2}=${params[k2]}`).join("&");
}
function chipOfferValues(facet, offer) {
  if (!offer) return null;
  if (facet.valuesSource === "types") return offer.show.type ? offer.types || [] : [];
  if (facet.valuesSource === "reactionTags") return offer.show.reaction ? offer.reaction || [] : [];
  if (facet.key === "publication") return offer.show.publication ? offer.publication || [] : [];
  return facet.options || [];
}
function FacetBar({
  facets,
  state,
  update,
  sortFields = [],
  groupAxes = [],
  search,
  onSearchInput,
  searchRef,
  titleSearch,
  onTitleSearchInput,
  facetParams,
  showSearch = true
}) {
  const [moreOpen, setMoreOpen] = d(false);
  const promptSearchId = g();
  const titleSearchId = g();
  const [offer, setOffer] = d(null);
  const effectiveParams = facetParams || EMPTY_FACET_PARAMS;
  const paramsKey = facetParamsKey(effectiveParams);
  const ownRev = useOwnModelsRevision();
  const indexEpoch = useIndexEpoch();
  const offerKey = A(paramsKey);
  y(() => {
    let cancelled = false;
    if (offerKey.current !== paramsKey) {
      offerKey.current = paramsKey;
      setOffer(null);
    }
    getListOffer(effectiveParams).then((data) => {
      if (!cancelled) setOffer(data || { show: {}, groupAxes: [] });
    }).catch(() => {
      if (!cancelled) setOffer({ show: {}, groupAxes: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [paramsKey, ownRev, indexEpoch]);
  const isPrimary = (f) => f.kind === "chips" || f.kind === "multi" || f.kind === "tree" || f.kind === "nested-tree" || f.kind === "tristate" || f.kind === "date-range" || f.kind === "flag";
  const primary = facets.filter(isPrimary);
  const advanced = facets.filter((f) => !isPrimary(f));
  const offeredGroupAxes = (() => {
    if (offer == null) return null;
    const allowed = new Set(offer.groupAxes || []);
    const list = (groupAxes || []).filter((a) => allowed.has(a.value));
    const gb = state.groupBy && state.groupBy !== "none" ? state.groupBy : null;
    if (gb && !list.some((a) => a.value === gb)) {
      const fromProp = (groupAxes || []).find((a) => a.value === gb);
      list.push(fromProp || { value: gb, label: gb });
    }
    return list;
  })();
  const advancedVisible = advanced.filter((facet) => {
    if (offer == null) return false;
    if (facet.kind === "number-range") {
      if (facet.key === "cfgMin") {
        return offer.show.cfg || state.cfgMin != null || state.cfgMax != null;
      }
      if (facet.key === "stepsMin") {
        return offer.show.steps || state.stepsMin != null || state.stepsMax != null;
      }
    }
    return true;
  });
  const renderFacet = (facet) => {
    const listKey = facetListKey(facet);
    switch (facet.kind) {
      case "chips":
        return /* @__PURE__ */ u(
          ChipGroup,
          {
            facet,
            active: state[facet.key] || [],
            update,
            offerValues: chipOfferValues(facet, offer)
          },
          listKey
        );
      case "multi":
        return /* @__PURE__ */ u(
          MultiSelect,
          {
            facet,
            active: state[facet.key] || [],
            ratingActive: state.rating || [],
            postTagActive: state.postTag || [],
            update,
            facetParams: effectiveParams,
            offerShow: offer == null ? null : !!offer.show.tags
          },
          listKey
        );
      case "tree":
        return /* @__PURE__ */ u(
          TreePicker,
          {
            facet,
            state,
            update,
            facetParams: effectiveParams,
            offerShow: offer == null ? null : !!offer.show.resources,
            showOwn: offer == null ? false : !!offer.show.ownModels,
            ownKnown: offer == null ? false : offer.ownKnown === true,
            ownRev
          },
          listKey
        );
      case "nested-tree": {
        if (offer == null) return null;
        if (facet.tree === "type-workflow") {
          const active = (state.mediaType || []).length || (state.workflowMode || []).length || (state.workflow || []).length;
          if (!offer.show.typeTree && !active) return null;
        } else if (facet.tree === "aspect") {
          const active = (state.aspect || []).length;
          if (!offer.show.aspect && !active) return null;
        } else {
          return null;
        }
        return /* @__PURE__ */ u(
          NestedTreePicker,
          {
            facet,
            state,
            update,
            facetParams: effectiveParams,
            offer
          },
          listKey
        );
      }
      case "date-range":
        if (offer == null) return null;
        if (!offer.show.when && !(state[facet.key] || state[facet.key2])) return null;
        return /* @__PURE__ */ u(
          DateRange,
          {
            facet,
            state,
            update,
            dateBounds: offer.when || { min: null, max: null }
          },
          listKey
        );
      case "number-range": {
        if (offer == null) return null;
        const isCfg = facet.key === "cfgMin";
        const shown = isCfg ? offer.show.cfg || state.cfgMin != null || state.cfgMax != null : offer.show.steps || state.stepsMin != null || state.stepsMax != null;
        if (!shown) return null;
        return /* @__PURE__ */ u(RangePicker, { label: facet.label, minKey: facet.key, maxKey: facet.key2, state, update, type: "number" }, listKey);
      }
      case "tristate":
        return /* @__PURE__ */ u(Segmented, { facet, value: state[facet.key], update }, listKey);
      case "flag":
        return /* @__PURE__ */ u(
          Flag,
          {
            facet,
            value: state[facet.key],
            update,
            offerShow: offer == null ? null : !!offer.show.usedAsInput
          },
          listKey
        );
      default:
        return null;
    }
  };
  const showArrange = (sortFields || []).length > 0 || (groupAxes || []).length > 0;
  const arrangeGroupAxes = offeredGroupAxes == null ? [] : offeredGroupAxes;
  return /* @__PURE__ */ u("search", { class: "filter-bar facet-bar", children: [
    /* @__PURE__ */ u("div", { class: "facet-primary", children: primary.map(renderFacet) }),
    /* @__PURE__ */ u("div", { class: "filter-controls", children: [
      showArrange && /* @__PURE__ */ u(
        Arrange,
        {
          state,
          sortFields,
          groupAxes: arrangeGroupAxes,
          update
        }
      ),
      advancedVisible.length > 0 && /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: `quiet-btn${moreOpen ? " open" : ""}`,
          "aria-expanded": moreOpen,
          onClick: () => setMoreOpen((o) => !o),
          children: [
            "More ",
            moreOpen ? "\u25B4" : "\u25BE"
          ]
        }
      ),
      showSearch && /* @__PURE__ */ u(k, { children: [
        /* @__PURE__ */ u("label", { class: "visually-hidden", for: promptSearchId, children: "Search prompts" }),
        /* @__PURE__ */ u(
          "input",
          {
            id: promptSearchId,
            ref: searchRef,
            type: "search",
            class: "search-input",
            placeholder: "Search prompts\u2026",
            title: "Search prompts",
            value: search || "",
            onInput: (e) => onSearchInput(e.target.value)
          }
        )
      ] }),
      typeof onTitleSearchInput === "function" && /* @__PURE__ */ u(k, { children: [
        /* @__PURE__ */ u("label", { class: "visually-hidden", for: titleSearchId, children: "Search titles" }),
        /* @__PURE__ */ u(
          "input",
          {
            id: titleSearchId,
            type: "search",
            class: "search-input",
            placeholder: "Search titles\u2026",
            title: "Search titles",
            value: titleSearch || "",
            onInput: (e) => onTitleSearchInput(e.target.value)
          }
        )
      ] })
    ] }),
    moreOpen && advancedVisible.length > 0 && /* @__PURE__ */ u("div", { class: "facet-advanced", children: advancedVisible.map(renderFacet) })
  ] });
}

export {
  FacetBar
};
