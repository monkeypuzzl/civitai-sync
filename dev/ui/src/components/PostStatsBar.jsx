import { TimeText } from './TimeText.jsx';

export function PostStatsBar ({ stats, postTotal, totalLabel = 'posts' }) {
  const imgCount = stats ? (stats.postImages ?? stats.totalImages) : null;
  const vidCount = stats ? (stats.postVideos ?? stats.totalVideos) : null;
  const audCount = stats ? (stats.postAudio ?? stats.totalAudio) : null;

  const items = [
    postTotal != null && { label: totalLabel, value: postTotal },
    imgCount != null && { label: 'images', value: imgCount },
    vidCount > 0 && { label: 'videos', value: vidCount },
    audCount > 0 && { label: 'audio', value: audCount },
    stats?.postDateRange?.from && {
      label: '',
      from: stats.postDateRange.from,
      to: stats.postDateRange.to
    }
  ].filter(Boolean);

  return (
    <ul class="stats-bar" aria-hidden={items.length ? undefined : 'true'}>
      {items.flatMap((item, i) => {
        const cell = (
          <li key={`item-${i}`} class="stat-item">
            {item.label ? <><strong>{item.value.toLocaleString()}</strong> {item.label}</> : (
              <>
                <TimeText at={item.from}>{item.from}</TimeText>
                {' \u2014 '}
                <TimeText at={item.to}>{item.to}</TimeText>
              </>
            )}
          </li>
        );
        if (i === 0) return [cell];
        return [
          <li key={`sep-${i}`} class="stat-separator" aria-hidden="true">{'\u00B7'}</li>,
          cell
        ];
      })}
    </ul>
  );
}
