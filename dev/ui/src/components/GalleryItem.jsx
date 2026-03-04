import { formatDate } from '../lib/format.js';
import { HighlightText } from './HighlightText.jsx';

export function GalleryItem ({ item, onClick, search }) {
  const first = item.media[0];
  if (!first) return null;

  const hasFav = item.tags.includes('favorite');
  const hasLiked = item.tags.includes('feedback:liked');
  const hasDisliked = item.tags.includes('feedback:disliked');
  const isVideo = first.type === 'video';
  const dateStr = formatDate(item.createdAt);
  const snippet = search && item.prompt ? item.prompt.slice(0, 120) : null;

  return (
    <div class="gallery-item" onClick={onClick} title={dateStr}>
      {isVideo
        ? <video src={first.thumbnailPath} preload="metadata" muted playsInline />
        : <img src={first.thumbnailPath} loading="lazy" alt="" />
      }
      {isVideo && <div class="video-badge" />}
      {item.mediaCount > 1 && <span class="media-badge">{item.mediaCount}</span>}
      {snippet
        ? <div class="hover-info search-snippet"><HighlightText text={snippet} search={search} /></div>
        : <div class="hover-info">{dateStr}</div>
      }
      {(hasFav || hasLiked || hasDisliked) && (
        <div class="tag-indicators">
          {hasFav && <span class="tag-indicator favorite">{'\u2764\uFE0F'}</span>}
          {hasLiked && <span class="tag-indicator liked">{'\uD83D\uDC4D'}</span>}
          {hasDisliked && <span class="tag-indicator disliked">{'\uD83D\uDC4E'}</span>}
        </div>
      )}
    </div>
  );
}
