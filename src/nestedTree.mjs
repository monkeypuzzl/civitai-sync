// Compact selection for a `{ key, children }` tree.
//
// Type / workflowMode / workflow is one union axis. A checked type writes
// `type=`. A checked mode writes `workflowMode=<abbreviation>`. A leaf or a
// unary workflow row writes `workflow=<id>`. A remainder row writes
// `workflowMode=none:<type>`. Checking a parent does not also emit its
// descendants. A sole unary workflow child does not promote to `type=`.
//
// Paths are `/`-joined keys from the type root (`image/T2I/txt2img:face-fix`).

function csvList (value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

function childPath (parent, key) {
  return parent ? `${parent}/${key}` : key;
}

/**
 * Checkbox state of one node.
 *
 * A type is `checked` only when its own path (or an ancestor) is selected.
 * Covered children leave a type `indeterminate` — `type=` is a different
 * bookmark from the identifiers under it. A mode is `checked` when its path
 * is selected or every leaf is.
 *
 * @param {{ key: string, kind?: string, children?: object[] }} node
 * @param {Set<string>} explicit
 * @param {string} path
 * @param {boolean} [ancestorChecked]
 * @returns {'checked'|'indeterminate'|'unchecked'}
 */
export function checkState (node, explicit, path, ancestorChecked = false) {
  if (ancestorChecked || explicit.has(path)) return 'checked';
  const kids = node.children || [];
  if (!kids.length) return 'unchecked';
  const states = kids.map(k => checkState(k, explicit, childPath(path, k.key), false));
  if (node.kind === 'type') {
    return states.some(s => s !== 'unchecked') ? 'indeterminate' : 'unchecked';
  }
  if (states.every(s => s === 'checked')) return 'checked';
  if (states.some(s => s !== 'unchecked')) return 'indeterminate';
  return 'unchecked';
}

function modeFullySelected (node, path, explicit) {
  if (explicit.has(path)) return true;
  const leaves = node.children || [];
  if (!leaves.length) return false;
  return leaves.every(leaf => explicit.has(childPath(path, leaf.key)));
}

function childFullySelected (node, path, explicit) {
  if (node.kind === 'mode') return modeFullySelected(node, path, explicit);
  return explicit.has(path);
}

function pushUnique (list, value) {
  if (!list.includes(value)) list.push(value);
}

/**
 * Compact a set of checked paths into URL params.
 * Fully checked type → `type` only. Fully checked mode → `workflowMode`
 * only (also when every leaf path is checked). Two leaves under one mode
 * stay `workflow` ids. A unary workflow row stays `workflow=<id>` even when
 * it is the type's only child. Remainder → `workflowMode=none:<type>`.
 *
 * @param {{ types?: object[] }} tree
 * @param {Iterable<string>} checkedPaths
 * @returns {{ type?: string, workflowMode?: string, workflow?: string }}
 */
export function selectionToTypeWorkflowParams (tree, checkedPaths) {
  const explicit = checkedPaths instanceof Set ? checkedPaths : new Set(checkedPaths || []);
  const types = [];
  const modes = [];
  const workflows = [];

  for (const typeNode of tree?.types || []) {
    const typePath = typeNode.key;
    const children = typeNode.children || [];
    const allChildren = children.length > 0
      && children.every(child => childFullySelected(child, childPath(typePath, child.key), explicit));
    const soleUnary = children.length === 1 && children[0].kind === 'workflow';
    if (explicit.has(typePath) || (allChildren && !soleUnary)) {
      pushUnique(types, typeNode.key);
      continue;
    }
    for (const child of children) {
      const path = childPath(typePath, child.key);
      if (child.kind === 'mode') {
        if (modeFullySelected(child, path, explicit)) {
          pushUnique(modes, child.key);
          continue;
        }
        for (const leaf of child.children || []) {
          if (explicit.has(childPath(path, leaf.key))) pushUnique(workflows, leaf.key);
        }
      } else if (child.kind === 'workflow') {
        if (explicit.has(path)) pushUnique(workflows, child.key);
      } else if (child.kind === 'remainder') {
        if (explicit.has(path)) pushUnique(modes, child.key);
      }
    }
  }

  const out = {};
  if (types.length) out.type = types.join(',');
  if (modes.length) out.workflowMode = modes.join(',');
  if (workflows.length) out.workflow = workflows.join(',');
  return out;
}

function indexTree (tree) {
  const typeKeys = new Set();
  const modePaths = new Map();
  const workflowPaths = new Map();
  const add = (map, key, path) => {
    const list = map.get(key);
    if (list) list.push(path);
    else map.set(key, [path]);
  };
  for (const typeNode of tree?.types || []) {
    typeKeys.add(typeNode.key);
    for (const child of typeNode.children || []) {
      const path = childPath(typeNode.key, child.key);
      if (child.kind === 'mode' || child.kind === 'remainder') add(modePaths, child.key, path);
      if (child.kind === 'workflow') add(workflowPaths, child.key, path);
      for (const leaf of child.children || []) {
        add(workflowPaths, leaf.key, childPath(path, leaf.key));
      }
    }
  }
  return { typeKeys, modePaths, workflowPaths };
}

function underExplicit (path, explicit) {
  const parts = path.split('/');
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i];
    if (explicit.has(acc)) return true;
  }
  return false;
}

function fillStates (nodes, explicit, ancestorChecked, prefix, into) {
  for (const node of nodes || []) {
    const path = prefix ? childPath(prefix, node.key) : node.key;
    const selfChecked = ancestorChecked || explicit.has(path);
    if (selfChecked) {
      into.set(path, 'checked');
      fillStates(node.children || [], explicit, true, path, into);
      continue;
    }
    fillStates(node.children || [], explicit, false, path, into);
    into.set(path, checkState(node, explicit, path, false));
  }
}

/**
 * Inverse of {@link selectionToTypeWorkflowParams}.
 * `type=image` checks that type and absorbs same-branch mode and workflow
 * tokens. `workflowMode=T2I` checks that mode and absorbs its identifiers.
 * `workflow=txt2img` checks that leaf. `workflowMode=none:image` checks
 * Unknown. Tokens that match no node are `extras`.
 *
 * @param {{ types?: object[] }} tree
 * @param {{ type?: string, workflowMode?: string, workflow?: string }} params
 * @returns {{ state: (path: string) => 'checked'|'indeterminate'|'unchecked', extras: string[] }}
 */
export function paramsToTypeWorkflowSelection (tree, params = {}) {
  const typeTokens = csvList(params.type);
  const modeTokens = csvList(params.workflowMode);
  const workflowTokens = csvList(params.workflow);
  const { typeKeys, modePaths, workflowPaths } = indexTree(tree);
  const explicit = new Set();
  const matchedTypes = new Set();
  const matchedModes = new Set();
  const matchedWorkflows = new Set();

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

  const states = new Map();
  fillStates(tree?.types || [], explicit, false, '', states);

  const extras = [
    ...typeTokens.filter(t => !matchedTypes.has(t)),
    ...modeTokens.filter(t => !matchedModes.has(t)),
    ...workflowTokens.filter(t => !matchedWorkflows.has(t))
  ];
  return {
    state (path) {
      return states.get(path) || 'unchecked';
    },
    extras
  };
}

/**
 * Aspect compact on the same path rules. Checking the class writes the class
 * token. Checking every ratio child collapses to the class. One unchecked
 * child of a checked class is the caller's explode (pass the sibling ratio
 * paths, not the class).
 *
 * @param {{ classes?: { key: string, ratios?: { value: string }[] }[] }} tree
 * @param {Iterable<string>} checkedPaths
 * @returns {{ aspect?: string }}
 */
export function selectionToAspectParams (tree, checkedPaths) {
  const explicit = checkedPaths instanceof Set ? checkedPaths : new Set(checkedPaths || []);
  const tokens = [];
  for (const cls of tree?.classes || []) {
    const ratios = cls.ratios || [];
    const allRatios = ratios.length > 0
      && ratios.every(ratio => explicit.has(childPath(cls.key, ratio.value)));
    if (explicit.has(cls.key) || allRatios) {
      pushUnique(tokens, cls.key);
      continue;
    }
    for (const ratio of ratios) {
      if (explicit.has(childPath(cls.key, ratio.value))) pushUnique(tokens, ratio.value);
    }
  }
  return tokens.length ? { aspect: tokens.join(',') } : {};
}

function findByPath (nodes, path) {
  for (const node of nodes || []) {
    if (node.path === path) return node;
    const hit = findByPath(node.children, path);
    if (hit) return hit;
  }
  return null;
}

function pathOfChild (cover, kid) {
  if (kid.path) return kid.path;
  if (!kid.key) return '';
  return cover ? `${cover}/${kid.key}` : kid.key;
}

/**
 * Highest checked paths. A checked parent stands in for its descendants.
 *
 * @param {{ path: string, children?: object[] }[]} roots
 * @param {(path: string) => string} stateOf
 * @returns {Set<string>}
 */
export function explicitPathsFromState (roots, stateOf) {
  const out = new Set();
  function walk (nodes, parentChecked) {
    for (const node of nodes || []) {
      const checked = stateOf(node.path) === 'checked';
      if (checked && !parentChecked) out.add(node.path);
      walk(node.children, checked || parentChecked);
    }
  }
  walk(roots, false);
  return out;
}

function explodeUncheck (roots, explicit, cover, target) {
  const node = findByPath(roots, cover);
  for (const kid of node?.children || []) {
    const childPath = pathOfChild(cover, kid);
    if (!childPath || childPath === target) continue;
    if (target.startsWith(`${childPath}/`)) explodeUncheck(roots, explicit, childPath, target);
    else explicit.add(childPath);
  }
}

/**
 * Check or uncheck one path. Unchecking a descendant of a checked ancestor
 * keeps that ancestor's other children (and walks down the unchecked branch).
 *
 * @param {{ path: string, children?: object[] }[]} roots
 * @param {Iterable<string>} explicitPaths
 * @param {string} path
 * @param {boolean} turnOn
 * @returns {Set<string>}
 */
export function toggleCheckedPaths (roots, explicitPaths, path, turnOn) {
  const explicit = new Set(explicitPaths || []);
  if (turnOn) {
    for (const p of explicit) {
      if (path === p || path.startsWith(`${p}/`)) return explicit;
    }
    const drop = [];
    for (const p of explicit) {
      if (p.startsWith(`${path}/`)) drop.push(p);
    }
    for (const p of drop) explicit.delete(p);
    explicit.add(path);
    return explicit;
  }
  let cover = null;
  if (explicit.has(path)) cover = path;
  else {
    const parts = path.split('/');
    let acc = '';
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
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
