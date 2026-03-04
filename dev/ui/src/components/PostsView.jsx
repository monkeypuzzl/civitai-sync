import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { getPosts, getStats } from '../api.js';
import { navigate } from '../lib/router.js';
import { PostStatsBar } from './PostStatsBar.jsx';
import { PostFilterBar } from './PostFilterBar.jsx';
import { PostGallery } from './PostGallery.jsx';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';

export function PostsView () {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [postTotal, setPostTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState('newest');
  const [activeTags, setActiveTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const fetchId = useRef(0);
  const seenTags = useRef(new Map());

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setItems([]);
    setPage(1);
    setTotalPages(1);
  }, [sort, activeTags, search]);

  useEffect(() => {
    const id = ++fetchId.current;
    setLoading(true);

    const tags = activeTags.join(',');
    getPosts({ page, sort, tags, search })
      .then(data => {
        if (id !== fetchId.current) return;
        setTotalPages(data.totalPages);
        setPostTotal(data.total);

        const newItems = page === 1 ? data.items : [...items, ...data.items];
        setItems(newItems);

        for (const post of data.items) {
          if (Array.isArray(post.tags)) {
            for (const tag of post.tags) {
              const name = tag.name || tag;
              if (!seenTags.current.has(name)) {
                seenTags.current.set(name, true);
              }
            }
          }
        }
        setAvailableTags([...seenTags.current.keys()].sort());
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

  const searchRef = useRef(null);

  function openPost (idx) {
    const post = items[idx];
    if (post) navigate(`posts/${post.id}`);
  }

  useEffect(() => {
    function onKey (e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'j') window.scrollBy({ top: 300, behavior: 'smooth' });
      else if (e.key === 'k') window.scrollBy({ top: -300, behavior: 'smooth' });
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="main-content">
      <PostStatsBar stats={stats} postTotal={postTotal} />
      <PostFilterBar
        availableTags={availableTags}
        activeTags={activeTags}
        onTagToggle={toggleTag}
        sort={sort}
        onSortToggle={handleSortToggle}
        search={searchInput}
        onSearchInput={setSearchInput}
        searchRef={searchRef}
      />
      <PostGallery
        items={items}
        onItemClick={openPost}
        sentinelRef={sentinelRef}
        loading={loading}
        search={search}
      />
    </div>
  );
}
