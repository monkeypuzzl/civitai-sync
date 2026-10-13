import { useState, useEffect, useCallback, useRef, useId } from 'preact/hooks';
import {
  listExports, createExport, updateExport, deleteExport, planExport,
  syncExport, cancelExportSync, connectExportSync, getModelHierarchy
} from '../api.js';
import { OpenFolderButton } from './OpenFolderButton.jsx';
import { FacetBar } from './FacetBar.jsx';
import { PUBLICATION_FACET, USED_AS_INPUT_FACET } from '../lib/publication.js';
import { describeQuery, scopeNamesFromTree, scopeNeedsNames } from '../lib/query-label.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { exportPendingCopy, exportRowKind, REMOVAL_BUSY_MS, removalBusyLabel, removalFailureCopy } from '../lib/export-status.js';

// The export query editor reuses the Phase 3 FacetBar for membership only
// (facets + search). Arrangement (`sortFields` / `groupAxes` / Arrange) is
// gallery-only — an export is a set of media items, not a sorted page.
// The facet set is the subset that evaluates correctly over the flat
// `mediaItems` projection that `evaluateExport` filters: reactions, type,
// aspect, the hierarchical `scope` tree, date, cfg/steps ranges, Publication
// (posts ∪ comic chapters), and Used as input. `status` stays omitted — it
// is a post-entry field with no meaning over a bare media-item.
const EXPORT_FACETS = [
  { key: 'reaction', kind: 'chips', source: 'reaction', valuesSource: 'reactionTags', options: ['favorite', 'feedback:liked', 'feedback:disliked'] },
  { key: 'type', kind: 'nested-tree', tree: 'type-workflow', label: 'Media Type' },
  { key: 'aspect', kind: 'nested-tree', tree: 'aspect', label: 'Aspect Ratio', alwaysShowRoots: true },
  { key: 'scope', kind: 'tree', label: 'Models' },
  { key: 'dateFrom', key2: 'dateTo', kind: 'date-range', label: 'When' },
  { key: 'cfgMin', key2: 'cfgMax', kind: 'number-range', label: 'CFG' },
  { key: 'stepsMin', key2: 'stepsMax', kind: 'number-range', label: 'Steps' },
  PUBLICATION_FACET,
  USED_AS_INPUT_FACET
];

const EMPTY_EXPORT_FACET_PARAMS = {};

const CSV_KEYS = ['tag', 'reaction', 'type', 'aspect', 'publication', 'workflow', 'workflowMode'];
const STR_KEYS = ['dateFrom', 'dateTo', 'scope'];
const FLAG_KEYS = ['mine'];
const NUM_KEYS = ['cfgMin', 'cfgMax', 'stepsMin', 'stepsMax'];

// --- Query <-> form-state conversion --------------------------------------
//
// The stored/sent `query` is the protocol param form (comma strings, number
// strings); FacetBar operates on the URL-state shape (arrays / numbers). These
// mirror the readSchemaState / serializeSchemaPartial pair in url-state.js,
// scoped to the export facet set.

function emptyQueryState () {
  const s = {};
  for (const k of CSV_KEYS) s[k] = [];
  for (const k of STR_KEYS) s[k] = '';
  for (const k of NUM_KEYS) s[k] = null;
  for (const k of FLAG_KEYS) s[k] = null;
  s.usedAsInput = null;
  return s;
}

function queryToState (query = {}) {
  const s = emptyQueryState();
  for (const k of CSV_KEYS) if (query[k]) s[k] = String(query[k]).split(',').map(x => x.trim()).filter(Boolean);
  for (const k of STR_KEYS) if (query[k]) s[k] = String(query[k]);
  for (const k of NUM_KEYS) if (query[k] != null && query[k] !== '') s[k] = Number(query[k]);
  for (const k of FLAG_KEYS) s[k] = query[k] === '1' || query[k] === true ? true : null;
  if (query.usedAsInput === '1' || query.usedAsInput === true) s.usedAsInput = true;
  return s;
}

function stateToQuery (state, q) {
  const out = {};
  for (const k of CSV_KEYS) { const v = state[k]; if (Array.isArray(v) && v.length) out[k] = v.join(','); }
  for (const k of STR_KEYS) { const v = state[k]; if (v) out[k] = v; }
  for (const k of NUM_KEYS) { const v = state[k]; if (v != null && v !== '' && !Number.isNaN(v)) out[k] = String(v); }
  for (const k of FLAG_KEYS) if (state[k] === true) out[k] = '1';
  if (state.usedAsInput === true) out.usedAsInput = '1';
  if (q && q.trim()) out.q = q.trim();
  return out;
}

function linkModeLabel (mode) {
  if (mode === 'hardlink') return 'Hard link';
  if (mode === 'copy') return 'Copy';
  return 'Auto';
}

// POST /api/open-folder accepts the same `/media/exports/<slug>` URL form as
// generations/posts/comics, plus an absolute custom dest. Stored paths are
// `media/exports/<slug>` (mediaPath-rooted); the leading slash makes them
// match the `/media/...` prefix map.
function exportOpenPath (rec) {
  const dest = rec.path || `media/exports/${rec.slug}`;
  if (dest.startsWith('media/') || dest.startsWith('media\\')) {
    return '/' + dest.replace(/\\/g, '/');
  }
  return dest;
}

function formatBytes (n) {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function formatEta (seconds) {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `~${minutes} min`;
  return `~${Math.round(minutes / 60)} h`;
}

// The exact one-line plan preview the C1d dry-run enables: +adds / −removes,
// then the cost — copied bytes (+ETA) for a copy-mode plan, or a no-bytes note
// for hard links. `plan` is the dry-run response ({ add, remove, bytesNeeded,
// estimatedSeconds, linkMode }); `dest` is the resolved destination.
function planPreviewText (plan, dest) {
  const add = (plan.add || 0).toLocaleString();
  const remove = (plan.remove || 0).toLocaleString();
  const head = `Saving will add ${add} / remove ${remove}`;
  if (plan.linkMode === 'copy' && plan.bytesNeeded > 0) {
    const eta = formatEta(plan.estimatedSeconds);
    return `${head} \u2014 ${formatBytes(plan.bytesNeeded)} copied to ${dest}${eta ? `, ${eta}` : ''}. Your downloaded originals are untouched.`;
  }
  return `${head} \u2014 hard-linked into ${dest}; no bytes are duplicated. Your downloaded originals are untouched.`;
}

function notifyChange () {
  try { window.dispatchEvent(new Event('exportschange')); } catch { /* older Event ctor */ }
}

// --- Status cell ----------------------------------------------------------

function FailureHint ({ copy }) {
  return (
    <span class="export-status-label">
      <em>{copy.sentence}</em>
      {' '}
      <em class="export-status-errno">Error: <code class="mono">{copy.code}</code></em>
    </span>
  );
}

function StatusCell ({ rec, job, busyLabel, onSyncNow, onRetry, onCancel }) {
  if (busyLabel) {
    return (
      <div class="export-status syncing">
        <span class="spinner spinner-sm" />
        <span class="export-status-label">{busyLabel}</span>
      </div>
    );
  }

  const kind = exportRowKind(rec.status, job);
  if (kind === 'blank') return null;

  if (kind === 'syncing') {
    const total = job?.filesTotal ?? ((rec.status?.drift?.add || 0) + (rec.status?.drift?.remove || 0));
    const done = job?.filesDone ?? 0;
    return (
      <div class="export-status syncing">
        <span class="spinner spinner-sm" />
        <span class="export-status-label">{`Syncing\u2026 ${done}/${total || '?'}`}</span>
        <button type="button" class="text-btn" onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  if (kind === 'pending') {
    const copy = exportPendingCopy(rec.status);
    return (
      <div class="export-status pending">
        {copy.kind === 'failure'
          ? <FailureHint copy={copy} />
          : <span class="export-status-label">{copy.text}</span>}
        <button type="button" class="text-btn" onClick={onSyncNow}>Sync now</button>
      </div>
    );
  }

  if (kind === 'error') {
    const copy = exportPendingCopy(rec.status);
    return (
      <div class="export-status error">
        {copy.kind === 'failure'
          ? <FailureHint copy={copy} />
          : <span class="export-status-label">Sync failed</span>}
        <button type="button" class="text-btn" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  return <span class="export-status idle" />;
}

// --- One export row -------------------------------------------------------

function ExportRow ({ rec, job, removing, removalPending, busyLabel, removalError, scopeNames, onEdit, onAskRemove, onConfirmRemove, onCancelRemove, onSyncNow, onCancel }) {
  const dest = rec.path || `media/exports/${rec.slug}`;
  return (
    <div class="export-row">
      <div class="export-row-main">
        <div class="export-row-name">{rec.name}</div>
        <div class="export-row-dest mono">{dest}</div>
        <div class="export-row-query">{describeQuery(rec.query, scopeNames)}</div>
      </div>
      <div class="export-row-status">
        <StatusCell
          rec={rec}
          job={job}
          busyLabel={busyLabel}
          onSyncNow={() => onSyncNow(rec.slug)}
          onRetry={() => onSyncNow(rec.slug)}
          onCancel={() => onCancel(rec.slug)}
        />
      </div>
      <div class="export-row-actions">
        {removing ? (
          <div class="export-remove-confirm">
            <span class="export-remove-note">
              Remove this export? <strong>Detach</strong> keeps the folder&apos;s files on disk;
              <strong> Delete files</strong> also unlinks them. Either way your downloaded originals are untouched.
            </span>
            <button type="button" class="text-btn" disabled={removalPending} onClick={() => onConfirmRemove(rec.slug, { deleteFiles: false })}>Detach</button>
            <button type="button" class="text-btn danger" disabled={removalPending} onClick={() => onConfirmRemove(rec.slug, { deleteFiles: true })}>Delete files</button>
            <button type="button" class="text-btn" disabled={removalPending} onClick={onCancelRemove}>Cancel</button>
          </div>
        ) : (
          <>
            <OpenFolderButton path={exportOpenPath(rec)} />
            <button type="button" class="quiet-btn" onClick={() => onEdit(rec)}>Edit</button>
            <button type="button" class="quiet-btn danger" onClick={() => onAskRemove(rec.slug)}>Remove</button>
            {removalError && <span class="export-remove-error">{removalError}</span>}
          </>
        )}
      </div>
    </div>
  );
}

// --- Create / edit form ---------------------------------------------------

// Save commits the export definition; the dry-run plan (C1d) then gates the
// *sync* (the file operations). On submit the view persists the def and fetches
// an exact plan: a `confirm` verdict (copy-with-bytes / >200 ops / any
// deletion) is handed back as `confirmPlan` and the form shows the precise
// preview before the user applies; an `auto` verdict syncs silently and the
// view closes the form. While the preview is shown the fields are locked so the
// plan can't go stale under an edit — Back returns to the editable form.
function ExportForm ({ initial, confirmPlan, scopeNames, ensureScopeNames, onSave, onConfirm, onBack, onCancel, saving, error }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || '');
  const [destPath, setDestPath] = useState(initial?.path || '');
  const [linkMode, setLinkMode] = useState(initial?.linkMode || 'auto');
  const [includeInputMedia, setIncludeInputMedia] = useState(initial?.includeInputMedia === true);
  const [query, setQuery] = useState(() => queryToState(initial?.query));
  const [q, setQ] = useState(initial?.query?.q || '');
  const [touched, setTouched] = useState(false);
  const nameId = useId();
  const destId = useId();

  const locked = !!confirmPlan;
  const updateQuery = useCallback((partial) => setQuery(prev => ({ ...prev, ...partial })), []);

  useEffect(() => {
    if (scopeNeedsNames(stateToQuery(query, q).scope)) ensureScopeNames();
  }, [query, q, ensureScopeNames]);

  function submit (e) {
    if (e) e.preventDefault();
    if (locked) { onConfirm(); return; }
    if (!name.trim()) { setTouched(true); return; }
    const body = { name: name.trim(), query: stateToQuery(query, q), linkMode, includeInputMedia };
    const p = destPath.trim();
    if (p) body.path = p;
    onSave(body);
  }

  return (
    <form class="export-form property-group" onSubmit={submit}>
      <h2 class="property-heading">{isEdit ? `Edit ${initial.name}` : 'New export'}</h2>

      <div class="property">
        <label class="property-name" for={nameId}>Name</label>
        <input
          id={nameId}
          class="export-input"
          type="text"
          value={name}
          placeholder="Wallpapers"
          disabled={locked}
          onInput={e => setName(e.target.value)}
        />
        {touched && !name.trim() && <div class="export-field-note">A name is required.</div>}
      </div>

      <div class="property">
        <label class="property-name" for={destId}>Destination</label>
        <input
          id={destId}
          class="export-input mono"
          type="text"
          value={destPath}
          placeholder="media/exports/<slug> (or an absolute path)"
          disabled={locked}
          onInput={e => setDestPath(e.target.value)}
        />
      </div>

      <fieldset class="property">
        <legend class="property-name">Link mode</legend>
        <div class="mode-selector">
          {['auto', 'hardlink', 'copy'].map(m => (
            <label
              key={m}
              class="mode-btn"
              title={m === 'auto' ? 'Probe the destination: hard link where possible, copy otherwise'
                : m === 'hardlink' ? 'Force hard links (no duplicated bytes)'
                  : 'Force copies (duplicates bytes; needed for exFAT / cloud-sync folders)'}
            >
              <input
                type="radio"
                name="link-mode"
                value={m}
                checked={linkMode === m}
                disabled={locked}
                onChange={() => setLinkMode(m)}
              />
              {linkModeLabel(m)}
            </label>
          ))}
        </div>
      </fieldset>

      <div class="property">
        <label class="checkbox-label">
          <input
            type="checkbox"
            checked={includeInputMedia}
            disabled={locked}
            onChange={e => setIncludeInputMedia(e.target.checked)}
          />
          Include input media
        </label>
        <div class="export-field-help">
          Also include files used as inputs of the matched items. Upload-only frames land under inputs/; a generated frame keeps its generations/ or posts/ path.
        </div>
      </div>

      <div class="property">
        <div class="property-name">Filter</div>
        <FacetBar
          facets={EXPORT_FACETS}
          state={query}
          update={updateQuery}
          search={q}
          onSearchInput={(v) => setQ(v)}
          facetParams={EMPTY_EXPORT_FACET_PARAMS}
        />
        <div class="export-query-summary">{describeQuery(stateToQuery(query, q), scopeNames)}</div>
      </div>

      {error && <div class="property-error">{error}</div>}

      {locked && <div class="export-plan-preview">{planPreviewText(confirmPlan, confirmPlan.dest)}</div>}

      <div class="property-actions">
        {locked ? (
          <>
            <button type="submit" class="action-btn" disabled={saving}>
              {saving ? 'Syncing\u2026' : 'Confirm & sync'}
            </button>
            <button type="button" class="action-btn secondary-btn" onClick={onBack} disabled={saving}>Back</button>
          </>
        ) : (
          <>
            <button type="submit" class="action-btn" disabled={saving}>
              {saving ? 'Saving\u2026' : (isEdit ? 'Save' : 'Create')}
            </button>
            <button type="button" class="action-btn secondary-btn" onClick={onCancel} disabled={saving}>Cancel</button>
          </>
        )}
      </div>
    </form>
  );
}

// --- The view -------------------------------------------------------------

export function ExportsView () {
  useDocumentTitle({ place: 'exports' });
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [jobs, setJobs] = useState({});          // slug -> live job snapshot
  const [form, setForm] = useState(null);         // null | { initial }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null); // { slug, plan, dest } awaiting confirm
  const [removing, setRemoving] = useState(null); // slug under inline confirm
  const [removalPending, setRemovalPending] = useState(null);
  const [removalBusy, setRemovalBusy] = useState(null);
  const [removalErrors, setRemovalErrors] = useState({});
  const [scopeNames, setScopeNames] = useState(null);

  const jobMeta = useRef({});                      // slug -> { jobId, disconnect }
  const namesState = useRef('idle');
  const viewAlive = useRef(true);
  const removalTimer = useRef(null);

  const ensureScopeNames = useCallback(() => {
    if (namesState.current !== 'idle') return;
    namesState.current = 'loading';
    getModelHierarchy({})
      .then(tree => { if (viewAlive.current) setScopeNames(scopeNamesFromTree(tree)); })
      .catch(() => { if (viewAlive.current) setScopeNames(null); })
      .finally(() => { if (viewAlive.current) namesState.current = 'done'; });
  }, []);

  useEffect(() => {
    if (exports.some(rec => scopeNeedsNames(rec.query?.scope))) ensureScopeNames();
  }, [exports, ensureScopeNames]);

  const reload = useCallback(async () => {
    try {
      const { exports: list = [] } = await listExports();
      setExports(list);
      setLoadError(null);
    } catch (e) {
      setLoadError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const onChange = () => { reload(); };
    window.addEventListener('exportschange', onChange);
    return () => window.removeEventListener('exportschange', onChange);
  }, [reload]);

  // Tear down any live SSE subscriptions on unmount (the server-side jobs keep
  // running; a later visit re-discovers them).
  useEffect(() => () => {
    viewAlive.current = false;
    clearTimeout(removalTimer.current);
    for (const meta of Object.values(jobMeta.current)) {
      if (meta?.disconnect) meta.disconnect();
    }
    jobMeta.current = {};
  }, []);

  const startSync = useCallback(async (slug) => {
    const resp = await syncExport(slug).catch(() => null);
    if (resp && resp.jobId) {
      setJobs(prev => ({
        ...prev,
        [slug]: { filesDone: 0, filesTotal: (resp.add || 0) + (resp.remove || 0), status: 'running', mode: resp.linkMode }
      }));
      const disconnect = connectExportSync(slug, resp.jobId, (ev) => {
        setJobs(prev => ({
          ...prev,
          [slug]: { filesDone: ev.filesDone, filesTotal: ev.filesTotal, status: ev.status, mode: ev.mode }
        }));
        if (ev.final) {
          const meta = jobMeta.current[slug];
          if (meta?.disconnect) meta.disconnect();
          delete jobMeta.current[slug];
          setJobs(prev => { const n = { ...prev }; delete n[slug]; return n; });
          reload();
          notifyChange();
        }
      });
      jobMeta.current[slug] = { jobId: resp.jobId, disconnect };
      notifyChange();
    } else {
      // pending (offline destination) / insufficient-space / not-found — the
      // server already recorded the status; refresh to surface it.
      await reload();
      notifyChange();
    }
    return resp;
  }, [reload]);

  const cancelSync = useCallback(async (slug) => {
    const meta = jobMeta.current[slug];
    if (meta?.jobId) await cancelExportSync(slug, meta.jobId).catch(() => {});
    // The cancelled terminal frame arrives over SSE and triggers the cleanup +
    // reload in startSync's handler.
  }, []);

  const finishForm = useCallback(() => {
    setForm(null);
    setPendingPlan(null);
    setSaveError(null);
  }, []);

  // Save commits the definition, then the dry-run plan gates the sync: an
  // `auto` plan applies silently and closes the form; a `confirm` plan is held
  // in pendingPlan so the form shows the exact preview and awaits an explicit
  // Confirm & sync. A pending/undeterminable plan (offline destination) just
  // closes the form — the def is saved and the server already marked it Pending.
  const handleSave = useCallback(async (body) => {
    setSaving(true);
    setSaveError(null);
    const isEdit = !!form?.initial;
    const rec = isEdit
      ? await updateExport(form.initial.slug, body).catch(() => null)
      : await createExport(body).catch(() => null);
    if (!rec || rec.error || !rec.slug) {
      setSaveError(rec?.error
        ? removalFailureCopy(rec.error, { pathEdit: true })
        : 'Could not save the export.');
      setSaving(false);
      return;
    }
    notifyChange();

    const plan = await planExport(rec.slug).catch(() => null);
    setSaving(false);

    if (plan && plan.mode === 'confirm') {
      const dest = rec.path || `media/exports/${rec.slug}`;
      // Re-bind the (possibly just-created) form to the persisted record so a
      // Back → re-Save updates it rather than creating a duplicate; the slug is
      // stable across edits, and the form keeps the user's typed field values.
      setForm({ initial: rec });
      setPendingPlan({ slug: rec.slug, plan, dest });
      await reload();
      return; // keep the form open showing the exact preview
    }

    finishForm();
    await reload();
    if (plan && !plan.pending && !plan.error) {
      // `auto` plan (or a zero-op no-op): apply silently.
      await startSync(rec.slug);
    } else {
      // offline / undeterminable: the def is saved and recorded Pending.
      notifyChange();
    }
  }, [form, reload, startSync, finishForm]);

  const handleConfirmSync = useCallback(async () => {
    if (!pendingPlan) return;
    const { slug } = pendingPlan;
    finishForm();
    await reload();
    await startSync(slug);
  }, [pendingPlan, reload, startSync, finishForm]);

  const handleBackToEdit = useCallback(() => setPendingPlan(null), []);

  const handleRemove = useCallback(async (slug, { deleteFiles = false } = {}) => {
    setRemovalErrors(prev => {
      if (!prev[slug]) return prev;
      const next = { ...prev };
      delete next[slug];
      return next;
    });
    setRemovalPending(slug);
    setRemovalBusy(null);
    clearTimeout(removalTimer.current);
    removalTimer.current = setTimeout(() => {
      if (!viewAlive.current) return;
      setRemovalBusy({ slug, deleteFiles });
    }, REMOVAL_BUSY_MS);
    let body = null;
    try {
      body = await deleteExport(slug, { deleteFiles });
    } catch {
      body = null;
    }
    clearTimeout(removalTimer.current);
    if (!viewAlive.current) return;
    setRemovalPending(null);
    setRemovalBusy(null);
    setRemoving(null);
    if (body?.ok || body?.error === 'not-found') {
      await reload();
      notifyChange();
      return;
    }
    setRemovalErrors(prev => ({ ...prev, [slug]: removalFailureCopy(body?.error) }));
    await reload();
    notifyChange();
  }, [reload]);

  return (
    <main class="main-content exports-view">
      <div class="exports-header">
        <h1 class="exports-title">Exports</h1>
        {!form && (
          <button type="button" class="action-btn" onClick={() => { setSaveError(null); setPendingPlan(null); setForm({ initial: null }); }}>
            New export
          </button>
        )}
      </div>

      <p class="exports-intro">
        An export is a filter that saves a copy of matching downloads into a folder on the computer.
        Exported files are hard-linked to your original downloads, so they don&apos;t consume extra disk space.
      </p>

      {form && (
        <ExportForm
          key={form.initial?.slug || 'new'}
          initial={form.initial}
          confirmPlan={pendingPlan ? { ...pendingPlan.plan, dest: pendingPlan.dest } : null}
          scopeNames={scopeNames}
          ensureScopeNames={ensureScopeNames}
          onSave={handleSave}
          onConfirm={handleConfirmSync}
          onBack={handleBackToEdit}
          onCancel={finishForm}
          saving={saving}
          error={saveError}
        />
      )}

      {loadError && <div class="property-error">{loadError}</div>}

      {loading ? (
        <div class="property-loading"><div class="spinner" /></div>
      ) : exports.length === 0 && !form ? (
        <div class="exports-empty">No exports yet. Create one to mirror a slice of your library in a folder.</div>
      ) : (
        <div class="exports-list">
          {exports.map(rec => (
            <ExportRow
              key={rec.slug}
              rec={rec}
              job={jobs[rec.slug]}
              removing={removing === rec.slug}
              removalPending={removalPending === rec.slug}
              busyLabel={removalBusy?.slug === rec.slug
                ? removalBusyLabel({ deleteFiles: removalBusy.deleteFiles, elapsedMs: REMOVAL_BUSY_MS })
                : null}
              removalError={removalErrors[rec.slug]}
              scopeNames={scopeNames}
              onEdit={(r) => { setSaveError(null); setPendingPlan(null); setForm({ initial: r }); setRemoving(null); }}
              onAskRemove={(slug) => {
                setRemovalErrors(prev => {
                  if (!prev[slug]) return prev;
                  const next = { ...prev };
                  delete next[slug];
                  return next;
                });
                setRemoving(slug);
              }}
              onConfirmRemove={handleRemove}
              onCancelRemove={() => setRemoving(null)}
              onSyncNow={startSync}
              onCancel={cancelSync}
            />
          ))}
        </div>
      )}
    </main>
  );
}
