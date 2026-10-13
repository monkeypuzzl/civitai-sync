// Pure label / chip helpers for media and container sidebar file actions.
// No Preact. Dates passed into civitaiInstanceLabels are already formatDate
// output.

const KIND_WORD = { post: 'Post', comic: 'Comic' };
const LINK_BASE = '\uD83D\uDD17 On Civitai';
const SEP = ' \u00B7 ';

export function mediaNoun (type) {
  if (type === 'image' || type === 'video' || type === 'audio') return type;
  return 'media';
}

export function downloadTitle (type) {
  return `Download ${mediaNoun(type)}`;
}

// count < 1 → null. comicFolder && count > 1 → comic id folder (nothing selected).
export function mediaFileCopy ({ count, types, comicFolder } = {}) {
  if (!(count >= 1)) return null;
  if (comicFolder && count > 1) {
    return { label: 'Media files', title: 'Open comic media folder' };
  }
  if (count === 1) {
    const noun = mediaNoun(Array.isArray(types) ? types[0] : types);
    return {
      label: 'Media file',
      title: `Open Media folder, with ${noun} file selected`
    };
  }
  return { label: 'Media files', title: 'Open Media folder' };
}

// items: { kind: 'post'|'comic', date: string }[].
// One link → base. Several, one kind → base · date. Mixed kinds → base · Kind · date.
// Empty date drops that segment; mixed kinds still keep the kind word.
export function civitaiInstanceLabels (items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const multi = items.length > 1;
  const kinds = new Set(items.map(i => i && i.kind).filter(Boolean));
  const mixed = kinds.size > 1;
  return items.map(item => {
    const parts = [LINK_BASE];
    if (multi && mixed) {
      const word = KIND_WORD[item.kind];
      if (word) parts.push(word);
      if (item.date) parts.push(item.date);
    } else if (multi && item.date) {
      parts.push(item.date);
    }
    return parts.join(SEP);
  });
}

export function postAccessChips (availability) {
  if (availability === 'Private') return ['Private'];
  if (availability === 'EarlyAccess') return ['Early Access'];
  return [];
}

// Highest among wire or lowercase chapter statuses. Empty → draft.
export function comicPublication (statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) return 'draft';
  const rank = { published: 3, scheduled: 2, draft: 1 };
  let best = 'draft';
  for (const raw of statuses) {
    const key = String(raw || 'draft').toLowerCase();
    const norm = rank[key] ? key : 'draft';
    if (rank[norm] > rank[best]) best = norm;
  }
  return best;
}

// Private if any chapter is Private. Early Access only for a live window
// (EarlyAccess + finite earlyAccessEndsAt in the future).
export function comicAccessChips (chapters, now = Date.now()) {
  const chips = [];
  let hasPrivate = false;
  let hasEarly = false;
  for (const ch of chapters || []) {
    if (!ch) continue;
    if (ch.availability === 'Private') hasPrivate = true;
    if (ch.availability === 'EarlyAccess' && ch.earlyAccessEndsAt) {
      const t = new Date(ch.earlyAccessEndsAt).getTime();
      if (Number.isFinite(t) && t > now) hasEarly = true;
    }
  }
  if (hasPrivate) chips.push('Private');
  if (hasEarly) chips.push('Early Access');
  return chips;
}
