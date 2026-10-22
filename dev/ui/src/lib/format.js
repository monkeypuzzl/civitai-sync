const TAG_LABELS = {
  'favorite': '\u2764\uFE0F Favorite',
  'feedback:liked': '\uD83D\uDC4D Liked',
  'feedback:disliked': '\uD83D\uDC4E Disliked'
};

export function isReactionToken (t) {
  return t === 'favorite' || t === 'feedback:liked' || t === 'feedback:disliked';
}

/** Owner marks. `reactions` wins when the tile or the detail record set it. */
export function reactionMarks (item) {
  if (Array.isArray(item?.reactions)) return item.reactions;
  const tags = item?.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter(isReactionToken);
}

// Owner tokens for one container member. A `reactions` array wins, including
// `[]`, so a hidden-only member shows no icon. Otherwise the owner tokens in
// `tags`, in list order. The container's rolled-up tags are not an argument.
export function memberReactionFields (member) {
  const row = member && typeof member === 'object' ? member : {};
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const reactions = Array.isArray(row.reactions)
    ? row.reactions.filter(isReactionToken)
    : tags.filter(isReactionToken);
  return { tags, reactions };
}

// One generation-batch member as a gallery tile. Identity stays `mediaId`.
// Post and comic pages keep their own ids and call `memberReactionFields`.
export function generationMemberTile (member) {
  const row = member && typeof member === 'object' ? member : {};
  const type = row.type;
  const id = normalizeMediaId(row.mediaId);
  const { tags, reactions } = memberReactionFields(row);
  return {
    id,
    type,
    tags,
    reactions,
    media: [{
      mediaId: id,
      type,
      thumbnailPath: row.thumbnailPath,
      tags,
      duration: row.duration
    }]
  };
}

export function tagLabel (tag) {
  if (typeof tag === 'object') return tag.name;
  return TAG_LABELS[tag] || tag;
}

export function tagCssClass (tag) {
  const name = typeof tag === 'string' ? tag : tag.name || '';
  return name.replace(/:/g, '-').replace(/\s+/g, '-').toLowerCase();
}

// Comic project genre. Same split Civitai uses: "SliceOfLife" → "Slice Of Life".
export function genreLabel (value) {
  if (typeof value !== 'string') return '';
  const token = value.trim();
  if (!token) return '';
  return token.replace(/([A-Z])/g, ' $1').trim();
}

// Optimistic client-side projection of a reaction edit onto a media item's
// workflow tags, mirroring the server's reactions→tags mapping. `edit` is a
// partial { favorite?, feedback? }: favorite toggles the `favorite` tag;
// feedback ('liked' | 'disliked' | null) is single-valued, so setting one
// evicts the other. Returns a new sorted array; the server response settles
// the authoritative value afterward.
export function nextTagsForReaction (tags, edit) {
  const set = new Set(Array.isArray(tags) ? tags : []);
  if ('favorite' in edit) {
    if (edit.favorite) set.add('favorite');
    else set.delete('favorite');
  }
  if ('feedback' in edit) {
    set.delete('feedback:liked');
    set.delete('feedback:disliked');
    if (edit.feedback === 'liked') set.add('feedback:liked');
    else if (edit.feedback === 'disliked') set.add('feedback:disliked');
  }
  return [...set].sort();
}

// UI mirror of src/mediaId.mjs's normalizeMediaId — kept here (not imported
// from the Node backend) so the bundled UI stays self-contained. The select
// URL value uses this normalized id-space (steward ruling 7) so a shared
// `?select=<id>` matches the same media item the server keys on.
const MEDIA_FILE_EXTS = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'mp4', 'webm', 'wav', 'mp3', 'flac', 'ogg', 'glb'];

export function normalizeMediaId (id) {
  const s = String(id ?? '');
  const dot = s.lastIndexOf('.');
  if (dot === -1) return s;
  return MEDIA_FILE_EXTS.includes(s.slice(dot + 1).toLowerCase()) ? s.slice(0, dot) : s;
}

// Resolve a `select=<media-item-id>` URL value to the index of the loaded
// gallery entry (generation batch) whose media contains that item, or -1
// when it isn't in the currently filtered + sorted set (steward ruling 7;
// explorer-url-protocol.md § Selection). The select id is the NORMALIZED
// media id (extension stripped); a loaded entry's `media[].mediaId` may
// still carry an extension, so match on equality or a dotted prefix — the
// same loose match `findMediaTagsFromResponse` uses, no extension table
// needed. Pure → unit-tested without a DOM harness.
export function resolveSelect (items, selectId) {
  if (!selectId || !Array.isArray(items)) return -1;
  for (let i = 0; i < items.length; i++) {
    const media = items[i] && items[i].media;
    if (!Array.isArray(media)) continue;
    const hit = media.some(m => m && (m.mediaId === selectId || String(m.mediaId).startsWith(`${selectId}.`)));
    if (hit) return i;
  }
  return -1;
}

// Stage size for the media player. The stage is sized from the pane and
// this ratio. The file paints inside it and does not change the box.
// Produced pixels win. A class-only item gets a stand-in ratio.
export function mediaStageStyle (record) {
  const w = Number(record && record.width);
  const h = Number(record && record.height);
  let rw = 0;
  let rh = 0;
  if (w > 0 && h > 0) {
    rw = w;
    rh = h;
  } else {
    const cls = record && record.aspectClass;
    if (cls === 'portrait') { rw = 2; rh = 3; }
    else if (cls === 'landscape') { rw = 3; rh = 2; }
    else if (cls === 'square') { rw = 1; rh = 1; }
  }
  if (!(rw > 0) || !(rh > 0)) return null;
  return {
    '--media-w': String(rw),
    '--media-h': String(rh),
    aspectRatio: `${rw} / ${rh}`
  };
}

// A downloaded cover still, not the playback file. Empty when there is none.
export function coverStillPath (record) {
  if (!record) return '';
  if (record.coverPath) return record.coverPath;
  const inputs = record.inputs;
  if (!Array.isArray(inputs)) return '';
  for (const inp of inputs) {
    if (inp && inp.role === 'cover' && inp.thumbnailPath) return inp.thumbnailPath;
  }
  return '';
}

// Cover-mode audio is an `.mp4`/`.webm` (the muxed still is the file's only
// video frame). The media-page player uses this. Thumbnails use
// `thumbnailVisual` and prefer a downloaded cover still.
export function isAudioCover (media) {
  if (!media || media.type !== 'audio') return false;
  const ref = media.thumbnailPath || media.mediaId || '';
  return /\.(mp4|webm)(\?|#|$)/i.test(ref);
}

// Thumbnail element choice. A local cover still is always an image. Without
// one, cover-mode audio and video stay a non-playing video preview; pure
// audio is the glyph. `src` is omitted for the glyph.
export function thumbnailVisual ({ type, thumbnailPath, coverPath } = {}) {
  if (coverPath) return { kind: 'image', src: coverPath };
  if (type === 'audio') {
    if (isAudioCover({ type, thumbnailPath })) return { kind: 'video', src: thumbnailPath };
    return { kind: 'glyph' };
  }
  if (type === 'video') return { kind: 'video', src: thumbnailPath };
  return { kind: 'image', src: thumbnailPath };
}

// Format a duration in seconds as m:ss (e.g. 95 -> "1:35"). Empty string for
// missing / non-positive values so callers can &&-guard the chip.
export function formatDuration (seconds) {
  const n = Number(seconds);
  if (!(n > 0)) return '';
  const total = Math.round(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Media-item type counts for the Overview lanes. Omit any type whose count
// is 0; "audio" is invariant (never "audios"); "3D" is invariant (never
// "3Ds"); join with " · ".
export function formatMediaCounts (counts) {
  if (!counts) return '';
  const parts = [];
  const image = Number(counts.image) || 0;
  const video = Number(counts.video) || 0;
  const audio = Number(counts.audio) || 0;
  if (image) parts.push(`${image} ${image === 1 ? 'image' : 'images'}`);
  if (video) parts.push(`${video} ${video === 1 ? 'video' : 'videos'}`);
  if (audio) parts.push(`${audio} audio`);
  const model3d = Number(counts.model3d) || 0;
  if (model3d) parts.push(`${model3d} 3D`);
  return parts.join(' · ');
}

export function formatDate (isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TIME_MONTH = /^(\d{4})-(\d{2})$/;
const TIME_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const CHIP_SECONDS = /^([1-9]\d*)s$/;

// Machine value for a <time> attribute. The string is returned unchanged.
// A local timezone must not rewrite it.
export function timeDatetime (value) {
  if (typeof value !== 'string' || value === '') return '';
  const month = TIME_MONTH.exec(value);
  if (month) {
    const m = Number(month[2]);
    return m >= 1 && m <= 12 ? value : '';
  }
  const day = TIME_DAY.exec(value);
  if (day) {
    const y = Number(day[1]);
    const m = Number(day[2]);
    const d = Number(day[3]);
    const utc = new Date(Date.UTC(y, m - 1, d));
    if (
      utc.getUTCFullYear() !== y ||
      utc.getUTCMonth() !== m - 1 ||
      utc.getUTCDate() !== d
    ) return '';
    return value;
  }
  if (TIME_INSTANT.test(value) && !Number.isNaN(new Date(value).getTime())) return value;
  return '';
}

// File-length chips only. 5s → PT5S. Resolution, tempo, and weights stay ''.
export function chipDatetime (text) {
  if (typeof text !== 'string') return '';
  const match = CHIP_SECONDS.exec(text);
  return match ? `PT${match[1]}S` : '';
}

// Local calendar dates. An instant yesterday evening is 1, even when fewer
// than 24 hours have passed. `now` is injectable so a test can pin the clock.
export function calendarDaysAgo (isoString, now = new Date()) {
  if (!isoString) return null;
  const then = new Date(isoString);
  if (Number.isNaN(then.getTime())) return null;
  const thenDay = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowDay - thenDay) / 86400000);
}

export function relativeTime (isoString, now = new Date()) {
  const days = calendarDaysAgo(isoString, now);
  if (days == null) return '';
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

// Count heading for a media-item container edge. Omit the section when
// this returns '' (count < 1). Kind keys match native containers.
const CONTAINER_EDGE_WORDS = {
  generation: ['Generation', 'Generations'],
  post: ['Post', 'Posts'],
  comic: ['Comic', 'Comics']
};

export function containerEdgeHeading (kind, count) {
  const n = Number(count);
  if (!(n >= 1)) return '';
  const words = CONTAINER_EDGE_WORDS[kind];
  if (!words) return '';
  return n === 1 ? words[0] : `${n} ${words[1]}`;
}

// Post / Comic edge row: date · title. Omit a blank trimmed title.
// Id is last-resort only when both date and title are empty.
// `date` is the formatted date alone; `tail` is the rest of the row.
export function containerEdgeRowParts ({ date, title, id } = {}) {
  const dateStr = date == null ? '' : String(date).trim();
  const titleStr = title == null ? '' : String(title).trim();
  if (dateStr && titleStr) return { date: dateStr, tail: ` \u00B7 ${titleStr}` };
  if (dateStr) return { date: dateStr, tail: '' };
  if (titleStr) return { date: '', tail: titleStr };
  if (id == null || id === '') return { date: '', tail: '' };
  const idStr = String(id).trim();
  return { date: '', tail: idStr };
}

export function containerEdgeRowText (row) {
  const { date, tail } = containerEdgeRowParts(row);
  return date + tail;
}

const INPUT_MEDIA_ROLE_LABELS = {
  'first-frame': 'First frame',
  'last-frame': 'Last frame',
  'start-image': 'Start image',
  'end-image': 'End image',
  source: 'Source',
  controlnet: 'ControlNet',
  'source-video': 'Source video',
  reference: 'Reference',
  cover: 'Cover',
  input: 'Input'
};

function inputMediaTypeWord (item) {
  const raw = item && (item.kind || item.type);
  if (raw === 'video') return 'Video';
  if (raw === 'audio') return 'Audio';
  return 'Image';
}

function inputMediaRoleKey (item) {
  const role = item && item.role;
  if (role == null || role === '') return 'input';
  return String(role);
}

function inputMediaSlotLabel (role) {
  if (Object.prototype.hasOwnProperty.call(INPUT_MEDIA_ROLE_LABELS, role)) {
    return INPUT_MEDIA_ROLE_LABELS[role];
  }
  const spaced = role.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Input Media strip. Same length as items; empty in → empty out.
// `#n` only when that role is repeated; n is 1-based within the role.
export function inputMediaCaptions (items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const roles = items.map(inputMediaRoleKey);
  const counts = new Map();
  for (const role of roles) counts.set(role, (counts.get(role) || 0) + 1);
  const seen = new Map();
  return items.map((item, i) => {
    const role = roles[i];
    const n = (seen.get(role) || 0) + 1;
    seen.set(role, n);
    const typeWord = inputMediaTypeWord(item);
    if (counts.get(role) === 1) {
      return `${typeWord} \u00B7 ${inputMediaSlotLabel(role)}`;
    }
    if (role === 'input') return `${typeWord} \u00B7 #${n}`;
    return `${typeWord} \u00B7 ${inputMediaSlotLabel(role)} #${n}`;
  });
}

// UI mirror of derivePostStatus (src/explorerQuery.mjs) — the UI bundle
// must not import that module. Published → no extra label; else Draft /
// Scheduled. Do not use a frozen postRef.status.
export function postStatusLabel (publishedAt, now = Date.now()) {
  if (!publishedAt) return 'Draft';
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return '';
  return t > now ? 'Scheduled' : '';
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
