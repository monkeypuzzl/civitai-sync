// Download page selection, notice, and status line.
// Pure. The page paints what these functions return.

import { DOWNLOAD_TYPE_ORDER, DOWNLOAD_TYPE_LABELS, canonicalizeDownloadTypes } from '../../../../src/downloadQueue.mjs';

function plural (n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function count (source, key) {
  const n = source && Number(source[key]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatActivity (activity) {
  const phase = activity && activity.phase;
  if (phase === 'media' || phase === 'input-media') return 'saving';
  return 'checking';
}

function countsFor (type, source) {
  if (!source) return null;
  const parts = [];
  if (type === 'generations') {
    const fresh = count(source, 'generationsNew');
    if (fresh) parts.push(`${fresh} new`);
    const updated = count(source, 'generationsUpdated');
    if (updated) parts.push(`${updated} updated`);
    const images = count(source, 'imagesSaved');
    if (images) parts.push(plural(images, 'image'));
    const videos = count(source, 'videosSaved');
    if (videos) parts.push(plural(videos, 'video'));
    const audio = count(source, 'audioSaved');
    if (audio) parts.push(plural(audio, 'audio file'));
    const meshes = count(source, 'model3dSaved');
    if (meshes) parts.push(`${meshes} 3D`);
  } else if (type === 'posts') {
    const fresh = count(source, 'postsNew');
    if (fresh) parts.push(`${fresh} new`);
    const updated = count(source, 'postsUpdated');
    if (updated) parts.push(`${updated} updated`);
    const images = count(source, 'imagesSaved');
    if (images) parts.push(plural(images, 'image'));
    const videos = count(source, 'videosSaved');
    if (videos) parts.push(plural(videos, 'video'));
    const audio = count(source, 'audioSaved');
    if (audio) parts.push(plural(audio, 'audio file'));
  } else if (type === 'comics') {
    const fresh = count(source, 'comicsNew');
    if (fresh) parts.push(`${fresh} new`);
    const updated = count(source, 'comicsUpdated');
    if (updated) parts.push(`${updated} updated`);
    const images = count(source, 'imagesSaved');
    if (images) parts.push(plural(images, 'image'));
  } else if (type === 'model3ds') {
    const fresh = count(source, 'model3dsNew');
    if (fresh) parts.push(`${fresh} new`);
    const updated = count(source, 'model3dsUpdated');
    if (updated) parts.push(`${updated} updated`);
    const files = count(source, 'filesSaved');
    if (files) parts.push(plural(files, 'file'));
  }
  return parts.length ? parts.join(' · ') : null;
}

function activityFor (type, progress) {
  return formatActivity(progress && progress.activity);
}

export function resolveDownloadTypes ({ saved, totals } = {}) {
  const stored = canonicalizeDownloadTypes(saved);
  if (stored.length) return stored;
  if (!totals || typeof totals !== 'object') return DOWNLOAD_TYPE_ORDER.slice();
  const selected = DOWNLOAD_TYPE_ORDER.filter(id => Number(totals[id]) > 0);
  return selected.length ? selected : DOWNLOAD_TYPE_ORDER.slice();
}

export function downloadNotice ({
  running = false,
  errorMessage = null,
  online = true,
  generationsOn = false,
  generationDays = null,
  postsOn = false,
  postsNeedUpdate = false
} = {}) {
  if (running) return null;
  if (errorMessage != null) {
    return { tone: 'error', text: errorMessage || 'Download failed.' };
  }
  if (!online) return { tone: 'warning', text: 'Offline' };
  if (generationsOn && generationDays != null && generationDays >= 30) {
    return { tone: 'warning', text: 'Generations may have expired.' };
  }
  if (postsOn && postsNeedUpdate) {
    return { tone: 'warning', text: 'Additional data is needed. Download All to update the posts.' };
  }
  if (generationsOn && generationDays != null && generationDays >= 25) {
    return { tone: 'warning', text: 'Download soon to avoid expiry.' };
  }
  return null;
}

const HOUR_MS = 60 * 60 * 1000;

// Kind is the contract. The page builds the sentence.
export function nextDownloadClause (dueAt, now = Date.now()) {
  const due = Number(dueAt);
  const at = Number(now);
  if (!Number.isFinite(due) || !Number.isFinite(at)) return null;
  if (due <= at) return { kind: 'now' };
  const remaining = due - at;
  if (remaining < HOUR_MS) {
    return { kind: 'minutes', minutes: Math.max(1, Math.ceil(remaining / 60000)) };
  }
  return { kind: 'clock', at: due };
}

export function downloadStatusLine (snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const types = Array.isArray(snapshot.types) ? snapshot.types : [];
  const results = Array.isArray(snapshot.results) ? snapshot.results : [];
  const current = snapshot.current || null;
  if (!current && results.length === 0) return null;

  const clauses = [];
  for (const type of types) {
    const result = results.find(item => item && item.type === type);
    if (result) {
      const counts = countsFor(type, result);
      let mark = null;
      if (result.status === 'aborted') mark = 'stopped';
      else if (result.status === 'error') mark = 'failed';
      else if (!counts) mark = 'up to date';
      clauses.push({
        type,
        label: DOWNLOAD_TYPE_LABELS[type] || type,
        active: false,
        activity: null,
        counts,
        mark
      });
    } else if (type === current) {
      clauses.push({
        type,
        label: DOWNLOAD_TYPE_LABELS[type] || type,
        active: true,
        activity: activityFor(type, snapshot.progress),
        counts: countsFor(type, snapshot.progress),
        mark: null
      });
    }
  }
  if (!clauses.length) return null;
  const live = current != null && !results.some(item => item && item.type === current);
  return { live, startedAt: snapshot.startedAt || null, clauses };
}

// A single-type run has no queue snapshot. Keep Stop honest if one is active.
export function snapshotFromStatus (status) {
  if (!status || typeof status !== 'object') return null;
  if (status.queue) return status.queue;
  if (!status.active || !status.type) return null;
  const elapsed = Number(status.elapsed) || 0;
  return {
    types: [status.type],
    pending: [],
    current: status.type,
    startedAt: Date.now() - elapsed,
    results: [],
    progress: status.progress || null,
    spec: {},
    closed: false,
    elapsed
  };
}
