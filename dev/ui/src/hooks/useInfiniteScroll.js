import { useRef, useCallback } from 'preact/hooks';

export function useInfiniteScroll (callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const observerRef = useRef(null);

  const sentinelRef = useCallback((el) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) cbRef.current(); },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  return sentinelRef;
}
