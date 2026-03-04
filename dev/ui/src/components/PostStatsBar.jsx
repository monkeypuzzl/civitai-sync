export function PostStatsBar ({ stats, postTotal }) {
  if (!stats) return null;

  const imgCount = stats.postImages ?? stats.totalImages;
  const vidCount = stats.postVideos ?? stats.totalVideos;

  const items = [
    postTotal != null && { label: 'posts', value: postTotal },
    imgCount != null && { label: 'images', value: imgCount },
    vidCount > 0 && { label: 'videos', value: vidCount },
    stats.postDateRange?.from && {
      label: '',
      value: `${stats.postDateRange.from} \u2014 ${stats.postDateRange.to}`
    }
  ].filter(Boolean);

  return (
    <div class="stats-bar">
      {items.map((item, i) => (
        <>
          {i > 0 && <span class="stat-separator">{'\u00B7'}</span>}
          <span class="stat-item">
            {item.label ? <><strong>{item.value.toLocaleString()}</strong> {item.label}</> : item.value}
          </span>
        </>
      ))}
    </div>
  );
}
