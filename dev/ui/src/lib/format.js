const TAG_LABELS = {
  'favorite': '\u2764\uFE0F Favorite',
  'feedback:liked': '\uD83D\uDC4D Liked',
  'feedback:disliked': '\uD83D\uDC4E Disliked'
};

export function tagLabel (tag) {
  if (typeof tag === 'object') return tag.name;
  return TAG_LABELS[tag] || tag;
}

export function tagCssClass (tag) {
  const name = typeof tag === 'string' ? tag : tag.name || '';
  return name.replace(/:/g, '-').replace(/\s+/g, '-').toLowerCase();
}

export function formatDate (isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function relativeTime (isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function highlightTerms (text, search) {
  if (!search || !text) return [text];
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [text];
  const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(${pattern})`, 'gi');
  return text.split(re);
}

export async function copyToClipboard (text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
}
