// Explorer Download Posts. Recheck is a flag on All, not a third run.
// Turning it on selects All. Turning it off leaves All. Latest clears it.

export function applyPostsSelection (state, clicked) {
  const mode = state && state.mode === 'all' ? 'all' : 'latest';
  const recheck = !!(state && state.recheck);
  if (clicked === 'latest') return { mode: 'latest', recheck: false };
  if (clicked === 'all') return { mode: 'all', recheck };
  if (clicked === 'recheck') {
    if (recheck) return { mode, recheck: false };
    return { mode: 'all', recheck: true };
  }
  return { mode, recheck };
}
