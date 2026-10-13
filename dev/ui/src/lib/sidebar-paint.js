import { normalizeMediaId } from './format.js';

/**
 * Index and rating record that paint the media sidebar.
 * A detail whose id is this item wins. Otherwise the parent fallback
 * already in hand wins, so Next does not paint an empty column while
 * a local refetch is still the previous item. Otherwise nothing —
 * never the previous item's index or raw.
 */
export function sidebarPaint (detail, fallback, mediaId, fallbackRaw) {
  const want = normalizeMediaId(mediaId);
  if (!want) return { index: null, raw: null };
  const fromDetail = detail && detail.index;
  if (fromDetail && normalizeMediaId(fromDetail.id) === want) {
    return { index: fromDetail, raw: detail.raw ?? null };
  }
  if (fallback && normalizeMediaId(fallback.id) === want) {
    return { index: fallback, raw: fallbackRaw ?? null };
  }
  return { index: null, raw: null };
}
