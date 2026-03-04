export function StatsBar ({ stats }) {
  if (!stats) return null;

  const imgCount = stats.genImages ?? stats.totalImages;
  const vidCount = stats.genVideos ?? stats.totalVideos;

  const items = [
    stats.totalGenerations != null && { label: 'generations', value: stats.totalGenerations },
    imgCount != null && { label: 'images', value: imgCount },
    vidCount > 0 && { label: 'videos', value: vidCount },
    stats.totalFavorites > 0 && { label: 'favorites', value: stats.totalFavorites },
    stats.totalLiked > 0 && { label: 'liked', value: stats.totalLiked },
    stats.generationDateRange?.from && {
      label: '',
      value: `${stats.generationDateRange.from} — ${stats.generationDateRange.to}`
    }
  ].filter(Boolean);

  return (
    <div class="stats-bar">
      {items.map((item, i) => (
        <>
          {i > 0 && <span class="stat-separator">·</span>}
          <span class="stat-item">
            {item.label ? <><strong>{item.value.toLocaleString()}</strong> {item.label}</> : item.value}
          </span>
        </>
      ))}
    </div>
  );
}
