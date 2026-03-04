import { tagLabel } from '../lib/format.js';

const GEN_TAGS = ['favorite', 'feedback:liked', 'feedback:disliked'];

export function FilterBar ({ activeTags, onTagToggle, sort, onSortToggle, search, onSearchInput, searchRef }) {
  return (
    <div class="filter-bar">
      <div class="filter-tags">
        {GEN_TAGS.map(tag => {
          const cls = tag === 'favorite' ? 'favorite' : tag === 'feedback:liked' ? 'liked' : '';
          return (
            <button
              key={tag}
              class={`tag-chip ${cls}${activeTags.includes(tag) ? ' active' : ''}`}
              onClick={() => onTagToggle(tag)}
            >
              {tagLabel(tag)}
            </button>
          );
        })}
      </div>
      <div class="filter-controls">
        <button class="sort-toggle" onClick={onSortToggle}>
          {sort === 'newest' ? '↓ Newest' : '↑ Oldest'}
        </button>
        <input
          ref={searchRef}
          type="search"
          class="search-input"
          placeholder="Search prompts…"
          value={search}
          onInput={e => onSearchInput(e.target.value)}
        />
      </div>
    </div>
  );
}
