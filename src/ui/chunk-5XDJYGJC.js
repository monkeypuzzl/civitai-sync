// src/vendor/civitai-workflows.mjs
var CIVITAI_WORKFLOWS = Object.freeze({
  "img2img": Object.freeze({
    "identifier": "img2img",
    "label": "Image Variations",
    "category": "image"
  }),
  "img2img:edit": Object.freeze({
    "identifier": "img2img:edit",
    "label": "Image to Image",
    "category": "image"
  }),
  "img2img:face-fix": Object.freeze({
    "identifier": "img2img:face-fix",
    "label": "Image Face Fix",
    "category": "image",
    "modeLabel": "Image to Image"
  }),
  "img2img:hires-fix": Object.freeze({
    "identifier": "img2img:hires-fix",
    "label": "Image Hires Fix",
    "category": "image",
    "modeLabel": "Image to Image"
  }),
  "img2img:preprocess": Object.freeze({
    "identifier": "img2img:preprocess",
    "label": "Control Preprocessor",
    "category": "image"
  }),
  "img2img:remove-background": Object.freeze({
    "identifier": "img2img:remove-background",
    "label": "Remove Background",
    "category": "image"
  }),
  "img2img:upscale": Object.freeze({
    "identifier": "img2img:upscale",
    "label": "Upscale",
    "category": "image"
  }),
  "img2meta": Object.freeze({
    "identifier": "img2meta",
    "label": "Extract Metadata",
    "category": "image"
  }),
  "img2model3d": Object.freeze({
    "identifier": "img2model3d",
    "label": "Create 3D Model",
    "category": "model3d",
    "modeLabel": "Image to 3D"
  }),
  "img2vid": Object.freeze({
    "identifier": "img2vid",
    "label": "Image to Video",
    "category": "video"
  }),
  "img2vid:first-last": Object.freeze({
    "identifier": "img2vid:first-last",
    "label": "First/Last Frame",
    "category": "video"
  }),
  "img2vid:ref2vid": Object.freeze({
    "identifier": "img2vid:ref2vid",
    "label": "Reference to Video",
    "category": "video"
  }),
  "prompt:enhance": Object.freeze({
    "identifier": "prompt:enhance",
    "label": "Enhance Prompt",
    "category": "image"
  }),
  "txt2img": Object.freeze({
    "identifier": "txt2img",
    "label": "Create Image",
    "category": "image",
    "modeLabel": "Text to Image"
  }),
  "txt2img:draft": Object.freeze({
    "identifier": "txt2img:draft",
    "label": "Draft",
    "category": "image"
  }),
  "txt2img:face-fix": Object.freeze({
    "identifier": "txt2img:face-fix",
    "label": "Create + Face Fix",
    "category": "image",
    "modeLabel": "Text to Image"
  }),
  "txt2img:hires-fix": Object.freeze({
    "identifier": "txt2img:hires-fix",
    "label": "Create + Hires Fix",
    "category": "image",
    "modeLabel": "Text to Image"
  }),
  "txt2model3d": Object.freeze({
    "identifier": "txt2model3d",
    "label": "Create 3D Model",
    "category": "model3d",
    "modeLabel": "Text to 3D"
  }),
  "txt2music": Object.freeze({
    "identifier": "txt2music",
    "label": "Create Music",
    "category": "audio",
    "modeLabel": "Text to Music"
  }),
  "txt2vid": Object.freeze({
    "identifier": "txt2vid",
    "label": "Create Video",
    "category": "video",
    "modeLabel": "Text to Video"
  }),
  "vid2vid:edit": Object.freeze({
    "identifier": "vid2vid:edit",
    "label": "Edit Video",
    "category": "video"
  }),
  "vid2vid:extend": Object.freeze({
    "identifier": "vid2vid:extend",
    "label": "Extend Video",
    "category": "video"
  }),
  "vid2vid:interpolate": Object.freeze({
    "identifier": "vid2vid:interpolate",
    "label": "Interpolate",
    "category": "video"
  }),
  "vid2vid:preprocess": Object.freeze({
    "identifier": "vid2vid:preprocess",
    "label": "Control Preprocessor",
    "category": "video"
  }),
  "vid2vid:upscale": Object.freeze({
    "identifier": "vid2vid:upscale",
    "label": "Upscale",
    "category": "video"
  })
});
var WORKFLOW_MEDIA_TOKENS = Object.freeze({
  "audio": "Audio",
  "img": "Image",
  "model3d": "3D",
  "music": "Music",
  "txt": "Text",
  "vid": "Video"
});
var WORKFLOW_MODE_LABELS = Object.freeze({
  "img2img": "Image to Image",
  "img2model3d": "Image to 3D",
  "img2vid": "Image to Video",
  "txt2img": "Text to Image",
  "txt2model3d": "Text to 3D",
  "txt2music": "Text to Music",
  "txt2vid": "Text to Video",
  "vid2vid": "Video to Video"
});
var WORKFLOW_MODE_ABBREVIATIONS = Object.freeze({
  "img2img": "I2I",
  "img2model3d": "I23D",
  "img2vid": "I2V",
  "txt2img": "T2I",
  "txt2model3d": "T23D",
  "txt2music": "T2A",
  "txt2vid": "T2V",
  "vid2vid": "V2V"
});
var WORKFLOW_ABBREVIATION_EXPANSIONS = Object.freeze({
  "I23D": "Image to 3D",
  "I2I": "Image to Image",
  "I2V": "Image to Video",
  "T23D": "Text to 3D",
  "T2A": "Text to Audio",
  "T2I": "Text to Image",
  "T2V": "Text to Video",
  "V2V": "Video to Video"
});
var WORKFLOW_DISPLAY_LABELS = Object.freeze({
  "img2img": "Image Variations",
  "img2img:edit": "Edit",
  "img2img:face-fix": "Image Face Fix",
  "img2img:hires-fix": "Image Hires Fix",
  "img2img:preprocess": "Control Preprocessor",
  "img2img:remove-background": "Remove Background",
  "img2img:upscale": "Upscale",
  "img2model3d": "Image to 3D",
  "img2vid": "Image to Video",
  "img2vid:first-last": "First/Last Frame",
  "img2vid:ref2vid": "Reference to Video",
  "txt2img": "Text to Image",
  "txt2img:draft": "Draft",
  "txt2img:face-fix": "Face Fix",
  "txt2img:hires-fix": "Hires Fix",
  "txt2model3d": "Text to 3D",
  "txt2music": "Text to Music",
  "txt2vid": "Text to Video",
  "vid2vid": "Video to Video",
  "vid2vid:edit": "Edit Video",
  "vid2vid:extend": "Extend Video",
  "vid2vid:interpolate": "Interpolate",
  "vid2vid:preprocess": "Control Preprocessor",
  "vid2vid:upscale": "Upscale"
});

// src/workflowVocab.mjs
function modeKeyOf(id) {
  if (!id || typeof id !== "string") return "";
  const colon = id.indexOf(":");
  return colon === -1 ? id : id.slice(0, colon);
}
function getWorkflowModePhrase(id) {
  const mode = modeKeyOf(id);
  if (!mode) return "";
  return WORKFLOW_MODE_LABELS[mode] || "";
}
function getWorkflowModeAbbreviation(id) {
  const mode = modeKeyOf(id);
  if (!mode) return "";
  return WORKFLOW_MODE_ABBREVIATIONS[mode] || "";
}
function getWorkflowAbbreviationExpansion(id) {
  const badge = getWorkflowModeAbbreviation(id);
  if (!badge) return "";
  return WORKFLOW_ABBREVIATION_EXPANSIONS[badge] || "";
}
function getWorkflowDisplayLabel(id) {
  if (!id || typeof id !== "string") return "";
  return WORKFLOW_DISPLAY_LABELS[id] || "";
}
var TYPE_QUERY_LABELS = Object.freeze({
  image: "Image",
  video: "Video",
  audio: "Audio",
  model3d: "3D"
});
var COLLIDING_DISPLAY_LABELS = (() => {
  const counts = /* @__PURE__ */ new Map();
  for (const label of Object.values(WORKFLOW_DISPLAY_LABELS)) {
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const out = /* @__PURE__ */ new Set();
  for (const [label, n] of counts) {
    if (n > 1) out.add(label);
  }
  return out;
})();
function queryTokens(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value).split(",").map((s) => s.trim()).filter(Boolean);
}
function formatWorkflowQueryLabel(id) {
  const token = id == null ? "" : String(id);
  if (!token) return "";
  const label = getWorkflowDisplayLabel(token);
  if (!label) return token;
  if (!COLLIDING_DISPLAY_LABELS.has(label)) return label;
  const abbrev = getWorkflowModeAbbreviation(token);
  return abbrev ? `${abbrev} \xB7 ${label}` : label;
}
function formatModeQueryLabel(token, remainderCount) {
  if (typeof token === "string" && token.startsWith("none:")) {
    const type = token.slice("none:".length);
    if (remainderCount > 1) return `Unknown (${type})`;
    return "Unknown";
  }
  return token;
}
function describeTypeWorkflowQuery(query = {}) {
  const parts = [];
  const types = queryTokens(query.type);
  if (types.length) {
    parts.push(types.map((t) => TYPE_QUERY_LABELS[t] || t).join(", "));
  }
  const modes = queryTokens(query.workflowMode);
  if (modes.length) {
    const remainderCount = modes.filter((t) => t.startsWith("none:")).length;
    parts.push(modes.map((t) => formatModeQueryLabel(t, remainderCount)).join(", "));
  }
  const workflows = queryTokens(query.workflow);
  if (workflows.length) {
    parts.push(workflows.map((id) => formatWorkflowQueryLabel(id)).join(", "));
  }
  return parts;
}

export {
  getWorkflowModePhrase,
  getWorkflowModeAbbreviation,
  getWorkflowAbbreviationExpansion,
  getWorkflowDisplayLabel,
  formatWorkflowQueryLabel,
  describeTypeWorkflowQuery
};
