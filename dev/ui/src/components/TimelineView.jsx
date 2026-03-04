import { useState, useEffect } from 'preact/hooks';
import { getTimelineMonths, getTimelineMonth } from '../api.js';
import { navigate } from '../lib/router.js';
import { Lightbox } from './Lightbox.jsx';

function monthLabel (key) {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function TimelineView () {
  const [months, setMonths] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [items, setItems] = useState([]);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selected, setSelected] = useState(null);
  const [cache] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    setLoadingMonths(true);
    getTimelineMonths()
      .then(data => {
        if (cancelled) return;
        setMonths(data.months || []);
        setCurrentIdx(0);
        setLoadingMonths(false);
      })
      .catch(() => { if (!cancelled) setLoadingMonths(false); });
    return () => { cancelled = true; };
  }, []);

  const current = months[currentIdx] || null;
  const monthKey = current?.month;

  useEffect(() => {
    if (!monthKey) return;
    if (cache.has(monthKey)) {
      setItems(cache.get(monthKey));
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    getTimelineMonth(monthKey)
      .then(data => {
        if (cancelled) return;
        const fetched = data.items || [];
        cache.set(monthKey, fetched);
        setItems(fetched);
        setLoadingItems(false);
      })
      .catch(() => { if (!cancelled) setLoadingItems(false); });
    return () => { cancelled = true; };
  }, [monthKey]);

  function goTo (idx) {
    if (idx >= 0 && idx < months.length) {
      setCurrentIdx(idx);
      setSelected(null);
    }
  }

  function openItem (item) {
    if (item._source === 'post') {
      navigate(`posts/${item.id}`);
    } else {
      setSelected(item);
    }
  }

  const selectedIdx = selected ? items.indexOf(selected) : -1;

  function navPrev () {
    if (selectedIdx > 0) setSelected(items[selectedIdx - 1]);
  }
  function navNext () {
    if (selectedIdx < items.length - 1) setSelected(items[selectedIdx + 1]);
  }

  if (loadingMonths) {
    return <div class="main-content"><div class="loading-bar"><div class="spinner" /></div></div>;
  }

  if (!months.length) {
    return (
      <div class="main-content">
        <div class="empty-state">
          <h2>No content yet</h2>
          <p>Download generations or posts to see your timeline.</p>
        </div>
      </div>
    );
  }

  return (
    <div class="main-content">
      {/* Month picker */}
      <div class="month-picker">
        <button
          class="month-picker-arrow"
          disabled={currentIdx >= months.length - 1}
          onClick={() => goTo(currentIdx + 1)}
          aria-label="Previous month"
        >
          {'\u2039'}
        </button>

        <div class="month-picker-center">
          <select
            class="month-picker-select"
            value={currentIdx}
            onChange={e => goTo(Number(e.target.value))}
          >
            {months.map((m, i) => (
              <option key={m.month} value={i}>
                {monthLabel(m.month)}
              </option>
            ))}
          </select>
          <div class="month-picker-counts">
            {current.genCount > 0 && <span>{current.genCount} generation{current.genCount !== 1 ? 's' : ''}</span>}
            {current.genCount > 0 && current.postCount > 0 && <span class="stat-separator">{'\u00B7'}</span>}
            {current.postCount > 0 && <span>{current.postCount} post{current.postCount !== 1 ? 's' : ''}</span>}
          </div>
        </div>

        <button
          class="month-picker-arrow"
          disabled={currentIdx <= 0}
          onClick={() => goTo(currentIdx - 1)}
          aria-label="Next month"
        >
          {'\u203A'}
        </button>
      </div>

      {/* Grid for selected month */}
      {loadingItems ? (
        <div class="loading-bar"><div class="spinner" /></div>
      ) : (
        <div class="timeline-grid">
          {items.map(item => {
            const thumb = item.media?.[0];
            if (!thumb) return null;
            const isVideo = thumb.type === 'video';
            return (
              <div key={`${item._source}-${item.id}`} class="timeline-thumb" onClick={() => openItem(item)}>
                {isVideo
                  ? <video src={thumb.thumbnailPath} preload="metadata" muted playsInline />
                  : <img src={thumb.thumbnailPath} loading="lazy" alt="" />
                }
                {item._source === 'post' && <span class="timeline-badge post">P</span>}
              </div>
            );
          })}
        </div>
      )}

      {selected && selected._source === 'generation' && (
        <Lightbox
          item={selected}
          onClose={() => setSelected(null)}
          onPrev={selectedIdx > 0 ? navPrev : null}
          onNext={selectedIdx < items.length - 1 ? navNext : null}
        />
      )}
    </div>
  );
}
