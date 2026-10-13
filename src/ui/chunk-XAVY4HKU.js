import {
  nextGalleryPage
} from "./chunk-DDUI6F2D.js";
import {
  A,
  d,
  q,
  y
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/hooks/useInfiniteScroll.js
function useInfiniteScroll(callback) {
  const cbRef = A(callback);
  cbRef.current = callback;
  const observerRef = A(null);
  const sentinelRef = q((el) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) cbRef.current();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    observerRef.current = observer;
  }, []);
  return sentinelRef;
}

// dev/ui/src/hooks/useGalleryData.js
function useGalleryData({ fetcher, query, onPage }) {
  const [items, setItems] = d([]);
  const [groupsMeta, setGroupsMeta] = d(null);
  const [page, setPage] = d(1);
  const [appliedPage, setAppliedPage] = d(0);
  const [totalPages, setTotalPages] = d(1);
  const [total, setTotal] = d(null);
  const [loading, setLoading] = d(true);
  const fetchId = A(0);
  const queryKey = JSON.stringify(query);
  const queryRef = A(query);
  queryRef.current = query;
  const onPageRef = A(onPage);
  onPageRef.current = onPage;
  y(() => {
    setItems([]);
    setGroupsMeta(null);
    setPage(1);
    setAppliedPage(0);
    setTotalPages(1);
    setLoading(true);
  }, [queryKey]);
  y(() => {
    const id = ++fetchId.current;
    setLoading(true);
    fetcher({ ...queryRef.current, page }).then((data) => {
      if (id !== fetchId.current) return;
      setTotalPages(data.totalPages || 1);
      setTotal(typeof data.total === "number" ? data.total : null);
      setAppliedPage(page);
      const next = data.items || [];
      setItems((prev) => page === 1 ? next : [...prev, ...next]);
      if (data.grouped || Array.isArray(data.groups)) {
        setGroupsMeta(data.groups || []);
      } else {
        setGroupsMeta(null);
      }
      if (onPageRef.current) onPageRef.current(data, page);
    }).catch(() => {
      if (id === fetchId.current) setAppliedPage(page);
    }).finally(() => {
      if (id === fetchId.current) setLoading(false);
    });
  }, [queryKey, page, fetcher]);
  const loadMore = q(() => {
    const next = nextGalleryPage(page, { loading, totalPages, appliedPage });
    if (next !== page) setPage(next);
  }, [loading, page, totalPages, appliedPage]);
  const sentinelRef = useInfiniteScroll(loadMore);
  return {
    items,
    groupsMeta,
    setItems,
    total,
    loading,
    page,
    totalPages,
    sentinelRef,
    hasMore: page < totalPages,
    loadMore,
    pending: loading || page > appliedPage
  };
}

export {
  useGalleryData
};
