// Pure origin-list resolver for Explorer ‹ › continuity.
//
// Given a scope + grain + query and the open node, returns previous/next
// neighbours (ids + slot tokens) and placement. `entries` is fixture-shaped
// index data — no CONFIG, no fetch, no disk.
//
// Facet matching reuses matchesFacets / applySort / groupItems from
// explorerQuery.mjs. Member identity is resolveMemberMedia (the gallery hop).
// q and title are handled here (matchesSearch ORs titles into q, which is
// the wrong haystack). Optional ctx carries getMediaItemById, mediaById,
// getModelVersion, and now.

import {
  matchesFacets,
  applySort,
  groupItems,
  mediaItemToFilterable,
  isValidGroupAxis,
  derivePostStatus,
  deriveComicStatus,
  resolveMemberMedia
} from './explorerQuery.mjs';
import { normalizeMediaId } from './mediaId.mjs';

// In-process cache of folded slot arrays. Outer WeakMap key is the
// mediaItems array (drops when the index replaces it). Inner key is
// epoch + scope + grain + canonical query. Epoch bumps on reproject so a
// same-array mutation (if any) still invalidates.
let originEpoch = 0;
const originSlotCache = new WeakMap();
const EMPTY_MEDIA_ITEMS = Object.freeze([]);

/** Bump when the index media projection is rebuilt or tags change. */
export function bumpOriginListCache () {
  originEpoch += 1;
}

export function originListCacheEpoch () {
  return originEpoch;
}

const ORIGIN_QUERY_KEYS = Object.freeze([
  'tag', 'type', 'scope', 'ecosystem', 'model', 'version', 'versionId',
  'resourceType', 'resource', 'aspect', 'cfgMin', 'cfgMax', 'stepsMin',
  'stepsMax', 'workflow', 'workflowMode', 'usedAsInput', 'publication', 'dateFrom', 'dateTo',
  'status', 'inPost', 'reaction',
  'sort', 'groupBy', 'groupSort', 'q', 'title'
]);

const VALID_SCOPES = new Set(['generations', 'posts', 'comics', 'models', 'imports']);

const MEDIA_FACET_KEYS = [
  'tag', 'reaction', 'type', 'scope', 'ecosystem', 'model', 'version', 'versionId',
  'resourceType', 'resource', 'aspect', 'cfgMin', 'cfgMax', 'stepsMin',
  'stepsMax', 'workflow', 'workflowMode', 'usedAsInput', 'publication', 'dateFrom', 'dateTo',
  'status', 'inPost'
];

const CONTAINER_FACET_KEYS = [
  'publication', 'dateFrom', 'dateTo', 'status', 'inPost'
];

function isInputOnly (mi) {
  if (!mi?.containers) return true;
  return mi.containers.generation == null
    && !(Array.isArray(mi.containers.posts) && mi.containers.posts.length > 0)
    && !(Array.isArray(mi.containers.comics) && mi.containers.comics.length > 0);
}

function isGenerationBacked (mi) {
  return mi?.containers?.generation != null;
}

function isPostBacked (mi) {
  return Array.isArray(mi?.containers?.posts) && mi.containers.posts.length > 0;
}

function isComicBacked (mi) {
  return Array.isArray(mi?.containers?.comics) && mi.containers.comics.length > 0;
}

function buildMediaById (mediaItems) {
  const map = new Map();
  for (const mi of mediaItems || []) {
    if (mi?.id != null) map.set(normalizeMediaId(mi.id), mi);
  }
  return map;
}

function pick (params, keys) {
  const out = {};
  for (const k of keys) {
    if (params[k] != null && params[k] !== '') out[k] = params[k];
  }
  return out;
}

function hasAny (params, keys) {
  return keys.some(k => params[k] != null && params[k] !== '');
}

function mediaFacetParams (query, scope) {
  const keys = MEDIA_FACET_KEYS.filter(k => {
    if (k === 'publication' || k === 'dateFrom' || k === 'dateTo' || k === 'status' || k === 'inPost') {
      return scope === 'generations' || scope === 'models' || scope === 'imports';
    }
    return true;
  });
  return pick(query || {}, keys);
}

function containerFacetParams (query, scope) {
  const keys = CONTAINER_FACET_KEYS.filter(k => {
    if (k === 'publication' || k === 'dateFrom' || k === 'dateTo' || k === 'status' || k === 'inPost') {
      return scope === 'posts' || scope === 'comics';
    }
    return false;
  });
  return pick(query || {}, keys);
}

function hasMediaPredicates (query, scope) {
  const q = query || {};
  if (q.q) return true;
  return hasAny(q, Object.keys(mediaFacetParams(q, scope)));
}

/** Prompt-only: item.prompt and resolved member prompts. Never negativePrompt / title / name. */
function matchesPrompt (item, q, ctx) {
  if (!q) return true;
  const needle = String(q).toLowerCase();
  const hay = new Set();
  const add = (v) => {
    if (typeof v === 'string' && v) hay.add(v.toLowerCase());
  };
  add(item.prompt);
  if (Array.isArray(item.media)) {
    for (const m of item.media) {
      const mi = resolveMemberMedia(m, ctx);
      if (mi) add(mi.prompt);
    }
  }
  for (const text of hay) {
    if (text.includes(needle)) return true;
  }
  return false;
}

/** Title substring: post title or comic name. Generations ignores title. */
function matchesTitle (item, title, scope) {
  if (!title) return true;
  if (scope === 'generations' || scope === 'models' || scope === 'imports') return true;
  const needle = String(title).toLowerCase();
  if (item.type === 'post') {
    return String(item.title || '').toLowerCase().includes(needle);
  }
  if (item.type === 'comic') {
    return String(item.name || '').toLowerCase().includes(needle);
  }
  // Media item: any containing post title / comic name.
  if (Array.isArray(item.containers?.posts)) {
    for (const ref of item.containers.posts) {
      if (String(ref?.title || '').toLowerCase().includes(needle)) return true;
    }
  }
  if (Array.isArray(item.containers?.comics)) {
    for (const ref of item.containers.comics) {
      if (String(ref?.name || '').toLowerCase().includes(needle)) return true;
    }
  }
  return false;
}

function matchesMediaItem (mi, query, scope, ctx) {
  const adapted = mediaItemToFilterable(mi);
  const facets = mediaFacetParams(query, scope);
  // Title on posts/comics media grain is a container predicate applied to the
  // member via containing-container titles — not via matchesFacets.
  if (!matchesFacets(adapted, facets, null, ctx)) return false;
  if (!matchesPrompt(adapted, query?.q, ctx)) return false;
  if (scope === 'posts' || scope === 'comics') {
    if (!matchesTitle(mi, query?.title, scope)) return false;
  }
  return true;
}

function matchesContainer (container, query, scope, ctx, { requireMediaMember = true } = {}) {
  const cFacets = containerFacetParams(query, scope);
  if (!matchesFacets(container, cFacets, null, ctx)) return false;
  if (scope !== 'generations' && !matchesTitle(container, query?.title, scope)) return false;

  if (!requireMediaMember) return true;
  if (!hasMediaPredicates(query, scope)) return true;

  // Any member must satisfy media predicates. Identity is the gallery hop
  // (canonical id, including a joined post/comic image id).
  if (!Array.isArray(container.media) || !container.media.length) return false;
  for (const m of container.media) {
    if (isChromeRole(m)) continue;
    const mi = resolveMemberMedia(m, ctx);
    if (mi && matchesMediaItem(mi, query, scope, ctx)) return true;
  }
  // Generation entries also carry union tags / prompt at entry level.
  if (container.type === 'generation') {
    const mFacets = mediaFacetParams(query, scope);
    if (matchesFacets(container, mFacets, null, ctx) && matchesPrompt(container, query?.q, ctx)) {
      return true;
    }
  }
  return false;
}

function isChromeRole (m) {
  return m?.role === 'cover' || m?.role === 'hero';
}

/** Canonical media-item id for a container member, or '' when unresolved. */
function canonicalMemberId (m, ctx) {
  const mi = resolveMemberMedia(m, ctx);
  if (mi?.id == null || mi.id === '') return '';
  return normalizeMediaId(mi.id);
}

/**
 * Media-page open id. An image id that joins a generation blob lands on
 * that blob's slot. Container ids are not aliased.
 */
function canonicalOpenId (id, ctx) {
  const norm = normalizeMediaId(id);
  if (!norm) return norm;
  if (ctx?.mediaById?.has(norm)) return norm;
  const mid = canonicalMemberId({ mediaId: id, imageId: id }, ctx);
  return mid || norm;
}

function walkCtx (userCtx, entries, scope) {
  const built = buildMediaById(entries?.mediaItems);
  return {
    getModelVersion: () => null,
    now: Date.now(),
    ...userCtx,
    mediaById: userCtx?.mediaById || built,
    normalizeId: normalizeMediaId,
    publicationScope: publicationScopeFor(scope)
  };
}

function foldAdjacent (slots) {
  const out = [];
  for (const s of slots) {
    if (out.length && out[out.length - 1].id === s.id) continue;
    out.push(s);
  }
  return out;
}

function assignOrdinals (rawSlots, prefix, keyOf) {
  // rawSlots: [{ id, key }] before fold. After fold, ordinal is the
  // 0-based position among that container/group's own slots so each
  // token is unique in the walk (anchorSlot lookup has no media id).
  // A later non-adjacent repeat of the same id still gets its own ordinal.
  const folded = foldAdjacent(rawSlots);
  const seen = new Map(); // key → next ordinal
  return folded.map(s => {
    const key = keyOf(s);
    const ord = seen.get(key) || 0;
    seen.set(key, ord + 1);
    return {
      id: s.id,
      slot: `${prefix}:${key}:${ord}`,
      key
    };
  });
}

function consumerDate (mi, mediaById) {
  let best = null;
  for (const edge of mi.usedAsInput || []) {
    const producer = mediaById.get(normalizeMediaId(edge.id));
    if (!producer) continue;
    const d = producer.date || producer.containers?.generation?.sortKey || '';
    if (!d) continue;
    if (best == null || String(d) < String(best)) best = d;
  }
  return best || '';
}

function buildImportSlots (mediaItems, mediaById) {
  const imports = (mediaItems || []).filter(isInputOnly);
  imports.sort((a, b) => {
    const da = consumerDate(a, mediaById);
    const db = consumerDate(b, mediaById);
    if (da !== db) return String(da).localeCompare(String(db));
    return String(a.id).localeCompare(String(b.id));
  });
  return imports.map(mi => ({ id: normalizeMediaId(mi.id), slot: null }));
}

function scopeMediaItems (entries, scope) {
  const items = entries.mediaItems || [];
  switch (scope) {
    case 'generations': return items.filter(isGenerationBacked);
    case 'posts': return items.filter(isPostBacked);
    case 'comics': return items.filter(isComicBacked);
    case 'imports': return items.filter(isInputOnly);
    case 'models': return items.filter(mi => !isInputOnly(mi));
    default: return items.filter(mi => !isInputOnly(mi));
  }
}

function scopeContainers (entries, scope) {
  switch (scope) {
    case 'generations': return entries.generations || [];
    case 'posts': return entries.posts || [];
    case 'comics': return entries.comics || [];
    default: return [];
  }
}

function publicationScopeFor (scope) {
  if (scope === 'posts') return 'post';
  if (scope === 'comics') return 'comic';
  return 'all';
}

/**
 * Matching containers in gallery order: groupBy+groupSort sections, then
 * item sort inside each group. No groupBy → applySort only.
 */
function orderContainers (containers, query, ctx) {
  const q = query || {};
  if (isValidGroupAxis(q.groupBy)) {
    const groups = groupItems(containers, q.groupBy, {
      sort: q.sort,
      groupSort: q.groupSort,
      getModelVersion: ctx?.getModelVersion
    });
    const out = [];
    for (const g of groups) {
      for (const c of g.items) out.push(c);
    }
    return out;
  }
  return applySort(containers, q.sort);
}

/**
 * Build the ordered media-slot array for an origin.
 * Each slot: { id, slot } where slot may be null when the walk cannot repeat.
 */
function buildMediaSlots ({ scope, grain, query, entries, ctx }) {
  const q = query || {};

  if (scope === 'imports') {
    return buildImportSlots(entries.mediaItems, ctx?.mediaById);
  }

  if (grain === 'container') {
    const containers = orderContainers(
      scopeContainers(entries, scope).filter(c => matchesContainer(c, q, scope, ctx)),
      q,
      ctx
    );
    const mediaPreds = hasMediaPredicates(q, scope);
    const raw = [];
    for (const c of containers) {
      const media = Array.isArray(c.media) ? c.media : [];
      for (const m of media) {
        if (isChromeRole(m)) continue;
        const mi = resolveMemberMedia(m, ctx);
        if (!mi) continue;
        if (mediaPreds && !matchesMediaItem(mi, q, scope, ctx)) continue;
        raw.push({ id: normalizeMediaId(mi.id), key: String(c.id) });
      }
    }
    return assignOrdinals(raw, 'c', s => s.key);
  }

  // Media grain
  let items = scopeMediaItems(entries, scope).filter(mi => matchesMediaItem(mi, q, scope, ctx));
  const adapted = items.map(mi => {
    const a = mediaItemToFilterable(mi);
    a._source = mi;
    return a;
  });

  if (isValidGroupAxis(q.groupBy)) {
    const groups = groupItems(adapted, q.groupBy, {
      sort: q.sort,
      groupSort: q.groupSort,
      getModelVersion: ctx?.getModelVersion
    });
    const raw = [];
    for (const g of groups) {
      for (const item of g.items) {
        const id = normalizeMediaId(item._source?.id ?? item.id);
        raw.push({ id, key: String(g.key) });
      }
    }
    return assignOrdinals(raw, 'g', s => s.key);
  }

  const sorted = applySort(adapted, q.sort);
  // Media grain without groupBy cannot repeat an id — no slot tokens.
  return sorted.map(item => ({
    id: normalizeMediaId(item._source?.id ?? item.id),
    slot: null
  }));
}

function buildContainerSlots ({ scope, query, entries, ctx }) {
  const q = query || {};
  const containers = orderContainers(
    scopeContainers(entries, scope).filter(c => matchesContainer(c, q, scope, ctx)),
    q,
    ctx
  );
  return containers.map(c => ({ id: String(c.id), slot: null }));
}

function canonicalOriginQuery (query) {
  const q = query || {};
  const parts = [];
  for (const key of ORIGIN_QUERY_KEYS) {
    const v = q[key];
    if (v == null || v === '') continue;
    parts.push(`${key}=${Array.isArray(v) ? v.join(',') : String(v)}`);
  }
  return parts.join('&');
}

function publicationCacheKey (entries, now) {
  const parts = [];
  for (const p of entries?.posts || []) {
    const status = derivePostStatus(p.publishedAt, now);
    if (status !== p.status) parts.push(`p${p.id}=${status}`);
  }
  for (const c of entries?.comics || []) {
    const status = deriveComicStatus(c);
    if (status !== c.status) parts.push(`c${c.id}=${status}`);
  }
  return parts.join('|');
}

function readTimeEntries (entries, now) {
  const posts = entries?.posts || [];
  const comics = entries?.comics || [];
  let postsChanged = false;
  const nextPosts = posts.map(p => {
    const status = derivePostStatus(p.publishedAt, now);
    if (status === p.status) return p;
    postsChanged = true;
    return { ...p, status };
  });
  let comicsChanged = false;
  const nextComics = comics.map(c => {
    const status = deriveComicStatus(c);
    if (status === c.status) return c;
    comicsChanged = true;
    return { ...c, status };
  });
  if (!postsChanged && !comicsChanged) return entries;
  return { ...entries, posts: nextPosts, comics: nextComics };
}

function cachedWalkSlots ({ scope, grain, query, entries, ctx }) {
  const effectiveGrain = (scope === 'imports' || scope === 'models') ? 'media' : grain;
  const items = Array.isArray(entries?.mediaItems) ? entries.mediaItems : EMPTY_MEDIA_ITEMS;
  let byKey = originSlotCache.get(items);
  if (!byKey) {
    byKey = new Map();
    originSlotCache.set(items, byKey);
  }
  const now = ctx?.now ?? Date.now();
  const key = `${originEpoch}\0${scope}\0${effectiveGrain}\0${canonicalOriginQuery(query)}\0${publicationCacheKey(entries, now)}`;
  let hit = byKey.get(key);
  if (!hit) {
    const stamped = readTimeEntries(entries, now);
    const scoped = walkCtx(ctx, stamped, scope);
    const mediaSlots = buildMediaSlots({
      scope, grain: effectiveGrain, query, entries: stamped, ctx: scoped
    });
    const containerSlots = (effectiveGrain === 'container')
      ? buildContainerSlots({ scope, query, entries: stamped, ctx: scoped })
      : [];
    hit = { mediaSlots, containerSlots, effectiveGrain };
    byKey.set(key, hit);
  }
  return hit;
}

function findSlotIndex (slots, id, slotToken) {
  const nid = normalizeMediaId(id);
  if (slotToken) {
    const i = slots.findIndex(s => s.slot === slotToken && s.id === nid);
    if (i !== -1) return i;
    // Stale token for this id: land on the first slot whose media id matches.
    return slots.findIndex(s => s.id === nid);
  }
  return slots.findIndex(s => s.id === nid);
}

/** True when this visit is a later copy of the same id in the walk. */
function slotNeedsInUrl (slots, index) {
  if (index < 0 || !slots[index]) return false;
  const id = slots[index].id;
  for (let i = 0; i < index; i++) {
    if (slots[i].id === id) return true;
  }
  return false;
}

function neighbourPayload (slots, index, { placement, inWalk = null }) {
  if (index < 0) {
    return {
      prevId: null,
      nextId: null,
      prevSlot: null,
      nextSlot: null,
      slot: null,
      slotInUrl: false,
      prevSlotInUrl: false,
      nextSlotInUrl: false,
      placement,
      inWalk
    };
  }
  const cur = slots[index];
  const prev = index > 0 ? slots[index - 1] : null;
  const next = index < slots.length - 1 ? slots[index + 1] : null;
  return {
    prevId: prev ? prev.id : null,
    nextId: next ? next.id : null,
    prevSlot: prev ? prev.slot : null,
    nextSlot: next ? next.slot : null,
    slot: cur.slot,
    slotInUrl: slotNeedsInUrl(slots, index),
    prevSlotInUrl: prev ? slotNeedsInUrl(slots, index - 1) : false,
    nextSlotInUrl: next ? slotNeedsInUrl(slots, index + 1) : false,
    placement,
    inWalk
  };
}

function inWalkForContainer (containerId, mediaSlots) {
  const prefix = `c:${containerId}:`;
  return mediaSlots
    .filter(s => s.slot && s.slot.startsWith(prefix))
    .map(s => ({ id: s.id, slot: s.slot }));
}

// Container preference: generation, else post, else comic, else imports.
// Models is never inferred.
function membershipFallbackScope (id, entries) {
  const mi = (entries.mediaItems || []).find(m => normalizeMediaId(m.id) === normalizeMediaId(id));
  if (!mi) return null;
  if (isGenerationBacked(mi)) return 'generations';
  if (isPostBacked(mi)) return 'posts';
  if (isComicBacked(mi)) return 'comics';
  if (isInputOnly(mi)) return 'imports';
  return null;
}

function membershipFallback (id, kind, entries, ctx) {
  const fbScope = membershipFallbackScope(id, entries);
  if (!fbScope) {
    return {
      ...neighbourPayload([], -1, { placement: 'fallback', inWalk: kind === 'container' ? [] : null }),
      scope: null
    };
  }
  const { mediaSlots } = cachedWalkSlots({
    scope: fbScope,
    grain: 'media',
    query: {},
    entries,
    ctx
  });
  const fbIdx = findSlotIndex(mediaSlots, id, null);
  return {
    ...neighbourPayload(mediaSlots, fbIdx, {
      placement: 'fallback',
      inWalk: kind === 'container' ? [] : null
    }),
    scope: fbScope
  };
}

/**
 * Pick facet/sort/group/search keys from a URL params object for resolveOrigin.
 * Omits from, granularity, slot, anchor, and fetch-only overlay keys.
 */
export function originQueryFromParams (params = {}) {
  return pick(params, ORIGIN_QUERY_KEYS);
}

/** True when the quiet query still carries a key that must keep `from`. */
function queryKeepsFrom (query) {
  const q = query || {};
  for (const key of ORIGIN_QUERY_KEYS) {
    const v = q[key];
    if (v == null || v === '') continue;
    if (key === 'sort' && String(v) === 'date:desc') continue;
    if (key === 'groupBy' && (v === 'none')) continue;
    if (key === 'groupSort') {
      if (q.groupBy == null || q.groupBy === '' || q.groupBy === 'none') continue;
      if (String(v) === 'count:desc') continue;
    }
    return true;
  }
  return false;
}

/**
 * Drop `from` when the walk without it is already the same list (membership
 * matches scope and no other origin key remains). Models always keeps from.
 */
function computeOmitFrom ({ scope, grain, query, kind, pathScope, slotInUrl, id, entries }) {
  if (scope === 'models') return false;
  if (kind === 'container') {
    return pathScope != null && scope === pathScope;
  }
  if (scope == null || scope === '') return false;
  const membership = membershipFallbackScope(id, entries);
  if (scope !== membership) return false;
  if (grain === 'container') return false;
  if (slotInUrl) return false;
  if (queryKeepsFrom(query)) return false;
  return true;
}

/**
 * Resolve detail neighbours for a request. Pure given `entries`.
 * When `scope` is null/empty, skips the encoded list and uses membership fallback.
 */
export function resolveOrigin ({
  scope,
  grain,
  query = {},
  kind,
  id,
  slot = null,
  anchorSlot = null,
  entries,
  ctx: userCtx = null
}) {
  const ctx = walkCtx(userCtx, entries, scope);
  const lookupId = kind === 'media' ? canonicalOpenId(id, ctx) : String(id);

  // Missing scope → membership fallback only (bare media GET with no from=).
  if (scope == null || scope === '') {
    return membershipFallback(lookupId, kind, entries, ctx);
  }

  const { mediaSlots, containerSlots } = cachedWalkSlots({
    scope, grain, query, entries, ctx
  });

  const inWalk = kind === 'container'
    ? inWalkForContainer(String(id), mediaSlots)
    : null;

  // Detached: open id outside the walk, but an anchor slot was just left.
  if (kind === 'media' && anchorSlot) {
    const inEncoded = findSlotIndex(mediaSlots, lookupId, slot) !== -1;
    if (!inEncoded) {
      const anchorIdx = mediaSlots.findIndex(s => s.slot === anchorSlot);
      if (anchorIdx !== -1) {
        const prev = mediaSlots[anchorIdx];
        const next = mediaSlots[anchorIdx + 1] || null;
        return {
          prevId: prev.id,
          nextId: next ? next.id : null,
          prevSlot: prev.slot,
          nextSlot: next ? next.slot : null,
          slot: null,
          slotInUrl: false,
          prevSlotInUrl: slotNeedsInUrl(mediaSlots, anchorIdx),
          nextSlotInUrl: next ? slotNeedsInUrl(mediaSlots, anchorIdx + 1) : false,
          placement: 'detached',
          inWalk: null
        };
      }
    }
  }

  if (kind === 'container') {
    const idx = containerSlots.findIndex(s => s.id === String(id));
    if (idx !== -1) {
      return neighbourPayload(containerSlots, idx, { placement: 'in', inWalk });
    }
  } else {
    const idx = findSlotIndex(mediaSlots, lookupId, slot);
    if (idx !== -1) {
      return neighbourPayload(mediaSlots, idx, { placement: 'in', inWalk: null });
    }
  }

  return membershipFallback(lookupId, kind, entries, ctx);
}

/**
 * Detail-payload helper: `{ origin, members }` where `origin` is the neighbour
 * object (no inWalk array) and `members` is the container's media[] with
 * `inWalk` / `slot` / `slotInUrl` stamped when kind is container.
 */
export function buildDetailOrigin ({
  scope,
  grain,
  query,
  kind,
  id,
  slot,
  anchorSlot,
  entries,
  members = null,
  pathScope = null,
  ctx: userCtx = null
}) {
  const ctx = walkCtx(userCtx, entries, scope);
  const lookupId = kind === 'media' ? canonicalOpenId(id, ctx) : String(id);
  const resolved = resolveOrigin({
    scope, grain, query, kind, id: lookupId, slot, anchorSlot, entries, ctx
  });
  const omitFrom = computeOmitFrom({
    scope: resolved.placement === 'fallback' ? resolved.scope : scope,
    grain,
    query,
    kind,
    pathScope,
    slotInUrl: resolved.slotInUrl === true,
    id: lookupId,
    entries
  });
  const origin = {
    prevId: resolved.prevId,
    nextId: resolved.nextId,
    prevSlot: resolved.prevSlot,
    nextSlot: resolved.nextSlot,
    slot: resolved.slot,
    slotInUrl: resolved.slotInUrl === true,
    prevSlotInUrl: resolved.prevSlotInUrl === true,
    nextSlotInUrl: resolved.nextSlotInUrl === true,
    omitFrom,
    placement: resolved.placement
  };
  // Fallback first-arrow write needs the membership scope; quiet URLs need
  // scope when from is omitted so the origin tab can light.
  if (resolved.placement === 'fallback' && resolved.scope) {
    origin.scope = resolved.scope;
  } else if (omitFrom && scope) {
    origin.scope = scope;
  }
  if (kind !== 'container' || !Array.isArray(members)) {
    return { origin, members };
  }
  const walk = Array.isArray(resolved.inWalk) ? resolved.inWalk : [];
  let wi = 0;
  let prevStampedId = null;
  let prevStampedSlot = null;
  let prevStampedSlotInUrl = false;
  const seenIds = new Set();
  const stamped = members.map(m => {
    const mid = isChromeRole(m) ? '' : canonicalMemberId(m, ctx);
    const withId = mid ? { mediaId: mid } : {};
    // Consume the next walk token when it is this canonical id.
    // Otherwise reuse the previous token: adjacent duplicates, and copies
    // the walk folded together because a non-matching row is not a step.
    if (mid && wi < walk.length && walk[wi].id === mid) {
      const token = walk[wi].slot;
      const later = seenIds.has(mid);
      seenIds.add(mid);
      wi += 1;
      prevStampedId = mid;
      prevStampedSlot = token;
      prevStampedSlotInUrl = later;
      return { ...m, ...withId, inWalk: true, slot: token, slotInUrl: later };
    }
    if (mid && prevStampedId != null && mid === prevStampedId) {
      return {
        ...m,
        ...withId,
        inWalk: true,
        slot: prevStampedSlot,
        slotInUrl: prevStampedSlotInUrl
      };
    }
    return { ...m, ...withId, inWalk: false };
  });
  return { origin, members: stamped };
}

/**
 * Parse from= / granularity / slot / anchor from a URLSearchParams (or
 * params object) into resolveOrigin args. Fetch-only `origin=` is ignored.
 */
export function originArgsFromSearchParams (sp, { kind, id, defaultScope = null } = {}) {
  const get = (k) => {
    if (!sp) return null;
    if (typeof sp.get === 'function') return sp.get(k);
    return sp[k] != null ? String(sp[k]) : null;
  };
  const from = get('from') || '';
  const scope = VALID_SCOPES.has(from)
    ? from
    : (kind === 'container' ? defaultScope : null);
  const gran = get('granularity') || '';
  let grain = 'media';
  if (kind === 'container') grain = 'container';
  else if (gran === 'batch' || gran === 'post' || gran === 'comic') grain = 'container';

  const params = {};
  if (sp && typeof sp.entries === 'function') {
    for (const [k, v] of sp.entries()) {
      params[k] = params[k] != null ? `${params[k]},${v}` : v;
    }
  } else if (sp && typeof sp === 'object') {
    Object.assign(params, sp);
  }

  return {
    scope,
    grain,
    query: originQueryFromParams(params),
    kind,
    id: String(id),
    slot: get('slot') || null,
    anchorSlot: get('anchor') || null,
    pathScope: kind === 'container' ? defaultScope : null
  };
}
