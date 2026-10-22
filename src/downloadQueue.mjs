// Download queue contract. Leaf: no I/O, no server import.
// The server, the prefs patch, and the Download page all read this order.

export const DOWNLOAD_TYPE_ORDER = Object.freeze(['generations', 'posts', 'comics', 'model3ds']);

export const DOWNLOAD_TYPE_LABELS = Object.freeze({
  generations: 'Generations',
  posts: 'Posts',
  comics: 'Comics',
  model3ds: '3D'
});

const GENERATION_MODES = new Set(['latest', 'missing-all', 'missing-tags']);
const POST_MODES = new Set(['latest', 'all']);

export function canonicalizeDownloadTypes (list) {
  const source = Array.isArray(list) ? list : [];
  const present = new Set(source);
  return DOWNLOAD_TYPE_ORDER.filter(id => present.has(id));
}

export function acceptQueueBody (body) {
  const source = body && typeof body === 'object' ? body : {};
  const types = canonicalizeDownloadTypes(source.types);
  if (!types.length) return { error: 'No download type selected' };

  const spec = {};
  if (types.includes('generations')) {
    const mode = source.generations && source.generations.mode
      ? source.generations.mode
      : 'latest';
    if (!GENERATION_MODES.has(mode)) return { error: 'Unknown generations download.' };
    spec.generations = { mode };
  }
  const recheck = source.recheck === true;
  if (types.includes('posts')) {
    const mode = source.posts && source.posts.mode ? source.posts.mode : 'latest';
    if (!POST_MODES.has(mode)) return { error: 'Unknown posts download.' };
    spec.posts = {
      mode,
      checkAllMedia: mode === 'all' && (recheck || !!(source.posts && source.posts.checkAllMedia === true))
    };
  }
  if (types.includes('comics')) {
    const mode = source.comics && source.comics.mode ? source.comics.mode : 'latest';
    if (!POST_MODES.has(mode)) return { error: 'Unknown comics download.' };
    spec.comics = {
      mode,
      checkAllMedia: mode === 'all' && (recheck || !!(source.comics && source.comics.checkAllMedia === true))
    };
  }
  if (types.includes('model3ds')) {
    const mode = source.model3ds && source.model3ds.mode ? source.model3ds.mode : 'latest';
    if (!POST_MODES.has(mode)) return { error: 'Unknown 3D download.' };
    spec.model3ds = { mode };
  }
  if (recheck) spec.recheck = true;
  return { types, spec };
}

// `outcome.status` is `complete`, `error`, or `aborted`.
// `halt` stops the rest even when this type completed.
export function stepDownloadQueue (state, outcome) {
  const types = Array.isArray(state && state.types) ? state.types : [];
  const results = (Array.isArray(state && state.results) ? state.results : []).concat(outcome);
  const idx = outcome && outcome.type ? types.indexOf(outcome.type) : -1;
  const nextIndex = idx + 1;
  const stop = !outcome
    || outcome.status === 'error'
    || outcome.status === 'aborted'
    || (state && state.halt === true)
    || idx < 0;
  if (stop || nextIndex >= types.length) {
    return {
      results,
      cursor: types.length,
      done: true,
      startType: null,
      hooks: results.some(result => result && result.status === 'complete')
    };
  }
  return {
    results,
    cursor: nextIndex,
    done: false,
    startType: types[nextIndex],
    hooks: false
  };
}

// `closed` is the terminal frame: pending is empty and current is null,
// including when a failure left later types unstarted.
export function queueSnapshot ({ types, results, current, startedAt, progress, spec, closed = false }) {
  const list = Array.isArray(types) ? types : [];
  const done = Array.isArray(results) ? results : [];
  const finished = new Set(done.map(result => result && result.type));
  const cur = current || null;
  return {
    types: list,
    pending: closed ? [] : list.filter(id => id !== cur && !finished.has(id)),
    current: closed ? null : cur,
    startedAt: startedAt || null,
    results: done,
    progress: closed ? null : (progress || null),
    spec: spec || {},
    closed: closed === true,
    elapsed: startedAt ? Date.now() - startedAt : 0
  };
}
