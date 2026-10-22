// =============================================================================
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Artifact:        ecosystems
// Description:     AIR URN ecosystem keys → display names
//
// Upstream repo:   civitai-src (https://github.com/civitai/civitai)
// Upstream path:   civitai-src/packages/civitai-shared/src/basemodel.constants.ts
// Upstream range:  the `ecosystems` EcosystemRecord[] export
// Upstream branch: main
// Upstream commit: 103e59d87ce86c1e30b5c7af103352406f4a682a
// Fields read:     key, displayName (and parentEcosystemId, used to filter)
//
// Refreshed at:    2026-10-22T17:10:22.953Z
// Refresh by:      node dev/tools/refresh-vendored-civitai.mjs ecosystems
// Verify drift:    node dev/tools/refresh-vendored-civitai.mjs verify
//
// Transformation rules:
//   Filter rules:
//   1. Skip entries with parentEcosystemId — AIR URN stringifier collapses
//   children to roots, so child keys never appear as AIR ecosystem
//   segments in saved data.
//   2. Lowercase the key (matches the AIR URN form).
//   3. Drop entries where titleCase(lowercaseKey) === displayName
//   (the lookup module title-case fallback already produces that).
//   Result: only entries that need an explicit display override remain.
//
// Refresh policy & isolation:
//   docs/guides/civitai-sync/internal/vendored-snapshots.md
//
// Consumers MUST import from the artifact-specific lookup module —
// never directly from src/vendor/. The lint test in
// tests/vendor-isolation.test.mjs enforces this.
// =============================================================================
// --- BEGIN GENERATED DATA ---
export const ECOSYSTEM_DISPLAY_NAMES = Object.freeze({
  "ace":                  "ACE Audio",
  "auraflow":             "AuraFlow",
  "cogvideox":            "CogVideoX",
  "flux1":                "Flux.1",
  "flux1kontext":         "Flux.1 Kontext",
  "flux2":                "Flux.2",
  "flux3":                "Flux.3",
  "flux3klein":           "Flux.3 Klein",
  "flux3klein_base":      "Flux.3 Klein Base",
  "flux3video":           "Flux 3 Video",
  "fluxkrea":             "Flux.1 Krea",
  "happyhorse":           "HappyHorse",
  "hidream":              "HiDream",
  "hidream-o1":           "HiDream-O1",
  "hunyuan3d":            "Hunyuan3D",
  "hydit1":               "Hunyuan DiT",
  "hyv1":                 "Hunyuan Video",
  "imagen4":              "Imagen 4",
  "krea2":                "Krea 2",
  "krea3":                "Krea 3",
  "ltxv":                 "LTX Video",
  "ltxv2":                "LTX Video 2",
  "ltxv23":               "LTX Video 2.3",
  "ltxv25":               "LTX Video 2.5",
  "mageflow":             "Mage Flow",
  "mai":                  "MAI",
  "ming":                 "Ming Image Design",
  "minglayer":            "Ming Image Design Layer",
  "minimaxh3":            "MiniMax H3",
  "minimaxmusic3":        "MiniMax Music 3",
  "mossimage":            "MOSS Image",
  "museimage":            "Muse Image",
  "nanobanana":           "Nano Banana",
  "odor":                 "ODOR",
  "openai":               "OpenAI",
  "pixal3d":              "Pixal3D",
  "pixarta":              "PixArt Alpha",
  "pixarte":              "PixArt Sigma",
  "playgroundv2":         "Playground v2",
  "polygen":              "PolyGen (Meshy)",
  "qwen2":                "Qwen 2",
  "qwen21":               "Qwen 2.1",
  "qwen3":                "Qwen 3",
  "scascade":             "Stable Cascade",
  "sd1":                  "Stable Diffusion 1.x",
  "sd2":                  "Stable Diffusion 2.x",
  "sd3":                  "Stable Diffusion 3",
  "sd3_5m":               "Stable Diffusion 3.5 Medium",
  "sdxl":                 "Stable Diffusion XL",
  "sdxldistilled":        "SDXL Distilled",
  "sora2":                "Sora 2",
  "svd":                  "Stable Video Diffusion",
  "trellis2":             "Trellis.2",
  "veo3":                 "Veo 3",
  "wanimage27":           "Wan Image 2.7",
  "wanvideo":             "Wan Video",
  "wanvideo-22-i2v-a14b": "Wan Video 2.2 I2V A14B",
  "wanvideo-22-t2v-a14b": "Wan Video 2.2 T2V A14B",
  "wanvideo-22-ti2v-5b":  "Wan Video 2.2 TI2V 5B",
  "wanvideo-25-i2v":      "Wan Video 2.5 I2V",
  "wanvideo-25-t2v":      "Wan Video 2.5 T2V",
  "wanvideo14b_i2v_480p": "Wan Video 14B I2V 480p",
  "wanvideo14b_i2v_720p": "Wan Video 14B I2V 720p",
  "wanvideo14b_t2v":      "Wan Video 14B T2V",
  "wanvideo1_3b_t2v":     "Wan Video 1.3B T2V",
  "wanvideo27":           "Wan Video 2.7",
  "wanvideo30":           "Wan Video 3.0",
  "yue2":                 "YuE2",
  "zimagebase":           "ZImageBase",
  "zimageturbo":          "ZImageTurbo",
});
