import {
  k,
  u
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/lib/format.js
var TAG_LABELS = {
  "favorite": "\u2764\uFE0F Favorite",
  "feedback:liked": "\u{1F44D} Liked",
  "feedback:disliked": "\u{1F44E} Disliked"
};
function isReactionToken(t) {
  return t === "favorite" || t === "feedback:liked" || t === "feedback:disliked";
}
function reactionMarks(item) {
  if (Array.isArray(item?.reactions)) return item.reactions;
  const tags = item?.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter(isReactionToken);
}
function generationMemberTile(member) {
  const row = member && typeof member === "object" ? member : {};
  const type = row.type;
  const id = normalizeMediaId(row.mediaId);
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const reactions = tags.filter(isReactionToken);
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
function tagLabel(tag) {
  if (typeof tag === "object") return tag.name;
  return TAG_LABELS[tag] || tag;
}
function tagCssClass(tag) {
  const name = typeof tag === "string" ? tag : tag.name || "";
  return name.replace(/:/g, "-").replace(/\s+/g, "-").toLowerCase();
}
function nextTagsForReaction(tags, edit) {
  const set = new Set(Array.isArray(tags) ? tags : []);
  if ("favorite" in edit) {
    if (edit.favorite) set.add("favorite");
    else set.delete("favorite");
  }
  if ("feedback" in edit) {
    set.delete("feedback:liked");
    set.delete("feedback:disliked");
    if (edit.feedback === "liked") set.add("feedback:liked");
    else if (edit.feedback === "disliked") set.add("feedback:disliked");
  }
  return [...set].sort();
}
var MEDIA_FILE_EXTS = ["jpeg", "jpg", "png", "webp", "gif", "mp4", "webm", "wav", "mp3", "flac", "ogg", "glb"];
function normalizeMediaId(id) {
  const s = String(id ?? "");
  const dot = s.lastIndexOf(".");
  if (dot === -1) return s;
  return MEDIA_FILE_EXTS.includes(s.slice(dot + 1).toLowerCase()) ? s.slice(0, dot) : s;
}
function mediaStageStyle(record) {
  const w = Number(record && record.width);
  const h = Number(record && record.height);
  let rw = 0;
  let rh = 0;
  if (w > 0 && h > 0) {
    rw = w;
    rh = h;
  } else {
    const cls = record && record.aspectClass;
    if (cls === "portrait") {
      rw = 2;
      rh = 3;
    } else if (cls === "landscape") {
      rw = 3;
      rh = 2;
    } else if (cls === "square") {
      rw = 1;
      rh = 1;
    }
  }
  if (!(rw > 0) || !(rh > 0)) return null;
  return {
    "--media-w": String(rw),
    "--media-h": String(rh),
    aspectRatio: `${rw} / ${rh}`
  };
}
function coverStillPath(record) {
  if (!record) return "";
  if (record.coverPath) return record.coverPath;
  const inputs = record.inputs;
  if (!Array.isArray(inputs)) return "";
  for (const inp of inputs) {
    if (inp && inp.role === "cover" && inp.thumbnailPath) return inp.thumbnailPath;
  }
  return "";
}
function isAudioCover(media) {
  if (!media || media.type !== "audio") return false;
  const ref = media.thumbnailPath || media.mediaId || "";
  return /\.(mp4|webm)(\?|#|$)/i.test(ref);
}
function thumbnailVisual({ type, thumbnailPath, coverPath } = {}) {
  if (coverPath) return { kind: "image", src: coverPath };
  if (type === "audio") {
    if (isAudioCover({ type, thumbnailPath })) return { kind: "video", src: thumbnailPath };
    return { kind: "glyph" };
  }
  if (type === "video") return { kind: "video", src: thumbnailPath };
  return { kind: "image", src: thumbnailPath };
}
function formatMediaCounts(counts) {
  if (!counts) return "";
  const parts = [];
  const image = Number(counts.image) || 0;
  const video = Number(counts.video) || 0;
  const audio = Number(counts.audio) || 0;
  if (image) parts.push(`${image} ${image === 1 ? "image" : "images"}`);
  if (video) parts.push(`${video} ${video === 1 ? "video" : "videos"}`);
  if (audio) parts.push(`${audio} audio`);
  const model3d = Number(counts.model3d) || 0;
  if (model3d) parts.push(`${model3d} 3D`);
  return parts.join(" \xB7 ");
}
function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
var TIME_MONTH = /^(\d{4})-(\d{2})$/;
var TIME_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
var TIME_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
var CHIP_SECONDS = /^([1-9]\d*)s$/;
function timeDatetime(value) {
  if (typeof value !== "string" || value === "") return "";
  const month = TIME_MONTH.exec(value);
  if (month) {
    const m = Number(month[2]);
    return m >= 1 && m <= 12 ? value : "";
  }
  const day = TIME_DAY.exec(value);
  if (day) {
    const y = Number(day[1]);
    const m = Number(day[2]);
    const d = Number(day[3]);
    const utc = new Date(Date.UTC(y, m - 1, d));
    if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) return "";
    return value;
  }
  if (TIME_INSTANT.test(value) && !Number.isNaN(new Date(value).getTime())) return value;
  return "";
}
function chipDatetime(text) {
  if (typeof text !== "string") return "";
  const match = CHIP_SECONDS.exec(text);
  return match ? `PT${match[1]}S` : "";
}
function calendarDaysAgo(isoString, now = /* @__PURE__ */ new Date()) {
  if (!isoString) return null;
  const then = new Date(isoString);
  if (Number.isNaN(then.getTime())) return null;
  const thenDay = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowDay - thenDay) / 864e5);
}
function relativeTime(isoString, now = /* @__PURE__ */ new Date()) {
  const days = calendarDaysAgo(isoString, now);
  if (days == null) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}
function highlightTerms(text, search) {
  if (!search || !text) return [text];
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [text];
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  return text.split(re);
}
var CONTAINER_EDGE_WORDS = {
  generation: ["Generation", "Generations"],
  post: ["Post", "Posts"],
  comic: ["Comic", "Comics"]
};
function containerEdgeHeading(kind, count) {
  const n = Number(count);
  if (!(n >= 1)) return "";
  const words = CONTAINER_EDGE_WORDS[kind];
  if (!words) return "";
  return n === 1 ? words[0] : `${n} ${words[1]}`;
}
function containerEdgeRowParts({ date, title, id } = {}) {
  const dateStr = date == null ? "" : String(date).trim();
  const titleStr = title == null ? "" : String(title).trim();
  if (dateStr && titleStr) return { date: dateStr, tail: ` \xB7 ${titleStr}` };
  if (dateStr) return { date: dateStr, tail: "" };
  if (titleStr) return { date: "", tail: titleStr };
  if (id == null || id === "") return { date: "", tail: "" };
  const idStr = String(id).trim();
  return { date: "", tail: idStr };
}
var INPUT_MEDIA_ROLE_LABELS = {
  "first-frame": "First frame",
  "last-frame": "Last frame",
  "start-image": "Start image",
  "end-image": "End image",
  source: "Source",
  controlnet: "ControlNet",
  "source-video": "Source video",
  reference: "Reference",
  cover: "Cover",
  input: "Input"
};
function inputMediaTypeWord(item) {
  const raw = item && (item.kind || item.type);
  if (raw === "video") return "Video";
  if (raw === "audio") return "Audio";
  return "Image";
}
function inputMediaRoleKey(item) {
  const role = item && item.role;
  if (role == null || role === "") return "input";
  return String(role);
}
function inputMediaSlotLabel(role) {
  if (Object.prototype.hasOwnProperty.call(INPUT_MEDIA_ROLE_LABELS, role)) {
    return INPUT_MEDIA_ROLE_LABELS[role];
  }
  const spaced = role.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
function inputMediaCaptions(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const roles = items.map(inputMediaRoleKey);
  const counts = /* @__PURE__ */ new Map();
  for (const role of roles) counts.set(role, (counts.get(role) || 0) + 1);
  const seen = /* @__PURE__ */ new Map();
  return items.map((item, i) => {
    const role = roles[i];
    const n = (seen.get(role) || 0) + 1;
    seen.set(role, n);
    const typeWord = inputMediaTypeWord(item);
    if (counts.get(role) === 1) {
      return `${typeWord} \xB7 ${inputMediaSlotLabel(role)}`;
    }
    if (role === "input") return `${typeWord} \xB7 #${n}`;
    return `${typeWord} \xB7 ${inputMediaSlotLabel(role)} #${n}`;
  });
}
function postStatusLabel(publishedAt, now = Date.now()) {
  if (!publishedAt) return "Draft";
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return "";
  return t > now ? "Scheduled" : "";
}
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

// dev/ui/src/components/TimeText.jsx
function TimeText({ at, datetime, class: className, children }) {
  if (children == null || children === false || children === "") return null;
  const resolved = datetime != null && datetime !== "" ? String(datetime) : timeDatetime(at);
  if (!resolved) {
    if (className) return /* @__PURE__ */ u("span", { class: className, children });
    return /* @__PURE__ */ u(k, { children });
  }
  return /* @__PURE__ */ u("time", { class: className, datetime: resolved, children });
}

export {
  reactionMarks,
  generationMemberTile,
  tagLabel,
  tagCssClass,
  nextTagsForReaction,
  normalizeMediaId,
  mediaStageStyle,
  coverStillPath,
  isAudioCover,
  thumbnailVisual,
  formatMediaCounts,
  formatDate,
  chipDatetime,
  calendarDaysAgo,
  relativeTime,
  highlightTerms,
  containerEdgeHeading,
  containerEdgeRowParts,
  inputMediaCaptions,
  postStatusLabel,
  copyToClipboard,
  TimeText
};
