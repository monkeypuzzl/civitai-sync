// Merge a current Civitai table with a retired-key record.
// Current wins. A residual value is used only when the key is absent.
// This module does not import src/vendor/.

function has (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Plain-object merge. Keys on `current` replace the same keys on `residual`.
 *
 * @param {object|null|undefined} current
 * @param {object|null|undefined} residual
 * @returns {object}
 */
export function mergeRecords (current, residual) {
  const out = {};
  const extra = residual && typeof residual === 'object' ? residual : {};
  const live = current && typeof current === 'object' ? current : {};
  for (const key of Object.keys(extra)) {
    if (has(extra, key)) out[key] = extra[key];
  }
  for (const key of Object.keys(live)) {
    if (has(live, key)) out[key] = live[key];
  }
  return out;
}

function versionIdSet (variants) {
  const ids = new Set();
  for (const variant of variants || []) {
    for (const vid of variant.versionIds || []) {
      const n = Number(vid);
      if (Number.isFinite(n)) ids.add(n);
    }
  }
  return ids;
}

/**
 * Current families stay. A residual family id that is missing is appended.
 * A residual variant is appended only when none of its version ids already
 * sit on the current family.
 *
 * @param {object[]|null|undefined} currentFamilies
 * @param {object[]|null|undefined} residualFamilies
 * @returns {object[]}
 */
export function mergeFamilies (currentFamilies, residualFamilies) {
  const current = Array.isArray(currentFamilies) ? currentFamilies : [];
  const residual = Array.isArray(residualFamilies) ? residualFamilies : [];
  const out = current.map(fam => ({
    ...fam,
    variants: [...(fam.variants || [])]
  }));
  const index = new Map(out.map(fam => [fam.id, fam]));

  for (const fam of residual) {
    if (!fam || !fam.id) continue;
    const existing = index.get(fam.id);
    if (!existing) {
      out.push(fam);
      index.set(fam.id, fam);
      continue;
    }
    const taken = versionIdSet(existing.variants);
    const variants = [...(existing.variants || [])];
    for (const variant of fam.variants || []) {
      const ids = [];
      for (const vid of variant.versionIds || []) {
        const n = Number(vid);
        if (Number.isFinite(n)) ids.push(n);
      }
      if (ids.some(id => taken.has(id))) continue;
      variants.push(variant);
      for (const id of ids) taken.add(id);
    }
    existing.variants = variants;
  }

  return out;
}
