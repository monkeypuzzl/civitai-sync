// Download-tab shell mark. One frozen spinner per running kind. A progress
// frame that does not change the kind returns the same reference, so the
// nav leaf does not render. App does not store the mark.

const NONE = Object.freeze({ kind: 'none', title: '' });
const WAITING = Object.freeze({ kind: 'waiting', title: 'Auto download on' });

const SPINNERS = Object.freeze({
  generations: Object.freeze({ kind: 'spinner', title: 'Downloading generations' }),
  posts: Object.freeze({ kind: 'spinner', title: 'Downloading posts' }),
  comics: Object.freeze({ kind: 'spinner', title: 'Downloading comics' }),
  model3ds: Object.freeze({ kind: 'spinner', title: 'Downloading 3D' }),
  other: Object.freeze({ kind: 'spinner', title: 'Download in progress' })
});

const DOWNLOAD_TYPES = new Set(['generations', 'posts', 'comics', 'model3ds']);
const IGNORED = new Set(['model-cache', 'exports', 'own-models', 'tag-cache']);

function spinnerFor (type) {
  return SPINNERS[type] || SPINNERS.other;
}

function unchanged (prev, next) {
  return prev.kind === next.kind && prev.title === next.title ? prev : next;
}

export function nextDownloadMark (prev, event) {
  const prior = prev && prev.kind ? prev : NONE;
  if (!event || typeof event !== 'object') return prior;
  if (IGNORED.has(event.type)) return prior;
  if (event.type === 'auto') {
    if (event.phase === 'waiting') return unchanged(prior, WAITING);
    if (prior.kind === 'spinner') return prior;
    return prior.kind === 'none' ? prior : NONE;
  }
  if (event.type === 'connected') {
    if (event.active) return unchanged(prior, spinnerFor(event.downloadType));
    if (event.auto && event.auto.phase === 'waiting') return unchanged(prior, WAITING);
    return prior.kind === 'none' ? prior : NONE;
  }
  if (event.final && DOWNLOAD_TYPES.has(event.type)) {
    const pending = event.queue && Array.isArray(event.queue.pending) ? event.queue.pending : [];
    if (pending.length > 0) return prior;
    return prior.kind === 'none' ? prior : NONE;
  }
  if (event.status === 'downloading' && DOWNLOAD_TYPES.has(event.type)) {
    return unchanged(prior, spinnerFor(event.type));
  }
  return prior;
}

let current = NONE;
const listeners = new Set();

export function getDownloadMark () {
  return current;
}

export function subscribeDownloadMark (fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function noteDownloadEvent (event) {
  const next = nextDownloadMark(current, event);
  if (next === current) return;
  current = next;
  for (const fn of listeners) fn(current);
}
