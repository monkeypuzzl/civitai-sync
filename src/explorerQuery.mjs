// Pure query pipeline for the Explorer's paginated endpoints.
//
// `src/server.mjs`'s `handlePaginated` is the only runtime caller; these
// functions are factored out so the facet / sort / group-by contract is
// unit-testable without booting the HTTP server. Everything here is a pure
// function of its inputs (no CONFIG, no fs, no network).
//
// The grammar these implement is normative in
// docs/guides/civitai-sync/explorer-url-protocol.md (§ Facets, § Group-by,
// § Sort). The same protocol param names are used end-to-end (steward
// ruling 3): the URL, the view, `api.js`, and these helpers all speak
// `tag` / `q` / `type` / `ecosystem` / … / `sort=<field>:<dir>`.
//
// Two entry shapes flow through here — generation entries and post/comic
// entries (see `buildGenerationEntry` / `buildPostEntry` / `buildComicEntry`
// in serverIndex.mjs). Extractors read each facet from whichever shape
// applies. On a post/comic row, media-item axes (`reaction=`, the
// type/workflowMode/workflow union, scope, cfg/steps, usedAsInput) match if
// **any** resolved member matches (`ctx.mediaById`); content tags stay
// entry-level. A facet with no member and no entry-level value filters
// the row out. `reaction=` requires every selected mark in that union.

import { getEcosystemDisplayName } from './ecosystemDisplay.mjs';
import { assignModelFamily, generatorFamilyForItem, getModelFamily } from './modelFamily.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import {
  resolveModelGroupKey,
  resolveResourceLineName,
  hydratedResourceSlots
} from './checkpointResolution.mjs';
import {
  namedAspectToken,
  isAspectClassToken,
  isAspectRatioToken
} from './mediaAspect.mjs';
import {
  isWorkflowRemainderToken,
  parseWorkflowFamily,
  remainderTypeOf
} from './workflowFamily.mjs';

// --- Field extractors (shape-tolerant) -------------------------------------

const UNKNOWN_NAMES = new Set(['', '(unknown)']);

function nonEmpty (arr) {
  return arr.filter(v => typeof v === 'string' && !UNKNOWN_NAMES.has(v));
}

/** The media types present on an entry ('image' | 'video' | 'audio' | 'model3d'). */
export function itemTypes (item) {
  return Array.isArray(item.media) ? item.media.map(m => m.type).filter(Boolean) : [];
}

/** Ecosystem keys (AIR root, e.g. 'sdxl') across all hydrated resource slots. */
export function itemEcosystems (item, getModelVersion = () => null) {
  const out = [];
  for (const r of hydratedResourceSlots(item, getModelVersion)) {
    if (r?.air?.ecosystem) out.push(r.air.ecosystem);
  }
  return [...new Set(out)];
}

/** `params.workflow` is the canonical token, job or designation. Single-valued. */
export function itemWorkflows (item) {
  const w = item?.params?.workflow;
  return w ? [w] : [];
}

/** Model-line names across all resources. Cache-aware (R1.5). */
export function itemModels (item, getModelVersion = () => null) {
  const out = [];
  if (item.checkpoint) {
    const n = resolveResourceLineName(item.checkpoint, getModelVersion);
    if (n) out.push(n);
  }
  for (const r of item.resources || []) {
    const n = resolveResourceLineName(r, getModelVersion);
    if (n) out.push(n);
  }
  return [...new Set(out)];
}

/** Version names across all hydrated resource slots. */
export function itemVersions (item, getModelVersion = () => null) {
  const out = [];
  for (const r of hydratedResourceSlots(item, getModelVersion)) {
    if (r?.versionName) out.push(r.versionName);
  }
  return [...new Set(nonEmpty(out))];
}

/**
 * Numeric version IDs (as strings) across ALL resource slots — the primary
 * checkpoint plus every additional resource (LoRA / embedding / …). Backs the
 * Models-tree leaf scoping: a `versionId=<id>` filter must include media where
 * the version appears in a NON-primary slot, not just as the checkpoint (the
 * Phase 1c capture is the whole point). Generations only. The checkpoint is
 * itself one of `resources`, but it's read explicitly too so the union holds
 * for any future entry shape where it isn't. Stringified so it compares
 * cleanly against the comma-split URL tokens.
 */
export function itemVersionIds (item) {
  const out = [];
  if (item.checkpoint?.versionId != null) out.push(String(item.checkpoint.versionId));
  for (const r of item.resources || []) if (r?.versionId != null) out.push(String(r.versionId));
  return [...new Set(out)];
}

/** Closed ModelType values across all hydrated resource slots. */
export function itemResourceTypes (item, getModelVersion = () => null) {
  const out = [];
  for (const r of hydratedResourceSlots(item, getModelVersion)) {
    if (r?.type) out.push(r.type);
  }
  return [...new Set(out)];
}

/** Resource (model-line) names across ALL resource slots. Generations only. */
export function itemResources (item, getModelVersion = () => null) {
  return itemModels(item, getModelVersion);
}

/** Aspect classes present on an entry ('portrait' | 'landscape' | 'square'). */
export function itemAspects (item) {
  if (item.type === 'generation') return item.aspectClass ? [item.aspectClass] : [];
  const out = Array.isArray(item.media) ? item.media.map(m => m.aspectClass).filter(Boolean) : [];
  return [...new Set(out)];
}

function aspectCandidates (item) {
  const out = [];
  if (Array.isArray(item.media) && item.media.length) {
    for (const m of item.media) {
      out.push({
        aspectClass: m.aspectClass || '',
        width: m.width || 0,
        height: m.height || 0
      });
    }
  }
  out.push({
    aspectClass: item.aspectClass || '',
    width: item.width || item.params?.width || 0,
    height: item.height || item.params?.height || 0
  });
  for (const c of out) {
    if (!c.width && (item.width || item.params?.width)) c.width = item.width || item.params.width;
    if (!c.height && (item.height || item.params?.height)) c.height = item.height || item.params.height;
    if (!c.aspectClass && item.aspectClass) c.aspectClass = item.aspectClass;
  }
  return out;
}

function candidateMatchesAspectToken (candidate, token) {
  if (isAspectClassToken(token)) return candidate.aspectClass === token;
  if (isAspectRatioToken(token)) {
    return namedAspectToken(candidate.width, candidate.height) === token;
  }
  return false;
}

/** OR: class token matches `aspectClass`; `W:H` token matches the snap-or-exact label. */
export function itemMatchesAspect (item, tokens) {
  if (!Array.isArray(tokens) || !tokens.length) return true;
  const candidates = aspectCandidates(item);
  return tokens.some(token => candidates.some(c => candidateMatchesAspectToken(c, token)));
}

/** Owner marks. The closed set the Reactions filter and the media-page row use. */
export function isReactionToken (t) {
  return t === 'favorite' || t === 'feedback:liked' || t === 'feedback:disliked';
}

/**
 * Private reactions on a media item. `reactions` is authoritative when the
 * projection set it (including an empty array). Generation entries and
 * fixtures that still carry the marks on `tags` fall through.
 */
export function itemReactionTags (item) {
  if (Array.isArray(item?.reactions)) return item.reactions.filter(isReactionToken);
  if (!Array.isArray(item?.tags)) return [];
  return item.tags.filter(t => typeof t === 'string' && isReactionToken(t));
}

/** Content tag names — resolved post-level + image tag names. Posts only. */
export function itemContentTags (item) {
  const names = Array.isArray(item.contentTags)
    ? item.contentTags
    : (Array.isArray(item.tags)
      ? item.tags.map(t => (typeof t === 'string' ? t : t?.name))
      : []);
  return names.filter(t => t && !isReactionToken(t));
}

function isContainerEntry (item) {
  return item?.type === 'post' || item?.type === 'comic';
}

function memberMediaId (m) {
  return m?.mediaId ?? m?.imageId ?? m?.panelMediaId ?? m?.id;
}

export function resolveMemberMedia (m, ctx) {
  const id = memberMediaId(m);
  if (id == null || id === '') return null;
  const normalizeId = ctx?.normalizeId || (x => String(x ?? ''));
  const norm = normalizeId(id);
  const map = ctx?.mediaById;
  if (map) {
    const direct = map.get(norm);
    if (direct) return direct;
  }
  // Joined post/comic members key mediaById by the canonical blob id;
  // imageId / panelMediaId need the alias hop getMediaItemById already does.
  if (typeof ctx?.getMediaItemById === 'function') {
    return ctx.getMediaItemById(id) || ctx.getMediaItemById(norm) || null;
  }
  return null;
}

function forEachResolvedMember (item, ctx, fn) {
  if (!Array.isArray(item?.media)) return;
  for (const m of item.media) {
    const mi = resolveMemberMedia(m, ctx);
    if (mi) fn(mi);
  }
}

function adaptedContainerMembers (item, ctx) {
  const out = [];
  forEachResolvedMember(item, ctx, mi => out.push(mediaItemToFilterable(mi)));
  return out;
}

/** Post/comic: any adapted member, else the entry itself. Other types: entry. */
function anyMemberOrSelf (item, ctx, pred) {
  if (isContainerEntry(item)) {
    const members = adaptedContainerMembers(item, ctx);
    if (members.length) return members.some(pred);
  }
  return pred(item);
}

/**
 * Read-time tri-state post status. A post's status is time-relative: a future
 * publishedAt is 'scheduled' until it passes, then 'published'. Derived per
 * request (never frozen in the index — the stored status is the binary
 * draft/published; the server overrides it with this at /api/posts).
 */
export function derivePostStatus (publishedAt, now = Date.now()) {
  if (!publishedAt) return 'draft';
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return 'published'; // a malformed but present publishedAt is treated as published (matches the legacy binary)
  return t > now ? 'scheduled' : 'published';
}

export function chapterPublicationStatus (ch) {
  const status = typeof ch === 'string' ? ch : ch?.status;
  if (!status) return 'draft';
  // Wire ComicChapterStatus is PascalCase. Leftover publishedAt after
  // unpublish must not count — classify from the enum only. Lowercase
  // tokens are accepted so a stamped comicRef.chapterStatus and a
  // chapter object share this classifier.
  if (status === 'Draft' || status === 'draft') return 'draft';
  if (status === 'Scheduled' || status === 'scheduled') return 'scheduled';
  if (status === 'Published' || status === 'published') return 'published';
  return 'draft';
}

/**
 * Derived comic gallery/Overview status. Highest chapter wins:
 * published > scheduled > draft. Early access is an overlay, not a status.
 */
export function deriveComicStatus (entry) {
  const chapters = Array.isArray(entry?.chapters) ? entry.chapters : [];
  let anyPublished = false;
  let anyScheduled = false;
  for (const ch of chapters) {
    const status = chapterPublicationStatus(ch);
    if (status === 'published') anyPublished = true;
    else if (status === 'scheduled') anyScheduled = true;
  }
  if (anyPublished) return 'published';
  if (anyScheduled) return 'scheduled';
  return 'draft';
}

function latestPublishedChapterAt (chapters, now) {
  let best = '';
  let bestT = -Infinity;
  for (const ch of (Array.isArray(chapters) ? chapters : [])) {
    if (chapterPublicationStatus(ch) !== 'published' || !ch.publishedAt) continue;
    const t = new Date(ch.publishedAt).getTime();
    if (Number.isNaN(t) || t > now) continue;
    if (t >= bestT) {
      bestT = t;
      best = ch.publishedAt;
    }
  }
  return best;
}

function earliestScheduledChapterAt (chapters) {
  let best = '';
  let bestT = Infinity;
  for (const ch of (Array.isArray(chapters) ? chapters : [])) {
    if (chapterPublicationStatus(ch) !== 'scheduled' || !ch.publishedAt) continue;
    const t = new Date(ch.publishedAt).getTime();
    if (Number.isNaN(t)) continue;
    if (t < bestT) {
      bestT = t;
      best = ch.publishedAt;
    }
  }
  return best;
}

function comicItemStatus (item) {
  if (item.status === 'draft' || item.status === 'scheduled' || item.status === 'published') {
    return item.status;
  }
  return deriveComicStatus(item);
}

/** The status-aware effective date string for date-range filtering / sort. */
export function itemDate (item, now = Date.now()) {
  if (item.type === 'post') {
    // Draft → createdAt; published AND scheduled → publishedAt (a scheduled
    // post keys on its future publishedAt, not createdAt). Fallbacks preserved.
    return (item.status === 'draft' ? item.createdAt : item.publishedAt) || item.publishedAt || item.createdAt || '';
  }
  if (item.type === 'comic') {
    const status = comicItemStatus(item);
    if (status === 'draft') return item.createdAt || '';
    if (status === 'published') {
      return latestPublishedChapterAt(item.chapters, now) || item.createdAt || '';
    }
    if (status === 'scheduled') {
      return earliestScheduledChapterAt(item.chapters) || item.createdAt || '';
    }
    return item.createdAt || '';
  }
  if (item.type === 'model3d') {
    if (item.status === 'published') return item.publishedAt || item.createdAt || '';
    return item.createdAt || '';
  }
  return item.createdAt || '';
}

// --- Content tags (OR) and private reactions (AND) -------------------------

/** Content tags. OR within the list. Reaction tokens are not content names. */
export function matchesTags (item, requiredTags) {
  if (!requiredTags.length) return true;
  const content = new Set(itemContentTags(item));
  return requiredTags.some(t => content.has(t));
}

/**
 * Private reactions. Every selected token must be present (AND). On a
 * post or comic the tokens are the union of members, so Favorite and Liked
 * may sit on different members. A media item must carry each token itself.
 */
export function matchesReactions (item, required, ctx = {}) {
  if (!required.length) return true;
  const have = new Set();
  if (isContainerEntry(item)) {
    let anyMember = false;
    forEachResolvedMember(item, ctx, mi => {
      anyMember = true;
      for (const t of itemReactionTags(mi)) have.add(t);
    });
    if (!anyMember) {
      for (const t of itemReactionTags(item)) have.add(t);
    }
  } else {
    for (const t of itemReactionTags(item)) have.add(t);
  }
  return required.every(t => have.has(t));
}

// --- Substring search (prompt-like text only; tags are facets) -------------
// Haystack is item.prompt ∪ member prompts. Never title / name / container
// titles, never tags, never negativePrompt. Container titles use params.title
// via matchesTitleParam (posts/comics only).

export function matchesSearch (item, search, searchField, ctx = {}) {
  if (!search) return true;
  const q = String(search).toLowerCase();
  const hay = new Set();
  const add = (v) => {
    if (typeof v === 'string' && v) hay.add(v.toLowerCase());
  };
  add(item.prompt);
  // searchField is legacy (posts historically passed 'title'); q is
  // prompt-only — only honour an explicit prompt field.
  if (searchField === 'prompt') add(item.prompt);
  forEachResolvedMember(item, ctx, mi => add(mi.prompt));
  for (const text of hay) {
    if (text.includes(q)) return true;
  }
  return false;
}

/**
 * `title=` substring on post title / comic name. Generations ignores it.
 * Media items (adapted or flat) match via containers.posts[].title or
 * containers.comics[].name when the walk is posts/comics-scoped.
 */
export function matchesTitleParam (item, title, ctx = {}) {
  if (!title) return true;
  const scope = ctx.publicationScope;
  const isContainer = item?.type === 'post' || item?.type === 'comic';
  const scoped = scope === 'post' || scope === 'comic';
  if (!isContainer && !scoped) return true;

  const needle = String(title).toLowerCase();
  if (item.type === 'post') {
    return String(item.title || '').toLowerCase().includes(needle);
  }
  if (item.type === 'comic') {
    return String(item.name || '').toLowerCase().includes(needle);
  }
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

// --- Numeric helpers -------------------------------------------------------

function num (v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function itemCfg (item) { return num(item.params?.cfgScale); }
export function itemSteps (item) { return num(item.params?.steps); }

/**
 * Publication tokens present on an item for the list-offer walk. Posts and
 * comics use their own `status`. Everything else reuses
 * `collectPublicationFacts` (same path as `matchesPublication`). `unposted`
 * is included only when facts say so and `publicationScope` is not
 * `post` or `comic`.
 */
export function model3dPublicationStatus (status) {
  if (status === 'Published' || status === 'published') return 'published';
  if (status === 'Draft' || status === 'draft') return 'draft';
  if (status === 'Unpublished' || status === 'unpublished') return 'unpublished';
  if (status === 'Deleted' || status === 'deleted') return 'deleted';
  return '';
}

export function publicationTokensOf (item, ctx = {}) {
  if (item.type === 'post' || item.type === 'comic') {
    const s = item.status;
    if (s === 'published' || s === 'scheduled' || s === 'draft') return [s];
    return [];
  }
  if (item.type === 'model3d') {
    const s = item.status;
    if (s === 'published' || s === 'draft' || s === 'unpublished') return [s];
    return [];
  }
  const facts = collectPublicationFacts(item, ctx);
  const scope = publicationScopeOf(ctx);
  const out = [];
  for (const token of PUBLICATION_TOKENS) {
    if (token === 'unposted') {
      if (facts.unposted && scope !== 'post' && scope !== 'comic') out.push('unposted');
    } else if (facts.statuses.has(token)) {
      out.push(token);
    }
  }
  return out;
}

const MODEL3D_PUBLICATION_ORDER = Object.freeze(['published', 'draft', 'unpublished']);

function model3dOfferDate (row) {
  if (!row) return '';
  const raw = row.status === 'published' ? (row.publishedAt || row.createdAt) : row.createdAt;
  const day = String(raw || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
}

export function model3dListOffer (rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(row => {
    const status = row && row.status;
    return status !== 'deleted' && status !== 'Deleted';
  });
  const counts = new Map();
  const months = new Set();
  const days = new Set();
  for (const row of list) {
    const token = row.status;
    if (token === 'published' || token === 'draft' || token === 'unpublished') {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
    const day = model3dOfferDate(row);
    if (!day) continue;
    days.add(day);
    months.add(day.slice(0, 7));
  }
  const publication = MODEL3D_PUBLICATION_ORDER.filter(token => (counts.get(token) || 0) > 0);
  const showPublication = publication.length >= 2;
  const groupAxes = [];
  if (months.size >= 2) groupAxes.push('month');
  if (days.size >= 2) groupAxes.push('day');
  if (showPublication) groupAxes.push('publication');
  const show = {
    type: false,
    typeTree: false,
    aspect: false,
    reaction: false,
    publication: showPublication,
    usedAsInput: false,
    cfg: false,
    steps: false,
    when: false,
    tags: false,
    resources: false,
    ownModels: false
  };
  const payload = { total: list.length, show, groupAxes };
  if (showPublication) payload.publication = publication;
  return payload;
}

// --- Facet application -----------------------------------------------------

function csv (params, key) {
  const v = params[key];
  if (!v) return [];
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

function someIn (values, wanted) {
  if (!wanted.length) return true;
  const set = new Set(values);
  return wanted.some(w => set.has(w));
}

// --- scope grammar (hierarchical model/resource filter) --------------------
//
// `scope` = `~`-separated terms; each term = `/`-separated, level-prefixed
// segments (values encodeURIComponent-ed). A term is a partial constraint
// (segments are an unordered set). An item matches if ANY resource slot
// (checkpoint ∪ resources[]) satisfies ALL segments of ANY term.
//
// Prefixes: t.<ModelType> | b.<baseModel> | e.<ecosystem> | m.<modelId>
// | v.<versionId> | mn.<modelName> (id-less / legacy)
// | o.<family output type> | f.<family id>.
// See explorer-url-protocol.md. `e.` remains valid for old bookmarks;
// the FacetBar emits `b.` (Civitai's Base model token). `f.` / `o.` are
// the 3D generator-family rows.

const SCOPE_PREFIX = {
  t: 'type',
  b: 'baseModel',
  e: 'ecosystem',
  m: 'modelId',
  v: 'versionId',
  mn: 'modelName',
  o: 'familyOutput',
  f: 'familyId'
};

const SCOPE_SERIALIZE_ORDER = ['type', 'baseModel', 'ecosystem', 'modelId', 'modelName', 'versionId', 'familyOutput', 'familyId'];
const SCOPE_SERIALIZE_PREFIX = {
  type: 't',
  baseModel: 'b',
  ecosystem: 'e',
  modelId: 'm',
  modelName: 'mn',
  versionId: 'v',
  familyOutput: 'o',
  familyId: 'f'
};

/**
 * Resource-slot tuples used by `matchesScope`. Each slot is
 * `{ type, ecosystem, modelId, versionId, modelName }`. Cache-hydrated so a
 * post-only `{ type, versionId }` can still satisfy an `m.` / `e.` term.
 */
export function itemScopeTuples (item, getModelVersion = () => null) {
  const out = [];
  const seen = new Set();
  for (const r of hydratedResourceSlots(item, getModelVersion)) {
    const assignment = assignModelFamily({
      baseModel: r.baseModel,
      airEcosystem: r.air?.ecosystem,
      versionId: r.versionId
    });
    const fam = assignment?.familyId ? getModelFamily(assignment.familyId) : null;
    const tuple = {
      type: r.type || 'Other',
      baseModel: (typeof r.baseModel === 'string' && r.baseModel) ? r.baseModel : '',
      ecosystem: r.air?.ecosystem || '',
      modelId: r.modelId != null && r.modelId !== '' ? String(r.modelId) : '',
      versionId: r.versionId != null && r.versionId !== '' ? String(r.versionId) : '',
      modelName: (r.modelName && r.modelName !== '(unknown)') ? r.modelName : '',
      familyId: fam?.id || '',
      familyOutput: fam?.outputType || ''
    };
    const key = `${tuple.type}\0${tuple.baseModel}\0${tuple.ecosystem}\0${tuple.modelId}\0${tuple.versionId}\0${tuple.modelName}\0${tuple.familyId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tuple);
  }
  const fallback = generatorFamilyForItem(item);
  if (fallback) {
    out.push({
      type: '',
      baseModel: '',
      ecosystem: '',
      modelId: '',
      versionId: '',
      modelName: '',
      familyId: fallback.familyId,
      familyOutput: 'model3d'
    });
  }
  return out;
}

function parseScopeSegment (raw) {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot < 1) return null;
  const field = SCOPE_PREFIX[raw.slice(0, dot)];
  if (!field) return null;
  let value = raw.slice(dot + 1);
  try { value = decodeURIComponent(value); } catch { /* keep raw */ }
  if (!value) return null;
  return { field, value };
}

/** Parse a `scope=` param into an array of term objects. Empty / absent → []. */
export function parseScope (param) {
  if (!param) return [];
  const terms = [];
  for (const rawTerm of String(param).split('~')) {
    if (!rawTerm) continue;
    const term = {};
    for (const rawSeg of rawTerm.split('/')) {
      const seg = parseScopeSegment(rawSeg);
      if (!seg) continue;
      term[seg.field] = seg.value;
    }
    if (Object.keys(term).length) terms.push(term);
  }
  return terms;
}

function serializeScopeTerm (term) {
  if (!term || typeof term !== 'object') return '';
  const segs = [];
  for (const field of SCOPE_SERIALIZE_ORDER) {
    const value = term[field];
    if (value == null || value === '') continue;
    // Prefer `m.` over `mn.` when both are present (id is the stable key).
    if (field === 'modelName' && term.modelId) continue;
    segs.push(`${SCOPE_SERIALIZE_PREFIX[field]}.${encodeURIComponent(String(value))}`);
  }
  return segs.join('/');
}

/** Serialize term objects back to the `scope=` param form. */
export function serializeScopeTerms (terms) {
  if (!Array.isArray(terms) || !terms.length) return '';
  return terms.map(serializeScopeTerm).filter(Boolean).join('~');
}

function tupleMatchesTerm (tuple, term) {
  if (term.type != null && (tuple.type || 'Other') !== term.type) return false;
  if (term.baseModel != null && (tuple.baseModel || '') !== term.baseModel) return false;
  if (term.ecosystem != null && (tuple.ecosystem || '') !== term.ecosystem) return false;
  if (term.modelId != null && String(tuple.modelId || '') !== String(term.modelId)) return false;
  if (term.modelName != null && (tuple.modelName || '') !== term.modelName) return false;
  if (term.versionId != null && String(tuple.versionId || '') !== String(term.versionId)) return false;
  if (term.familyOutput != null && (tuple.familyOutput || '') !== term.familyOutput) return false;
  if (term.familyId != null && (tuple.familyId || '') !== term.familyId) return false;
  return true;
}

/**
 * OR-of-terms, prefix/subtree match: an item matches if any resource slot
 * satisfies every segment of any term. Empty terms → no constraint.
 */
function mineOn (params) {
  return params?.mine === '1' || params?.mine === 'true' || params?.mine === true;
}

function slotInOwnSet (item, ctx) {
  const ids = ctx?.ownModels?.ids;
  if (!ids || !ids.size) return false;
  return itemScopeTuples(item, ctx.getModelVersion).some(t => t.modelId && ids.has(String(t.modelId)));
}

/**
 * Model dimension: `scope` and live `mine`. Unknown own-models record
 * (no file, or another username) does not apply `mine`.
 */
function matchesModelDimension (item, params, ctx) {
  const terms = parseScope(params?.scope);
  const scopeOk = !terms.length || anyMemberOrSelf(
    item, ctx, it => matchesScope(it, terms, ctx.getModelVersion)
  );
  const wantMine = mineOn(params);
  const known = ctx?.ownModels?.known === true;
  if (!wantMine || !known) return scopeOk;
  const mineOk = anyMemberOrSelf(item, ctx, it => slotInOwnSet(it, ctx));
  if (!terms.length) return mineOk;
  return scopeOk || mineOk;
}

export function matchesScope (item, terms, getModelVersion = () => null) {
  if (!Array.isArray(terms) || !terms.length) return true;
  const tuples = itemScopeTuples(item, getModelVersion);
  if (!tuples.length) return false;
  return terms.some(term => tuples.some(tuple => tupleMatchesTerm(tuple, term)));
}

export const PUBLICATION_TOKENS = Object.freeze([
  'published', 'scheduled', 'draft', 'unpublished', 'unposted'
]);
const POSTED_PUBLICATION_TOKENS = Object.freeze(['published', 'scheduled', 'draft']);

function wantedPublication (params) {
  const tokens = csv(params, 'publication').filter(t => PUBLICATION_TOKENS.includes(t));
  if (tokens.length) return tokens;
  // Dual-read leftover status= (pre-_v=4 / in-flight) when publication is absent.
  const statusTokens = csv(params, 'status').filter(t => PUBLICATION_TOKENS.includes(t));
  if (statusTokens.length) return statusTokens;
  // Legacy inPost: 1 = any posted status (post or comic chapter); 0 = unposted.
  if (params.inPost === '1') return [...POSTED_PUBLICATION_TOKENS];
  if (params.inPost === '0') return ['unposted'];
  return [];
}

function publicationScopeOf (ctx) {
  const s = ctx?.publicationScope;
  return s === 'post' || s === 'comic' || s === 'model3d' ? s : 'all';
}

function publicationFactsFromContainers (containers, now, scope = 'all') {
  const posts = Array.isArray(containers?.posts) ? containers.posts : [];
  const comics = Array.isArray(containers?.comics) ? containers.comics : [];
  const statuses = new Set();
  if (scope !== 'comic') {
    for (const ref of posts) statuses.add(derivePostStatus(ref?.publishedAt, now));
  }
  if (scope !== 'post') {
    for (const ref of comics) statuses.add(chapterPublicationStatus(ref?.chapterStatus));
  }
  const unposted = scope === 'post'
    ? posts.length === 0
    : scope === 'comic'
      ? comics.length === 0
      : posts.length === 0 && comics.length === 0;
  return { statuses, unposted };
}

function collectPublicationFacts (item, ctx) {
  const now = ctx.now ?? Date.now();
  const scope = publicationScopeOf(ctx);
  if (item.containers) return publicationFactsFromContainers(item.containers, now, scope);
  if (!Array.isArray(item.media)) return { statuses: new Set(), unposted: true };
  const statuses = new Set();
  let anyResolved = false;
  let allUnposted = true;
  for (const m of item.media) {
    const mi = resolveMemberMedia(m, ctx);
    if (!mi) continue;
    anyResolved = true;
    const facts = publicationFactsFromContainers(mi.containers, now, scope);
    for (const s of facts.statuses) statuses.add(s);
    if (!facts.unposted) allUnposted = false;
  }
  if (!anyResolved) return { statuses: new Set(), unposted: true };
  // Statuses are a union (any member). Unposted is only true when every
  // resolved member is unposted — a mixed batch is not "Not in a post or comic".
  return { statuses, unposted: allUnposted };
}

function matchesOwnPublicationStatus (itemStatus, wanted) {
  // Unposted never matches a post/comic entry.
  return wanted.some(token => token !== 'unposted' && token === itemStatus);
}

function matchesPublication (item, params, ctx) {
  const wanted = wantedPublication(params);
  if (!wanted.length) return true;
  const scope = publicationScopeOf(ctx);
  if (item.type === 'post') {
    if (scope === 'comic') return false;
    return matchesOwnPublicationStatus(item.status, wanted);
  }
  if (item.type === 'comic') {
    if (scope === 'post') return false;
    return matchesOwnPublicationStatus(item.status, wanted);
  }
  if (item.type === 'model3d') {
    if (scope === 'post' || scope === 'comic') return false;
    return matchesOwnPublicationStatus(item.status, wanted);
  }
  const facts = collectPublicationFacts(item, ctx);
  return wanted.some(token => (
    token === 'unposted' ? facts.unposted : facts.statuses.has(token)
  ));
}

function itemUsedAsInput (item, ctx) {
  if (Array.isArray(item.usedAsInput) && item.usedAsInput.length > 0) return true;
  if (item.containers) return false;
  if (!Array.isArray(item.media)) return false;
  return item.media.some(m => {
    const mi = resolveMemberMedia(m, ctx);
    return Array.isArray(mi?.usedAsInput) && mi.usedAsInput.length > 0;
  });
}

function matchesUsedAsInput (item, params, ctx) {
  if (params.usedAsInput !== '1' && params.usedAsInput !== true) return true;
  return itemUsedAsInput(item, ctx);
}

function listsOverlap (values, wanted) {
  if (!wanted.length || !values?.length) return false;
  const set = new Set(values);
  return wanted.some(w => set.has(w));
}

/**
 * Union of `type`, `workflowMode`, and exact `workflow`. Unconstrained when
 * all three are empty. `type=image` includes an item with no workflow.
 * `workflowMode=T2I` hits `txt2img` and `txt2img:face-fix`. `workflow=txt2img`
 * does not hit `txt2img:hires-fix`. `workflowMode=none:image` hits that
 * gallery type only when the workflow is not an offered media workflow.
 * A missing or non-string workflow contributes no abbreviation and no
 * identifier. An unknown `workflowMode` token matches nothing. Does not throw.
 *
 * Hand-typed `type=image&workflow=txt2img` is every image plus any item with
 * that identifier. Hand-typed `workflowMode=T2I&workflow=txt2img:face-fix` is
 * every T2I item. `scope` stays AND-ed with this dimension in `matchesFacets`.
 *
 * @param {object} item
 * @param {object} params
 * @returns {boolean}
 */
export function matchesTypeWorkflow (item, params) {
  const types = csv(params || {}, 'type');
  const modes = csv(params || {}, 'workflowMode');
  const wfs = csv(params || {}, 'workflow');
  if (!types.length && !modes.length && !wfs.length) return true;
  const raw = item?.params?.workflow;
  const workflow = typeof raw === 'string' ? raw : '';
  const family = parseWorkflowFamily(workflow);
  const offered = family.offered;
  const abbrev = offered ? family.abbreviation : '';
  const present = item && typeof item === 'object' ? itemTypes(item) : [];
  let hit = false;
  if (types.length) hit = hit || listsOverlap(present, types);
  if (modes.length) {
    for (const token of modes) {
      if (isWorkflowRemainderToken(token)) {
        const galleryType = remainderTypeOf(token);
        const leafOfThisType = offered && !!abbrev && family.category === galleryType;
        hit = hit || (present.includes(galleryType) && !leafOfThisType);
      } else if (abbrev && abbrev === token) {
        hit = true;
      }
    }
  }
  if (wfs.length) hit = hit || (workflow !== '' && wfs.includes(workflow));
  return hit;
}

/**
 * Apply every facet present in `params` to a single item. `ctx` may carry
 * `now` (for read-time post scheduled vs published) and `mediaById` (the
 * index Map, for batch-grain union of member media items).
 *
 * `normalizeId` is injected (the UI and server share the id-space defined
 * in `src/mediaId.mjs`); the caller passes `normalizeMediaId`.
 */
export function matchesFacets (item, params, searchField, ctx = {}) {
  if (!matchesTags(item, csv(params, 'tag'), ctx)) return false;
  if (!matchesReactions(item, csv(params, 'reaction'), ctx)) return false;
  if (!anyMemberOrSelf(item, ctx, it => matchesTypeWorkflow(it, params))) return false;
  if (!anyMemberOrSelf(item, ctx, it => someIn(itemEcosystems(it, ctx.getModelVersion), csv(params, 'ecosystem')))) return false;
  if (!anyMemberOrSelf(item, ctx, it => someIn(itemModels(it, ctx.getModelVersion), csv(params, 'model')))) return false;
  if (!anyMemberOrSelf(item, ctx, it => someIn(itemVersions(it, ctx.getModelVersion), csv(params, 'version')))) return false;
  // versionId: the Models-tree leaf scope (by immutable id, across all slots).
  if (!anyMemberOrSelf(item, ctx, it => someIn(itemVersionIds(it), csv(params, 'versionId')))) return false;
  if (!anyMemberOrSelf(item, ctx, it => someIn(itemResourceTypes(it, ctx.getModelVersion), csv(params, 'resourceType')))) return false;
  if (!anyMemberOrSelf(item, ctx, it => someIn(itemResources(it, ctx.getModelVersion), csv(params, 'resource')))) return false;
  if (!anyMemberOrSelf(item, ctx, it => itemMatchesAspect(it, csv(params, 'aspect')))) return false;

  // Hierarchical scope, OR a live `mine=1` (account-published model ids on
  // ctx.ownModels). An unknown record ignores `mine`. A known empty set
  // matches nothing. Other facets still AND with this dimension.
  if (!matchesModelDimension(item, params, ctx)) return false;
  if (params?.familyId != null && params.familyId !== '') {
    const want = String(params.familyId);
    const hit = anyMemberOrSelf(item, ctx, it => {
      const fam = generatorFamilyForItem(it);
      return fam != null && fam.familyId === want;
    });
    if (!hit) return false;
  }

  // Date range (inclusive). Compare on the YYYY-MM-DD prefix so a `dateTo`
  // of 2025-06-30 includes everything on that day regardless of time.
  // Media items with several generation occurrences match if ANY day is in
  // range. itemDate itself is unchanged (newest) so sort/badge stay newest.
  const dateFrom = params.dateFrom;
  const dateTo = params.dateTo;
  if (dateFrom || dateTo) {
    if (item.occurrenceDates?.length) {
      const inRange = item.occurrenceDates.some(d => {
        const day = String(d).slice(0, 10);
        if (!day) return false;
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        return true;
      });
      if (!inRange) return false;
    } else {
      const d = itemDate(item).slice(0, 10);
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
    }
  }

  // Numeric ranges (generation/media-item views; post/comic = any member).
  const cfgMin = num(params.cfgMin);
  const cfgMax = num(params.cfgMax);
  if (cfgMin != null || cfgMax != null) {
    const ok = anyMemberOrSelf(item, ctx, it => {
      const c = itemCfg(it);
      if (c == null) return false;
      if (cfgMin != null && c < cfgMin) return false;
      if (cfgMax != null && c > cfgMax) return false;
      return true;
    });
    if (!ok) return false;
  }
  const stepsMin = num(params.stepsMin);
  const stepsMax = num(params.stepsMax);
  if (stepsMin != null || stepsMax != null) {
    const ok = anyMemberOrSelf(item, ctx, it => {
      const s = itemSteps(it);
      if (s == null) return false;
      if (stepsMin != null && s < stepsMin) return false;
      if (stepsMax != null && s > stepsMax) return false;
      return true;
    });
    if (!ok) return false;
  }

  // publication= (OR of published | scheduled | draft | unposted). Origin
  // scope: ctx.publicationScope 'post' | 'comic' | 'all' (default). Dual-read
  // leftover status= when publication is absent. Legacy inPost=1/0 expands
  // to posted / unposted when both are absent.
  if (!matchesPublication(item, params, ctx)) return false;
  if (!matchesUsedAsInput(item, params, ctx)) return false;
  if (!matchesTitleParam(item, params.title, ctx)) return false;

  return matchesSearch(item, params.q, searchField, ctx);
}

export function applyFacets (items, params, searchField, ctx = {}) {
  return items.filter(item => matchesFacets(item, params, searchField, ctx));
}

// --- Media-item shape adapter (Phase 4 ruling 4) ---------------------------

/**
 * Bridge the flat `mediaItems` projection (serverIndex's
 * `getIndex().mediaItems`) to the generation/post ENTRY shape the facet
 * extractors above were written for. The projection is flat — `type` is the
 * media type, `aspectClass` / `date` are top-level — whereas the extractors
 * read `item.media[].type`, branch on `item.type === 'generation'` for
 * aspect/date, and read `item.createdAt`. This is a SHAPE map only; the
 * filtering logic is never reimplemented.
 *
 * Exports' C1a introduced this as `toFilterableEntry` inside `src/exports.mjs`;
 * Phase 4 lifts it here so it has a single home and both consumers — Exports'
 * `evaluateExport` and the `/api/media` endpoint — run `applyFacets` over
 * media-items through the same adapter (closing the projection/entry shape seam
 * the Exports phase flagged). The original media item is preserved on `_source`
 * so callers can unwrap the projected record after filtering.
 */
export function mediaItemToFilterable (mediaItem) {
  const occurrenceDates = [];
  const seenDays = new Set();
  for (const g of mediaItem.containers?.generations || []) {
    const day = g?.batchDate ? String(g.batchDate).slice(0, 10) : '';
    if (!day || seenDays.has(day)) continue;
    seenDays.add(day);
    occurrenceDates.push(day);
  }
  return {
    ...mediaItem,
    type: 'generation',
    createdAt: mediaItem.date,
    media: [{
      mediaId: mediaItem.id,
      type: mediaItem.type,
      aspectClass: mediaItem.aspectClass,
      width: mediaItem.width,
      height: mediaItem.height
    }],
    occurrenceDates,
    _source: mediaItem
  };
}

// --- Sort ------------------------------------------------------------------

const SORT_DEFAULT_DIR = {
  date: 'desc', published: 'desc', count: 'desc', name: 'asc',
  hearts: 'desc', likes: 'desc', dislikes: 'desc', comments: 'desc', collected: 'desc'
};

export function parseSort (param) {
  // Defensive: legacy Phase 2 tokens map to the protocol form even though
  // the _v=1→2 migration rewrites bookmarks (steward ruling 4). API params
  // are not bookmarked, so this is belt-and-braces for an in-flight tab.
  if (param === 'newest' || !param) return { field: 'date', dir: 'desc' };
  if (param === 'oldest') return { field: 'date', dir: 'asc' };
  const [field, dir] = String(param).split(':');
  const f = field || 'date';
  const d = dir === 'asc' || dir === 'desc' ? dir : (SORT_DEFAULT_DIR[f] || 'desc');
  return { field: f, dir: d };
}

function sortValue (item, field) {
  switch (field) {
    case 'published':
      // Comics: project publishedAt is leftover after unpublish (3452).
      // Drafts have no publication date; published/scheduled use itemDate.
      if (item.type === 'comic') {
        return comicItemStatus(item) === 'draft' ? '' : itemDate(item);
      }
      if (item.type === 'model3d') {
        return item.status === 'published' ? (item.publishedAt || '') : '';
      }
      return item.publishedAt || '';
    case 'hearts': return num(item.stats?.heartCount) ?? 0;
    case 'likes': return num(item.stats?.likeCount) ?? 0;
    case 'dislikes': return num(item.stats?.dislikeCount) ?? 0;
    case 'comments': return num(item.stats?.commentCount) ?? 0;
    case 'collected': return num(item.stats?.collectedCount) ?? 0;
    case 'date':
    default: return itemDate(item);
  }
}

export function applySort (items, sort) {
  // Accept a raw `sort` string (incl. undefined → default), or a
  // pre-parsed { field, dir } object.
  const { field, dir } = (sort && typeof sort === 'object') ? sort : parseSort(sort);
  const factor = dir === 'asc' ? 1 : -1;
  const decorated = items.map((item, i) => ({ item, i, key: sortValue(item, field) }));
  decorated.sort((a, b) => {
    let cmp;
    if (typeof a.key === 'number' && typeof b.key === 'number') cmp = a.key - b.key;
    else cmp = String(a.key).localeCompare(String(b.key));
    if (cmp !== 0) return cmp * factor;
    return a.i - b.i; // stable
  });
  return decorated.map(d => d.item);
}

// --- Group-by --------------------------------------------------------------

const VALID_GROUP_AXES = new Set([
  'model', 'version', 'ecosystem', 'resourceType', 'month', 'day',
  'aspect', 'sampler', 'status', 'publication', 'resource'
]);

/**
 * Group keys for an item on a given axis. Returns an array because some
 * axes (`resource`) place one item in several sections; single-valued axes
 * return a one-element array. An empty string key collects the "no value"
 * bucket.
 */
export function groupKeysFor (item, axis, getModelVersion = () => null) {
  switch (axis) {
    case 'model': return [resolveModelGroupKey(item, getModelVersion)];
    case 'version': return [item.checkpoint?.versionName || ''];
    case 'ecosystem': return [item.checkpoint?.air?.ecosystem || (itemEcosystems(item, getModelVersion)[0] || '')];
    case 'resourceType': {
      const types = itemResourceTypes(item, getModelVersion);
      return types.length ? types : [''];
    }
    case 'month': return [itemDate(item).slice(0, 7)];
    case 'day': return [itemDate(item).slice(0, 10)];
    case 'aspect': return [item.type === 'generation' ? (item.aspectClass || '') : (itemAspects(item)[0] || '')];
    case 'sampler': return [item.params?.sampler || ''];
    case 'publication':
    case 'status': return [item.status || ''];
    case 'resource': {
      const names = itemResources(item, getModelVersion);
      return names.length ? names : [''];
    }
    default: return [''];
  }
}

export function groupLabel (axis, key) {
  if (!key) {
    if (axis === 'resource') return 'No resource';
    if (axis === 'model') return 'No model';
    return 'Unknown';
  }
  if (axis === 'model' && String(key).startsWith('family:')) {
    const id = String(key).slice('family:'.length);
    return getModelFamily(id)?.label || id;
  }
  if (axis === 'ecosystem') return getEcosystemDisplayName(key) || key;
  return key;
}

/**
 * Build the grouped shape `{ groups: [{ key, label, count, items }] }`.
 * Items within each group are sorted by `sort`; groups are ordered by
 * `groupSort` (defaults to count:desc). O(N) over the filtered input.
 * Callers that page a gallery should use `paginateGrouped` (item pages +
 * group metadata) rather than slicing this array — pages-of-groups was
 * steward ruling 6 and is superseded.
 */
export function groupItems (items, axis, { sort, groupSort, getModelVersion } = {}) {
  const map = new Map();
  for (const item of items) {
    for (const key of groupKeysFor(item, axis, getModelVersion)) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
  }

  let groups = [...map.entries()].map(([key, groupItemsArr]) => ({
    key,
    label: groupLabel(axis, key),
    count: groupItemsArr.length,
    items: sort ? applySort(groupItemsArr, sort) : groupItemsArr
  }));

  const gs = parseGroupSort(groupSort);
  const factor = gs.dir === 'asc' ? 1 : -1;
  groups.sort((a, b) => {
    let cmp;
    if (gs.field === 'name') cmp = String(a.label).localeCompare(String(b.label));
    else cmp = a.count - b.count; // count
    if (cmp !== 0) return cmp * factor;
    return String(a.key).localeCompare(String(b.key));
  });

  return groups;
}

function parseGroupSort (param) {
  if (!param) return { field: 'count', dir: 'desc' };
  const [field, dir] = String(param).split(':');
  const f = field === 'name' ? 'name' : 'count';
  const d = dir === 'asc' || dir === 'desc' ? dir : SORT_DEFAULT_DIR[f];
  return { field: f, dir: d };
}

export function isValidGroupAxis (axis) {
  return typeof axis === 'string' && axis !== 'none' && VALID_GROUP_AXES.has(axis);
}

/**
 * Item-paginate a grouped, sorted set. Groups become metadata
 * `{ key, label, count, offset }` — no members — so a page never ships more
 * than `limit` items regardless of bucket size. `offset` is the index of the
 * group's first item in the flattened (group-order, in-group-sort) sequence.
 * `total` is the flattened item count (not the group count).
 */
export function paginateGrouped (filtered, { groupBy, sort, groupSort, page, limit, getModelVersion }) {
  const groups = groupItems(filtered, groupBy, { sort, groupSort, getModelVersion });
  let offset = 0;
  const meta = [];
  const flat = [];
  for (const g of groups) {
    meta.push({ key: g.key, label: g.label, count: g.count, offset });
    for (const it of g.items) flat.push(it);
    offset += g.items.length;
  }
  const total = flat.length;
  const start = (Math.max(1, page) - 1) * limit;
  return { items: flat.slice(start, start + limit), groups: meta, total };
}

// --- Tile DTO (gallery list payload) ---------------------------------------

const MEDIA_ITEM_TYPES = new Set(['image', 'video', 'audio', 'model3d']);

// Local still for a thumbnail. The first cover input that has a file.
// Empty string when the cover was not captured. Playback stays thumbnailPath.
export function coverPathOf (item) {
  const inputs = item?.inputs;
  if (!Array.isArray(inputs)) return '';
  for (const inp of inputs) {
    if (inp && inp.role === 'cover' && inp.thumbnailPath) return inp.thumbnailPath;
  }
  return '';
}

function trimmedMediaTitle (value) {
  return String(value || '').trim();
}

function songTitleOf (entry) {
  if (!entry || typeof entry !== 'object') return '';
  const fromAudio = trimmedMediaTitle(entry.audio && entry.audio.title);
  if (fromAudio) return fromAudio;
  if (MEDIA_ITEM_TYPES.has(entry.type)) return trimmedMediaTitle(entry.title);
  return '';
}

function lightMedia (m, ctx) {
  const raw = m.mediaId ?? m.imageId ?? m.id;
  const resolved = ctx ? resolveMemberMedia(m, ctx) : null;
  const mediaId = (resolved && resolved.id != null && resolved.id !== '')
    ? resolved.id
    : raw;
  const out = {
    mediaId,
    type: m.type,
    thumbnailPath: m.thumbnailPath,
    duration: m.duration,
    tags: m.tags || [],
    ...(Array.isArray(m.reactions) ? { reactions: m.reactions } : {}),
    aspectClass: m.aspectClass,
    seed: m.seed
  };
  const coverPath = coverPathOf(resolved) || coverPathOf(m);
  if (coverPath) out.coverPath = coverPath;
  const width = Number(m.width);
  const height = Number(m.height);
  if (width > 0 && height > 0) {
    out.width = width;
    out.height = height;
  }
  return out;
}

function tileInputSummary (entry) {
  const kinds = [];
  const seen = new Set();
  const add = (inp) => {
    const kind = inp?.kind;
    if (!kind || seen.has(kind)) return;
    seen.add(kind);
    kinds.push(kind);
  };
  if (Array.isArray(entry.inputs) && entry.inputs.length) {
    for (const inp of entry.inputs) add(inp);
  } else if (Array.isArray(entry.media)) {
    for (const m of entry.media) {
      if (!Array.isArray(m.inputs)) continue;
      for (const inp of m.inputs) add(inp);
    }
  }
  return { hasInputs: kinds.length > 0, inputKinds: kinds };
}

function consumedOccurrenceForOverlay (entry) {
  const gens = entry.containers?.generations;
  const edges = entry.usedAsInput;
  if (!Array.isArray(gens) || !gens.length) return null;
  if (!Array.isArray(edges) || !edges.length) return null;
  const byOccId = new Map();
  for (const g of gens) {
    if (g?.id) byOccId.set(g.id, g);
  }
  let best = null;
  for (const edge of edges) {
    const occ = edge?.generation ? byOccId.get(edge.generation) : null;
    if (!occ) continue;
    if (!best || (occ.sortKey || '') > (best.sortKey || '')) best = occ;
  }
  return best;
}

export function originFileForOverlay (entry, { origin, containerId } = {}) {
  const refs = origin === 'post'
    ? entry?.containers?.posts
    : origin === 'comic'
      ? entry?.containers?.comics
      : null;
  if (!Array.isArray(refs) || !refs.length) return null;
  let candidates = refs;
  if (containerId != null && containerId !== '') {
    candidates = refs.filter(r => String(r.id) === String(containerId));
    if (!candidates.length) return null;
  }
  let best = null;
  for (const r of candidates) {
    if (!r?.thumbnailPath) continue;
    if (!best || (r.sortKey || '') > (best.sortKey || '')) best = r;
  }
  return best?.thumbnailPath || null;
}

/**
 * Project an index entry (generation, post, or media-item) to the gallery
 * tile DTO. Drops entry-level detail (`prompt`, `negativePrompt`, `model`,
 * `checkpoint`, `resources`, `params`, `containers`) — those load on lightbox
 * open via `/api/generations|posts/:id`. `promptSnippet` is emitted only when
 * `q` is set (search hover). Media-item records have no `media[]`; a
 * one-element array is synthesized so GalleryItem reads one shape.
 *
 * Post tiles additionally keep the fields PostCard reads (`title`, counts,
 * `stats`). Input-media presence is a boolean + unique kinds — not the
 * full `inputs[]` / `usedAsInput` arrays (those load on detail). When
 * `usedAsInput` is on, the tile picture and hop id overlay the newest
 * consumed occurrence. `createdAt` stays the newest creation day (the
 * Date sort key). When `fileOrigin` is `post`
 * or `comic` and usedAsInput did not overlay, `thumbnailPath` overlays
 * the origin tree (`originFileForOverlay`); date is unchanged.
 * `media[].mediaId` is the canonical media-item id when `getMediaItemById`
 * is passed (joined post/comic Image ids hop onto the generation blob).
 */
export function toTile (entry, { q, usedAsInput, mediaById, normalizeId, getMediaItemById, fileOrigin, originContainerId } = {}) {
  const memberCtx = { mediaById, normalizeId, getMediaItemById };
  const hasMedia = Array.isArray(entry.media) && entry.media.length > 0;
  const media = hasMedia
    ? entry.media.map(m => lightMedia(m, memberCtx))
    : (MEDIA_ITEM_TYPES.has(entry.type) ? [lightMedia({ ...entry, mediaId: entry.id }, memberCtx)] : []);
  const { hasInputs, inputKinds } = tileInputSummary(entry);

  const reactions = Array.isArray(entry.reactions)
    ? entry.reactions.filter(isReactionToken)
    : (Array.isArray(entry.tags) ? entry.tags.filter(isReactionToken) : []);
  const tile = {
    id: entry.id,
    type: entry.type,
    createdAt: entry.createdAt ?? entry.date,
    publishedAt: entry.publishedAt,
    status: entry.status,
    mediaCount: entry.mediaCount,
    tags: entry.tags || [],
    reactions,
    contentTags: entry.contentTags || [],
    aspectClass: entry.aspectClass,
    hasInputs,
    inputKinds,
    media
  };
  if (entry.title != null) tile.title = entry.title;
  if (entry.name != null) tile.name = entry.name;
  if (entry.imageCount != null) {
    tile.imageCount = entry.imageCount;
    tile.videoCount = entry.videoCount;
    tile.audioCount = entry.audioCount;
  }
  if (entry.stats) tile.stats = entry.stats;
  if (q) {
    const needle = String(q).toLowerCase();
    const own = entry.prompt || '';
    let snippet = own.slice(0, 160);
    if (!own.toLowerCase().includes(needle) && Array.isArray(entry.media)) {
      for (const m of entry.media) {
        const mi = resolveMemberMedia(m, memberCtx);
        const p = mi?.prompt || '';
        if (p && p.toLowerCase().includes(needle)) {
          snippet = p.slice(0, 160);
          break;
        }
      }
    }
    tile.promptSnippet = snippet;
  }
  // Comic chrome must date from itemDate (chapter status), not leftover
  // project publishedAt. Other types keep using createdAt/publishedAt.
  if (entry.type === 'comic') tile.date = itemDate(entry);
  if (entry.type === 'model3d') {
    tile.date = itemDate(entry);
    tile.licenseName = entry.licenseName || '';
    tile.primaryPath = entry.primaryPath || '';
    tile.thumbnailPath = entry.thumbnailPath || '';
  }

  // Song title for the page this tile opens. A several-output batch page
  // does not use it. A one-output batch opens the media page, whose title
  // is the media item's (primary) song title.
  let songTitle = '';
  if (MEDIA_ITEM_TYPES.has(entry.type)) {
    songTitle = songTitleOf(entry);
  } else if (media.length === 1) {
    const onlyId = media[0] && media[0].mediaId;
    const lookedUp = (onlyId != null && getMediaItemById) ? getMediaItemById(onlyId) : null;
    songTitle = songTitleOf(lookedUp) || trimmedMediaTitle(entry.audio && entry.audio.title);
  }
  if (songTitle) tile.audioTitle = songTitle;

  const overlayOn = usedAsInput === '1' || usedAsInput === true;
  const consumed = overlayOn ? consumedOccurrenceForOverlay(entry) : null;
  if (consumed) {
    if (tile.media[0]) {
      tile.media[0] = { ...tile.media[0], thumbnailPath: consumed.thumbnailPath };
    }
    tile.occurrenceGenerationId = consumed.id;
  } else if (fileOrigin === 'post' || fileOrigin === 'comic') {
    const path = originFileForOverlay(entry, { origin: fileOrigin, containerId: originContainerId });
    if (path && tile.media[0]) {
      tile.media[0] = { ...tile.media[0], thumbnailPath: path };
    }
  }
  return tile;
}

/**
 * Produced-container test: no generation, no posts, no comics → input-only
 * (import). Missing / null item is not treated as import (do not guess).
 */
export function isInputOnlyItem (mi) {
  if (!mi || typeof mi !== 'object') return false;
  if (!mi.containers) return true;
  return mi.containers.generation == null
    && !(Array.isArray(mi.containers.posts) && mi.containers.posts.length > 0)
    && !(Array.isArray(mi.containers.comics) && mi.containers.comics.length > 0);
}

function hasProducedContainer (mi) {
  const c = mi && mi.containers;
  if (!c) return false;
  return c.generation != null
    || (Array.isArray(c.posts) && c.posts.length > 0)
    || (Array.isArray(c.comics) && c.comics.length > 0);
}

function edgeWorkflow (edge) {
  return typeof edge?.workflow === 'string' ? edge.workflow : '';
}

function compareConsumerId (a, b) {
  const sa = String(normalizeMediaId(a && a.id));
  const sb = String(normalizeMediaId(b && b.id));
  if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) {
    const na = Number(sa);
    const nb = Number(sb);
    if (na !== nb) return na < nb ? -1 : 1;
    return 0;
  }
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

function collectUsedIn (edges, getItemById) {
  if (!Array.isArray(edges) || typeof getItemById !== 'function') return [];
  const byNorm = new Map();
  for (const edge of edges) {
    if (edge == null || edge.id == null || edge.id === '') continue;
    const norm = normalizeMediaId(edge.id);
    if (!norm) continue;
    const existing = byNorm.get(norm);
    if (existing) {
      if (!edgeWorkflow(existing.edge) && edgeWorkflow(edge)) existing.edge = edge;
      continue;
    }
    const item = getItemById(edge.id);
    if (!item || !item.thumbnailPath || !hasProducedContainer(item)) continue;
    byNorm.set(norm, { item, edge });
  }
  const rows = [...byNorm.values()];
  rows.sort((a, b) => compareConsumerId(a.item, b.item));
  const sortedItems = applySort(rows.map(r => r.item), 'date:desc');
  const byItem = new Map(rows.map(r => [r.item, r]));
  return sortedItems.map(item => byItem.get(item));
}

/**
 * One produced consumer per media id. First edge wins the id. Skip a
 * missing item, an item with no `thumbnailPath`, and an item with no
 * generation, post, or comic container. Survivors are id-ascending, then
 * `date:desc` (`itemDate` / `createdAt`). Equal dates keep the smaller id.
 * Empty dates sort last. `applySort` is stable.
 */
export function usedInConsumers (edges, getItemById) {
  return collectUsedIn(edges, getItemById).map(row => row.item);
}

function stampConsumerMembership (row, item) {
  const c = item && item.containers;
  row.hasGeneration = !!(c && c.generation != null);
  row.hasPost = Array.isArray(c && c.posts) && c.posts.length > 0;
  row.hasComic = Array.isArray(c && c.comics) && c.comics.length > 0;
  return row;
}

/**
 * Detail preview in collector order. Does not re-sort. When several edges
 * share an id, the row uses the first whose `workflow` is a non-empty
 * string, otherwise the first. `total` is the consumer count.
 */
export function projectUsedInPreview (edges, getItemById) {
  const collected = collectUsedIn(edges, getItemById);
  const rows = [];
  for (const { item, edge } of collected) {
    const row = projectUsedAsInputForDetail([edge], getItemById)[0];
    if (!row) continue;
    rows.push(stampConsumerMembership(row, item));
  }
  return { total: collected.length, rows };
}

/**
 * Earliest consumer date for an import header. Same choice as the Imports
 * list: the consumer's `date`, else its generation `sortKey`. Missing
 * consumers and empty dates are skipped. The import's own `date` is not read.
 * @returns {string}
 */
export function earliestUsedInDate (edges, getItemById) {
  if (!Array.isArray(edges) || typeof getItemById !== 'function') return '';
  let best = null;
  for (const edge of edges) {
    if (!edge?.id) continue;
    const producer = getItemById(edge.id);
    if (!producer) continue;
    const d = producer.date || producer.containers?.generation?.sortKey || '';
    if (!d) continue;
    const s = String(d);
    if (best == null || s < best) best = s;
  }
  return best || '';
}

/**
 * Row shape for one `usedAsInput` edge. Newest producer first when given
 * several edges (`createdAt || date`, ISO `localeCompare`; missing last).
 * Omit missing items and items with no `thumbnailPath`. Emit `{ id, role,
 * workflow, thumbnailPath, type, inputOnly }` plus `coverPath` when the
 * producer has a local cover still, plus `slot` only when present.
 * `workflow` is the edge string, or `''` when the edge omitted it — not
 * `item.params.workflow`. Drop `from` / `generation` / `createdAt`.
 * Detail sends `projectUsedInPreview` (collector order, capped by the
 * handler), not this sort over the whole edge list. Lookup is injected
 * (no CONFIG/fs).
 */
export function projectUsedAsInputForDetail (edges, getItemById) {
  if (!Array.isArray(edges) || typeof getItemById !== 'function') return [];
  const rows = [];
  for (const e of edges) {
    if (!e?.id) continue;
    const item = getItemById(e.id);
    if (!item || !item.thumbnailPath) continue;
    const out = {
      id: item.id,
      role: e.role,
      workflow: typeof e.workflow === 'string' ? e.workflow : '',
      thumbnailPath: item.thumbnailPath,
      type: item.type || 'image',
      inputOnly: isInputOnlyItem(item)
    };
    const coverPath = coverPathOf(item);
    if (coverPath) out.coverPath = coverPath;
    if (e.slot != null) out.slot = e.slot;
    rows.push({ out, sortKey: item.createdAt || item.date || '' });
  }
  rows.sort((a, b) => {
    if (!a.sortKey && !b.sortKey) return 0;
    if (!a.sortKey) return 1;
    if (!b.sortKey) return -1;
    return b.sortKey.localeCompare(a.sortKey);
  });
  return rows.map(r => r.out);
}

/**
 * Project `inputs[]` for GET /api/media/:id. Keeps existing row fields and
 * stamps `inputOnly` from the looked-up media item (produced-container test).
 */
export function projectInputsForDetail (inputs, getItemById) {
  if (!Array.isArray(inputs) || typeof getItemById !== 'function') return [];
  const out = [];
  for (const inp of inputs) {
    if (!inp?.id) continue;
    const item = getItemById(inp.id);
    out.push({
      ...inp,
      inputOnly: isInputOnlyItem(item)
    });
  }
  return out;
}
