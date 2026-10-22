import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { nextGalleryPage } from '../lib/gallery-focus.js';
import { useInfiniteScroll } from './useInfiniteScroll.js';

// Shared gallery data plumbing for the paginated views. The server always
// item-paginates: `items` is the single accumulator (grouped or flat) and
// `groupsMeta` is `{ key, label, count, offset }` metadata from the latest
// response (replaced, not appended — offsets are absolute to the full set).
//
// Growth bound: `items` grows with scroll at tile-DTO size (~200–400 B/tile)
// and is cleared on filter change (`queryKey` reset). A retained-array hard
// cap (sliding-window eviction) is deferred to a >50k-corpus follow-up;
// until then the bound is "small tile × context-switch clear."
//
// `fetcher` is the api.js call (getGenerations / getPosts / getMedia);
// `query` is the view's wire-param slice (URL-state facet/sort/groupBy,
// MINUS session-only keys like `select` so opening the lightbox never
// refetches). The hook keys reset/refetch on a stable stringification of
// `query`.
export function useGalleryData ({ fetcher, query, onPage, reloadEpoch = 0 }) {
  const [items, setItems] = useState([]);
  const [groupsMeta, setGroupsMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [appliedPage, setAppliedPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchId = useRef(0);
  const epochRef = useRef(reloadEpoch);
  const suppressPageFetch = useRef(false);

  const queryKey = JSON.stringify(query);

  const queryRef = useRef(query);
  queryRef.current = query;
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;

  useEffect(() => {
    setItems([]);
    setGroupsMeta(null);
    setPage(1);
    setAppliedPage(0);
    setTotalPages(1);
    setLoading(true);
  }, [queryKey]);

  useEffect(() => {
    if (suppressPageFetch.current) {
      suppressPageFetch.current = false;
      setAppliedPage(page);
      setLoading(false);
      return;
    }
    const id = ++fetchId.current;
    setLoading(true);
    fetcher({ ...queryRef.current, page })
      .then(data => {
        if (id !== fetchId.current) return;
        setTotalPages(data.totalPages || 1);
        setTotal(typeof data.total === 'number' ? data.total : null);
        setAppliedPage(page);
        const next = data.items || [];
        setItems(prev => (page === 1 ? next : [...prev, ...next]));
        if (data.grouped || Array.isArray(data.groups)) {
          setGroupsMeta(data.groups || []);
        } else {
          setGroupsMeta(null);
        }
        if (onPageRef.current) onPageRef.current(data, page);
      })
      .catch(() => {
        if (id === fetchId.current) setAppliedPage(page);
      })
      .finally(() => { if (id === fetchId.current) setLoading(false); });
  }, [queryKey, page, fetcher]);

  useEffect(() => {
    if (epochRef.current === reloadEpoch) return undefined;
    epochRef.current = reloadEpoch;
    const id = ++fetchId.current;
    const target = Math.max(1, page);
    let cancelled = false;
    (async () => {
      const collected = [];
      let pages = 1;
      let totalValue = null;
      let groups = null;
      let loaded = 1;
      for (let p = 1; p <= target; p += 1) {
        const data = await fetcher({ ...queryRef.current, page: p });
        if (cancelled || id !== fetchId.current) return;
        pages = data.totalPages || 1;
        totalValue = typeof data.total === 'number' ? data.total : null;
        if (data.grouped || Array.isArray(data.groups)) groups = data.groups || [];
        collected.push(...(data.items || []));
        loaded = p;
        if (p >= pages) break;
      }
      if (cancelled || id !== fetchId.current) return;
      const nextPage = Math.min(loaded, pages);
      if (nextPage !== page) suppressPageFetch.current = true;
      setItems(collected);
      setTotalPages(pages);
      setTotal(totalValue);
      setGroupsMeta(groups);
      setPage(nextPage);
      setAppliedPage(nextPage);
      setLoading(false);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [reloadEpoch, fetcher, page]);

  const loadMore = useCallback(() => {
    const next = nextGalleryPage(page, { loading, totalPages, appliedPage });
    if (next !== page) setPage(next);
  }, [loading, page, totalPages, appliedPage]);

  const sentinelRef = useInfiniteScroll(loadMore);

  // `setItems` is exposed so a host view can apply optimistic local patches
  // (e.g. GenerationsView's reaction updates) without owning the fetch/paging
  // plumbing. Reaction/selection state stays view-local. groupsMeta is
  // metadata-only (no members to patch).
  return {
    items, groupsMeta, setItems, total, loading, page, totalPages,
    sentinelRef, hasMore: page < totalPages, loadMore,
    pending: loading || page > appliedPage
  };
}
