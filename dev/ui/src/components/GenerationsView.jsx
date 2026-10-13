import { useState, useEffect, useCallback, useRef, useMemo } from 'preact/hooks';
import { getGenerations, getMedia, getStats, setReactions } from '../api.js';
import { nextTagsForReaction, reactionMarks } from '../lib/format.js';
import { getRoute } from '../lib/router.js';
import { useStickyUrlState } from '../lib/sticky-ui.js';
import { useGalleryData } from '../hooks/useGalleryData.js';
import { useDebouncedUrlParam } from '../hooks/useDebouncedUrlParam.js';
import { StatsBar } from './StatsBar.jsx';
import { FacetBar } from './FacetBar.jsx';
import { Gallery } from './Gallery.jsx';
import {
  activateOriginTile,
  originNodeHref,
  shouldLoadFocusPrefix,
  readHistoryFocus
} from '../lib/open-origin-node.js';
import {
  publicationFacet,
  USED_AS_INPUT_FACET,
  effectivePublication,
  publicationFromInPost
} from '../lib/publication.js';
import { pruneGrainParams } from '../lib/grain.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { GranularityToggle } from './GranularityToggle.jsx';

// Module-scope schema so useUrlState's memo key stays stable, and so the
// Exports feature can reuse it (it stores a subset as a saved query). `sort`
// is now the protocol's `<field>:<direction>` form (the _v=1→2 migration
// rewrites legacy newest/oldest bookmarks). `granularity` is now live (Phase 4
// E4): `media` serves the flat media-item projection via /api/media, `batch`
// keeps today's /api/generations. The default is `media` (roadmap § Decisions
// item 4 — GenerationsView switches to media-item once Phase 4 ships).
// `granularity` is session-only for exports; sticky for the install.
export const URL_SCHEMA = {
  sort: { type: 'string', default: 'date:desc' },
  tag: { type: 'csv', default: [] },
  q: { type: 'string', default: '' },
  type: { type: 'csv', default: [] },
  ecosystem: { type: 'csv', default: [] },
  model: { type: 'csv', default: [] },
  version: { type: 'csv', default: [] },
  resourceType: { type: 'csv', default: [] },
  resource: { type: 'csv', default: [] },
  versionId: { type: 'csv', default: [] },
  scope: { type: 'string', default: '' },
  mine: { type: 'boolean', default: null },
  aspect: { type: 'csv', default: [] },
  dateFrom: { type: 'string', default: '' },
  dateTo: { type: 'string', default: '' },
  cfgMin: { type: 'number', default: null },
  cfgMax: { type: 'number', default: null },
  stepsMin: { type: 'integer', default: null },
  stepsMax: { type: 'integer', default: null },
  inPost: { type: 'boolean', default: null },
  publication: { type: 'csv', default: [] },
  usedAsInput: { type: 'boolean', default: null },
  workflow: { type: 'csv', default: [] },
  workflowMode: { type: 'csv', default: [] },
  reaction: { type: 'csv', default: [] },
  groupBy: { type: 'string', default: 'none' },
  groupSort: { type: 'string', default: 'count:desc' },
  granularity: { type: 'string', default: 'media', sticky: true }
};

const FACETS = [
  { key: 'reaction', kind: 'chips', source: 'reaction', valuesSource: 'reactionTags', options: ['favorite', 'feedback:liked', 'feedback:disliked'], label: 'Reactions' },
  { key: 'type', kind: 'nested-tree', tree: 'type-workflow', label: 'Media Type' },
  { key: 'aspect', kind: 'nested-tree', tree: 'aspect', label: 'Aspect Ratio', alwaysShowRoots: true },
  { key: 'scope', kind: 'tree', label: 'Models' },
  { key: 'dateFrom', key2: 'dateTo', kind: 'date-range', label: 'When' },
  { key: 'cfgMin', key2: 'cfgMax', kind: 'number-range', label: 'CFG' },
  { key: 'stepsMin', key2: 'stepsMax', kind: 'number-range', label: 'Steps' },
  publicationFacet(),
  USED_AS_INPUT_FACET
];

const GRAIN_OPTIONS = [
  { value: 'media', label: 'Media' },
  { value: 'batch', label: 'Batches' }
];

const SORT_FIELDS = [{ value: 'date', label: 'Date' }];
const GROUP_AXES = [
  { value: 'resourceType', label: 'Model type' },
  { value: 'ecosystem', label: 'Ecosystem' },
  { value: 'model', label: 'Model' },
  { value: 'version', label: 'Version' },
  { value: 'resource', label: 'Additional resource' },
  { value: 'aspect', label: 'Aspect' },
  { value: 'sampler', label: 'Sampler' },
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' }
];

// The roll-up tag set of a generation entry is the union of its media items'
// tags — the same recompute the index performs, so gallery badges and the
// tag-chip filter stay in sync without a refetch.
function rollUpTags (media) {
  return [...new Set(media.flatMap(m => m.tags || []))].sort();
}

// Match a batch-response item (keyed by the NORMALIZED media-item id) back to
// a client media item (keyed by its RAW mediaId).
function findMediaTagsFromResponse (rawMediaId, responseItems) {
  const hit = responseItems.find(r =>
    rawMediaId === r.mediaItemId || rawMediaId.startsWith(`${r.mediaItemId}.`)
  );
  return hit && Array.isArray(hit.tags) ? hit.tags : null;
}

export function GenerationsView () {
  const [urlState, updateUrl] = useStickyUrlState(URL_SCHEMA);
  const grain = urlState.granularity === 'batch' ? 'batch' : 'media';
  useDocumentTitle({ place: 'generations', grain });

  const [stats, setStats] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const searchRef = useRef(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  // Search input ↔ URL bridge (debounced, replaceState).
  const [searchInput, setSearchInput] = useDebouncedUrlParam(urlState.q, updateUrl, 'q');

  // Rewrite legacy inPost bookmarks onto publication= so the picker lights
  // up and the URL canonicalizes. The query memo below also derives
  // publication from inPost so the first fetch is correct before this runs.
  useEffect(() => {
    if ((urlState.publication || []).length) {
      if (urlState.inPost != null) updateUrl({ inPost: null });
      return;
    }
    if (urlState.inPost == null) return;
    updateUrl({ publication: publicationFromInPost(urlState.inPost), inPost: null });
  }, [urlState.publication, urlState.inPost, updateUrl]);

  // The wire query — facet/sort/group keys. `granularity` IS keyed
  // here so toggling batch↔media resets paging and refetches the other source;
  // the fetcher strips it before it reaches the server (it is not a facet).
  const query = useMemo(() => ({
    tag: urlState.tag, reaction: urlState.reaction, q: urlState.q, sort: urlState.sort,
    type: urlState.type, ecosystem: urlState.ecosystem, model: urlState.model,
    version: urlState.version, resourceType: urlState.resourceType, resource: urlState.resource,
    versionId: urlState.versionId, scope: urlState.scope,
    aspect: urlState.aspect, dateFrom: urlState.dateFrom, dateTo: urlState.dateTo,
    cfgMin: urlState.cfgMin, cfgMax: urlState.cfgMax, stepsMin: urlState.stepsMin, stepsMax: urlState.stepsMax,
    publication: effectivePublication(urlState.publication, urlState.inPost),
    usedAsInput: urlState.usedAsInput === true ? true : null,
    workflow: urlState.workflow,
    workflowMode: urlState.workflowMode,
    groupBy: urlState.groupBy, groupSort: urlState.groupSort,
    granularity: urlState.granularity
  }), [urlState]);

  // One fetcher, routed by granularity: `media` serves the flat projection
  // (/api/media, adapted into tiles); `batch` keeps /api/generations.
  // `granularity` is stripped before the request — it keys the refetch but
  // is never a server facet. Sticky for the install; session-only for exports.
  const galleryFetcher = useCallback((params) => {
    const { granularity: g, ...rest } = params;
    return g === 'media'
      ? getMedia({ ...rest, hasGeneration: true })
      : getGenerations(rest);
  }, []);

  const { items, groupsMeta, loading, sentinelRef, setItems, hasMore, loadMore, pending } = useGalleryData({ fetcher: galleryFetcher, query });

  const facetParams = useMemo(() => (
    grain === 'media'
      ? { hasGeneration: true }
      : { hasGeneration: true, dateSource: 'container' }
  ), [grain]);

  useEffect(() => {
    if (shouldLoadFocusPrefix(readHistoryFocus(), { loading, itemCount: items.length, hasMore })) {
      loadMore();
    }
  }, [loading, items.length, hasMore, loadMore]);

  // Clear the multi-select set when the result set changes (it is per
  // result-set). Reaction / selection state is view-local, never URL state.
  const queryKey = JSON.stringify(query);
  useEffect(() => { setSelectedIds(new Set()); }, [queryKey]);

  // Apply a map of mediaId → tags across the loaded items, re-rolling each
  // touched entry's tags (optimistic update / settle / revert). Groups are
  // metadata-only and are not patched.
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

  const toggleReaction = useCallback((token) => {
    const next = urlState.reaction.includes(token)
      ? urlState.reaction.filter(t => t !== token)
      : [...urlState.reaction, token];
    updateUrl({ reaction: next });
  }, [urlState.reaction, updateUrl]);

  const hrefFor = useCallback((item, index) => originNodeHref(item, {
    grain,
    originView: 'generations',
    params: getRoute().params,
    index,
    groupsMeta
  }), [grain, urlState, groupsMeta]);

  const onItemActivate = useCallback((e, item, index, landmarks) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
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
      originView: 'generations',
      params: getRoute().params,
      groupsMeta
    });
  }, [grain, groupsMeta]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Set-dominant batch toggle over the selection (steward ruling): set unless
  // every selected tile already has it, then clear; same value for every
  // selected media-item. Optimistic, settle from response, revert on error.
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
      else if (e.key === 'Escape') { if (selectedIds.size) clearSelection(); }
      // With a selection active, f / l / d act on the selection; with none,
      // 'f' toggles the Reactions Favorite chip.
      else if (e.key === 'f') { if (selectedIds.size) { e.preventDefault(); applyBatchReaction('favorite'); } else toggleReaction('favorite'); }
      else if (e.key === 'l') { if (selectedIds.size) { e.preventDefault(); applyBatchReaction('liked'); } }
      else if (e.key === 'd') { if (selectedIds.size) { e.preventDefault(); applyBatchReaction('disliked'); } }
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleReaction, selectedIds, applyBatchReaction, clearSelection]);

  return (
    <main class="main-content">
      <h1 class="visually-hidden">Generations</h1>
      <StatsBar stats={stats} />
      <GranularityToggle
        value={urlState.granularity}
        options={GRAIN_OPTIONS}
        onChange={(next) => updateUrl({ granularity: next, ...pruneGrainParams(next, urlState) })}
      />
      <FacetBar
        facets={FACETS}
        state={urlState}
        update={updateUrl}
        sortFields={SORT_FIELDS}
        groupAxes={GROUP_AXES}
        search={searchInput}
        onSearchInput={setSearchInput}
        searchRef={searchRef}
        facetParams={facetParams}
      />
      {selectedIds.size > 0 && (
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
      {(items.length > 0 || !loading) && (
        <Gallery
          items={items}
          grain={grain}
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
    </main>
  );
}
