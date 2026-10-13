import { memo } from 'preact/compat';
import { formatDate, isAudioCover, reactionMarks } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';
import { tileLead, tileSlotIso } from '../lib/tile-title.js';
import { HighlightText } from './HighlightText.jsx';
import { MediaThumb } from './MediaThumb.jsx';

function HasInputsMark ({ inputKinds }) {
  const kinds = Array.isArray(inputKinds) ? inputKinds : [];
  const only = kinds.length === 1 ? kinds[0] : null;
  const title = only === 'image' ? 'Has input image'
    : only === 'video' ? 'Has input video'
    : 'Has input media';
  return <span class="has-inputs-mark" title={title} aria-label={title} />;
}

function MediaTile ({ item, onActivate, selected, search, compact, href, grain }) {
  const first = item.media && item.media[0];
  if (!first) return null;

  const tags = reactionMarks(item);
  const hasFav = tags.includes('favorite');
  const hasLiked = tags.includes('feedback:liked');
  const hasDisliked = tags.includes('feedback:disliked');
  const isVideo = first.type === 'video';
  const isAudio = first.type === 'audio';
  const audioCover = isAudio && (first.coverPath || isAudioCover(first));
  const model3dStill = first.type === 'model3d' && first.thumbnailPath;
  const slotIso = grain ? tileSlotIso(item, grain) : item.createdAt;
  const dateStr = formatDate(slotIso);
  const titleStr = grain ? tileLead(item, grain, dateStr) : dateStr;
  const snippetText = search ? (item.promptSnippet || (item.prompt ? item.prompt.slice(0, 160) : null)) : null;
  const contentTags = Array.isArray(item.contentTags) ? item.contentTags : [];
  const Tag = href ? 'a' : 'div';

  return (
    <Tag
      class={`gallery-item${selected ? ' selected' : ''}${compact ? ' compact' : ''}`}
      href={href || undefined}
      onClick={onActivate ? (e) => onActivate(e, item) : undefined}
      onMouseDown={onActivate ? (e) => { if (e.button === 1) onActivate(e, item); } : undefined}
      title={titleStr}
    >
      <MediaThumb
        type={first.type}
        thumbnailPath={first.thumbnailPath}
        coverPath={first.coverPath}
      />
      {item.hasInputs && <HasInputsMark inputKinds={item.inputKinds} />}
      {isVideo && <div class="video-badge" />}
      {audioCover && <div class="audio-badge">{'\u266B'}</div>}
      {model3dStill && <div class="model3d-badge">3D</div>}
      {!compact && item.mediaCount > 1 && <span class="media-badge">{item.mediaCount}</span>}
      {!compact && contentTags.length > 0 && (
        <ul class="content-tags">
          {contentTags.slice(0, 6).map(t => (
            <li key={t} class="content-tag-chip">{t}</li>
          ))}
        </ul>
      )}
      {!compact && snippetText && (
        <div class="hover-info search-snippet"><HighlightText text={snippetText} search={search} /></div>
      )}
      {!compact && !snippetText && dateStr && (
        <div class="hover-info tile-date"><TimeText at={slotIso}>{dateStr}</TimeText></div>
      )}
      {(hasFav || hasLiked || hasDisliked) && (
        <div class="tag-indicators">
          {hasFav && <span class="tag-indicator favorite">{'\u2764\uFE0F'}</span>}
          {hasLiked && <span class="tag-indicator liked">{'\uD83D\uDC4D'}</span>}
          {hasDisliked && <span class="tag-indicator disliked">{'\uD83D\uDC4E'}</span>}
        </div>
      )}
    </Tag>
  );
}

function sameTile (prev, next) {
  const a = prev.item;
  const b = next.item;
  return a.id === b.id
    && prev.selected === next.selected
    && prev.compact === next.compact
    && (a.media && a.media[0] && a.media[0].type) === (b.media && b.media[0] && b.media[0].type)
    && (a.media && a.media[0] && a.media[0].thumbnailPath) === (b.media && b.media[0] && b.media[0].thumbnailPath)
    && (a.media && a.media[0] && a.media[0].coverPath) === (b.media && b.media[0] && b.media[0].coverPath)
    && reactionMarks(a).join(',') === reactionMarks(b).join(',')
    && prev.search === next.search
    && prev.grain === next.grain
    && a.createdAt === b.createdAt
    && a.publishedAt === b.publishedAt
    && a.date === b.date
    && a.status === b.status
    && a.title === b.title
    && a.name === b.name
    && a.audioTitle === b.audioTitle
    && !!a.hasInputs === !!b.hasInputs
    && (a.inputKinds || []).join(',') === (b.inputKinds || []).join(',')
    && prev.href === next.href;
}

const MemoMediaTile = memo(MediaTile, sameTile);
export { MemoMediaTile as MediaTile };
