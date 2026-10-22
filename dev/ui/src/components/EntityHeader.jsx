import { useState } from 'preact/hooks';
import { chipDatetime, formatDate, relativeTime } from '../lib/format.js';
import { openOriginNode } from '../lib/open-origin-node.js';
import { readHistoryBag } from '../lib/origin-page.js';
import { ChipOverflow } from './ChipOverflow.jsx';
import { TimeText } from './TimeText.jsx';

function reactionTone (chip) {
  if (chip && chip.title === 'Reactions: Favorite') return ' favorite';
  if (chip && chip.title === 'Reactions: Liked') return ' liked';
  return '';
}

function dismissFilter (event, href) {
  if (!event || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openOriginNode(event, { href, bag: readHistoryBag() });
}

function FilterChip ({ filter, clusterOpen, onToggleCluster }) {
  const text = filter && filter.text != null ? String(filter.text) : '';
  const tip = filter && filter.title ? String(filter.title) : '';
  const dest = filter && filter.href ? String(filter.href) : '';
  const aria = filter && filter.ariaLabel ? String(filter.ariaLabel) : `Remove ${tip || text}`;
  if (filter && filter.kind === 'cluster') {
    return (
      <span class="tag-chip active tree-picker-chip chip-cluster">
        <button type="button" class="chip-cluster-show" onClick={() => onToggleCluster(dest)}>
          {clusterOpen ? 'Show less' : text}
        </button>
        <a
          class="chip-cluster-remove"
          href={dest}
          title={tip || undefined}
          aria-label={aria}
          onClick={e => dismissFilter(e, dest)}
        >
          {'\u00D7'}
        </a>
      </span>
    );
  }
  const except = filter && filter.kind === 'except';
  return (
    <a
      class={`tag-chip tree-picker-chip remove${except ? ' exception' : ` active${reactionTone(filter)}`}`}
      href={dest}
      title={tip || undefined}
      aria-label={aria}
      onClick={e => dismissFilter(e, dest)}
    >
      {text} {'\u00D7'}
    </a>
  );
}

// First sidebar block on a media, batch, post, comic, or published 3D page.
// Title, kind, date, and property chips. `href` is the bare container while
// a filter is on the address. `filters` are the removable values, outside
// that link. The media page does not pass either.
export function EntityHeader ({ title, label, date, chips, href, filters }) {
  const heading = String(title || '').trim();
  const name = String(label || '').trim();
  const when = date ? formatDate(date) : '';
  const rel = date ? relativeTime(date) : '';
  const row = Array.isArray(chips) ? chips.filter(Boolean) : [];
  const filterRow = Array.isArray(filters) ? filters.filter(Boolean) : [];
  const [openCluster, setOpenCluster] = useState('');
  if (!heading && !name && !when && !row.length && !filterRow.length) return null;

  const link = String(href || '').trim();
  const body = (
    <header>
      {heading ? <h1 class="post-detail-title">{heading}</h1> : null}
      {name ? <div class="meta-label">{name}</div> : null}
      {when ? (
        <div class="post-detail-date">
          <TimeText at={date}>{when}</TimeText>
          {rel ? <span class="text-muted">{'\u00B7'} <TimeText at={date}>{rel}</TimeText></span> : null}
        </div>
      ) : null}
      {row.length > 0 ? (
        <ul class="meta-params entity-header-chips">
          {row.map((chip, i) => {
            const text = chip && typeof chip === 'object' ? chip.text : String(chip || '');
            const title = chip && typeof chip === 'object' ? String(chip.title || '').trim() : '';
            const datetime = chipDatetime(text);
            return (
              <li key={`${text}:${i}`} class="param-chip" title={title || undefined}>
                {datetime ? <TimeText datetime={datetime}>{text}</TimeText> : text}
              </li>
            );
          })}
        </ul>
      ) : null}
    </header>
  );

  return (
    <div class="meta-section entity-header">
      {link ? (
        <a
          class="entity-header-link"
          href={link}
          onClick={e => openOriginNode(e, { href: link, bag: readHistoryBag() })}
        >{body}</a>
      ) : body}
      {filterRow.length > 0 ? (
        <>
          <ChipOverflow maxLines={2} class="entity-header-filters">
            {filterRow.map((filter, i) => (
              <FilterChip
                key={`${filter.text}:${i}`}
                filter={filter}
                clusterOpen={!!(filter.kind === 'cluster' && openCluster && openCluster === filter.href)}
                onToggleCluster={href => setOpenCluster(current => current === href ? '' : href)}
              />
            ))}
          </ChipOverflow>
          {filterRow.filter(filter => filter.kind === 'cluster' && filter.href === openCluster).map(filter => (
            <div key={filter.href} class="chip-cluster-members">
              {(filter.members || []).map((member, i) => (
                <FilterChip key={`${member.text}:${i}`} filter={member} />
              ))}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
