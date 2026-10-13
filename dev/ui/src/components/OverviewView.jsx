import { useState, useEffect } from 'preact/hooks';
import { getOverview } from '../api.js';
import { formatDate, formatMediaCounts } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';
import { MediaThumb } from './MediaThumb.jsx';
import { openOriginNode } from '../lib/open-origin-node.js';
import { overviewMarkerHref, overviewMarkerLead } from '../lib/overview-href.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { formatUrl } from '../lib/url-state.js';

// Overview holds NO URL_SCHEMA — every interaction navigates away, so there
// is no Overview coalescer writer (the param-leak surface stays at zero).
// Links carry the destination. Plain left click stays in the SPA; modified
// clicks and the context menu follow href. No history bag: Overview is not
// an origin gallery.

function laneHref (view, params) {
  return formatUrl({ view, entityId: null, modelTrail: null, params: params || {} });
}

function onSpaLink (e) {
  const href = e.currentTarget && e.currentTarget.getAttribute('href');
  openOriginNode(e, { href });
}

function onSpaLinkMouseDown (e) {
  if (e.button === 1) onSpaLink(e);
}

function monthLabel (month) {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return month;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function UnknownNotice ({ unknownView }) {
  return (
    <p class="overview-unknown">
      Unknown page — {'"'}{unknownView || 'unknown'}{'"'}.
    </p>
  );
}

function MarkerThumb ({ thumb }) {
  if (!thumb) return <span class="overview-marker-empty" />;
  return (
    <MediaThumb
      type={thumb.type}
      thumbnailPath={thumb.thumbnailPath}
      coverPath={thumb.coverPath}
    />
  );
}

function Marker ({ marker }) {
  const statusClass = marker.kind === 'batch'
    ? 'overview-marker-batch'
    : `overview-marker-${marker.status || 'published'}`;
  const title = overviewMarkerLead({
    ...marker,
    dateLabel: formatDate(marker.titleAt)
  });
  const href = overviewMarkerHref(marker);
  const Tag = href ? 'a' : 'span';
  return (
    <Tag
      class={`overview-marker ${statusClass}`}
      title={title}
      href={href || undefined}
      onClick={href ? onSpaLink : undefined}
      onMouseDown={href ? onSpaLinkMouseDown : undefined}
    >
      <MarkerThumb thumb={marker.thumb} />
    </Tag>
  );
}

function Lane ({ title, counts, markers, more, headerHref, moreHref }) {
  const countLine = formatMediaCounts(counts);
  return (
    <div class="overview-lane">
      <a class="overview-lane-header" href={headerHref} onClick={onSpaLink} onMouseDown={onSpaLinkMouseDown}>
        <span class="overview-lane-title">{title}</span>
        {countLine && <span class="overview-lane-counts">{countLine}</span>}
      </a>
      {(markers.length > 0 || more > 0) && (
        <div class="overview-markers">
          {markers.map(m => (
            <Marker key={`${m.kind}-${m.id}`} marker={m} />
          ))}
          {more > 0 && (
            <a class="overview-more" href={moreHref} onClick={onSpaLink} onMouseDown={onSpaLinkMouseDown}>
              +{more} more
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function MonthBlock ({ bucket, createdTitle = 'Generations' }) {
  const monthRange = { dateFrom: bucket.dateFrom, dateTo: bucket.dateTo };
  const hasGenerations = bucket.created.batchesTotal > 0;
  const hasPosts = (bucket.published?.total || 0) > 0;
  const hasComics = (bucket.comics?.total || 0) > 0;

  return (
    <section class="overview-month">
      <h2 class="overview-month-title"><TimeText at={bucket.month}>{monthLabel(bucket.month)}</TimeText></h2>
      {hasGenerations && (
        <Lane
          title={createdTitle}
          counts={bucket.created.counts}
          markers={bucket.created.markers}
          more={bucket.created.more}
          headerHref={laneHref('generations', monthRange)}
          moreHref={laneHref('generations', monthRange)}
        />
      )}
      {hasPosts && (
        <Lane
          title="Posts"
          counts={bucket.published.counts}
          markers={bucket.published.markers}
          more={bucket.published.more}
          headerHref={laneHref('posts', monthRange)}
          moreHref={laneHref('posts', monthRange)}
        />
      )}
      {hasComics && (
        <Lane
          title="Comics"
          counts={bucket.comics.counts}
          markers={bucket.comics.markers}
          more={bucket.comics.more}
          headerHref={laneHref('comics', monthRange)}
          moreHref={laneHref('comics', monthRange)}
        />
      )}
    </section>
  );
}

export function OverviewView ({ viewWasUnknown, unknownView }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useDocumentTitle({ place: 'overview' });

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    getOverview()
      .then(d => { if (!cancelled) { setData(d); setStatus('ready'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') {
    return (
      <main class="main-content">
        <h1 class="visually-hidden">Overview</h1>
        <div class="loading-bar"><div class="spinner" /></div>
      </main>
    );
  }
  if (status === 'error' || !data) {
    return (
      <main class="main-content">
        <h1 class="visually-hidden">Overview</h1>
        {viewWasUnknown && <UnknownNotice unknownView={unknownView} />}
        <div class="empty-state"><h2>Overview unavailable</h2><p>Could not load activity.</p></div>
      </main>
    );
  }

  const { upcoming = [], months = [], undatedDrafts } = data;
  const undatedTotal = undatedDrafts?.total || 0;
  const isEmpty = !upcoming.length && !months.length && undatedTotal === 0;
  if (isEmpty) {
    return (
      <main class="main-content">
        <h1 class="visually-hidden">Overview</h1>
        {viewWasUnknown && <UnknownNotice unknownView={unknownView} />}
        <div class="empty-state">
          <h2>No activity yet</h2>
          <p>Download your generations and posts to see your activity.</p>
        </div>
      </main>
    );
  }

  return (
    <main class="main-content overview-view">
      {viewWasUnknown && <UnknownNotice unknownView={unknownView} />}
      <h1 class="overview-title">Overview</h1>
      {upcoming.length > 0 && (
        <section class="overview-upcoming">
          <h2 class="overview-section-title">Upcoming</h2>
          {upcoming.map(b => <MonthBlock key={b.month} bucket={b} />)}
        </section>
      )}
      {months.map(b => <MonthBlock key={b.month} bucket={b} />)}
      {undatedTotal > 0 && (
        <section class="overview-undated">
          <h2 class="overview-section-title">Dateless drafts</h2>
          <p class="overview-undated-sub">
            Drafts whose saved JSON predates the image-createdAt field.
            {' '}
            <a class="overview-undated-link" href={laneHref('posts', { publication: 'draft' })} onClick={onSpaLink} onMouseDown={onSpaLinkMouseDown}>
              View all
            </a>
          </p>
          <div class="overview-markers">
            {(undatedDrafts.markers || []).map(m => (
              <Marker key={`${m.kind}-${m.id}`} marker={m} />
            ))}
            {undatedDrafts.more > 0 && (
              <a class="overview-more" href={laneHref('posts', { publication: 'draft' })} onClick={onSpaLink} onMouseDown={onSpaLinkMouseDown}>
                +{undatedDrafts.more} more
              </a>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
