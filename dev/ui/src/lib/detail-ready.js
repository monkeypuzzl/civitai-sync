// A neighbour hop keeps the complete page until the next complete record
// exists, then swaps. The cache is that record, keyed the way the
// destination view will ask for it.

import { useEffect, useRef, useState } from 'preact/hooks';
import { getComic, getGeneration, getMediaDetail, getPost } from '../api.js';
import { originFetchQuery } from './media-href.js';
import { originNeighbourParams, originNeighbourPath } from './origin-page.js';
import { parseUrl } from './url-state.js';

const IMAGE_WARM_CAP = 24;
const cache = new Map();
const inflight = new Map();

export function fileOriginFrom (params) {
  const from = params && params.from;
  if (from === 'posts') return 'post';
  if (from === 'comics') return 'comic';
  return '';
}

// The arrow click merges the neighbour query onto the current route
// (`replaceState` keeps keys the neighbour object omitted). The cache key
// has to be that merged route, or the click misses and fetches again.
export function routeParamsAfterHop (currentParams, neighbourParams) {
  const merged = { ...(currentParams || {}), ...(neighbourParams || {}) };
  for (const key of Object.keys(merged)) {
    const val = merged[key];
    if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
      delete merged[key];
    }
  }
  return merged;
}

export function detailCacheKey ({ view, id, params, anchor } = {}) {
  return JSON.stringify({
    view: view || '',
    id: id == null ? '' : String(id),
    q: originFetchQuery(params || {}),
    origin: fileOriginFrom(params),
    anchor: view === 'media' ? (anchor || '') : ''
  });
}

export function readDetailCache (key) {
  return cache.has(key) ? cache.get(key) : null;
}

export function writeDetailCache (key, data) {
  if (!key || data == null) return;
  cache.set(key, data);
}

function sameHeld (a, b) {
  return a.displayed === b.displayed
    && a.shownKey === b.shownKey
    && a.pendingKey === b.pendingKey
    && a.failed === b.failed;
}

export function reduceHeldDetail (state, action) {
  const base = state || { displayed: null, shownKey: null, pendingKey: null, failed: false };
  let next = base;

  if (action.type === 'navigate') {
    if (action.cached) {
      next = {
        displayed: action.cached,
        shownKey: action.key,
        pendingKey: null,
        failed: false
      };
    } else if (base.displayed) {
      next = {
        displayed: base.displayed,
        shownKey: base.shownKey,
        pendingKey: action.key,
        failed: false
      };
    } else {
      next = {
        displayed: null,
        shownKey: null,
        pendingKey: action.key,
        failed: false
      };
    }
  } else if (action.type === 'arrived') {
    if (base.pendingKey !== action.key) return base;
    next = {
      displayed: action.data,
      shownKey: action.key,
      pendingKey: null,
      failed: false
    };
  } else if (action.type === 'failed') {
    if (base.pendingKey !== action.key) return base;
    next = {
      displayed: null,
      shownKey: null,
      pendingKey: null,
      failed: true
    };
  }

  return sameHeld(base, next) ? base : next;
}

function warmImages (data) {
  if (typeof Image === 'undefined' || !data || !data.index) return;
  const urls = [];
  const push = (type, path) => {
    if (urls.length >= IMAGE_WARM_CAP) return;
    if (type === 'video') return;
    if (type && type !== 'image') return;
    if (!path || urls.includes(path)) return;
    urls.push(path);
  };
  const index = data.index;
  push(index.type, index.thumbnailPath);
  const media = Array.isArray(index.media) ? index.media : [];
  for (const member of media) {
    if (!member) continue;
    push(member.type, member.thumbnailPath);
  }
  for (const src of urls) {
    const img = new Image();
    img.src = src;
  }
}

function prefetchChunk (view) {
  if (view === 'media') return import('../components/MediaDetail.jsx');
  if (view === 'generations') return import('../components/BatchDetailView.jsx');
  if (view === 'posts') return import('../components/PostDetailView.jsx');
  if (view === 'comics') return import('../components/ComicDetailView.jsx');
  return Promise.resolve();
}

export function loadMediaDetail (id, params, anchor) {
  return getMediaDetail(id, {
    origin: fileOriginFrom(params) || undefined,
    ...originFetchQuery(params),
    ...(anchor ? { anchor } : {})
  });
}

export function loadContainerDetail (view, id, params) {
  const q = originFetchQuery(params);
  if (view === 'generations') return getGeneration(id, q);
  if (view === 'posts') return getPost(id, q);
  if (view === 'comics') return getComic(id, q);
  return Promise.resolve(null);
}

export function prefetchDetail (key, loader) {
  if (!key) return Promise.resolve(null);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = Promise.resolve()
    .then(loader)
    .then(data => {
      if (data != null) {
        cache.set(key, data);
        warmImages(data);
      }
      return data;
    })
    .finally(() => { inflight.delete(key); });
  inflight.set(key, job);
  return job;
}

function prefetchOne ({ view, id, params, anchor }) {
  if (id == null || id === '') return;
  prefetchChunk(view);
  const key = detailCacheKey({ view, id, params, anchor });
  const loader = () => (
    view === 'media'
      ? loadMediaDetail(id, params, anchor)
      : loadContainerDetail(view, id, params)
  );
  prefetchDetail(key, loader);
}

export function prefetchOriginNeighbours ({ view, routeParams, origin, anchor } = {}) {
  if (!origin || typeof origin !== 'object') return;
  const hops = [
    ['prevId', 'prevSlot', 'prevSlotInUrl'],
    ['nextId', 'nextSlot', 'nextSlotInUrl']
  ];
  for (const [idKey, slotKey, urlKey] of hops) {
    const id = origin[idKey];
    if (id == null || id === '') continue;
    const path = originNeighbourPath(id, view);
    const parsed = parseUrl(path);
    const cleaned = originNeighbourParams(routeParams, origin, {
      slot: origin[slotKey],
      slotInUrl: origin[urlKey],
      path
    });
    const params = routeParamsAfterHop(routeParams, cleaned);
    const neighbourAnchor = origin.placement === 'fallback' ? '' : (anchor || '');
    prefetchOne({
      view: parsed.view,
      id: parsed.entityId,
      params,
      anchor: neighbourAnchor
    });
  }
}

export function useHeldDetail (cacheKey, fetcher) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [state, setState] = useState(() => reduceHeldDetail(
    { displayed: null, shownKey: null, pendingKey: null, failed: false },
    { type: 'navigate', key: cacheKey, cached: readDetailCache(cacheKey) }
  ));

  useEffect(() => {
    const cached = readDetailCache(cacheKey);
    setState(prev => reduceHeldDetail(prev, { type: 'navigate', key: cacheKey, cached }));
    if (cached) return undefined;
    let cancelled = false;
    prefetchDetail(cacheKey, () => fetcherRef.current())
      .then(data => {
        if (cancelled) return;
        if (data == null) {
          setState(prev => reduceHeldDetail(prev, { type: 'failed', key: cacheKey }));
          return;
        }
        setState(prev => reduceHeldDetail(prev, { type: 'arrived', key: cacheKey, data }));
      })
      .catch(() => {
        if (!cancelled) setState(prev => reduceHeldDetail(prev, { type: 'failed', key: cacheKey }));
      });
    return () => { cancelled = true; };
  }, [cacheKey]);

  return state;
}
