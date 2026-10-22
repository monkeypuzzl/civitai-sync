// One Recheck metadata toggle for Posts and Comics.
// Lighting it sets every selected row of those types to All.
// Choosing Latest clears the toggle and leaves the other row on All.

const RECHECK_TYPES = ['posts', 'comics'];

function modeOf (modes, id) {
  return modes && modes[id] === 'all' ? 'all' : 'latest';
}

export function recheckShown ({ selected, modes, totalPosts, totalComics }) {
  const on = new Set(Array.isArray(selected) ? selected : []);
  const posts = on.has('posts') && modeOf(modes, 'posts') === 'all' && (totalPosts || 0) > 0;
  const comics = on.has('comics') && modeOf(modes, 'comics') === 'all' && (totalComics || 0) > 0;
  return posts || comics;
}

export function applyRecheck (state, clicked) {
  const modes = {
    posts: modeOf(state && state.modes, 'posts'),
    comics: modeOf(state && state.modes, 'comics')
  };
  const selected = new Set(Array.isArray(state && state.selected) ? state.selected : []);
  let recheck = !!(state && state.recheck);

  if (clicked === 'recheck') {
    if (recheck) return { modes, selected: [...selected], recheck: false };
    if (selected.has('posts')) modes.posts = 'all';
    if (selected.has('comics')) modes.comics = 'all';
    return { modes, selected: [...selected], recheck: true };
  }

  if (clicked === 'posts-latest' || clicked === 'comics-latest') {
    const id = clicked === 'posts-latest' ? 'posts' : 'comics';
    modes[id] = 'latest';
    return { modes, selected: [...selected], recheck: false };
  }

  if (clicked === 'posts-all' || clicked === 'comics-all') {
    const id = clicked === 'posts-all' ? 'posts' : 'comics';
    modes[id] = 'all';
    return { modes, selected: [...selected], recheck };
  }

  if (clicked === 'select-posts' || clicked === 'select-comics') {
    const id = clicked === 'select-posts' ? 'posts' : 'comics';
    if (selected.has(id)) selected.delete(id);
    else {
      selected.add(id);
      if (recheck) modes[id] = 'all';
    }
    return { modes, selected: RECHECK_TYPES.filter(type => selected.has(type)), recheck };
  }

  return { modes, selected: [...selected], recheck };
}
