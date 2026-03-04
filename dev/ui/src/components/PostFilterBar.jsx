import { useState, useRef, useEffect } from 'preact/hooks';

export function PostFilterBar ({ availableTags, activeTags, onTagToggle, sort, onSortToggle, search, onSearchInput, searchRef }) {
  const [open, setOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const panelRef = useRef(null);
  const tagBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown (e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        tagBtnRef.current && !tagBtnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const visibleTags = tagSearch
    ? availableTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
    : availableTags;

  return (
    <div class="filter-bar post-filter-bar">
      <div class="filter-controls">
        <button class="sort-toggle" onClick={onSortToggle}>
          {sort === 'newest' ? '\u2193 Newest' : '\u2191 Oldest'}
        </button>

        {/* Tag picker button */}
        <div class="tag-picker-wrap">
          <button
            ref={tagBtnRef}
            class={`sort-toggle tag-picker-btn${activeTags.length > 0 ? ' has-active' : ''}${open ? ' open' : ''}`}
            onClick={() => setOpen(o => !o)}
          >
            Tags{activeTags.length > 0 ? ` (${activeTags.length})` : ''} {open ? '\u25B4' : '\u25BE'}
          </button>

          {open && (
            <div ref={panelRef} class="tag-picker-panel">
              <input
                class="tag-picker-search"
                type="search"
                placeholder="Filter tags…"
                value={tagSearch}
                onInput={e => setTagSearch(e.target.value)}
                autoFocus
              />
              <div class="tag-picker-list">
                {visibleTags.length === 0 && (
                  <span class="tag-picker-empty">No matching tags</span>
                )}
                {visibleTags.map(tag => (
                  <button
                    key={tag}
                    class={`tag-chip${activeTags.includes(tag) ? ' active' : ''}`}
                    onClick={() => onTagToggle(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active tag chips */}
        {activeTags.map(tag => (
          <button
            key={tag}
            class="tag-chip active tag-chip-active-inline"
            onClick={() => onTagToggle(tag)}
            title={`Remove: ${tag}`}
          >
            {tag} {'\u00D7'}
          </button>
        ))}

        <input
          ref={searchRef}
          type="search"
          class="search-input"
          placeholder="Search titles & tags…"
          value={search}
          onInput={e => onSearchInput(e.target.value)}
        />
      </div>
    </div>
  );
}
