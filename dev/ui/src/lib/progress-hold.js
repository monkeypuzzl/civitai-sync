// When this document may hold GET /api/download/progress.
// No document, clock, or network. The session performs the effects.

const EMPTY = Object.freeze({
  leader: false,
  visible: false,
  open: false,
  retries: 0,
  ignoreError: false
});

function base (prev) {
  const p = prev && typeof prev === 'object' ? prev : EMPTY;
  return {
    leader: p.leader === true,
    visible: p.visible === true,
    open: p.open === true,
    retries: Number.isInteger(p.retries) && p.retries > 0 ? p.retries : 0,
    ignoreError: p.ignoreError === true
  };
}

function pack (state, effects) {
  return {
    state,
    connect: false,
    close: false,
    retryMs: null,
    readStatus: false,
    ...effects
  };
}

function backoff (retries) {
  return Math.min(30000, 3000 * 2 ** (retries - 1));
}

export function nextProgressConnection (prev, signal) {
  const state = base(prev);

  if (signal === 'show') {
    const next = { ...state, visible: true };
    const connect = next.leader && !next.open;
    if (connect) next.retries = 0;
    return pack(next, { connect, readStatus: true });
  }

  if (signal === 'hide') {
    return pack(
      { ...state, visible: false, open: false, ignoreError: true },
      { close: state.open }
    );
  }

  if (signal === 'lead') {
    const next = { ...state, leader: true };
    if (!next.visible) return pack(next);
    const connect = !next.open;
    if (connect) next.retries = 0;
    return pack(next, { connect, readStatus: true });
  }

  if (signal === 'follow') {
    return pack(
      { ...state, leader: false, open: false, ignoreError: true },
      { close: state.open }
    );
  }

  if (signal === 'opened') {
    return pack({ ...state, open: true, retries: 0, ignoreError: false });
  }

  if (signal === 'error') {
    if (state.ignoreError) {
      return pack({ ...state, open: false, ignoreError: false });
    }
    if (state.visible && state.leader) {
      const retries = state.retries + 1;
      return pack(
        { ...state, open: false, retries },
        { retryMs: backoff(retries) }
      );
    }
    return pack({ ...state, open: false });
  }

  if (signal === 'wake') {
    if (!(state.visible && state.leader)) return pack(state);
    const connect = !state.open;
    return pack(
      { ...state, retries: 0 },
      { connect, readStatus: true }
    );
  }

  return pack(state);
}
