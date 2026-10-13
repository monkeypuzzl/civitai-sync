// =============================================================================
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Artifact:        workflows
// Description:     On-site generator workflow identifier → label / category / modeLabel
//
// Upstream repo:   civitai-src (https://github.com/civitai/civitai)
// Upstream path:   civitai-src/src/shared/generation/config/workflows.ts
// Upstream range:  lines 171-468 (the `workflowConfigs` WorkflowConfigs export)
// Upstream branch: main
// Upstream commit: f6bbd3ded78ddbddc152bf74abb431ed68504999
// Fields read:     object key (identifier), label, category, modeLabel (when set)
//
// Refreshed at:    2026-10-12T17:11:44.692Z
// Refresh by:      node dev/tools/refresh-vendored-civitai.mjs workflows
// Verify drift:    node dev/tools/refresh-vendored-civitai.mjs verify
//
// Transformation rules:
//   Flavour 2 identity table. Keep every workflowConfigs record that has
//   both label and category. Identity key is the object key (txt2img,
//   txt2img:draft, …) — the same string saved as params.workflow.
//   Store { identifier, label, category } and modeLabel when upstream sets it.
//   Do not vendor ecosystemIds, engines, graph wiring, or description.
//   Sort keys alphabetically. Unknown identifiers fall back in the lookup
//   module to the identifier itself (never title-case).
//   After the identity table, derive five frozen maps in the same file.
//   A mode is the identifier segment before the first ":". It is mode-shaped
//   when it matches ^([a-z]+)2([a-z0-9]+)$.
//   Pass 1 teaches tokens from modeLabel only. It does not read label or
//   category. Split modeLabel on the spaced separator " to ". The left side
//   is the keyword for the input token and the right side is the keyword
//   for the output token (positional teach).
//   Pass 2 emits a mode phrase "{input keyword} to {output keyword}" when
//   both tokens were taught. A mode missing an unresolved output token on
//   the exception list is omitted.
//   UNRESOLVED_OUTPUT_TOKENS = ["meta"].
//   Any other missing token rejects the capture (exit 5). A taught exception
//   token is stale and is neither emitted nor omitted.
//   Pass 3 is the category gate. It reads category. It inserts a category
//   as a token key only when that key is absent, the capitalised word is
//   not already a value, and the word matches /^[A-Z][a-z]+$/.
//   Pass 4 writes one abbreviation per emitted mode:
//   {input letter}2{output abbreviation}. The abbreviation scan reads
//   category. A digit-leading output keyword is the whole output
//   abbreviation; otherwise the output abbreviation is the first character
//   of the mode's single category.
//   The abbreviation expansion does not read the mode phrase and does not
//   read label. Its output word is the same choice the badge just made
//   (digit-leading keyword, otherwise the category with its first
//   character upper-cased). One badge stores one expansion.
//   Pass 5 writes display labels and reads label. A label that starts with
//   the seven characters "Create " or equals the mode phrase is replaced
//   (bare identifier → mode phrase; suffix after ":" → hyphen to space,
//   then the first character of each word upper-cased). Every other row
//   keeps its job label.
//   After those identity-row labels, bare-mode insertion sets each emitted
//   mode that is not already a key to the mode phrase.
//   Derivation rejection prints the capture-failure report and exits 5.
//   The file is not written. Runtime lookup reads the frozen exports and
//   does not re-derive.
//
// Refresh policy & isolation:
//   docs/guides/civitai-sync/internal/vendored-snapshots.md
//
// Consumers MUST import from the artifact-specific lookup module —
// never directly from src/vendor/. The lint test in
// tests/vendor-isolation.test.mjs enforces this.
// =============================================================================
// --- BEGIN GENERATED DATA ---
export const CIVITAI_WORKFLOWS = Object.freeze({
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

export const WORKFLOW_MEDIA_TOKENS = Object.freeze({
  "audio":   "Audio",
  "img":     "Image",
  "model3d": "3D",
  "music":   "Music",
  "txt":     "Text",
  "vid":     "Video",
});

export const WORKFLOW_MODE_LABELS = Object.freeze({
  "img2img":     "Image to Image",
  "img2model3d": "Image to 3D",
  "img2vid":     "Image to Video",
  "txt2img":     "Text to Image",
  "txt2model3d": "Text to 3D",
  "txt2music":   "Text to Music",
  "txt2vid":     "Text to Video",
  "vid2vid":     "Video to Video",
});

export const WORKFLOW_MODE_ABBREVIATIONS = Object.freeze({
  "img2img":     "I2I",
  "img2model3d": "I23D",
  "img2vid":     "I2V",
  "txt2img":     "T2I",
  "txt2model3d": "T23D",
  "txt2music":   "T2A",
  "txt2vid":     "T2V",
  "vid2vid":     "V2V",
});

export const WORKFLOW_ABBREVIATION_EXPANSIONS = Object.freeze({
  "I23D": "Image to 3D",
  "I2I":  "Image to Image",
  "I2V":  "Image to Video",
  "T23D": "Text to 3D",
  "T2A":  "Text to Audio",
  "T2I":  "Text to Image",
  "T2V":  "Text to Video",
  "V2V":  "Video to Video",
});

export const WORKFLOW_DISPLAY_LABELS = Object.freeze({
  "img2img":                   "Image Variations",
  "img2img:edit":              "Edit",
  "img2img:face-fix":          "Image Face Fix",
  "img2img:hires-fix":         "Image Hires Fix",
  "img2img:preprocess":        "Control Preprocessor",
  "img2img:remove-background": "Remove Background",
  "img2img:upscale":           "Upscale",
  "img2model3d":               "Image to 3D",
  "img2vid":                   "Image to Video",
  "img2vid:first-last":        "First/Last Frame",
  "img2vid:ref2vid":           "Reference to Video",
  "txt2img":                   "Text to Image",
  "txt2img:draft":             "Draft",
  "txt2img:face-fix":          "Face Fix",
  "txt2img:hires-fix":         "Hires Fix",
  "txt2model3d":               "Text to 3D",
  "txt2music":                 "Text to Music",
  "txt2vid":                   "Text to Video",
  "vid2vid":                   "Video to Video",
  "vid2vid:edit":              "Edit Video",
  "vid2vid:extend":            "Extend Video",
  "vid2vid:interpolate":       "Interpolate",
  "vid2vid:preprocess":        "Control Preprocessor",
  "vid2vid:upscale":           "Upscale",
});
