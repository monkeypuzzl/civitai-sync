// Which Models-catalog variant rows mount. Chip order is the caller's
// order (the section payload). Collapse is a list of family ids, not a URL key.

export function familyIsSelected (option, familyIds, variantIds) {
  if (!option) return false;
  const families = familyIds || [];
  const variants = variantIds || [];
  if (families.includes(option.value)) return true;
  const vids = Array.isArray(option.variants) ? option.variants : [];
  return vids.some(v => variants.includes(v.value));
}

export function variantRowsForSection (families, familyIds, variantIds, collapsedIds) {
  const collapsed = collapsedIds || [];
  return (families || []).filter(f =>
    Array.isArray(f.variants)
    && f.variants.length >= 2
    && familyIsSelected(f, familyIds, variantIds)
    && !collapsed.includes(f.value)
  );
}
