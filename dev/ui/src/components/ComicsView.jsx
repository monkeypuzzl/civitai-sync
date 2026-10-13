import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import { getComics, getMedia, getStats, setReactions } from '../api.js';
import { nextTagsForReaction, reactionMarks } from '../lib/format.js';
import { getRoute, replaceState } from '../lib/router.js';
import { useStickyUrlState } from '../lib/sticky-ui.js';
import { useGalleryData } from '../hooks/useGalleryData.js';
import { useDebouncedUrlParam } from '../hooks/useDebouncedUrlParam.js';
import { publicationFacet, publicationFromStatus, USED_AS_INPUT_FACET } from '../lib/publication.js';
import { pruneGrainParams } from '../lib/grain.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { ComicStatsBar } from './ComicStatsBar.jsx';
import { FacetBar } from './FacetBar.jsx';
import { ComicGallery } from './ComicGallery.jsx';
import { Gallery } from './Gallery.jsx';
import { GranularityToggle } from './GranularityToggle.jsx';
import {
  activateOriginTile,
  originNodeHref,
  shouldLoadFocusPrefix,
  readHistoryFocus
} from '../lib/open-origin-node.js';

// Module-scope schema (stable memo key; reusable as a saved export query).
// Comics share Generations membership filters plus content tags, aspect,
// and publication. Sort is date/published only (no hearts vocabulary).
// `granularity` is live: `comic` (default, sticky) serves /api/comics;
// `media` serves GET /api/media?hasComic=1. A typed `engagement=` is prune-only on
// VIEW_PARAM_KEYS, not in this schema. Leftover `status=` is rewritten
// onto `publication`. No `inPost`.
export const URL_SCHEMA = {
  sort: { type: 'string', default: 'date:desc' },
  tag: { type: 'csv', default: [] },
  q: { type: 'string', default: '' },
  title: { type: 'string', default: '' },
  type: { type: 'csv', default: [] },
  ecosystem: { type: 'csv', default: [] },
  model: { type: 'csv', default: [] },
  version: { type: 'csv', default: [] },
  resourceType: { type: 'csv', default: [] },
  resource: { type: 'csv', default: [] },
  versionId: { type: 'csv', default: [] },
  scope: { type: 'string', default: '' },
  mine: { type: 'boolean', default: null },
  publication: { type: 'csv', default: [] },
  aspect: { type: 'csv', default: [] },
  dateFrom: { type: 'string', default: '' },
  dateTo: { type: 'string', default: '' },
  cfgMin: { type: 'number', default: null },
  cfgMax: { type: 'number', default: null },
  stepsMin: { type: 'integer', default: null },
  stepsMax: { type: 'integer', default: null },
  usedAsInput: { type: 'boolean', default: null },
  workflow: { type: 'csv', default: [] },
  workflowMode: { type: 'csv', default: [] },
  reaction: { type: 'csv', default: [] },
  groupBy: { type: 'string', default: 'none' },
  groupSort: { type: 'string', default: 'count:desc' },
  granularity: { type: 'string', default: 'comic', sticky: true }
};

const GRAIN_OPTIONS = [
  { value: 'media', label: 'Media' },
  { value: 'comic', label: 'Comics' }
];

const FACETS = [
  { key: 'reaction', kind: 'chips', source: 'reaction', valuesSource: 'reactionTags', options: ['favorite', 'feedback:liked', 'feedback:disliked'], label: 'Reactions' },
  { key: 'tag', kind: 'multi', source: 'tags', label: 'Tags' },
  { key: 'type', kind: 'nested-tree', tree: 'type-workflow', label: 'Media Type' },
  { key: 'aspect', kind: 'nested-tree', tree: 'aspect', label: 'Aspect Ratio', alwaysShowRoots: true },
  { key: 'scope', kind: 'tree', label: 'Models' },
  { key: 'dateFrom', key2: 'dateTo', kind: 'date-range', label: 'When' },
  { key: 'cfgMin', key2: 'cfgMax', kind: 'number-range', label: 'CFG' },
  { key: 'stepsMin', key2: 'stepsMax', kind: 'number-range', label: 'Steps' },
  publicationFacet({ unposted: false }),
  USED_AS_INPUT_FACET
];

const MEDIA_SORT_FIELDS = [{ value: 'date', label: 'Date' }];
const CONTAINER_SORT_FIELDS = [
  { value: 'date', label: 'Date' },
  { value: 'published', label: 'Published' }
];

const MEDIA_GROUP_AXES = [
  { value: 'resourceType', label: 'Model type' },
  { value: 'ecosystem', label: 'Ecosystem' },
  { value: 'model', label: 'Model' },
  { value: 'version', label: 'Version' },
  { value: 'resource', label: 'Additional resource' },
  { value: 'aspect', label: 'Aspect' },
  { value: 'sampler', label: 'Sampler' },
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' },
  { value: 'publication', label: 'Publication' }
];
const CONTAINER_GROUP_AXES = [
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' },
  { value: 'publication', label: 'Publication' }
];

function rollUpTags (media) {
  return [...new Set(media.flatMap(m => m.tags || []))].sort();
}

function findMediaTagsFromResponse (rawMediaId, responseItems) {
  const hit = responseItems.find(r =>
    rawMediaId === r.mediaItemId || rawMediaId.startsWith(`${r.mediaItemId}.`)
  );
  return hit && Array.isArray(hit.tags) ? hit.tags : null;
}

export function ComicsView () {
  const [urlState, updateUrl] = useStickyUrlState(URL_SCHEMA);
  const isMediaGrain = urlState.granularity === 'media';
  useDocumentTitle({ place: 'comics', grain: isMediaGrain ? 'media' : 'comic' });

  const [stats, setStats] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const searchRef = useRef(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  const [searchInput, setSearchInput] = useDebouncedUrlParam(urlState.q, updateUrl, 'q');
  const [titleInput, setTitleInput] = useDebouncedUrlParam(urlState.title, updateUrl, 'title');

  const facetParams = useMemo(() => (
    isMediaGrain
      ? { hasComic: true }
      : { hasComic: true, dateSource: 'container' }
  ), [isMediaGrain]);

  const toggleReaction = useCallback((token) => {
    const next = (urlState.reaction || []).includes(token)
      ? urlState.reaction.filter(t => t !== token)
      : [...(urlState.reaction || []), token];
    updateUrl({ reaction: next });
  }, [urlState.reaction, updateUrl]);

  // _v=4 copies status= → publication= in getRoute(); that does not write
  // history. If the address still carries the retired key, format the
  // migrated route so the bar matches the chips.
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.has('status') || sp.get('groupBy') === 'status') replaceState({});
  }, []);

  const query = useMemo(() => ({
    tag: urlState.tag, reaction: urlState.reaction, q: urlState.q, title: urlState.title, sort: urlState.sort,
    type: urlState.type, ecosystem: urlState.ecosystem, model: urlState.model,
    version: urlState.version, resourceType: urlState.resourceType, resource: urlState.resource,
    versionId: urlState.versionId, scope: urlState.scope,
    publication: urlState.publication.length
      ? urlState.publication
      : publicationFromStatus(getRoute()?.params?.status),
    aspect: urlState.aspect,
    dateFrom: urlState.dateFrom, dateTo: urlState.dateTo,
    cfgMin: urlState.cfgMin, cfgMax: urlState.cfgMax, stepsMin: urlState.stepsMin, stepsMax: urlState.stepsMax,
    usedAsInput: urlState.usedAsInput === true ? true : null,
    workflow: urlState.workflow,
    workflowMode: urlState.workflowMode,
    groupBy: urlState.groupBy, groupSort: urlState.groupSort,
    granularity: urlState.granularity
  }), [urlState]);

  const galleryFetcher = useCallback((params) => {
    const { granularity: g, ...rest } = params;
    return g === 'media'
      ? getMedia({ ...rest, hasComic: true })
      : getComics(rest);
  }, []);

  const {
    items, groupsMeta, total, loading, sentinelRef, setItems, hasMore, loadMore, pending
  } = useGalleryData({ fetcher: galleryFetcher, query });

  const grain = isMediaGrain ? 'media' : 'comic';

  useEffect(() => {
    if (shouldLoadFocusPrefix(readHistoryFocus(), { loading, itemCount: items.length, hasMore })) {
      loadMore();
    }
  }, [loading, items.length, hasMore, loadMore]);

  const queryKey = JSON.stringify(query);
  useEffect(() => { setSelectedIds(new Set()); }, [queryKey]);

  const applyMediaTagUpdates = useCallback((updates) => {
    const patch = (arr) => arr.map(it => {
      if (!Array.isArray(it.media)) return it;
      let changed = false;
      const media = it.media.map(m => {
        if (updates.has(m.mediaId)) {
          changed = true;
          const marks = updates.get(m.mediaId);
          return { ...m, tags: marks, reactions: marks };
        }
        return m;
      });
      if (!changed) return it;
      const rolled = rollUpTags(media);
      return { ...it, media, tags: rolled, reactions: rolled };
    });
    setItems(prev => patch(prev));
  }, [setItems]);

  const hrefFor = useCallback((item, index) => originNodeHref(item, {
    grain,
    originView: 'comics',
    params: getRoute().params,
    index,
    groupsMeta
  }), [grain, urlState, groupsMeta]);

  const onItemActivate = useCallback((e, item, index, landmarks) => {
    if (isMediaGrain && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
        return next;
      });
      return;
    }
    activateOriginTile(e, item, index, landmarks, {
      grain,
      originView: 'comics',
      params: getRoute().params,
      groupsMeta
    });
  }, [grain, isMediaGrain, groupsMeta]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const applyBatchReaction = useCallback((kind) => {
    const targets = items.filter(it => selectedIds.has(it.id));
    if (!targets.length) return;

    let edit;
    if (kind === 'favorite') edit = { favorite: !targets.every(it => reactionMarks(it).includes('favorite')) };
    else if (kind === 'liked') edit = { feedback: targets.every(it => reactionMarks(it).includes('feedback:liked')) ? null : 'liked' };
    else if (kind === 'disliked') edit = { feedback: targets.every(it => reactionMarks(it).includes('feedback:disliked')) ? null : 'disliked' };
    else return;

    const original = new Map();
    const optimistic = new Map();
    const batchItems = [];
    for (const it of targets) {
      for (const m of (it.media || [])) {
        const marks = reactionMarks(m);
        original.set(m.mediaId, marks);
        optimistic.set(m.mediaId, nextTagsForReaction(marks, edit));
        batchItems.push({ mediaItemId: m.mediaId, ...edit });
      }
    }
    if (!batchItems.length) return;

    applyMediaTagUpdates(optimistic);

    setReactions(batchItems)
      .then(res => {
        if (!res || res.ok === false || !Array.isArray(res.items)) { applyMediaTagUpdates(original); return; }
        const settle = new Map();
        for (const mediaId of original.keys()) {
          const tags = findMediaTagsFromResponse(mediaId, res.items);
          settle.set(mediaId, tags != null ? tags : optimistic.get(mediaId));
        }
        applyMediaTagUpdates(settle);
      })
      .catch(() => applyMediaTagUpdates(original));
  }, [items, selectedIds, applyMediaTagUpdates]);

  useEffect(() => {
    function onKey (e) {
      const t = e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      if (e.key === 'j') window.scrollBy({ top: 300, behavior: 'smooth' });
      else if (e.key === 'k') window.scrollBy({ top: -300, behavior: 'smooth' });
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'f') {
        if (isMediaGrain && selectedIds.size) { e.preventDefault(); applyBatchReaction('favorite'); }
        else toggleReaction('favorite');
      }
      else if (isMediaGrain) {
        if (e.key === 'Escape') { if (selectedIds.size) clearSelection(); }
        else if (e.key === 'l') { if (selectedIds.size) { e.preventDefault(); applyBatchReaction('liked'); } }
        else if (e.key === 'd') { if (selectedIds.size) { e.preventDefault(); applyBatchReaction('disliked'); } }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedIds, applyBatchReaction, clearSelection, isMediaGrain, toggleReaction]);

  return (
    <main class="main-content">
      <h1 class="visually-hidden">Comics</h1>
      <ComicStatsBar
        stats={stats}
        comicTotal={total}
        totalLabel={isMediaGrain ? 'items' : 'comics'}
      />
      <GranularityToggle
        value={urlState.granularity}
        options={GRAIN_OPTIONS}
        onChange={(next) => updateUrl({ granularity: next, ...pruneGrainParams(next, urlState) })}
      />
      <FacetBar
        facets={FACETS}
        state={urlState}
        update={updateUrl}
        sortFields={isMediaGrain ? MEDIA_SORT_FIELDS : CONTAINER_SORT_FIELDS}
        groupAxes={isMediaGrain ? MEDIA_GROUP_AXES : CONTAINER_GROUP_AXES}
        search={searchInput}
        onSearchInput={setSearchInput}
        searchRef={searchRef}
        titleSearch={titleInput}
        onTitleSearchInput={setTitleInput}
        facetParams={facetParams}
      />
      {isMediaGrain && selectedIds.size > 0 && (
        <div class="selection-toolbar">
          <span class="selection-count">{selectedIds.size} selected</span>
          <div class="selection-actions">
            <button type="button" class="reaction-btn favorite" onClick={() => applyBatchReaction('favorite')} title="Favorite (f)">{'\u2764\uFE0F'}</button>
            <button type="button" class="reaction-btn liked" onClick={() => applyBatchReaction('liked')} title="Like (l)">{'\uD83D\uDC4D'}</button>
            <button type="button" class="reaction-btn disliked" onClick={() => applyBatchReaction('disliked')} title="Dislike (d)">{'\uD83D\uDC4E'}</button>
          </div>
          <button type="button" class="quiet-btn" onClick={clearSelection}>Clear</button>
        </div>
      )}
      {isMediaGrain ? (
        <>
          {(items.length > 0 || !loading) && (
            <Gallery
              items={items}
              grain="media"
              groupsMeta={groupsMeta}
              onItemActivate={onItemActivate}
              hrefFor={hrefFor}
              selectedIds={selectedIds}
              sentinelRef={sentinelRef}
              search={urlState.q}
              loading={loading}
              hasMore={hasMore}
              pending={pending}
            />
          )}
          {loading && (
            <div class="loading-bar"><div class="spinner" /></div>
          )}
        </>
      ) : (
        <ComicGallery
          items={items}
          groupsMeta={groupsMeta}
          onItemActivate={onItemActivate}
          hrefFor={hrefFor}
          sentinelRef={sentinelRef}
          loading={loading}
          search={urlState.q}
          hasMore={hasMore}
          pending={pending}
        />
      )}
    </main>
  );
}
