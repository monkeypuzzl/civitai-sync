// Explorer Download Generations. Four buttons always, in this order.
// Favorited and Liked toggle together. Download draws the break between
// All and Favorited; it is not a mode.

const REACTION_ORDER = ['favorite', 'feedback:liked'];

const GENERATION_DOWNLOAD_MODES = [
  {
    value: 'latest',
    label: 'Latest',
    desc: 'Most recent generations not yet saved; missing files on those jobs too'
  },
  {
    value: 'missing-all',
    label: 'All',
    desc: 'All generations in last 30 days, including missing files'
  },
  {
    value: 'favorite',
    label: 'Favorited',
    desc: 'Favorited generations in the last 30 days, including missing files'
  },
  {
    value: 'feedback:liked',
    label: 'Liked',
    desc: 'Liked generations in the last 30 days, including missing files'
  }
];

function canonicalReactions (source) {
  const list = Array.isArray(source) ? source : [];
  return REACTION_ORDER.filter(id => list.includes(id));
}

export function generationDownloadModes () {
  return GENERATION_DOWNLOAD_MODES;
}

// `clicked` is `latest`, `all`, `favorite`, or `feedback:liked`.
// The All button's mode value is `missing-all`; the view maps that to `all`.
export function applyGenerationSelection (state, clicked) {
  if (clicked === 'latest' || clicked === 'all') {
    return { run: clicked, reactions: [] };
  }
  const lit = state && state.run === 'reactions' ? canonicalReactions(state.reactions) : [];
  const next = lit.includes(clicked) ? lit.filter(id => id !== clicked) : lit.concat(clicked);
  const reactions = canonicalReactions(next);
  if (!reactions.length) return { run: 'latest', reactions: [] };
  return { run: 'reactions', reactions };
}

export function selectionFromConfig ({ generationDownload, generationReactions } = {}) {
  if (generationDownload === 'all') return { run: 'all', reactions: [] };
  if (generationDownload === 'reactions') {
    const reactions = canonicalReactions(generationReactions);
    if (!reactions.length) return { run: 'latest', reactions: [] };
    return { run: 'reactions', reactions };
  }
  return { run: 'latest', reactions: [] };
}
