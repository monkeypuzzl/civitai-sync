import { formatDate } from '../lib/format.js';
import { HighlightText } from './HighlightText.jsx';

export function PostCard ({ item, onClick, search }) {
  const first = item.media[0];
  if (!first) return null;

  const isVideo = first.type === 'video';
  const totalMedia = item.imageCount + item.videoCount;
  const stats = item.stats || {};
  const reactions = (stats.likeCount || 0) + (stats.heartCount || 0);
  const dateStr = formatDate(item.publishedAt);

  return (
    <div class="gallery-item post-card" onClick={onClick} title={dateStr}>
      <div class="post-card-media">
        {isVideo
          ? <video src={first.thumbnailPath} preload="metadata" muted playsInline />
          : <img src={first.thumbnailPath} loading="lazy" alt="" />
        }
        {isVideo && <div class="video-badge" />}
        {totalMedia > 1 && <span class="media-badge">{totalMedia}</span>}
        {item.videoCount > 0 && totalMedia > 1 && (
          <span class="media-badge video-count-badge">{item.videoCount} vid</span>
        )}
      </div>
      <div class="post-card-info">
        {item.title && <div class="post-card-title"><HighlightText text={item.title} search={search} /></div>}
        {item.tags.length > 0 && (
          <div class="post-card-tags">
            {item.tags.slice(0, 4).map(tag => (
              <span key={tag.id || tag.name} class="post-card-tag">{tag.name}</span>
            ))}
            {item.tags.length > 4 && (
              <span class="post-card-tag post-card-tag-more">+{item.tags.length - 4}</span>
            )}
          </div>
        )}
        {reactions > 0 && (
          <div class="post-card-reactions">
            {stats.heartCount > 0 && <span class="reaction">{'\u2764\uFE0F'} {stats.heartCount}</span>}
            {stats.likeCount > 0 && <span class="reaction">{'\uD83D\uDC4D'} {stats.likeCount}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
