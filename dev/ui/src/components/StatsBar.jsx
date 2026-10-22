import { TimeText } from './TimeText.jsx';

export function StatsBar ({ stats }) {
  const imgCount = stats ? (stats.genImages ?? stats.totalImages) : null;
  const vidCount = stats ? (stats.genVideos ?? stats.totalVideos) : null;
  const audCount = stats ? (stats.genAudio ?? stats.totalAudio) : null;
  const model3dCount = stats ? (stats.genModel3d ?? stats.totalModel3d) : null;

  const items = [
    stats?.totalGenerations != null && { label: 'generations', value: stats.totalGenerations },
    imgCount != null && { label: 'images', value: imgCount },
    vidCount > 0 && { label: 'videos', value: vidCount },
    audCount > 0 && { label: 'audio', value: audCount },
    model3dCount > 0 && { label: '3D', value: model3dCount },
    stats?.totalFavorites > 0 && { label: 'favorites', value: stats.totalFavorites },
    stats?.totalLiked > 0 && { label: 'liked', value: stats.totalLiked },
    stats?.generationDateRange?.from && {
      label: '',
      from: stats.generationDateRange.from,
      to: stats.generationDateRange.to
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
