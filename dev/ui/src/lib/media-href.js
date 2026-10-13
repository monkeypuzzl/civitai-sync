// Tile click destinations vs grain-remapped ‹ › hrefs. Callers add origin
// query (`originQuery`) on hops from an origin gallery. Graph edges stay bare.

import { normalizeMediaId } from './format.js';

function mediaHref (id) {
  return `/media/${normalizeMediaId(id)}`;
}

/**
 * Id to write into the address bar for a media page. Null when the raw
 * path segment is already the canonical id. A bookmark that still carries
 * a container suffix (`.glb`, `.jpeg`) rewrites; `parseUrl` keeps that
 * raw segment so this comparison can see it.
 */
export function canonicalMediaRouteId (routeSegment, indexId) {
  const source = indexId != null && indexId !== '' ? indexId : routeSegment;
  const canonical = normalizeMediaId(source);
  if (!canonical) return null;
  if (String(routeSegment ?? '') === canonical) return null;
  return canonical;
}

function onlyMediaId (item) {
  const media = item && Array.isArray(item.media) ? item.media : [];
  if (media.length !== 1) return null;
  const first = media[0];
  return first && first.mediaId != null ? first.mediaId : null;
}

function isEmptyParam (v) {
  if (v == null) return true;
  if (v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/**
 * Click destination. Callers append origin query; this helper does not.
 * Grain chooses the page; overlay fields on the tile are not a destination.
 */
export function tileHref (item, { grain } = {}) {
  const g = grain || 'media';
  if (g === 'post') return `/posts/${item.id}`;
  if (g === 'comic') return `/comics/${item.id}`;
  if (g === 'batch') {
    const media = item && Array.isArray(item.media) ? item.media : [];
    if (media.length > 1) return `/generations/${item.id}`;
    const only = onlyMediaId(item);
    return mediaHref(only);
  }
  const id = item && item.id != null && item.id !== ''
    ? item.id
    : onlyMediaId(item);
  return mediaHref(id);
}

/**
 * Container-walk ‹ › destination (not the click table). Batch grain always
 * `/generations/<id>` including singletons (Next from C is D's batch page).
 */
export function listHref (item, { grain } = {}) {
  const g = grain || 'media';
  if (g === 'batch') return `/generations/${item.id}`;
  if (g === 'post') return `/posts/${item.id}`;
  if (g === 'comic') return `/comics/${item.id}`;
  return tileHref(item, { grain: g });
}

/**
 * Flattened `/media/<id>` in gallery order from each tile's `media[].mediaId`
 * (canonical media-item id; post/comic tiles resolve Image ids in `toTile`).
 * Media-page ‹ › neighbour of `b1` among A,B,C is `/media/c1`, never a batch URL.
 */
export function flattenMediaList (items) {
  const out = [];
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    const media = item && item.media;
    if (!Array.isArray(media)) continue;
    for (const m of media) {
      if (!m || m.mediaId == null || m.mediaId === '') continue;
      out.push(mediaHref(m.mediaId));
    }
  }
  return out;
}

/**
 * Slot token for a gallery tile hop onto a media page. Omitted when the
 * walk cannot repeat an id (media grain, no groupBy) or when the hop opens
 * a container page. Container-grain singleton → `c:<containerId>:0`.
 * Grouped media-grain → `g:<groupKey>:<ordinal>` from the flat index.
 */
export function galleryClickSlot (item, path, { grain, index, groupsMeta, groupBy } = {}) {
  if (!path || !String(path).startsWith('/media/')) return null;
  const g = grain || 'media';
  if (g === 'batch' || g === 'post' || g === 'comic') {
    if (item && item.id != null && item.id !== '') return `c:${item.id}:0`;
    return null;
  }
  if (!groupBy || !Array.isArray(groupsMeta) || index == null) return null;
  const i = Number(index);
  if (!Number.isFinite(i)) return null;
  const group = groupsMeta.find(gr => i >= gr.offset && i < gr.offset + gr.count);
  if (!group) return null;
  return `g:${group.key}:${i - group.offset}`;
}

/** True for `/posts/<id>`, `/generations/<id>`, `/comics/<id>`. */
export function isContainerNodePath (path) {
  return typeof path === 'string' && /^\/(posts|generations|comics)\//.test(path);
}

/**
 * Params for a node URL opened from an origin gallery.
 * Copies present keys except `select` / `generation` / fetch-only `origin` / `usedIn`;
 * sets `from`; writes resolved `granularity` when provided (even when the
 * gallery URL omitted it because sticky filled it); optional `slot`.
 * Then drops absent-key defaults. Container destinations never carry `from`
 * or `granularity`. Fetch-only API `origin=` is not a view param.
 */
export function originQuery (galleryParams, originView, { granularity, slot, path } = {}) {
  const src = galleryParams || {};
  const out = {};
  for (const key of Object.keys(src)) {
    if (key === 'select' || key === 'generation' || key === 'origin' || key === 'usedIn') continue;
    const v = src[key];
    if (isEmptyParam(v)) continue;
    out[key] = v;
  }
  if (originView) out.from = originView;
  if (granularity != null && granularity !== '' && granularity !== 'models') {
    out.granularity = granularity;
  }
  if (slot != null && slot !== '') out.slot = slot;
  else delete out.slot;

  if (out.sort === 'date:desc') delete out.sort;
  if (out.groupBy == null || out.groupBy === '' || out.groupBy === 'none') {
    delete out.groupBy;
    delete out.groupSort;
  } else if (out.groupSort === 'count:desc') {
    delete out.groupSort;
  }
  if (out.granularity == null || out.granularity === '' || out.granularity === 'media') {
    delete out.granularity;
  }

  if (isContainerNodePath(path)) {
    delete out.from;
    delete out.granularity;
  }
  return out;
}

/**
 * Origin-list query for a detail GET. Same keys as a tile hop; never the
 * fetch-only file-overlay `origin=`.
 */
export function originFetchQuery (routeParams) {
  const src = routeParams || {};
  return originQuery(src, src.from || null, {
    granularity: src.granularity,
    slot: src.slot
  });
}

/**
 * Sidebar container link: bare path — no from, granularity, or facets.
 */
export function containerResetQuery (_kind) {
  return {};
}

/**
 * Models version-leaf tile hop. Resolver reads versionId (not the page's
 * modelVersionId). Catalog chips and granularity stay off the media URL.
 * Default sort is omitted.
 */
export function modelsOriginQuery (versionId, { sort, familyId } = {}) {
  const out = { from: 'models' };
  if (versionId != null && versionId !== '') out.versionId = String(versionId);
  else if (familyId != null && familyId !== '') out.familyId = String(familyId);
  if (sort != null && sort !== '' && sort !== 'date:desc') out.sort = String(sort);
  return out;
}
