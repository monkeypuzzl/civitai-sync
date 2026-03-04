import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { getGenerations, getStats } from '../api.js';
import { StatsBar } from './StatsBar.jsx';
import { FilterBar } from './FilterBar.jsx';
import { Gallery } from './Gallery.jsx';
import { Lightbox } from './Lightbox.jsx';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';

export function GenerationsView () {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState('newest');
  const [activeTags, setActiveTags] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(null);
  const fetchId = useRef(0);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset on filter change
  useEffect(() => {
    setItems([]);
    setPage(1);
    setTotalPages(1);
  }, [sort, activeTags, search]);

  // Fetch data
  useEffect(() => {
    const id = ++fetchId.current;
    setLoading(true);

    const tags = activeTags.join(',');
    getGenerations({ page, sort, tags, search })
      .then(data => {
        if (id !== fetchId.current) return;
        setTotalPages(data.totalPages);
        setItems(prev => page === 1 ? data.items : [...prev, ...data.items]);
      })
      .catch(() => {})
      .finally(() => { if (id === fetchId.current) setLoading(false); });
  }, [page, sort, activeTags, search]);

  const loadMore = useCallback(() => {
    if (!loading && page < totalPages) setPage(p => p + 1);
  }, [loading, page, totalPages]);

  const sentinelRef = useInfiniteScroll(loadMore);

  function toggleTag (tag) {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  function handleSortToggle () {
    setSort(s => s === 'newest' ? 'oldest' : 'newest');
  }

  const selectedItem = selectedIdx != null ? items[selectedIdx] : null;
  const searchRef = useRef(null);

  useEffect(() => {
    if (selectedItem) return;
    function onKey (e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'j') window.scrollBy({ top: 300, behavior: 'smooth' });
      else if (e.key === 'k') window.scrollBy({ top: -300, behavior: 'smooth' });
      else if (e.key === 'f') toggleTag('favorite');
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedItem, activeTags]);

  return (
    <div class="main-content">
      <StatsBar stats={stats} />
      <FilterBar
        activeTags={activeTags}
        onTagToggle={toggleTag}
        sort={sort}
        onSortToggle={handleSortToggle}
        search={searchInput}
        onSearchInput={setSearchInput}
        searchRef={searchRef}
      />
      <Gallery
        items={items}
        onItemClick={setSelectedIdx}
        sentinelRef={sentinelRef}
        loading={loading}
        hasMore={page < totalPages}
        search={search}
      />
      {selectedItem && (
        <Lightbox
          item={selectedItem}
          onClose={() => setSelectedIdx(null)}
          onPrev={selectedIdx > 0 ? () => setSelectedIdx(i => i - 1) : null}
          onNext={selectedIdx < items.length - 1 ? () => setSelectedIdx(i => i + 1) : null}
          search={search}
        />
      )}
    </div>
  );
}
