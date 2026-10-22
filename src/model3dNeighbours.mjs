// Neighbours for the published 3D page. The walk is the 3D gallery order:
// drop deleted rows, then the same facets, then group or sort. The path id
// stays on the page. A row outside that list is placement `out`.

import { applyFacets, applySort, groupItems, isValidGroupAxis } from './explorerQuery.mjs';

const QUIET_SLOTS = {
  slot: null,
  prevSlot: null,
  nextSlot: null,
  slotInUrl: false,
  prevSlotInUrl: false,
  nextSlotInUrl: false
};

function keptRows (rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => row && row.status !== 'deleted' && row.status !== 'Deleted');
}

function orderedRows (filtered, query) {
  if (isValidGroupAxis(query.groupBy)) {
    const groups = groupItems(filtered, query.groupBy, {
      sort: query.sort,
      groupSort: query.groupSort
    });
    const flat = [];
    for (const group of groups) {
      for (const item of group.items) flat.push(item);
    }
    return flat;
  }
  return applySort(filtered, query.sort);
}

export function model3dNeighbourOrigin (rows, query, id) {
  const params = query && typeof query === 'object' ? query : {};
  const ordered = orderedRows(
    applyFacets(keptRows(rows), params, 'name', { publicationScope: 'model3d' }),
    params
  );
  const key = String(id);
  const idx = ordered.findIndex(row => String(row.id) === key);
  if (idx < 0) {
    return { prevId: null, nextId: null, placement: 'out', ...QUIET_SLOTS };
  }
  return {
    prevId: idx > 0 ? ordered[idx - 1].id : null,
    nextId: idx + 1 < ordered.length ? ordered[idx + 1].id : null,
    placement: 'in',
    ...QUIET_SLOTS
  };
}
