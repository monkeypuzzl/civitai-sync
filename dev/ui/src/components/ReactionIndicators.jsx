import { reactionMarks } from '../lib/format.js';

export function ReactionIndicators ({ item }) {
  const tags = reactionMarks(item);
  const hasFav = tags.includes('favorite');
  const hasLiked = tags.includes('feedback:liked');
  const hasDisliked = tags.includes('feedback:disliked');
  if (!hasFav && !hasLiked && !hasDisliked) return null;
  return (
    <div class="tag-indicators">
      {hasFav && <span class="tag-indicator favorite">{'\u2764\uFE0F'}</span>}
      {hasLiked && <span class="tag-indicator liked">{'\uD83D\uDC4D'}</span>}
      {hasDisliked && <span class="tag-indicator disliked">{'\uD83D\uDC4E'}</span>}
    </div>
  );
}
