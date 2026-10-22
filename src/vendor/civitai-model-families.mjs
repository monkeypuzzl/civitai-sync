// =============================================================================
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Artifact:        families
// Description:     Generator Eco family groups + official version pickers (Models catalog)
//
// Upstream repo:   civitai-src (https://github.com/civitai/civitai)
// Upstream path:   civitai-src/packages/civitai-shared/src/basemodel.constants.ts
// Upstream range:  basemodel.constants.ts ecosystems / ecosystemGroups / baseModelRecords / ecosystemSettings / MODEL3D_ECOSYSTEM_IDS; generation/config/workflows.ts workflowConfigs.ecosystemIds (coverage); form-graph/generation/video/wan.graph.ts wanVersionDefs; form-graph/generation/** *VersionOptions / VersionGroup / *VersionDefs; version-ids.ts shared numeric maps
// Upstream branch: main
// Upstream commit: 103e59d87ce86c1e30b5c7af103352406f4a682a
// Fields read:     ecosystem key/displayName/sortOrder, group id/displayName/ecosystemIds/sortOrder, baseModelRecords name→ecosystem, defaults.model.id, output type, picker options
//
// Refreshed at:    2026-10-22T20:07:15.000Z
// Refresh by:      node dev/tools/refresh-vendored-civitai.mjs families
// Verify drift:    node dev/tools/refresh-vendored-civitai.mjs verify
//
// Transformation rules:
//   Structural identity table (generator family picker).
//   Coverage = every ecosystem key in workflowConfigs.ecosystemIds.
//   Absorption uses official picker containment only (not parentEcosystemId,
//   not AIR root, not crossEcosystemRules).
//   A picker option covers an ecosystem when it names that key or its numeric
//   value equals that ecosystem's defaults.model.id.
//   A picker that hits an ecosystemGroup absorbs every covered key into that
//   group (family id = group id). No group + several ecosystems → survivor is
//   the ecosystem whose default accounts for the most options (tie: lower
//   sortOrder). One ecosystem → family id is its key.
//   Do not merge across outputType (image/video/audio/model3d).
//   Completeness: every coverage key is in exactly one family (else exit 4).
//   Sort families by outputType order then survivor sortOrder; variants in
//   picker order; baseModelToEcosystem keys alphabetically.
//
// Refresh policy & isolation:
//   docs/guides/civitai-sync/internal/vendored-snapshots.md
//
// Consumers MUST import from the artifact-specific lookup module —
// never directly from src/vendor/. The lint test in
// tests/vendor-isolation.test.mjs enforces this.
// =============================================================================
// --- BEGIN GENERATED DATA ---
// Picker sources:
//   src/shared/form-graph/generation/audio/ace.graph.ts
//   src/shared/form-graph/generation/audio/minimax-music.graph.ts
//   src/shared/form-graph/generation/audio/yue2.graph.ts
//   src/shared/form-graph/generation/grok-shared.ts
//   src/shared/form-graph/generation/image/boogu.graph.ts
//   src/shared/form-graph/generation/image/ernie.graph.ts
//   src/shared/form-graph/generation/image/flux-kontext.graph.ts
//   src/shared/form-graph/generation/image/flux.graph.ts
//   src/shared/form-graph/generation/image/flux2-klein.graph.ts
//   src/shared/form-graph/generation/image/flux2.graph.ts
//   src/shared/form-graph/generation/image/flux3-klein.graph.ts
//   src/shared/form-graph/generation/image/hi-dream-o1.graph.ts
//   src/shared/form-graph/generation/image/hi-dream.graph.ts
//   src/shared/form-graph/generation/image/ideogram.graph.ts
//   src/shared/form-graph/generation/image/krea2.graph.ts
//   src/shared/form-graph/generation/image/lens.graph.ts
//   src/shared/form-graph/generation/image/mage-flow.graph.ts
//   src/shared/form-graph/generation/image/moss-image.graph.ts
//   src/shared/form-graph/generation/image/nano-banana.graph.ts
//   src/shared/form-graph/generation/image/openai.graph.ts
//   src/shared/form-graph/generation/image/qwen.graph.ts
//   src/shared/form-graph/generation/image/seedream.graph.ts
//   src/shared/form-graph/generation/image/wan-image.graph.ts
//   src/shared/form-graph/generation/image/zimage.graph.ts
//   src/shared/form-graph/generation/video/flux3-video.graph.ts
//   src/shared/form-graph/generation/video/happy-horse.graph.ts
//   src/shared/form-graph/generation/video/kling.graph.ts
//   src/shared/form-graph/generation/video/ltx.graph.ts
//   src/shared/form-graph/generation/video/minimax.graph.ts
//   src/shared/form-graph/generation/video/seedance.graph.ts
//   src/shared/form-graph/generation/video/veo3.graph.ts
//   src/shared/form-graph/generation/video/vidu.graph.ts
//   src/shared/form-graph/generation/video/wan.graph.ts
export const CIVITAI_MODEL_FAMILIES = Object.freeze({
  families: Object.freeze([
  Object.freeze({
    "id": "Flux1",
    "label": "Flux.1",
    "outputType": "image",
    "members": ["Flux1","FluxKrea"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Flux1:699279",
        "optionKey": "699279",
        "label": "Draft",
        "ecosystemKeys": [],
        "versionIds": [699279]
      }),
      Object.freeze({
        "id": "Flux1:691639",
        "optionKey": "691639",
        "label": "Standard",
        "ecosystemKeys": ["Flux1"],
        "versionIds": [691639]
      }),
      Object.freeze({
        "id": "Flux1:2068000",
        "optionKey": "2068000",
        "label": "Krea",
        "ecosystemKeys": ["FluxKrea"],
        "versionIds": [2068000]
      }),
      Object.freeze({
        "id": "Flux1:922358",
        "optionKey": "922358",
        "label": "Pro 1.1",
        "ecosystemKeys": [],
        "versionIds": [922358]
      }),
      Object.freeze({
        "id": "Flux1:1088507",
        "optionKey": "1088507",
        "label": "Ultra",
        "ecosystemKeys": [],
        "versionIds": [1088507]
      })
    ])
  }),
  Object.freeze({
    "id": "Flux1Kontext",
    "label": "Flux.1 Kontext",
    "outputType": "image",
    "members": ["Flux1Kontext"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Flux1Kontext:1892509",
        "optionKey": "1892509",
        "label": "Pro",
        "ecosystemKeys": ["Flux1Kontext"],
        "versionIds": [1892509]
      }),
      Object.freeze({
        "id": "Flux1Kontext:1892523",
        "optionKey": "1892523",
        "label": "Max",
        "ecosystemKeys": [],
        "versionIds": [1892523]
      })
    ])
  }),
  Object.freeze({
    "id": "Flux2",
    "label": "Flux.2",
    "outputType": "image",
    "members": ["Flux2"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Flux2:2439067",
        "optionKey": "2439067",
        "label": "Dev",
        "ecosystemKeys": ["Flux2"],
        "versionIds": [2439067]
      }),
      Object.freeze({
        "id": "Flux2:2439047",
        "optionKey": "2439047",
        "label": "Flex",
        "ecosystemKeys": [],
        "versionIds": [2439047]
      }),
      Object.freeze({
        "id": "Flux2:2439442",
        "optionKey": "2439442",
        "label": "Pro",
        "ecosystemKeys": [],
        "versionIds": [2439442]
      }),
      Object.freeze({
        "id": "Flux2:2547175",
        "optionKey": "2547175",
        "label": "Max",
        "ecosystemKeys": [],
        "versionIds": [2547175]
      })
    ])
  }),
  Object.freeze({
    "id": "Flux3",
    "label": "Flux.3",
    "outputType": "image",
    "members": ["Flux3"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Flux3:3376170",
        "optionKey": "3376170",
        "label": "Flux.3",
        "ecosystemKeys": ["Flux3"],
        "versionIds": [3376170]
      })
    ])
  }),
  Object.freeze({
    "id": "SD1",
    "label": "Stable Diffusion 1.x",
    "outputType": "image",
    "members": ["SD1"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "SD1:128713",
        "optionKey": "128713",
        "label": "Stable Diffusion 1.x",
        "ecosystemKeys": ["SD1"],
        "versionIds": [128713]
      })
    ])
  }),
  Object.freeze({
    "id": "SDXL",
    "label": "Stable Diffusion XL",
    "outputType": "image",
    "members": ["SDXL"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "SDXL:128078",
        "optionKey": "128078",
        "label": "Stable Diffusion XL",
        "ecosystemKeys": ["SDXL"],
        "versionIds": [128078]
      })
    ])
  }),
  Object.freeze({
    "id": "Illustrious",
    "label": "Illustrious",
    "outputType": "image",
    "members": ["Illustrious"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Illustrious:889818",
        "optionKey": "889818",
        "label": "Illustrious",
        "ecosystemKeys": ["Illustrious"],
        "versionIds": [889818]
      })
    ])
  }),
  Object.freeze({
    "id": "NoobAI",
    "label": "NoobAI",
    "outputType": "image",
    "members": ["NoobAI"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "NoobAI:1190596",
        "optionKey": "1190596",
        "label": "NoobAI",
        "ecosystemKeys": ["NoobAI"],
        "versionIds": [1190596]
      })
    ])
  }),
  Object.freeze({
    "id": "Flux2Klein",
    "label": "Flux.2 Klein",
    "outputType": "image",
    "members": ["Flux2Klein_9B","Flux2Klein_9B_base","Flux2Klein_4B","Flux2Klein_4B_base"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Flux2Klein:2612554",
        "optionKey": "2612554",
        "label": "9B",
        "ecosystemKeys": ["Flux2Klein_9B"],
        "versionIds": [2612554]
      }),
      Object.freeze({
        "id": "Flux2Klein:2612557",
        "optionKey": "2612557",
        "label": "4B",
        "ecosystemKeys": ["Flux2Klein_4B"],
        "versionIds": [2612557]
      })
    ])
  }),
  Object.freeze({
    "id": "Flux3Klein",
    "label": "Flux.3 Klein",
    "outputType": "image",
    "members": ["Flux3Klein","Flux3Klein_base"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Flux3Klein:3407486",
        "optionKey": "3407486",
        "label": "Klein",
        "ecosystemKeys": ["Flux3Klein"],
        "versionIds": [3407486]
      }),
      Object.freeze({
        "id": "Flux3Klein:3407485",
        "optionKey": "3407485",
        "label": "Klein Base",
        "ecosystemKeys": ["Flux3Klein_base"],
        "versionIds": [3407485]
      })
    ])
  }),
  Object.freeze({
    "id": "Pony",
    "label": "Pony Diffusion",
    "outputType": "image",
    "members": ["Pony"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Pony:290640",
        "optionKey": "290640",
        "label": "Pony Diffusion",
        "ecosystemKeys": ["Pony"],
        "versionIds": [290640]
      })
    ])
  }),
  Object.freeze({
    "id": "PonyV7",
    "label": "Pony Diffusion V7",
    "outputType": "image",
    "members": ["PonyV7"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "PonyV7:2152373",
        "optionKey": "2152373",
        "label": "Pony Diffusion V7",
        "ecosystemKeys": ["PonyV7"],
        "versionIds": [2152373]
      })
    ])
  }),
  Object.freeze({
    "id": "WanImage",
    "label": "Wan Image",
    "outputType": "image",
    "members": ["WanImage27"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "WanImage:v2.7",
        "optionKey": "v2.7",
        "label": "2.7",
        "ecosystemKeys": ["WanImage27"],
        "versionIds": [2828170]
      })
    ])
  }),
  Object.freeze({
    "id": "NanoBanana",
    "label": "Nano Banana",
    "outputType": "image",
    "members": ["NanoBanana"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "NanoBanana:2154472",
        "optionKey": "2154472",
        "label": "Standard",
        "ecosystemKeys": ["NanoBanana"],
        "versionIds": [2154472]
      }),
      Object.freeze({
        "id": "NanoBanana:2436219",
        "optionKey": "2436219",
        "label": "Pro",
        "ecosystemKeys": [],
        "versionIds": [2436219]
      }),
      Object.freeze({
        "id": "NanoBanana:2725610",
        "optionKey": "2725610",
        "label": "V2",
        "ecosystemKeys": [],
        "versionIds": [2725610]
      }),
      Object.freeze({
        "id": "NanoBanana:3086021",
        "optionKey": "3086021",
        "label": "V2 Lite",
        "ecosystemKeys": [],
        "versionIds": [3086021]
      }),
      Object.freeze({
        "id": "NanoBanana:3390330",
        "optionKey": "3390330",
        "label": "V2.1",
        "ecosystemKeys": [],
        "versionIds": [3390330]
      })
    ])
  }),
  Object.freeze({
    "id": "OpenAI",
    "label": "OpenAI",
    "outputType": "image",
    "members": ["OpenAI"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "OpenAI:2512167",
        "optionKey": "2512167",
        "label": "v1.5",
        "ecosystemKeys": [],
        "versionIds": [2512167]
      }),
      Object.freeze({
        "id": "OpenAI:2880272",
        "optionKey": "2880272",
        "label": "v2",
        "ecosystemKeys": ["OpenAI"],
        "versionIds": [2880272]
      })
    ])
  }),
  Object.freeze({
    "id": "Qwen",
    "label": "Qwen",
    "outputType": "image",
    "members": ["Qwen"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Qwen:2110043",
        "optionKey": "2110043",
        "label": "v2509",
        "ecosystemKeys": [],
        "versionIds": [2110043]
      }),
      Object.freeze({
        "id": "Qwen:2552908",
        "optionKey": "2552908",
        "label": "v2512",
        "ecosystemKeys": ["Qwen"],
        "versionIds": [2552908]
      })
    ])
  }),
  Object.freeze({
    "id": "Qwen2",
    "label": "Qwen 2",
    "outputType": "image",
    "members": ["Qwen2"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Qwen2:2744101",
        "optionKey": "2744101",
        "label": "Qwen 2",
        "ecosystemKeys": ["Qwen2"],
        "versionIds": [2744101]
      })
    ])
  }),
  Object.freeze({
    "id": "Qwen21",
    "label": "Qwen 2.1",
    "outputType": "image",
    "members": ["Qwen21"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Qwen21:3352534",
        "optionKey": "3352534",
        "label": "Qwen 2.1",
        "ecosystemKeys": ["Qwen21"],
        "versionIds": [3352534]
      })
    ])
  }),
  Object.freeze({
    "id": "Qwen3",
    "label": "Qwen 3",
    "outputType": "image",
    "members": ["Qwen3"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Qwen3:3207633",
        "optionKey": "3207633",
        "label": "Qwen 3",
        "ecosystemKeys": ["Qwen3"],
        "versionIds": [3207633]
      })
    ])
  }),
  Object.freeze({
    "id": "ZImage",
    "label": "ZImage",
    "outputType": "image",
    "members": ["ZImageTurbo","ZImageBase"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "ZImage:2442439",
        "optionKey": "2442439",
        "label": "Turbo",
        "ecosystemKeys": ["ZImageTurbo"],
        "versionIds": [2442439]
      }),
      Object.freeze({
        "id": "ZImage:2635223",
        "optionKey": "2635223",
        "label": "Base",
        "ecosystemKeys": ["ZImageBase"],
        "versionIds": [2635223]
      })
    ])
  }),
  Object.freeze({
    "id": "Seedream",
    "label": "Seedream",
    "outputType": "image",
    "members": ["Seedream"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Seedream:3110984",
        "optionKey": "3110984",
        "label": "Seedream",
        "ecosystemKeys": ["Seedream"],
        "versionIds": [3110984]
      })
    ])
  }),
  Object.freeze({
    "id": "Ernie",
    "label": "Ernie",
    "outputType": "image",
    "members": ["Ernie"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Ernie:2863858",
        "optionKey": "2863858",
        "label": "Ernie",
        "ecosystemKeys": ["Ernie"],
        "versionIds": [2863858]
      }),
      Object.freeze({
        "id": "Ernie:2863892",
        "optionKey": "2863892",
        "label": "Turbo",
        "ecosystemKeys": [],
        "versionIds": [2863892]
      })
    ])
  }),
  Object.freeze({
    "id": "HiDream",
    "label": "HiDream",
    "outputType": "image",
    "members": ["HiDream"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "HiDream:1770945",
        "optionKey": "1770945",
        "label": "Fast",
        "ecosystemKeys": [],
        "versionIds": [1770945]
      }),
      Object.freeze({
        "id": "HiDream:1771369",
        "optionKey": "1771369",
        "label": "Dev",
        "ecosystemKeys": ["HiDream"],
        "versionIds": [1771369]
      }),
      Object.freeze({
        "id": "HiDream:1772448",
        "optionKey": "1772448",
        "label": "Full",
        "ecosystemKeys": [],
        "versionIds": [1772448]
      }),
      Object.freeze({
        "id": "HiDream:1768731",
        "optionKey": "1768731",
        "label": "Fast",
        "ecosystemKeys": [],
        "versionIds": [1768731]
      }),
      Object.freeze({
        "id": "HiDream:1769068",
        "optionKey": "1769068",
        "label": "Dev",
        "ecosystemKeys": [],
        "versionIds": [1769068]
      })
    ])
  }),
  Object.freeze({
    "id": "HiDream-O1",
    "label": "HiDream-O1",
    "outputType": "image",
    "members": ["HiDream-O1"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "HiDream-O1:2939946",
        "optionKey": "2939946",
        "label": "Full",
        "ecosystemKeys": [],
        "versionIds": [2939946]
      }),
      Object.freeze({
        "id": "HiDream-O1:2939964",
        "optionKey": "2939964",
        "label": "Dev",
        "ecosystemKeys": ["HiDream-O1"],
        "versionIds": [2939964]
      })
    ])
  }),
  Object.freeze({
    "id": "Krea2",
    "label": "Krea 2",
    "outputType": "image",
    "members": ["Krea2"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Krea2:2983023",
        "optionKey": "2983023",
        "label": "Medium",
        "ecosystemKeys": [],
        "versionIds": [2983023]
      }),
      Object.freeze({
        "id": "Krea2:2983022",
        "optionKey": "2983022",
        "label": "Large",
        "ecosystemKeys": [],
        "versionIds": [2983022]
      }),
      Object.freeze({
        "id": "Krea2:3072329",
        "optionKey": "3072329",
        "label": "Raw",
        "ecosystemKeys": ["Krea2"],
        "versionIds": [3072329]
      }),
      Object.freeze({
        "id": "Krea2:3072332",
        "optionKey": "3072332",
        "label": "Turbo",
        "ecosystemKeys": [],
        "versionIds": [3072332]
      })
    ])
  }),
  Object.freeze({
    "id": "Krea3",
    "label": "Krea 3",
    "outputType": "image",
    "members": ["Krea3"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Krea3:3405360",
        "optionKey": "3405360",
        "label": "Krea 3",
        "ecosystemKeys": ["Krea3"],
        "versionIds": [3405360]
      })
    ])
  }),
  Object.freeze({
    "id": "MAI",
    "label": "MAI",
    "outputType": "image",
    "members": ["MAI"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "MAI:3002140",
        "optionKey": "3002140",
        "label": "MAI",
        "ecosystemKeys": ["MAI"],
        "versionIds": [3002140]
      })
    ])
  }),
  Object.freeze({
    "id": "MageFlow",
    "label": "Mage Flow",
    "outputType": "image",
    "members": ["MageFlow"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "MageFlow:3172038",
        "optionKey": "3172038",
        "label": "Standard",
        "ecosystemKeys": ["MageFlow"],
        "versionIds": [3172038]
      }),
      Object.freeze({
        "id": "MageFlow:3172039",
        "optionKey": "3172039",
        "label": "Turbo",
        "ecosystemKeys": [],
        "versionIds": [3172039]
      })
    ])
  }),
  Object.freeze({
    "id": "Ideogram",
    "label": "Ideogram",
    "outputType": "image",
    "members": ["Ideogram"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Ideogram:3246186",
        "optionKey": "3246186",
        "label": "v4.0",
        "ecosystemKeys": ["Ideogram"],
        "versionIds": [3246186]
      }),
      Object.freeze({
        "id": "Ideogram:3375798",
        "optionKey": "3375798",
        "label": "v4.5",
        "ecosystemKeys": [],
        "versionIds": [3375798]
      })
    ])
  }),
  Object.freeze({
    "id": "Boogu",
    "label": "Boogu",
    "outputType": "image",
    "members": ["Boogu"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Boogu:3049541",
        "optionKey": "3049541",
        "label": "Base",
        "ecosystemKeys": ["Boogu"],
        "versionIds": [3049541]
      }),
      Object.freeze({
        "id": "Boogu:3050010",
        "optionKey": "3050010",
        "label": "Turbo",
        "ecosystemKeys": [],
        "versionIds": [3050010]
      })
    ])
  }),
  Object.freeze({
    "id": "Reve",
    "label": "Reve",
    "outputType": "image",
    "members": ["Reve"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Reve:3133202",
        "optionKey": "3133202",
        "label": "Reve",
        "ecosystemKeys": ["Reve"],
        "versionIds": [3133202]
      })
    ])
  }),
  Object.freeze({
    "id": "MuseImage",
    "label": "Muse Image",
    "outputType": "image",
    "members": ["MuseImage"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "MuseImage:3291238",
        "optionKey": "3291238",
        "label": "Muse Image",
        "ecosystemKeys": ["MuseImage"],
        "versionIds": [3291238]
      })
    ])
  }),
  Object.freeze({
    "id": "Anima",
    "label": "Anima",
    "outputType": "image",
    "members": ["Anima"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Anima:2945208",
        "optionKey": "2945208",
        "label": "Anima",
        "ecosystemKeys": ["Anima"],
        "versionIds": [2945208]
      })
    ])
  }),
  Object.freeze({
    "id": "Chroma",
    "label": "Chroma",
    "outputType": "image",
    "members": ["Chroma"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Chroma:2164239",
        "optionKey": "2164239",
        "label": "Chroma",
        "ecosystemKeys": ["Chroma"],
        "versionIds": [2164239]
      })
    ])
  }),
  Object.freeze({
    "id": "Lens",
    "label": "Lens",
    "outputType": "image",
    "members": ["Lens"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Lens:2982236",
        "optionKey": "2982236",
        "label": "Base",
        "ecosystemKeys": ["Lens"],
        "versionIds": [2982236]
      }),
      Object.freeze({
        "id": "Lens:2982241",
        "optionKey": "2982241",
        "label": "Turbo",
        "ecosystemKeys": [],
        "versionIds": [2982241]
      })
    ])
  }),
  Object.freeze({
    "id": "Grok",
    "label": "Grok",
    "outputType": "image",
    "members": ["Grok"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Grok:2738377",
        "optionKey": "2738377",
        "label": "v1.0",
        "ecosystemKeys": ["Grok"],
        "versionIds": [2738377]
      }),
      Object.freeze({
        "id": "Grok:3197990",
        "optionKey": "3197990",
        "label": "v1.5",
        "ecosystemKeys": [],
        "versionIds": [3197990]
      }),
      Object.freeze({
        "id": "Grok:3225510",
        "optionKey": "3225510",
        "label": "v2.0",
        "ecosystemKeys": [],
        "versionIds": [3225510]
      })
    ])
  }),
  Object.freeze({
    "id": "Ming",
    "label": "Ming Image Design",
    "outputType": "image",
    "members": ["Ming"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Ming:3355635",
        "optionKey": "3355635",
        "label": "Ming Image Design",
        "ecosystemKeys": ["Ming"],
        "versionIds": [3355635]
      })
    ])
  }),
  Object.freeze({
    "id": "MossImage",
    "label": "MOSS Image",
    "outputType": "image",
    "members": ["MossImage"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "MossImage:3409867",
        "optionKey": "3409867",
        "label": "SFT",
        "ecosystemKeys": ["MossImage"],
        "versionIds": [3409867]
      }),
      Object.freeze({
        "id": "MossImage:3409868",
        "optionKey": "3409868",
        "label": "Base",
        "ecosystemKeys": [],
        "versionIds": [3409868]
      })
    ])
  }),
  Object.freeze({
    "id": "Upscaler",
    "label": "Upscaler",
    "outputType": "image",
    "members": ["Upscaler"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Upscaler:default",
        "optionKey": "default",
        "label": "Upscaler",
        "ecosystemKeys": ["Upscaler"],
        "versionIds": []
      })
    ])
  }),
  Object.freeze({
    "id": "Flux3Video",
    "label": "Flux 3 Video",
    "outputType": "video",
    "members": ["Flux3Video"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Flux3Video:3204701",
        "optionKey": "3204701",
        "label": "v3.0",
        "ecosystemKeys": ["Flux3Video"],
        "versionIds": [3204701]
      })
    ])
  }),
  Object.freeze({
    "id": "HyV1",
    "label": "Hunyuan Video",
    "outputType": "video",
    "members": ["HyV1"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "HyV1:1313562",
        "optionKey": "1313562",
        "label": "Hunyuan Video",
        "ecosystemKeys": ["HyV1"],
        "versionIds": [1313562]
      })
    ])
  }),
  Object.freeze({
    "id": "WanVideo",
    "label": "Wan Video",
    "outputType": "video",
    "members": ["WanVideo","WanVideo1_3B_T2V","WanVideo14B_T2V","WanVideo14B_I2V_480p","WanVideo14B_I2V_720p","WanVideo-22-TI2V-5B","WanVideo-22-I2V-A14B","WanVideo-22-T2V-A14B","WanVideo-25-T2V","WanVideo-25-I2V","WanVideo27","WanVideo30"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "WanVideo:v2.1",
        "optionKey": "v2.1",
        "label": "2.1",
        "ecosystemKeys": ["WanVideo14B_T2V","WanVideo14B_I2V_720p","WanVideo14B_I2V_480p","WanVideo"],
        "versionIds": [1707796,1501344,1501125]
      }),
      Object.freeze({
        "id": "WanVideo:v2.2",
        "optionKey": "v2.2",
        "label": "2.2",
        "ecosystemKeys": ["WanVideo-22-T2V-A14B","WanVideo-22-I2V-A14B"],
        "versionIds": [2114154,2114157]
      }),
      Object.freeze({
        "id": "WanVideo:v2.2-5b",
        "optionKey": "v2.2-5b",
        "label": "2.2 5B",
        "ecosystemKeys": ["WanVideo-22-TI2V-5B"],
        "versionIds": [2114110]
      }),
      Object.freeze({
        "id": "WanVideo:v2.5",
        "optionKey": "v2.5",
        "label": "2.5",
        "ecosystemKeys": ["WanVideo-25-T2V","WanVideo-25-I2V"],
        "versionIds": [2254989,2254963]
      }),
      Object.freeze({
        "id": "WanVideo:v2.7",
        "optionKey": "v2.7",
        "label": "2.7",
        "ecosystemKeys": ["WanVideo27"],
        "versionIds": [2828005]
      }),
      Object.freeze({
        "id": "WanVideo:v3.0",
        "optionKey": "v3.0",
        "label": "3.0",
        "ecosystemKeys": ["WanVideo30"],
        "versionIds": [3267095]
      })
    ])
  }),
  Object.freeze({
    "id": "Veo3",
    "label": "Veo 3",
    "outputType": "video",
    "members": ["Veo3"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Veo3:2827948",
        "optionKey": "2827948",
        "label": "Fast Mode",
        "ecosystemKeys": [],
        "versionIds": [2827948]
      }),
      Object.freeze({
        "id": "Veo3:2827945",
        "optionKey": "2827945",
        "label": "Standard",
        "ecosystemKeys": ["Veo3"],
        "versionIds": [2827945]
      })
    ])
  }),
  Object.freeze({
    "id": "HappyHorse",
    "label": "HappyHorse",
    "outputType": "video",
    "members": ["HappyHorse"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "HappyHorse:2902378",
        "optionKey": "2902378",
        "label": "v1.0",
        "ecosystemKeys": [],
        "versionIds": [2902378]
      }),
      Object.freeze({
        "id": "HappyHorse:3063263",
        "optionKey": "3063263",
        "label": "v1.1",
        "ecosystemKeys": ["HappyHorse"],
        "versionIds": [3063263]
      })
    ])
  }),
  Object.freeze({
    "id": "LTXV",
    "label": "LTX Video",
    "outputType": "video",
    "members": ["LTXV","LTXV2","LTXV23","LTXV25"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "LTXV:2578325",
        "optionKey": "2578325",
        "label": "19B Dev",
        "ecosystemKeys": ["LTXV2"],
        "versionIds": [2578325]
      }),
      Object.freeze({
        "id": "LTXV:2600562",
        "optionKey": "2600562",
        "label": "19B Distilled",
        "ecosystemKeys": [],
        "versionIds": [2600562]
      }),
      Object.freeze({
        "id": "LTXV:2749908",
        "optionKey": "2749908",
        "label": "Dev",
        "ecosystemKeys": ["LTXV23"],
        "versionIds": [2749908]
      }),
      Object.freeze({
        "id": "LTXV:2749948",
        "optionKey": "2749948",
        "label": "Distilled",
        "ecosystemKeys": [],
        "versionIds": [2749948]
      }),
      Object.freeze({
        "id": "LTXV:3220143",
        "optionKey": "3220143",
        "label": "22B Dev",
        "ecosystemKeys": ["LTXV25"],
        "versionIds": [3220143]
      }),
      Object.freeze({
        "id": "LTXV:3220250",
        "optionKey": "3220250",
        "label": "22B Distilled",
        "ecosystemKeys": [],
        "versionIds": [3220250]
      }),
      Object.freeze({
        "id": "LTXV:2921800",
        "optionKey": "2921800",
        "label": "Dev",
        "ecosystemKeys": [],
        "versionIds": [2921800]
      }),
      Object.freeze({
        "id": "LTXV:2923808",
        "optionKey": "2923808",
        "label": "Distilled",
        "ecosystemKeys": [],
        "versionIds": [2923808]
      })
    ])
  }),
  Object.freeze({
    "id": "Vidu",
    "label": "Vidu",
    "outputType": "video",
    "members": ["Vidu"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Vidu:2623839",
        "optionKey": "2623839",
        "label": "Q1",
        "ecosystemKeys": ["Vidu"],
        "versionIds": [2623839]
      }),
      Object.freeze({
        "id": "Vidu:2741273",
        "optionKey": "2741273",
        "label": "Q3",
        "ecosystemKeys": [],
        "versionIds": [2741273]
      }),
      Object.freeze({
        "id": "Vidu:3392572",
        "optionKey": "3392572",
        "label": "Q4",
        "ecosystemKeys": [],
        "versionIds": [3392572]
      })
    ])
  }),
  Object.freeze({
    "id": "MiniMaxH3",
    "label": "MiniMax H3",
    "outputType": "video",
    "members": ["MiniMaxH3"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "MiniMaxH3:3216500",
        "optionKey": "3216500",
        "label": "Comfy",
        "ecosystemKeys": ["MiniMaxH3"],
        "versionIds": [3216500]
      }),
      Object.freeze({
        "id": "MiniMaxH3:3183239",
        "optionKey": "3183239",
        "label": "Api",
        "ecosystemKeys": [],
        "versionIds": [3183239]
      }),
      Object.freeze({
        "id": "MiniMaxH3:3388469",
        "optionKey": "3388469",
        "label": "Max by Fal",
        "ecosystemKeys": [],
        "versionIds": [3388469]
      }),
      Object.freeze({
        "id": "MiniMaxH3:3388470",
        "optionKey": "3388470",
        "label": "HeyGen",
        "ecosystemKeys": [],
        "versionIds": [3388470]
      })
    ])
  }),
  Object.freeze({
    "id": "Kling",
    "label": "Kling",
    "outputType": "video",
    "members": ["Kling"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Kling:2623815",
        "optionKey": "2623815",
        "label": "V1.6",
        "ecosystemKeys": [],
        "versionIds": [2623815]
      }),
      Object.freeze({
        "id": "Kling:2623817",
        "optionKey": "2623817",
        "label": "V2",
        "ecosystemKeys": [],
        "versionIds": [2623817]
      }),
      Object.freeze({
        "id": "Kling:2623821",
        "optionKey": "2623821",
        "label": "V2.5 Turbo",
        "ecosystemKeys": [],
        "versionIds": [2623821]
      }),
      Object.freeze({
        "id": "Kling:2698632",
        "optionKey": "2698632",
        "label": "V3",
        "ecosystemKeys": ["Kling"],
        "versionIds": [2698632]
      })
    ])
  }),
  Object.freeze({
    "id": "Seedance",
    "label": "Seedance",
    "outputType": "video",
    "members": ["Seedance"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Seedance:2864671",
        "optionKey": "2864671",
        "label": "v2",
        "ecosystemKeys": ["Seedance"],
        "versionIds": [2864671]
      }),
      Object.freeze({
        "id": "Seedance:3207504",
        "optionKey": "3207504",
        "label": "v2.5",
        "ecosystemKeys": [],
        "versionIds": [3207504]
      })
    ])
  }),
  Object.freeze({
    "id": "Ace",
    "label": "ACE Audio",
    "outputType": "audio",
    "members": ["Ace"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Ace:2864949",
        "optionKey": "2864949",
        "label": "XL Turbo",
        "ecosystemKeys": ["Ace"],
        "versionIds": [2864949]
      }),
      Object.freeze({
        "id": "Ace:2864880",
        "optionKey": "2864880",
        "label": "Turbo",
        "ecosystemKeys": [],
        "versionIds": [2864880]
      }),
      Object.freeze({
        "id": "Ace:2864917",
        "optionKey": "2864917",
        "label": "XL SFT",
        "ecosystemKeys": [],
        "versionIds": [2864917]
      }),
      Object.freeze({
        "id": "Ace:2864892",
        "optionKey": "2864892",
        "label": "XL Base",
        "ecosystemKeys": [],
        "versionIds": [2864892]
      }),
      Object.freeze({
        "id": "Ace:2864864",
        "optionKey": "2864864",
        "label": "Base",
        "ecosystemKeys": [],
        "versionIds": [2864864]
      })
    ])
  }),
  Object.freeze({
    "id": "MiniMaxMusic3",
    "label": "MiniMax Music 3",
    "outputType": "audio",
    "members": ["MiniMaxMusic3"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "MiniMaxMusic3:3225593",
        "optionKey": "3225593",
        "label": "v3.0",
        "ecosystemKeys": ["MiniMaxMusic3"],
        "versionIds": [3225593]
      })
    ])
  }),
  Object.freeze({
    "id": "YuE2",
    "label": "YuE2",
    "outputType": "audio",
    "members": ["YuE2"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "YuE2:3337846",
        "optionKey": "3337846",
        "label": "v2",
        "ecosystemKeys": ["YuE2"],
        "versionIds": [3337846]
      })
    ])
  }),
  Object.freeze({
    "id": "Sonilo",
    "label": "Sonilo",
    "outputType": "audio",
    "members": ["Sonilo"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Sonilo:3370181",
        "optionKey": "3370181",
        "label": "Sonilo",
        "ecosystemKeys": ["Sonilo"],
        "versionIds": [3370181]
      })
    ])
  }),
  Object.freeze({
    "id": "PolyGen",
    "label": "PolyGen (Meshy)",
    "outputType": "model3d",
    "members": ["PolyGen"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "PolyGen:default",
        "optionKey": "default",
        "label": "PolyGen (Meshy)",
        "ecosystemKeys": ["PolyGen"],
        "versionIds": []
      })
    ])
  }),
  Object.freeze({
    "id": "Tripo",
    "label": "Tripo",
    "outputType": "model3d",
    "members": ["Tripo"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Tripo:default",
        "optionKey": "default",
        "label": "Tripo",
        "ecosystemKeys": ["Tripo"],
        "versionIds": []
      })
    ])
  }),
  Object.freeze({
    "id": "Hunyuan3D",
    "label": "Hunyuan3D",
    "outputType": "model3d",
    "members": ["Hunyuan3D"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Hunyuan3D:default",
        "optionKey": "default",
        "label": "Hunyuan3D",
        "ecosystemKeys": ["Hunyuan3D"],
        "versionIds": []
      })
    ])
  }),
  Object.freeze({
    "id": "Pixal3D",
    "label": "Pixal3D",
    "outputType": "model3d",
    "members": ["Pixal3D"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Pixal3D:default",
        "optionKey": "default",
        "label": "Pixal3D",
        "ecosystemKeys": ["Pixal3D"],
        "versionIds": []
      })
    ])
  }),
  Object.freeze({
    "id": "Trellis2",
    "label": "Trellis.2",
    "outputType": "model3d",
    "members": ["Trellis2"],
    "variants": Object.freeze([
      Object.freeze({
        "id": "Trellis2:default",
        "optionKey": "default",
        "label": "Trellis.2",
        "ecosystemKeys": ["Trellis2"],
        "versionIds": []
      })
    ])
  })
  ]),
  baseModelToEcosystem: Object.freeze({
  "ACE Audio":                   "Ace",
  "Anima":                       "Anima",
  "AuraFlow":                    "AuraFlow",
  "Boogu":                       "Boogu",
  "Chroma":                      "Chroma",
  "CogVideoX":                   "CogVideoX",
  "Ernie":                       "Ernie",
  "Flux 3 Video":                "Flux3Video",
  "Flux.1 D":                    "Flux1",
  "Flux.1 Kontext":              "Flux1Kontext",
  "Flux.1 Krea":                 "FluxKrea",
  "Flux.1 S":                    "Flux1",
  "Flux.2 D":                    "Flux2",
  "Flux.2 Klein 4B":             "Flux2Klein_4B",
  "Flux.2 Klein 4B-base":        "Flux2Klein_4B_base",
  "Flux.2 Klein 9B":             "Flux2Klein_9B",
  "Flux.2 Klein 9B-base":        "Flux2Klein_9B_base",
  "Flux.3":                      "Flux3",
  "Flux.3 Klein":                "Flux3Klein",
  "Flux.3 Klein-base":           "Flux3Klein_base",
  "Grok":                        "Grok",
  "HappyHorse":                  "HappyHorse",
  "HiDream":                     "HiDream",
  "HiDream-O1":                  "HiDream-O1",
  "Hunyuan 1":                   "HyDit1",
  "Hunyuan Video":               "HyV1",
  "Hunyuan3D":                   "Hunyuan3D",
  "Ideogram 4.0":                "Ideogram",
  "Ideogram 4.5":                "Ideogram",
  "Illustrious":                 "Illustrious",
  "Imagen4":                     "Imagen4",
  "Kling":                       "Kling",
  "Kolors":                      "Kolors",
  "Krea 2":                      "Krea2",
  "Krea 2 Turbo":                "Krea2",
  "Krea 3":                      "Krea3",
  "LTXV":                        "LTXV",
  "LTXV 2.3":                    "LTXV23",
  "LTXV 2.5":                    "LTXV25",
  "LTXV2":                       "LTXV2",
  "Lens":                        "Lens",
  "Lumina":                      "Lumina",
  "MAI":                         "MAI",
  "MOSS Image":                  "MossImage",
  "MageFlow":                    "MageFlow",
  "Ming Image Design 0.1":       "Ming",
  "Ming Image Design Layer 0.1": "MingLayer",
  "MiniMax H3":                  "MiniMaxH3",
  "MiniMax Music 3":             "MiniMaxMusic3",
  "Mochi":                       "Mochi",
  "Muse Image":                  "MuseImage",
  "Nano Banana":                 "NanoBanana",
  "NoobAI":                      "NoobAI",
  "ODOR":                        "ODOR",
  "OpenAI":                      "OpenAI",
  "Other":                       "Other",
  "PixArt E":                    "PixArtE",
  "PixArt a":                    "PixArtA",
  "Pixal3D":                     "Pixal3D",
  "Playground v2":               "PlaygroundV2",
  "PolyGen":                     "PolyGen",
  "Pony":                        "Pony",
  "Pony V7":                     "PonyV7",
  "Qwen":                        "Qwen",
  "Qwen 2":                      "Qwen2",
  "Qwen 2.1":                    "Qwen21",
  "Qwen 3":                      "Qwen3",
  "Reve":                        "Reve",
  "SD 1.4":                      "SD1",
  "SD 1.5":                      "SD1",
  "SD 1.5 Hyper":                "SD1",
  "SD 1.5 LCM":                  "SD1",
  "SD 2.0":                      "SD2",
  "SD 2.0 768":                  "SD2",
  "SD 2.1":                      "SD2",
  "SD 2.1 768":                  "SD2",
  "SD 2.1 Unclip":               "SD2",
  "SD 3":                        "SD3",
  "SD 3.5":                      "SD3",
  "SD 3.5 Large":                "SD3",
  "SD 3.5 Large Turbo":          "SD3",
  "SD 3.5 Medium":               "SD3_5M",
  "SDXL 0.9":                    "SDXL",
  "SDXL 1.0":                    "SDXL",
  "SDXL 1.0 LCM":                "SDXL",
  "SDXL Distilled":              "SDXLDistilled",
  "SDXL Hyper":                  "SDXL",
  "SDXL Lightning":              "SDXL",
  "SDXL Turbo":                  "SDXL",
  "SVD":                         "SVD",
  "SVD XT":                      "SVD",
  "Seedance":                    "Seedance",
  "Seedream":                    "Seedream",
  "Sonilo":                      "Sonilo",
  "Sora 2":                      "Sora2",
  "Stable Cascade":              "SCascade",
  "Trellis.2":                   "Trellis2",
  "Tripo":                       "Tripo",
  "Upscaler":                    "Upscaler",
  "Veo 3":                       "Veo3",
  "Vidu Q1":                     "Vidu",
  "Wan Image 2.7":               "WanImage27",
  "Wan Video":                   "WanVideo",
  "Wan Video 1.3B t2v":          "WanVideo1_3B_T2V",
  "Wan Video 14B i2v 480p":      "WanVideo14B_I2V_480p",
  "Wan Video 14B i2v 720p":      "WanVideo14B_I2V_720p",
  "Wan Video 14B t2v":           "WanVideo14B_T2V",
  "Wan Video 2.2 I2V-A14B":      "WanVideo-22-I2V-A14B",
  "Wan Video 2.2 T2V-A14B":      "WanVideo-22-T2V-A14B",
  "Wan Video 2.2 TI2V-5B":       "WanVideo-22-TI2V-5B",
  "Wan Video 2.5 I2V":           "WanVideo-25-I2V",
  "Wan Video 2.5 T2V":           "WanVideo-25-T2V",
  "Wan Video 2.7":               "WanVideo27",
  "Wan Video 3.0":               "WanVideo30",
  "YuE2":                        "YuE2",
  "ZImageBase":                  "ZImageBase",
  "ZImageTurbo":                 "ZImageTurbo",
  })
});
