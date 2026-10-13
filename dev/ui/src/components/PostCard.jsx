import { formatDate, isAudioCover } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';
import { tileLead, tileSlotIso } from '../lib/tile-title.js';
import { HighlightText } from './HighlightText.jsx';
import { MediaThumb } from './MediaThumb.jsx';

export function PostCard ({ item, onClick, search, href }) {
  const first = item.media[0];
  if (!first) return null;

  const thumbW = Number(first.width);
  const thumbH = Number(first.height);
  const mediaAspect = (thumbW > 0 && thumbH > 0) ? `${thumbW} / ${thumbH}` : '1 / 1';

  const isVideo = first.type === 'video';
  const audioCover = first.type === 'audio' && (first.coverPath || isAudioCover(first));
  const totalMedia = item.imageCount + item.videoCount + (item.audioCount || 0);
  const stats = item.stats || {};
  const reactions = (stats.likeCount || 0) + (stats.heartCount || 0);

  // Tri-state status (Phase 5c-2). The corner date and the tooltip use the
  // slot date: drafts use createdAt; scheduled and published use publishedAt.
  const isScheduled = item.status === 'scheduled';
  const isDraft = item.status === 'draft';
  const slotIso = tileSlotIso(item, 'post');
  const dateStr = formatDate(slotIso);
  const titleStr = tileLead(item, 'post', dateStr);

  const Tag = href ? 'a' : 'div';

  return (
    <Tag class="gallery-item post-card" href={href || undefined} onClick={onClick} onMouseDown={onClick ? (e) => { if (e.button === 1) onClick(e); } : undefined} title={titleStr} data-focus-id={item.id}>
      <div class="post-card-media" style={{ aspectRatio: mediaAspect }}>
        <MediaThumb
          type={first.type}
          thumbnailPath={first.thumbnailPath}
          coverPath={first.coverPath}
        />
        {isVideo && <div class="video-badge" />}
        {audioCover && <div class="audio-badge">{'\u266B'}</div>}
        {totalMedia > 1 && <span class="media-badge">{totalMedia}</span>}
        {isScheduled && <span class="status-badge status-badge-scheduled">{'\u23F2'} Scheduled</span>}
        {isDraft && <span class="status-badge status-badge-draft">Draft</span>}
        {search && item.promptSnippet && (
          <div class="hover-info search-snippet"><HighlightText text={item.promptSnippet} search={search} /></div>
        )}
        {!(search && item.promptSnippet) && dateStr && (
          <div class="hover-info tile-date"><TimeText at={slotIso}>{dateStr}</TimeText></div>
        )}
      </div>
      <div class="post-card-info">
        {isScheduled && dateStr && <div class="post-card-status-date">Scheduled {'\u00B7'} <TimeText at={slotIso}>{dateStr}</TimeText></div>}
        {item.title && <div class="post-card-title"><HighlightText text={item.title} search={search} /></div>}
        {item.tags.length > 0 && (
          <ul class="post-card-tags">
            {item.tags.slice(0, 4).map(tag => (
              <li key={tag.id || tag.name} class="post-card-tag">{tag.name}</li>
            ))}
            {item.tags.length > 4 && (
              <li class="post-card-tag post-card-tag-more">+{item.tags.length - 4}</li>
            )}
          </ul>
        )}
        {reactions > 0 && (
          <div class="post-card-reactions">
            {stats.heartCount > 0 && <span class="reaction">{'\u2764\uFE0F'} {stats.heartCount}</span>}
            {stats.likeCount > 0 && <span class="reaction">{'\uD83D\uDC4D'} {stats.likeCount}</span>}
          </div>
        )}
      </div>
    </Tag>
  );
}
