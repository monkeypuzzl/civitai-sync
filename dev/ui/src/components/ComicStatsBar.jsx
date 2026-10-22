import { TimeText } from './TimeText.jsx';

export function ComicStatsBar ({ stats, comicTotal, totalLabel = 'comics' }) {
  const total = comicTotal !== undefined ? comicTotal : stats?.totalComics;
  const chapters = stats?.comicChapters;
  const panels = stats?.comicPanels;
  const from = stats?.comicFrom;
  const to = stats?.comicTo;

  const items = [
    total != null && { label: totalLabel, value: total },
    chapters != null && { label: 'chapters', value: chapters },
    panels > 0 && { label: 'panels', value: panels },
    from && {
      label: '',
      from,
      to
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
