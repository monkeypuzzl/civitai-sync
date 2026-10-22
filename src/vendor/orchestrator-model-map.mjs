// =============================================================================
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Artifact:        orchestrator-model-map
// Description:     Orchestrator video engine/workflow → modelVersionId maps (Wan + Hunyuan + other engines)
//
// Upstream repo:   civitai-src (https://github.com/civitai/civitai)
// Upstream path:   civitai-src/src/shared/utils/engine.utils.ts
// Upstream range:  engine.utils.ts ENGINE_TO_ECOSYSTEM; version-ids.ts wanBaseModelGroupIdMap; form-graph/generation/video/wan.graph.ts wanVersionDefs; basemodel.constants.ts ecosystems key table + ecosystemSettings defaults.model.id (hunyuan.handler.ts has no version-id map — Hunyuan id comes from ECO.HyV1 defaults)
// Upstream branch: main
// Upstream commit: 103e59d87ce86c1e30b5c7af103352406f4a682a
// Fields read:     engine, ecosystem key, wanVersion, t2v/i2v/i2v_480p ecosystem keys, defaults.model.id
//
// Refreshed at:    2026-10-22T20:07:15.209Z
// Refresh by:      node dev/tools/refresh-vendored-civitai.mjs orchestrator-model-map
// Verify drift:    node dev/tools/refresh-vendored-civitai.mjs verify
//
// Transformation rules:
//   Build three frozen tables:
//   1. engineToEcosystem — ENGINE_TO_ECOSYSTEM (hunyuan→HyV1, veo3→Veo3, …).
//   Wan is NOT in this table (many ecosystems share engine `wan`).
//   2. wanVersionEcosystems — wanVersionDefs version → { t2v, i2v, i2v_480p? }.
//   3. ecosystemToVersionId — merge wanBaseModelGroupIdMap with
//   ecosystemSettings[ecosystemKey].defaults.model.id (covers Hunyuan
//   HyV1 and Wan 2.2/2.5/2.7 which the handler map omits).
//   Keys on (3) are the ecosystems-table `key` strings (e.g. WanVideo-22-T2V-A14B).
//
// Refresh policy & isolation:
//   docs/guides/civitai-sync/internal/vendored-snapshots.md
//
// Consumers MUST import from the artifact-specific lookup module —
// never directly from src/vendor/. The lint test in
// tests/vendor-isolation.test.mjs enforces this.
// =============================================================================
// --- BEGIN GENERATED DATA ---
export const ENGINE_TO_ECOSYSTEM = Object.freeze({
  "haiper":     "Haiper",
  "hunyuan":    "HyV1",
  "kling":      "Kling",
  "lightricks": "Ltx2",
  "ltx2":       "Ltx2",
  "minimax":    "MiniMaxH3",
  "mochi":      "Mochi",
  "sora":       "Sora2",
  "veo3":       "Veo3",
  "vidu":       "Vidu",
});

export const WAN_VERSION_ECOSYSTEMS = Object.freeze({
  "v2.1": Object.freeze({
    "i2v": "WanVideo14B_I2V_720p",
    "i2v_480p": "WanVideo14B_I2V_480p",
    "t2v": "WanVideo14B_T2V"
  }),
  "v2.2": Object.freeze({
    "i2v": "WanVideo-22-I2V-A14B",
    "t2v": "WanVideo-22-T2V-A14B"
  }),
  "v2.2-5b": Object.freeze({
    "i2v": "WanVideo-22-TI2V-5B",
    "t2v": "WanVideo-22-TI2V-5B"
  }),
  "v2.5": Object.freeze({
    "i2v": "WanVideo-25-I2V",
    "t2v": "WanVideo-25-T2V"
  }),
  "v2.7": Object.freeze({
    "i2v": "WanVideo27",
    "t2v": "WanVideo27"
  }),
  "v3.0": Object.freeze({
    "i2v": "WanVideo30",
    "t2v": "WanVideo30"
  })
});

export const ECOSYSTEM_TO_VERSION_ID = Object.freeze({
  "Ace":                  2864949,
  "Anima":                2945208,
  "Boogu":                3049541,
  "Chroma":               2164239,
  "Ernie":                2863858,
  "Flux1":                691639,
  "Flux1Kontext":         1892509,
  "Flux2":                2439067,
  "Flux2Klein_4B":        2612557,
  "Flux2Klein_4B_base":   2612552,
  "Flux2Klein_9B":        2612554,
  "Flux2Klein_9B_base":   2612548,
  "Flux3":                3376170,
  "Flux3Klein":           3407486,
  "Flux3Klein_base":      3407485,
  "Flux3Video":           3204701,
  "FluxKrea":             2068000,
  "Grok":                 2738377,
  "HappyHorse":           3063263,
  "HiDream":              1771369,
  "HiDream-O1":           2939964,
  "HyV1":                 1313562,
  "Ideogram":             3246186,
  "Illustrious":          889818,
  "Kling":                2698632,
  "Krea2":                3072329,
  "Krea3":                3405360,
  "LTXV":                 1499827,
  "LTXV2":                2578325,
  "LTXV23":               2749908,
  "LTXV25":               3220143,
  "Lens":                 2982236,
  "MAI":                  3002140,
  "MageFlow":             3172038,
  "Ming":                 3355635,
  "MiniMaxH3":            3216500,
  "MiniMaxMusic3":        3225593,
  "Mochi":                1034189,
  "MossImage":            3409867,
  "MuseImage":            3291238,
  "NanoBanana":           2154472,
  "NoobAI":               1190596,
  "OpenAI":               2880272,
  "Other":                164821,
  "Pony":                 290640,
  "PonyV7":               2152373,
  "Qwen":                 2552908,
  "Qwen2":                2744101,
  "Qwen21":               3352534,
  "Qwen3":                3207633,
  "Reve":                 3133202,
  "SD1":                  128713,
  "SDXL":                 128078,
  "Seedance":             2864671,
  "Seedream":             3110984,
  "Sonilo":               3370181,
  "Veo3":                 2827945,
  "Vidu":                 2623839,
  "WanImage27":           2828170,
  "WanVideo-22-I2V-A14B": 2114157,
  "WanVideo-22-T2V-A14B": 2114154,
  "WanVideo-22-TI2V-5B":  2114110,
  "WanVideo-25-I2V":      2254963,
  "WanVideo-25-T2V":      2254989,
  "WanVideo14B_I2V_480p": 1501125,
  "WanVideo14B_I2V_720p": 1501344,
  "WanVideo14B_T2V":      1707796,
  "WanVideo1_3B_T2V":     1500646,
  "WanVideo27":           2828005,
  "WanVideo30":           3267095,
  "YuE2":                 3337846,
  "ZImageBase":           2635223,
  "ZImageTurbo":          2442439,
});
