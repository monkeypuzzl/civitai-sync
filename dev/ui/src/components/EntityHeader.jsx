import { chipDatetime, formatDate, relativeTime } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';

// First sidebar block on a media, batch, post, or comic page.
// Title, kind, date, and property chips. Nothing here is a link.
export function EntityHeader ({ title, label, date, chips }) {
  const heading = String(title || '').trim();
  const name = String(label || '').trim();
  const when = date ? formatDate(date) : '';
  const rel = date ? relativeTime(date) : '';
  const row = Array.isArray(chips) ? chips.filter(Boolean) : [];
  if (!heading && !name && !when && !row.length) return null;

  return (
    <div class="meta-section entity-header">
      <header>
        {heading ? <h1 class="post-detail-title">{heading}</h1> : null}
        {name ? <div class="meta-label">{name}</div> : null}
        {when ? (
          <div class="post-detail-date">
            <TimeText at={date}>{when}</TimeText>
            {rel ? <span class="text-muted">{'\u00B7'} <TimeText at={date}>{rel}</TimeText></span> : null}
          </div>
        ) : null}
        {row.length > 0 ? (
          <ul class="meta-params entity-header-chips">
            {row.map((chip, i) => {
              const text = chip && typeof chip === 'object' ? chip.text : String(chip || '');
              const title = chip && typeof chip === 'object' ? String(chip.title || '').trim() : '';
              const datetime = chipDatetime(text);
              return (
                <li key={`${text}:${i}`} class="param-chip" title={title || undefined}>
                  {datetime ? <TimeText datetime={datetime}>{text}</TimeText> : text}
                </li>
              );
            })}
          </ul>
        ) : null}
      </header>
    </div>
  );
}
