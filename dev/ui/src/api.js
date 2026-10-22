import { createProgressSession } from './lib/progress-session.js';

const progressSession = createProgressSession({
  readStatus: () => getDownloadStatus()
});

async function fetchJson (url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJson (url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function putJson (url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function deleteJson (url) {
  const res = await fetch(url, { method: 'DELETE' });
  return res.json();
}

export function getStats () {
  return fetchJson('/api/stats');
}

// Overview activity dashboard (created vs published, by month). Resolves to
// { upcoming, months, undatedDrafts }. Computed per request; Overview holds
// no URL_SCHEMA — every interaction navigates away.
export function getOverview () {
  return fetchJson('/api/overview');
}

// Serialize a view's URL-state slice into the query string. Steward ruling
// 3: the client↔server namespace is unified on the protocol param names, so
// this is a verbatim pass-through — arrays become the comma form, booleans
// become 1/0 (usedAsInput is true-or-omit; inPost bookmarks still rewrite
// on the Generations view), numbers stringify, and null / '' /
// empty arrays are dropped. The view hands us the same keys the URL carries
// (`tag`, `q`, `sort`, `type`, `ecosystem`, …, `groupBy`) plus `page`.
function toQuery (params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) { if (value.length) qs.set(key, value.join(',')); continue; }
    if (typeof value === 'boolean') { qs.set(key, value ? '1' : '0'); continue; }
    if (value === '') continue;
    qs.set(key, String(value));
  }
  return qs.toString();
}

export function getGenerations (params = {}) {
  return fetchJson(`/api/generations?${toQuery({ limit: 50, ...params })}`);
}

export function getGeneration (id, params = {}) {
  const q = toQuery(params);
  return fetchJson(`/api/generations/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
}

export function getPosts (params = {}) {
  return fetchJson(`/api/posts?${toQuery({ limit: 50, ...params })}`);
}

export function getComics (params = {}) {
  return fetchJson(`/api/comics?${toQuery({ limit: 50, ...params })}`);
}

export function getModel3ds (params = {}) {
  return fetchJson(`/api/model3ds?${toQuery({ limit: 50, ...params })}`);
}

export function getModel3d (id, params) {
  const q = toQuery(params || {});
  return fetchJson(`/api/model3ds/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
}

// Media-item granularity. Tile DTO via the same item-paginated envelope as
// getGenerations / getPosts (`items` + optional `groups` metadata). Each tile
// carries resolved `contentTags` (`tag-<id>` fallback for an unresolved id).
export function getMedia (params = {}) {
  return fetchJson(`/api/media?${toQuery({ limit: 50, ...params })}`);
}

// Full media-item record for the lightbox. Distinct from the list `getMedia`.
// Resolves to `{ index: <full media item>, raw: <parent JSON | null> }`.
// `generation` / `origin` / `post` / `comic` are fetch-only file overlays.
// Remaining keys are the origin-list query (`from`, `granularity`, facets,
// sort, groupBy, groupSort, q, title, slot) — never put list scope in
// fetch-only `origin=`.
export function getMediaDetail (id, opts = {}) {
  const { generation, origin, post, comic, ...originParams } = opts;
  const qs = new URLSearchParams();
  if (generation) qs.set('generation', generation);
  if (origin) qs.set('origin', origin);
  if (post) qs.set('post', post);
  if (comic) qs.set('comic', comic);
  const originQs = toQuery(originParams);
  if (originQs) {
    for (const [k, v] of new URLSearchParams(originQs)) {
      if (k === 'origin' || k === 'generation' || k === 'post' || k === 'comic') continue;
      qs.set(k, v);
    }
  }
  const q = qs.toString();
  return fetchJson(`/api/media/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
}

// Distinct facet values for FacetBar option lists, ordered by use-count desc.
// axis ∈ types | aspects | resourceTypes | reactionTags | ecosystems | models |
// versions | resources | tags | workflows. Chip groups eager-fetch; large multi-selects
// lazy-fetch on first open. Values are corpus-derived (media-present).
export function getFacetValues (axis, params = {}) {
  const q = toQuery(params);
  return fetchJson(`/api/facets/${axis}${q ? `?${q}` : ''}`);
}

// Full-depth corpus-present nested tree for the Models picker.
// { types: [{ key, label, count, baseModels: [{ … models: [{ … versions }] }] }] }
export function getModelHierarchy (params = {}) {
  const q = toQuery(params);
  return fetchJson(`/api/facets/model-tree${q ? `?${q}` : ''}`);
}

// Inclusive YYYY-MM-DD bounds of itemDate over media-present entries.
// { min, max } — either side null when the corpus is empty.
export function getDateBounds (params = {}) {
  const q = toQuery(params);
  return fetchJson(`/api/facets/date-bounds${q ? `?${q}` : ''}`);
}

// Two-level Aspect Ratio tree. FacetBar reads offer `aspect.classes`
// (zero-count parents already omitted) and adapts that shape. This endpoint
// still returns every orientation parent, including count 0.
export function getAspectTree (params = {}) {
  const q = toQuery(params);
  return fetchJson(`/api/facets/aspect-tree${q ? `?${q}` : ''}`);
}

// Type → mode abbreviation → workflow identifier. Counts are media items
// in the same origin walk as the aspect tree.
export function getTypeWorkflowTree (params = {}) {
  const q = toQuery(params);
  return fetchJson(`/api/facets/type-tree${q ? `?${q}` : ''}`);
}

// List-scoped FacetBar offer: which controls / options can change this list.
// One cached walk per origin + grain. Not cross-filtered.
export function getListOffer (params = {}) {
  const q = toQuery(params);
  return fetchJson(`/api/facets/offer${q ? `?${q}` : ''}`);
}

function csvQuery (value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(',');
  if (value == null || value === '') return '';
  return String(value);
}

// Models catalog (no modelId) or model page. Catalog filters are csv
// `resourceType` / `family` / `variant`. The model page takes `modelId`
// (numeric) and optional `versionId` (selected version; server defaults to
// latest lastUsed). A selected version may include `resource` (Open on
// Civitai plus version-cache dates / trigger words / about).
export function getModels ({ resourceType, family, variant, modelId, versionId, mine } = {}) {
  const qs = new URLSearchParams();
  const rt = csvQuery(resourceType);
  const fam = csvQuery(family);
  const vari = csvQuery(variant);
  if (rt) qs.set('resourceType', rt);
  if (fam) qs.set('family', fam);
  if (vari) qs.set('variant', vari);
  if (mine === true || mine === '1') qs.set('mine', '1');
  if (modelId != null && modelId !== '') qs.set('modelId', String(modelId));
  if (versionId != null && versionId !== '') qs.set('versionId', String(versionId));
  const s = qs.toString();
  return fetchJson(`/api/models${s ? `?${s}` : ''}`);
}

export function getPost (id, params = {}) {
  const q = toQuery(params);
  return fetchJson(`/api/posts/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
}

export function getComic (id, params = {}) {
  const q = toQuery(params);
  return fetchJson(`/api/comics/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
}

export function getConfig () {
  return fetchJson('/api/config');
}

export function getUiPrefs () {
  return fetchJson('/api/ui-prefs');
}

export function patchUiPrefs (body) {
  return fetch('/api/ui-prefs', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json());
}

export function updateConfig (updates) {
  return putJson('/api/config', updates);
}

export function getDownloadStatus () {
  return fetchJson('/api/download/status');
}

export function startDownloadQueue (body) {
  return postJson('/api/download/queue', body);
}

export function saveDownloadModes (body) {
  return postJson('/api/download/modes', body);
}

export function startDownload (type, mode, { checkAllMedia = false } = {}) {
  const body = { mode };
  if (checkAllMedia === true && type !== 'generations') body.checkAllMedia = true;
  return postJson(`/api/download/${type}`, body);
}

export function abortDownload () {
  return postJson('/api/download/abort', {});
}

export function rebuildIndex () {
  return postJson('/api/index/rebuild', {});
}

export function getModelCacheStatus () {
  return fetchJson('/api/model-cache/status');
}

export function refreshModelCache (force = false) {
  return postJson('/api/model-cache/refresh', { force });
}

export function abortModelCacheRefresh () {
  return postJson('/api/model-cache/abort', {});
}

export function saveApiKey (body) {
  return postJson('/api/key', body);
}

export function deleteApiKey () {
  return postJson('/api/key/delete', {});
}

export function protectApiKey (body) {
  return postJson('/api/key/password', body);
}

export function unprotectApiKey (body) {
  return postJson('/api/key/unprotect', body);
}

export function unlockKey (password) {
  return postJson('/api/unlock', { password });
}

export function refreshUser () {
  return postJson('/api/user/refresh', {});
}

// Open a local folder in the OS file manager. A media-file path (lightbox
// thumbnailPath) is revealed/selected when that file exists on disk;
// folder-only paths (Settings roots, Export dest) still open the folder.
// `mediaPath` is a `/media/{generations,posts,comics,inputs,model3ds,exports}/…` URL
// (lightbox thumbnailPath, or an export dest rewritten onto
// `/media/exports/<slug>`), an absolute custom export destination, the
// configured data/media root (as stored in config), or the Settings
// sentinels `/data` and `/media`.
export function openFolder (mediaPath) {
  return postJson('/api/open-folder', { path: mediaPath });
}

// Reveal several media files in the same directory (POST { paths }).
// Mixed directories are rejected by the server.
export function openFiles (paths) {
  return postJson('/api/open-folder', { paths });
}

// Reveal a saved container JSON in the OS file manager (select the file;
// do not open it). `type` is generation | post | comic; `id` is that
// container's id — the viewed surface, not generation-first raw.
export function openJson (type, id) {
  return postJson('/api/open-folder', { json: { type, id } });
}

// Set a single media item's reactions. `body` is a partial
// { favorite?, feedback? } — the server normalizes the id, merges against the
// current effective state, and stores an override only when it diverges from
// Civitai. Resolves to { ok, mediaItemId, tags, hasOverride }.
export function setReaction (mediaItemId, body) {
  return fetch(`/api/media/${encodeURIComponent(mediaItemId)}/reactions`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json());
}

// Batch-set reactions for a multi-select. `items` is
// [{ mediaItemId, favorite?, feedback? }, ...]; the server groups by parent
// generation. Resolves to { ok, items: [{ mediaItemId, tags, hasOverride }] }.
export function setReactions (items) {
  return fetch(`/api/media/reactions`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  }).then(r => r.json());
}

// --- Exports (C1c consumes the C1b /api/exports surface) -------------------
//
// The list rows arrive with the in-memory status the server already computed
// (idle | syncing | pending | error) — drift is read when the list is opened,
// never polled in the background. `query` is the persistable URL_SCHEMA subset
// in protocol (comma) form; the server sanitises it again on write.

export function listExports () {
  return fetchJson('/api/exports');
}

export function getExport (slug) {
  return fetchJson(`/api/exports/${encodeURIComponent(slug)}`);
}

export function createExport (body) {
  return postJson('/api/exports', body);
}

export function updateExport (slug, patch) {
  return putJson(`/api/exports/${encodeURIComponent(slug)}`, patch);
}

// Detach (`deleteFiles` false) drops the export record and leaves the folder.
// Delete files also removes an owned `media/exports/<slug>` directory, or this
// export's files in a custom folder. The record stays when that did not
// succeed (`ok: false`, `error` incomplete / unsafe-root / shared-destination).
// Downloaded originals are never the target. The destination itself is changed
// with Edit, not a separate control.
// Files Delete files would unlink. `{ files: 0 }` is an empty or missing
// folder. A non-OK response throws so the row can keep the confirm note.
export function removalFileCount (slug) {
  return fetchJson(`/api/exports/${encodeURIComponent(slug)}/removal`);
}

export function deleteExport (slug, { deleteFiles = false } = {}) {
  const qs = deleteFiles ? '?files=1' : '';
  return deleteJson(`/api/exports/${encodeURIComponent(slug)}${qs}`);
}

// Dry-run plan (C1d): the exact { mode, linkMode, add, remove, bytesNeeded,
// estimatedSeconds, warnings } the real sync would apply, computed WITHOUT
// applying it or scheduling a job. `mode` is the plan-gate verdict
// ('auto' | 'confirm'); the create/edit Save flow uses it to apply silently
// or to show the preview and await an explicit confirm. May also resolve to
// { pending, reason } (destination offline) or { error } (404).
export function planExport (slug) {
  return postJson(`/api/exports/${encodeURIComponent(slug)}/sync`, { dryRun: true });
}

// Plan a create or edit that has not been written. `slug` is set when editing.
// A confirm result is not a saved change. `{ pending: true }` means the
// destination could not be read; the export was not written.
export function planExportDraft (body) {
  return postJson('/api/exports/plan', body || {});
}

// Requests a bulk sync. Resolves to one of: the started-plan shape
// ({ jobId, mode, linkMode, add, remove, bytesNeeded, estimatedSeconds,
// warnings }), { pending, reason } (destination offline — recorded Pending),
// or { error, ... } (404 / insufficient-space). The server begins applying
// immediately; subscribe to the job stream for progress.
export function syncExport (slug) {
  return postJson(`/api/exports/${encodeURIComponent(slug)}/sync`, {});
}

export function cancelExportSync (slug, jobId) {
  return postJson(`/api/exports/${encodeURIComponent(slug)}/sync/${encodeURIComponent(jobId)}/cancel`, {});
}

// Subscribe to one sync job's SSE stream. `onEvent` receives each progress
// snapshot ({ filesDone, filesTotal, bytesDone, bytesTotal, currentPath,
// status, final, ... }); the terminal frame carries `final: true`. Returns a
// disconnect function. EventSource auto-reconnects on a dropped socket, so a
// closed tab re-discovers the still-running job on reopen.
export function connectExportSync (slug, jobId, onEvent) {
  const url = `/api/exports/${encodeURIComponent(slug)}/sync/${encodeURIComponent(jobId)}/events`;
  let es = null;
  let closed = false;

  function connect () {
    if (closed) return;
    es = new EventSource(url);
    es.onmessage = (e) => {
      try { onEvent(JSON.parse(e.data)); } catch {}
    };
    es.onerror = () => {
      if (es) es.close();
      es = null;
      // The browser's EventSource would retry on its own; we only reconnect
      // explicitly if the caller hasn't disconnected.
      if (!closed) setTimeout(connect, 1500);
    };
  }

  connect();

  return () => {
    closed = true;
    if (es) es.close();
  };
}

// One session for the shell and the Download page. A second call adds a
// listener; it does not open another EventSource.
export function connectProgress (onEvent) {
  return progressSession.connectProgress(onEvent);
}
