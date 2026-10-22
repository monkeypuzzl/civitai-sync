// Tags picker order. The facet payload stays count-ordered. This module
// is the presentation: ladder names in a Rating block, every other name
// A–Z, and a query that narrows only the general list.

import { ratingTagLabel, ratingTagRank } from './browsing-level.js';

function chipText (option) {
  const label = option?.label;
  if (label != null && String(label) !== '') return String(label);
  return String(option?.value ?? '');
}

function compareTagText (a, b) {
  const byLabel = chipText(a).localeCompare(chipText(b), undefined, { sensitivity: 'base' });
  if (byLabel !== 0) return byLabel;
  return String(a.value).localeCompare(String(b.value));
}

function arrangeNameList (options, query, applyQuery) {
  const pool = [];
  for (const option of Array.isArray(options) ? options : []) {
    if (!option || option.value == null) continue;
    pool.push(option);
  }
  const needle = applyQuery ? String(query ?? '').toLowerCase() : '';
  const visible = needle
    ? pool.filter(option => {
      const text = chipText(option).toLowerCase();
      return text.includes(needle) || String(option.value).toLowerCase().includes(needle);
    })
    : pool.slice();
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

// Ratings keep ladder order and canonical labels. The query does not
// remove them. When `ratingOptions` is an array, those chips are the
// Rating block and ladder names in `options` are skipped. Content names
// and post names are A–Z. `searchTarget` is which of those two lists the
// query narrows. The other list stays the full A–Z set.
export function arrangeTagOptions (options, query, ratingOptions, postOptions, searchTarget = 'content') {
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

  const posts = arrangeNameList(postOptions, query, searchTarget === 'posts');
  const content = arrangeNameList(general, query, searchTarget !== 'posts');
  return { ratings, general: content, posts };
}
