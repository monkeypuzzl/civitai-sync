import {
  WIRE
} from "./chunk-GOKE7NMO.js";

// src/mediaId.mjs
var MEDIA_FILE_EXTS = ["jpeg", "jpg", "png", "webp", "gif", "mp4", "webm", "wav", "mp3", "flac", "ogg", "glb"];
function normalizeMediaId(id) {
  const s = String(id ?? "");
  const dotIdx = s.lastIndexOf(".");
  if (dotIdx === -1) return s;
  const ext = s.slice(dotIdx + 1).toLowerCase();
  if (MEDIA_FILE_EXTS.includes(ext)) return s.slice(0, dotIdx);
  return s;
}

// src/parameters.mjs
var ALWAYS_OMIT = /* @__PURE__ */ new Set([
  "prompt",
  "Prompt",
  "negativePrompt",
  "Negative prompt",
  "musicDescription",
  "lyrics",
  "simplePrompt",
  "songConcept",
  "title",
  "workflow",
  "Model",
  "width",
  "height",
  "Size",
  "upscaleWidth",
  "upscaleHeight"
]);
var PARAMETER_OMISSIONS = /* @__PURE__ */ new Set([
  "Created Date",
  "air",
  WIRE.allowContent,
  "animaVariant",
  "animationActionId",
  "batchSize",
  "booguMode",
  "civitaiTip",
  "comfy",
  "createdAt",
  "createdDate",
  "creatorTip",
  "disablePoi",
  "ernieVariant",
  "experimental",
  "flux2KleinMode",
  "flux2Mode",
  "fluxMode",
  "fluxUltraAspectRatio",
  "generateCover",
  "hiDreamO1Variant",
  "hiDreamVariant",
  "hunyuanPrompt",
  "image",
  "input",
  "klingVersion",
  "krea2Variant",
  "lensVariant",
  "ltxVersion",
  "mageFlowVariant",
  "minimaxVariant",
  "nanoBananaMode",
  WIRE.modelFlag,
  "openaiVariant",
  "operation",
  "output",
  "outputFormat",
  "priority",
  "quantity",
  "remixOfId",
  "sourceImage",
  "sourceImageUrl",
  "wanImageVersion",
  "wanVersion",
  "whatIf",
  "workflowKind",
  "yue2Abc",
  "zImageMode"
]);
var TEXT_LIMIT = 80;
var MODEL_IDENTITY = /* @__PURE__ */ new Set(["ecosystem", "engine", "version", "baseModel"]);
function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
function splitUppercase(value) {
  return String(value).trim().split(/([A-Z][a-z]+|[0-9]+)/).map((word) => word.trim()).filter(Boolean).join(" ");
}
function titleCase(value) {
  const s = String(value);
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}
function paramLabel(key) {
  return titleCase(splitUppercase(key));
}
function undefinedToken(value) {
  return typeof value === "string" && value.trim().toLowerCase() === "undefined";
}
function blankString(value) {
  return typeof value === "string" && value.trim() === "";
}
function positivePair(pair) {
  const w = Number(pair && pair.width);
  const h = Number(pair && pair.height);
  if (!(w > 0) || !(h > 0)) return null;
  return { width: w, height: h };
}
function resolutionString(value) {
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (!s || s.toLowerCase() === "undefined") return "";
  return s;
}
function durationChip(seconds) {
  const n = Number(seconds);
  if (!(n > 0)) return "";
  return `${Math.round(n)}s`;
}
function finitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function shownKey(value) {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return s !== "" && s.toLowerCase() !== "undefined";
}
function memberSeedShown(value) {
  if (value == null || value === "") return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s || s.toLowerCase() === "undefined") return false;
    if (Number(s) === 0) return false;
    return true;
  }
  return true;
}
function seedText(value) {
  if (typeof value === "number") return `Seed ${String(value)}`;
  if (typeof value === "string") return `Seed ${value.trim()}`;
  return `Seed ${String(value)}`;
}
function displayValue(value) {
  if (typeof value === "boolean") return "true";
  if (typeof value === "number") return String(value);
  return String(value);
}
function droppedValue(value) {
  if (Array.isArray(value) || typeof value === "object") return true;
  if (typeof value === "string") return blankString(value) || undefinedToken(value);
  return !value;
}
function variantMotion(files) {
  let animated = false;
  let rigged = false;
  const list = Array.isArray(files) ? files : [];
  for (const file of list) {
    if (!file || typeof file !== "object") continue;
    const variant = typeof file.variant === "string" ? file.variant.trim().toLowerCase() : "";
    if (!variant) continue;
    if (variant === "animated" || variant.startsWith("walking") || variant.startsWith("running")) {
      animated = true;
    } else if (variant === "rigged") {
      rigged = true;
    }
  }
  return { animated, rigged };
}
function audioField(snapshot, audio, key) {
  if (isPlainObject(snapshot) && Object.prototype.hasOwnProperty.call(snapshot, key)) {
    return snapshot[key];
  }
  if (isPlainObject(audio) && Object.prototype.hasOwnProperty.call(audio, key)) {
    return audio[key];
  }
  return void 0;
}
function headerChip(text, title) {
  return { text, title };
}
function polycountText(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1e3 && n % 1e3 === 0) return `${n / 1e3}K`;
  return String(n);
}
function headerFrom(input) {
  const type = input && input.type;
  const snapshot = isPlainObject(input && input.snapshot) ? input.snapshot : null;
  const chips = [];
  const claimed = [];
  if (type === "image" || type === "video") {
    const size = positivePair(input.produced);
    if (size) {
      chips.push(headerChip(`${size.width}\xD7${size.height}`, "Size"));
      claimed.push("aspectRatio");
      if (type === "image") claimed.push("resolution");
    }
  }
  if (type === "video") {
    const res = resolutionString(input.resolution);
    if (res) {
      chips.push(headerChip(res, "Resolution"));
      claimed.push("resolution");
    }
    const dur = durationChip(input.durationSeconds);
    if (dur) {
      chips.push(headerChip(dur, "Duration"));
      claimed.push("duration");
    }
  }
  if (type === "audio") {
    const bpm = finitePositive(audioField(snapshot, input.audio, "bpm"));
    if (bpm != null) {
      chips.push(headerChip(`${bpm} BPM`, "BPM"));
      claimed.push("bpm");
    }
    const key = audioField(snapshot, input.audio, "key");
    if (shownKey(key)) {
      chips.push(headerChip(String(key).trim(), "Key"));
      claimed.push("key");
    }
    const dur = durationChip(input.durationSeconds);
    if (dur) {
      chips.push(headerChip(dur, "Duration"));
      claimed.push("duration");
    }
  }
  if (type === "model3d" && snapshot) {
    if (snapshot.modelType !== "lowpoly") {
      const count = polycountText(snapshot.targetPolycount) || polycountText(snapshot.faceLimit);
      if (count) {
        chips.push(headerChip(count, "Polycount"));
        claimed.push("targetPolycount", "faceLimit");
      }
    }
    const topology = snapshot.topology;
    if (topology === "triangle" || topology === "quad") {
      chips.push(headerChip(topology === "quad" ? "Quads" : "Triangles", "Topology"));
      claimed.push("topology", "quad");
    } else if (snapshot.quad === true || snapshot.quad === false) {
      chips.push(headerChip(snapshot.quad === true ? "Quads" : "Triangles", "Topology"));
      claimed.push("topology", "quad");
    }
    const motion = variantMotion(input.files);
    const animated = motion.animated || snapshot.enableAnimation === true;
    const rigged = motion.rigged || snapshot.enableRigging === true;
    if (animated || rigged) {
      chips.push(headerChip(animated ? "Animated" : "Rigged", animated ? "Animation" : "Rigging"));
      claimed.push("enableAnimation", "enableRigging");
    }
  }
  return { chips, claimed };
}
function holeFill(gen) {
  const step = Array.isArray(gen.steps) ? gen.steps[0] : void 0;
  const fromMeta = gen.metadata && isPlainObject(gen.metadata.params) ? gen.metadata.params : null;
  const fromStep = step && isPlainObject(step.params) ? step.params : null;
  const primary = fromMeta || fromStep || {};
  const fill = step && step.metadata && isPlainObject(step.metadata.params) ? step.metadata.params : {};
  const params = { ...primary };
  for (const [key, value] of Object.entries(fill)) {
    if (params[key] == null || params[key] === "") params[key] = value;
  }
  return params;
}
function idsOf(record) {
  if (!record || typeof record !== "object") return [];
  const image = record.image;
  return [record.id, record.imageId, image && image.id, image && image.name, record.name];
}
function recordMatches(record, want) {
  for (const id of idsOf(record)) {
    if (id == null || id === "") continue;
    if (normalizeMediaId(id) === want) return true;
  }
  return false;
}
function metaOf(record) {
  if (!record || typeof record !== "object") return null;
  if (isPlainObject(record.meta)) return record.meta;
  if (record.image && isPlainObject(record.image.meta)) return record.image.meta;
  return null;
}
function snapshotFromRaw(raw, mediaId) {
  if (!isPlainObject(raw)) return null;
  if (Array.isArray(raw.steps) || isPlainObject(raw.metadata)) return holeFill(raw);
  const want = mediaId == null || mediaId === "" ? "" : normalizeMediaId(mediaId);
  if (!want) return null;
  if (Array.isArray(raw.images)) {
    for (const image of raw.images) {
      if (recordMatches(image, want)) return metaOf(image);
    }
    return null;
  }
  if (Array.isArray(raw.chapters)) {
    for (const chapter of raw.chapters) {
      const panels = chapter && Array.isArray(chapter.panels) ? chapter.panels : [];
      for (const panel of panels) {
        if (recordMatches(panel, want)) return metaOf(panel);
      }
    }
    return null;
  }
  return null;
}
function sourceObject(snapshot, fallback) {
  if (isPlainObject(snapshot)) return snapshot;
  if (isPlainObject(fallback)) return fallback;
  return null;
}
function titleLine(snapshot) {
  if (!isPlainObject(snapshot)) return "";
  const title = snapshot.title;
  if (!shownKey(title)) return "";
  return String(title).trim();
}
function fillText(snapshot, key) {
  if (!isPlainObject(snapshot)) return "";
  const value = snapshot[key];
  if (!shownKey(value)) return "";
  return String(value).trim();
}
function digitsOnlyResolution(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  return /^\d+$/.test(value.trim());
}
function detailFacts(input = {}) {
  const snapshot = isPlainObject(input.snapshot) ? input.snapshot : null;
  const header = headerFrom({ ...input, snapshot });
  const claimed = new Set(header.claimed);
  const source = sourceObject(snapshot, input.fallback);
  const showSeed = input.showSeed === true;
  const seedValue = input.seed;
  const rows = [];
  const texts = [];
  const chips = [];
  let seedKeyPresent = false;
  let seedPlaced = false;
  const pushChip = (text) => {
    chips.push(text);
    rows.push({ kind: "chip", label: "", value: "", text });
  };
  const pushText = (label, value) => {
    texts.push({ label, value });
    rows.push({ kind: "text", label, value, text: "" });
  };
  const pushSeed = () => {
    if (!showSeed || seedPlaced || !memberSeedShown(seedValue)) return;
    seedPlaced = true;
    pushChip(seedText(seedValue));
  };
  if (source) {
    for (const [key, value] of Object.entries(source)) {
      if (key === "seed" || key === "Seed") {
        seedKeyPresent = true;
        pushSeed();
        continue;
      }
      if (ALWAYS_OMIT.has(key) || PARAMETER_OMISSIONS.has(key)) continue;
      if (key.toLowerCase().includes("hash")) continue;
      if (input.omitModelIdentity === true && MODEL_IDENTITY.has(key)) continue;
      if (input.omitWorkflowAliases === true && (key === "process" || key === "type")) continue;
      if (claimed.has(key)) continue;
      if (droppedValue(value)) continue;
      if (key === "resolution" && digitsOnlyResolution(value)) continue;
      const label = paramLabel(key);
      const shown = displayValue(value);
      if (shown.length > TEXT_LIMIT || shown.includes("\n")) pushText(label, shown);
      else pushChip(`${label} ${shown}`);
    }
  }
  if (showSeed && !seedKeyPresent) pushSeed();
  return {
    headerChips: header.chips,
    claimedKeys: header.claimed,
    title: titleLine(snapshot),
    texts,
    chips,
    rows,
    promptText: fillText(snapshot, "hunyuanPrompt"),
    lyricsText: fillText(snapshot, "yue2Abc")
  };
}

// dev/ui/src/lib/param-display.js
function positivePair2(pair) {
  const w = Number(pair && pair.width);
  const h = Number(pair && pair.height);
  if (!(w > 0) || !(h > 0)) return null;
  return { width: w, height: h };
}
function agreedProducedPair(members) {
  const list = Array.isArray(members) ? members : [];
  if (!list.length) return null;
  let agreed = null;
  for (const member of list) {
    const pair = positivePair2(member);
    if (!pair) return null;
    if (!agreed) {
      agreed = pair;
      continue;
    }
    if (agreed.width !== pair.width || agreed.height !== pair.height) return null;
  }
  return agreed;
}
var TYPE_WORD = { image: "Image", video: "Video", audio: "Audio", model3d: "3D" };
function resolutionString2(value) {
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (!s || s.toLowerCase() === "undefined") return "";
  return s;
}
function entityHeaderLabel(place, mediaType) {
  if (place === "post") return "Post";
  if (place === "comic") return "Comic";
  if (place === "media") return TYPE_WORD[mediaType] || "";
  if (place === "generation") {
    const word = TYPE_WORD[mediaType] || "";
    return word ? `Generation \xB7 ${word}` : "Generation";
  }
  return "";
}
function sharedMediaType(members) {
  const list = Array.isArray(members) ? members : [];
  if (!list.length) return "";
  const type = list[0] && list[0].type;
  if (!TYPE_WORD[type]) return "";
  for (const member of list) {
    if (!member || member.type !== type) return "";
  }
  return type;
}
function agreedDurationSeconds(members) {
  const list = Array.isArray(members) ? members : [];
  if (!list.length) return null;
  let agreed = null;
  for (const member of list) {
    const n = Number(member && member.duration);
    if (!(n > 0)) return null;
    const rounded = Math.round(n);
    if (agreed == null) agreed = rounded;
    else if (agreed !== rounded) return null;
  }
  return agreed;
}
function jobResolutionLabel(raw) {
  if (!raw || typeof raw !== "object") return "";
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  const sources = [
    raw.metadata && raw.metadata.params,
    steps[0] && steps[0].params,
    steps[0] && steps[0].metadata && steps[0].metadata.params
  ];
  if (!sources.some(Boolean)) return "";
  for (const src of sources) {
    const label = resolutionString2(src && src.resolution);
    if (label) return label;
  }
  return "";
}
function pathBasename(value) {
  const s = String(value || "").replace(/\\/g, "/");
  const cut = s.lastIndexOf("/");
  return cut >= 0 ? s.slice(cut + 1) : s;
}
function extensionFormat(value) {
  const base = pathBasename(value);
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}
function storedFormat(value, pathFallback) {
  if (typeof value === "string") {
    const s = value.trim().replace(/^\./, "").toLowerCase();
    if (s) return s;
  }
  return extensionFormat(pathFallback);
}
function storedLabel(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}
function formatDisplayName(format) {
  return format ? format.toUpperCase() : "";
}
function variantDisplayName(variant) {
  const raw = storedLabel(variant);
  if (!raw || raw.toLowerCase() === "primary") return "";
  return raw.split("-").filter(Boolean).map((part) => {
    const lower = part.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" ");
}
function isPreviewFile(file) {
  return storedLabel(file && file.role).toLowerCase() === "thumb";
}
function model3dFileRows({ mediaPath, files } = {}) {
  const rows = [];
  const primary = typeof mediaPath === "string" ? mediaPath : "";
  const primaryBase = primary ? pathBasename(primary) : "";
  if (primary) {
    const format = extensionFormat(primary);
    rows.push({
      label: formatDisplayName(format),
      format,
      path: primary
    });
  }
  const list = Array.isArray(files) ? files : [];
  for (const file of list) {
    if (!file || typeof file !== "object") continue;
    if (isPreviewFile(file)) continue;
    const filePath = typeof file.path === "string" ? file.path : "";
    if (!filePath) continue;
    if (primaryBase && pathBasename(filePath) === primaryBase) continue;
    const format = storedFormat(file.format, filePath);
    const label = variantDisplayName(file.variant) || formatDisplayName(format);
    rows.push({ label, format, path: filePath });
  }
  return rows;
}
function model3dShownFormat(row) {
  const format = storedFormat(row && row.format, "");
  if (!format) return "";
  if (storedLabel(row && row.label).toLowerCase() === format) return "";
  return format.toUpperCase();
}
var VIEWABLE_MESH_EXT = /* @__PURE__ */ new Set(["glb", "gltf"]);
function variantIsArmature(file) {
  return storedLabel(file && file.variant).toLowerCase().endsWith("-armature");
}
function viewableMeshFiles({ mediaPath, files } = {}) {
  const rows = [];
  const primary = typeof mediaPath === "string" ? mediaPath : "";
  const primaryBase = primary ? pathBasename(primary) : "";
  if (primary && VIEWABLE_MESH_EXT.has(extensionFormat(primary))) {
    rows.push({ label: "Primary", path: primary });
  }
  const list = Array.isArray(files) ? files : [];
  for (const file of list) {
    if (!file || typeof file !== "object") continue;
    const filePath = typeof file.path === "string" ? file.path : "";
    if (!filePath) continue;
    const format = storedFormat(file.format, filePath);
    if (!VIEWABLE_MESH_EXT.has(format)) continue;
    if (variantIsArmature(file)) continue;
    if (primaryBase && pathBasename(filePath) === primaryBase) continue;
    const label = storedLabel(file.variant) || storedLabel(file.role) || format;
    rows.push({ label, path: filePath });
  }
  return rows;
}
function model3dSizeText(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export {
  snapshotFromRaw,
  detailFacts,
  agreedProducedPair,
  entityHeaderLabel,
  sharedMediaType,
  agreedDurationSeconds,
  jobResolutionLabel,
  model3dFileRows,
  model3dShownFormat,
  viewableMeshFiles,
  model3dSizeText
};
