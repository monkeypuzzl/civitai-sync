import {
  FacetBar
} from "./chunk-PLCSGSRC.js";
import {
  REMOVAL_BUSY_MS,
  exportPendingCopy,
  exportRowKind,
  removalBusyLabel,
  removalFailureCopy,
  syncAllSlugs
} from "./chunk-YGDMMQ62.js";
import {
  aspectTokenLabel
} from "./chunk-CI4B4ALB.js";
import {
  PUBLICATION_FACET,
  PUBLICATION_LABELS,
  USED_AS_INPUT_FACET,
  formatDateRange,
  modelChipGroups
} from "./chunk-LNGUPSA6.js";
import {
  BASE_MODEL_RESIDUALS,
  FAMILY_RESIDUALS,
  describeTypeWorkflowQuery
} from "./chunk-TQWSKHC6.js";
import {
  modelTypeLabel
} from "./chunk-XQGXV6CL.js";
import {
  OpenFolderButton
} from "./chunk-LSVDCSFO.js";
import "./chunk-JLH4BCQU.js";
import "./chunk-X3SNRSQH.js";
import "./chunk-ECN4OFEF.js";
import {
  A,
  cancelExportSync,
  connectExportSync,
  createExport,
  d,
  deleteExport,
  g,
  getModelHierarchy,
  k,
  listExports,
  parseModels,
  planExportDraft,
  q,
  removalFileCount,
  stringLiftQuery,
  syncExport,
  tagLabel,
  u,
  updateExport,
  useDocumentTitle,
  y
} from "./chunk-GOKE7NMO.js";

// src/vendor/civitai-ecosystems.mjs
var ECOSYSTEM_DISPLAY_NAMES = Object.freeze({
  "ace": "ACE Audio",
  "auraflow": "AuraFlow",
  "cogvideox": "CogVideoX",
  "flux1": "Flux.1",
  "flux1kontext": "Flux.1 Kontext",
  "flux2": "Flux.2",
  "flux3": "Flux.3",
  "flux3klein": "Flux.3 Klein",
  "flux3klein_base": "Flux.3 Klein Base",
  "flux3video": "Flux 3 Video",
  "fluxkrea": "Flux.1 Krea",
  "happyhorse": "HappyHorse",
  "hidream": "HiDream",
  "hidream-o1": "HiDream-O1",
  "hunyuan3d": "Hunyuan3D",
  "hydit1": "Hunyuan DiT",
  "hyv1": "Hunyuan Video",
  "imagen4": "Imagen 4",
  "krea2": "Krea 2",
  "krea3": "Krea 3",
  "ltxv": "LTX Video",
  "ltxv2": "LTX Video 2",
  "ltxv23": "LTX Video 2.3",
  "ltxv25": "LTX Video 2.5",
  "mageflow": "Mage Flow",
  "mai": "MAI",
  "ming": "Ming Image Design",
  "minglayer": "Ming Image Design Layer",
  "minimaxh3": "MiniMax H3",
  "minimaxmusic3": "MiniMax Music 3",
  "mossimage": "MOSS Image",
  "museimage": "Muse Image",
  "nanobanana": "Nano Banana",
  "odor": "ODOR",
  "openai": "OpenAI",
  "pixal3d": "Pixal3D",
  "pixarta": "PixArt Alpha",
  "pixarte": "PixArt Sigma",
  "playgroundv2": "Playground v2",
  "polygen": "PolyGen (Meshy)",
  "qwen2": "Qwen 2",
  "qwen21": "Qwen 2.1",
  "qwen3": "Qwen 3",
  "scascade": "Stable Cascade",
  "sd1": "Stable Diffusion 1.x",
  "sd2": "Stable Diffusion 2.x",
  "sd3": "Stable Diffusion 3",
  "sd3_5m": "Stable Diffusion 3.5 Medium",
  "sdxl": "Stable Diffusion XL",
  "sdxldistilled": "SDXL Distilled",
  "sora2": "Sora 2",
  "svd": "Stable Video Diffusion",
  "trellis2": "Trellis.2",
  "veo3": "Veo 3",
  "wanimage27": "Wan Image 2.7",
  "wanvideo": "Wan Video",
  "wanvideo-22-i2v-a14b": "Wan Video 2.2 I2V A14B",
  "wanvideo-22-t2v-a14b": "Wan Video 2.2 T2V A14B",
  "wanvideo-22-ti2v-5b": "Wan Video 2.2 TI2V 5B",
  "wanvideo-25-i2v": "Wan Video 2.5 I2V",
  "wanvideo-25-t2v": "Wan Video 2.5 T2V",
  "wanvideo14b_i2v_480p": "Wan Video 14B I2V 480p",
  "wanvideo14b_i2v_720p": "Wan Video 14B I2V 720p",
  "wanvideo14b_t2v": "Wan Video 14B T2V",
  "wanvideo1_3b_t2v": "Wan Video 1.3B T2V",
  "wanvideo27": "Wan Video 2.7",
  "wanvideo30": "Wan Video 3.0",
  "yue2": "YuE2",
  "zimagebase": "ZImageBase",
  "zimageturbo": "ZImageTurbo"
});

// src/ecosystemDisplay.mjs
function titleCase(key) {
  if (!key) return "";
  return String(key).replace(/(^|[\s\-_])(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());
}
function getEcosystemDisplayName(key) {
  if (!key || typeof key !== "string") return "";
  const lower = key.toLowerCase();
  return ECOSYSTEM_DISPLAY_NAMES[lower] ?? titleCase(lower);
}

// src/vendor/civitai-model-families.mjs
var CIVITAI_MODEL_FAMILIES = Object.freeze({
  families: Object.freeze([
    Object.freeze({
      "id": "Flux1",
      "label": "Flux.1",
      "outputType": "image",
      "members": ["Flux1", "FluxKrea"],
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
          "versionIds": [2068e3]
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
      "members": ["Flux2Klein_9B", "Flux2Klein_9B_base", "Flux2Klein_4B", "Flux2Klein_4B_base"],
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
      "members": ["Flux3Klein", "Flux3Klein_base"],
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
      "members": ["ZImageTurbo", "ZImageBase"],
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
      "members": ["WanVideo", "WanVideo1_3B_T2V", "WanVideo14B_T2V", "WanVideo14B_I2V_480p", "WanVideo14B_I2V_720p", "WanVideo-22-TI2V-5B", "WanVideo-22-I2V-A14B", "WanVideo-22-T2V-A14B", "WanVideo-25-T2V", "WanVideo-25-I2V", "WanVideo27", "WanVideo30"],
      "variants": Object.freeze([
        Object.freeze({
          "id": "WanVideo:v2.1",
          "optionKey": "v2.1",
          "label": "2.1",
          "ecosystemKeys": ["WanVideo14B_T2V", "WanVideo14B_I2V_720p", "WanVideo14B_I2V_480p", "WanVideo"],
          "versionIds": [1707796, 1501344, 1501125]
        }),
        Object.freeze({
          "id": "WanVideo:v2.2",
          "optionKey": "v2.2",
          "label": "2.2",
          "ecosystemKeys": ["WanVideo-22-T2V-A14B", "WanVideo-22-I2V-A14B"],
          "versionIds": [2114154, 2114157]
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
          "ecosystemKeys": ["WanVideo-25-T2V", "WanVideo-25-I2V"],
          "versionIds": [2254989, 2254963]
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
      "members": ["LTXV", "LTXV2", "LTXV23", "LTXV25"],
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
    "ACE Audio": "Ace",
    "Anima": "Anima",
    "AuraFlow": "AuraFlow",
    "Boogu": "Boogu",
    "Chroma": "Chroma",
    "CogVideoX": "CogVideoX",
    "Ernie": "Ernie",
    "Flux 3 Video": "Flux3Video",
    "Flux.1 D": "Flux1",
    "Flux.1 Kontext": "Flux1Kontext",
    "Flux.1 Krea": "FluxKrea",
    "Flux.1 S": "Flux1",
    "Flux.2 D": "Flux2",
    "Flux.2 Klein 4B": "Flux2Klein_4B",
    "Flux.2 Klein 4B-base": "Flux2Klein_4B_base",
    "Flux.2 Klein 9B": "Flux2Klein_9B",
    "Flux.2 Klein 9B-base": "Flux2Klein_9B_base",
    "Flux.3": "Flux3",
    "Flux.3 Klein": "Flux3Klein",
    "Flux.3 Klein-base": "Flux3Klein_base",
    "Grok": "Grok",
    "HappyHorse": "HappyHorse",
    "HiDream": "HiDream",
    "HiDream-O1": "HiDream-O1",
    "Hunyuan 1": "HyDit1",
    "Hunyuan Video": "HyV1",
    "Hunyuan3D": "Hunyuan3D",
    "Ideogram 4.0": "Ideogram",
    "Ideogram 4.5": "Ideogram",
    "Illustrious": "Illustrious",
    "Imagen4": "Imagen4",
    "Kling": "Kling",
    "Kolors": "Kolors",
    "Krea 2": "Krea2",
    "Krea 2 Turbo": "Krea2",
    "Krea 3": "Krea3",
    "LTXV": "LTXV",
    "LTXV 2.3": "LTXV23",
    "LTXV 2.5": "LTXV25",
    "LTXV2": "LTXV2",
    "Lens": "Lens",
    "Lumina": "Lumina",
    "MAI": "MAI",
    "MOSS Image": "MossImage",
    "MageFlow": "MageFlow",
    "Ming Image Design 0.1": "Ming",
    "Ming Image Design Layer 0.1": "MingLayer",
    "MiniMax H3": "MiniMaxH3",
    "MiniMax Music 3": "MiniMaxMusic3",
    "Mochi": "Mochi",
    "Muse Image": "MuseImage",
    "Nano Banana": "NanoBanana",
    "NoobAI": "NoobAI",
    "ODOR": "ODOR",
    "OpenAI": "OpenAI",
    "Other": "Other",
    "PixArt E": "PixArtE",
    "PixArt a": "PixArtA",
    "Pixal3D": "Pixal3D",
    "Playground v2": "PlaygroundV2",
    "PolyGen": "PolyGen",
    "Pony": "Pony",
    "Pony V7": "PonyV7",
    "Qwen": "Qwen",
    "Qwen 2": "Qwen2",
    "Qwen 2.1": "Qwen21",
    "Qwen 3": "Qwen3",
    "Reve": "Reve",
    "SD 1.4": "SD1",
    "SD 1.5": "SD1",
    "SD 1.5 Hyper": "SD1",
    "SD 1.5 LCM": "SD1",
    "SD 2.0": "SD2",
    "SD 2.0 768": "SD2",
    "SD 2.1": "SD2",
    "SD 2.1 768": "SD2",
    "SD 2.1 Unclip": "SD2",
    "SD 3": "SD3",
    "SD 3.5": "SD3",
    "SD 3.5 Large": "SD3",
    "SD 3.5 Large Turbo": "SD3",
    "SD 3.5 Medium": "SD3_5M",
    "SDXL 0.9": "SDXL",
    "SDXL 1.0": "SDXL",
    "SDXL 1.0 LCM": "SDXL",
    "SDXL Distilled": "SDXLDistilled",
    "SDXL Hyper": "SDXL",
    "SDXL Lightning": "SDXL",
    "SDXL Turbo": "SDXL",
    "SVD": "SVD",
    "SVD XT": "SVD",
    "Seedance": "Seedance",
    "Seedream": "Seedream",
    "Sonilo": "Sonilo",
    "Sora 2": "Sora2",
    "Stable Cascade": "SCascade",
    "Trellis.2": "Trellis2",
    "Tripo": "Tripo",
    "Upscaler": "Upscaler",
    "Veo 3": "Veo3",
    "Vidu Q1": "Vidu",
    "Wan Image 2.7": "WanImage27",
    "Wan Video": "WanVideo",
    "Wan Video 1.3B t2v": "WanVideo1_3B_T2V",
    "Wan Video 14B i2v 480p": "WanVideo14B_I2V_480p",
    "Wan Video 14B i2v 720p": "WanVideo14B_I2V_720p",
    "Wan Video 14B t2v": "WanVideo14B_T2V",
    "Wan Video 2.2 I2V-A14B": "WanVideo-22-I2V-A14B",
    "Wan Video 2.2 T2V-A14B": "WanVideo-22-T2V-A14B",
    "Wan Video 2.2 TI2V-5B": "WanVideo-22-TI2V-5B",
    "Wan Video 2.5 I2V": "WanVideo-25-I2V",
    "Wan Video 2.5 T2V": "WanVideo-25-T2V",
    "Wan Video 2.7": "WanVideo27",
    "Wan Video 3.0": "WanVideo30",
    "YuE2": "YuE2",
    "ZImageBase": "ZImageBase",
    "ZImageTurbo": "ZImageTurbo"
  })
});

// src/residualMerge.mjs
function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function mergeRecords(current, residual) {
  const out = {};
  const extra = residual && typeof residual === "object" ? residual : {};
  const live = current && typeof current === "object" ? current : {};
  for (const key of Object.keys(extra)) {
    if (has(extra, key)) out[key] = extra[key];
  }
  for (const key of Object.keys(live)) {
    if (has(live, key)) out[key] = live[key];
  }
  return out;
}
function versionIdSet(variants) {
  const ids = /* @__PURE__ */ new Set();
  for (const variant of variants || []) {
    for (const vid of variant.versionIds || []) {
      const n = Number(vid);
      if (Number.isFinite(n)) ids.add(n);
    }
  }
  return ids;
}
function mergeFamilies(currentFamilies, residualFamilies) {
  const current = Array.isArray(currentFamilies) ? currentFamilies : [];
  const residual = Array.isArray(residualFamilies) ? residualFamilies : [];
  const out = current.map((fam) => ({
    ...fam,
    variants: [...fam.variants || []]
  }));
  const index = new Map(out.map((fam) => [fam.id, fam]));
  for (const fam of residual) {
    if (!fam || !fam.id) continue;
    const existing = index.get(fam.id);
    if (!existing) {
      out.push(fam);
      index.set(fam.id, fam);
      continue;
    }
    const taken = versionIdSet(existing.variants);
    const variants = [...existing.variants || []];
    for (const variant of fam.variants || []) {
      const ids = [];
      for (const vid of variant.versionIds || []) {
        const n = Number(vid);
        if (Number.isFinite(n)) ids.push(n);
      }
      if (ids.some((id) => taken.has(id))) continue;
      variants.push(variant);
      for (const id of ids) taken.add(id);
    }
    existing.variants = variants;
  }
  return out;
}

// src/modelFamily.mjs
var mergedFamilies = mergeFamilies(CIVITAI_MODEL_FAMILIES.families, FAMILY_RESIDUALS);
var mergedBaseModels = mergeRecords(
  CIVITAI_MODEL_FAMILIES.baseModelToEcosystem,
  BASE_MODEL_RESIDUALS
);
var SECTION_LABELS = Object.freeze({
  image: "Image",
  video: "Video",
  audio: "Audio",
  model3d: "3D"
});
var familyById = /* @__PURE__ */ new Map();
var ecoKeyToFamily = /* @__PURE__ */ new Map();
var ecoKeyLowerToKey = /* @__PURE__ */ new Map();
var versionIdToVariantIds = /* @__PURE__ */ new Map();
var baseModelToEco = /* @__PURE__ */ new Map();
for (const [name, ecoKey] of Object.entries(mergedBaseModels)) {
  baseModelToEco.set(name, ecoKey);
}
for (const fam of mergedFamilies) {
  familyById.set(fam.id, fam);
  const allVariantIds = (fam.variants || []).map((v) => v.id);
  for (const member of fam.members || []) {
    ecoKeyToFamily.set(member, { familyId: fam.id, variantIds: [...allVariantIds] });
    ecoKeyLowerToKey.set(String(member).toLowerCase(), member);
  }
  for (const v of fam.variants || []) {
    for (const vid of v.versionIds || []) {
      const n = Number(vid);
      if (!Number.isFinite(n)) continue;
      const list = versionIdToVariantIds.get(n) || [];
      if (!list.includes(v.id)) list.push(v.id);
      versionIdToVariantIds.set(n, list);
    }
  }
}
function getModelFamily(id) {
  if (!id || typeof id !== "string") return null;
  return familyById.get(id) || null;
}
function sectionLabel(outputType) {
  if (!outputType || typeof outputType !== "string") return "";
  return SECTION_LABELS[outputType] || outputType;
}

// dev/ui/src/lib/query-label.js
var MID = " \xB7 ";
var OR = " or ";
var SLASH = " / ";
function termHasId(term) {
  if (!term) return false;
  if (term.modelId != null && term.modelId !== "") return true;
  if (term.versionId != null && term.versionId !== "") return true;
  return (term.except || []).some(termHasId);
}
function scopeNeedsNames(value) {
  const s = value == null ? "" : String(value);
  if (/(?:^|[~/])m\./.test(s) || /(?:^|[~/])v\./.test(s)) return true;
  if (/(?:^|[,/])model\./.test(s) || /(?:^|[,/])version\./.test(s)) return true;
  return parseModels(s).some(termHasId);
}
function scopeNamesFromTree(tree) {
  const modelById = {};
  const modelByName = {};
  const versionById = {};
  for (const type of tree?.types || []) {
    for (const base of type.baseModels || []) {
      for (const model of base.models || []) {
        if (model?.key == null || model.key === "") continue;
        const rec = { label: model.label || String(model.key) };
        if (model.idKind === "name") modelByName[String(model.key)] = rec;
        else modelById[String(model.key)] = rec;
        for (const version of model.versions || []) {
          if (version?.key == null || version.key === "") continue;
          versionById[String(version.key)] = {
            label: version.label || `Version ${version.key}`,
            modelLabel: rec.label
          };
        }
      }
    }
  }
  return { modelById, modelByName, versionById };
}
function csv(value) {
  if (value == null || value === "") return [];
  return String(value).split(",").map((s) => s.trim()).filter(Boolean);
}
function modelLabelOf(term, names) {
  const id = term.modelId != null && term.modelId !== "" ? String(term.modelId) : "";
  if (id && names?.modelById?.[id]?.label) return names.modelById[id].label;
  const byName = term.modelName ? names?.modelByName?.[term.modelName] : null;
  if (byName?.label) return byName.label;
  const verId = term.versionId != null && term.versionId !== "" ? String(term.versionId) : "";
  const ver = verId ? names?.versionById?.[verId] : null;
  if (ver?.modelLabel) return ver.modelLabel;
  if (term.modelName) return String(term.modelName);
  if (id) return `Model ${id}`;
  return "";
}
function versionLabelOf(term, names) {
  if (term.versionId == null || term.versionId === "") return "";
  const hit = names?.versionById?.[String(term.versionId)];
  if (hit?.label) return hit.label;
  return `Version ${term.versionId}`;
}
function termPresentation(term, names) {
  if (term?.familyId) {
    const fam = getModelFamily(String(term.familyId));
    const text = fam?.label || String(term.familyId);
    return { text, ancestors: [] };
  }
  if (term?.familyOutput) {
    return { text: sectionLabel(term.familyOutput) || String(term.familyOutput), ancestors: [] };
  }
  const chain = [];
  if (term.type) chain.push(modelTypeLabel(term.type) || String(term.type));
  if (term.baseModel) chain.push(String(term.baseModel));
  else if (term.ecosystem) {
    const eco = getEcosystemDisplayName(term.ecosystem) || String(term.ecosystem);
    if (eco) chain.push(eco);
  }
  const modelLabel = modelLabelOf(term, names);
  const versionLabel = versionLabelOf(term, names);
  if (modelLabel) chain.push(modelLabel);
  if (versionLabel) chain.push(versionLabel);
  if (!chain.length) return null;
  if (versionLabel && chain.length >= 2) {
    return {
      text: `${chain[chain.length - 2]}${SLASH}${chain[chain.length - 1]}`,
      ancestors: chain.slice(0, -2).reverse()
    };
  }
  return {
    text: chain[chain.length - 1],
    ancestors: chain.slice(0, -1).reverse()
  };
}
function disambiguate(items) {
  const counts = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (!item?.text) continue;
    counts.set(item.text, (counts.get(item.text) || 0) + 1);
  }
  const out = [];
  for (const item of items) {
    if (!item?.text) continue;
    if ((counts.get(item.text) || 0) < 2) {
      out.push(item.text);
      continue;
    }
    let text = item.text;
    for (const ancestor of item.ancestors || []) {
      if (!ancestor || text === ancestor || text.startsWith(`${ancestor}${SLASH}`)) continue;
      text = `${ancestor}${SLASH}${text}`;
      break;
    }
    out.push(text);
  }
  return out;
}
function joinAnd(names) {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
function groupSentence(groups) {
  const parts = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (group.kind === "except") continue;
    if (group.kind === "cluster") {
      parts.push(`${group.parentLabel} (${group.count})`);
      continue;
    }
    const holes = [];
    for (let n = i + 1; n < groups.length && groups[n].kind === "except"; n++) {
      holes.push(groups[n].name || group.text);
    }
    parts.push(holes.length ? `${group.text} except ${joinAnd(holes)}` : group.text);
  }
  return parts.join(OR);
}
function modelsSegment(query, names, tree) {
  const terms = parseModels(stringLiftQuery(query).models);
  if (!terms.length) return "";
  const hasExcept = terms.some((term) => (term.except || []).length);
  if (!tree && !hasExcept && terms.length > 3) return `Models (${terms.length})`;
  if (tree || hasExcept) return groupSentence(modelChipGroups(tree, terms));
  const items = [];
  for (const term of terms) {
    if (term.mine) {
      items.push({ text: "Mine", ancestors: [] });
      continue;
    }
    const presented = termPresentation(term, names);
    if (presented) items.push(presented);
  }
  return disambiguate(items).join(OR);
}
function boundPresent(value) {
  return value != null && value !== "";
}
function rangeSegment(label, min, max) {
  if (!boundPresent(min) && !boundPresent(max)) return "";
  return `${label} ${boundPresent(min) ? min : ""}\u2013${boundPresent(max) ? max : ""}`;
}
function describeQuery(query = {}, names = null, tree = null) {
  const parts = [];
  const reactions = csv(query.reaction);
  if (reactions.length) parts.push(reactions.map(tagLabel).join(", "));
  const tags = csv(query.tag);
  if (tags.length) parts.push(tags.map(tagLabel).join(", "));
  for (const segment of describeTypeWorkflowQuery(query)) {
    if (segment) parts.push(segment);
  }
  const aspects = csv(query.aspect);
  if (aspects.length) parts.push(aspects.map(aspectTokenLabel).join(", "));
  const models = modelsSegment(query, names, tree);
  if (models) parts.push(models);
  const range = formatDateRange(query.dateFrom, query.dateTo);
  if (range) parts.push(range);
  const cfg = rangeSegment("CFG", query.cfgMin, query.cfgMax);
  if (cfg) parts.push(cfg);
  const steps = rangeSegment("Steps", query.stepsMin, query.stepsMax);
  if (steps) parts.push(steps);
  const pubs = csv(query.publication);
  if (pubs.length) parts.push(pubs.map((t) => PUBLICATION_LABELS[t] || t).join(", "));
  if (query.usedAsInput === "1" || query.usedAsInput === true) parts.push(USED_AS_INPUT_FACET.label);
  if (query.q) parts.push(`\u201C${query.q}\u201D`);
  return parts.length ? parts.join(MID) : "All media";
}

// dev/ui/src/components/ExportsView.jsx
var EXPORT_FACETS = [
  { key: "reaction", kind: "chips", source: "reaction", valuesSource: "reactionTags", options: ["favorite", "feedback:liked", "feedback:disliked"] },
  { key: "mediaType", kind: "nested-tree", tree: "type-workflow", label: "Media Type" },
  { key: "aspect", kind: "nested-tree", tree: "aspect", label: "Aspect Ratio", alwaysShowRoots: true },
  { key: "models", kind: "tree", label: "Models" },
  { key: "dateFrom", key2: "dateTo", kind: "date-range", label: "Date" },
  { key: "cfgMin", key2: "cfgMax", kind: "number-range", label: "CFG" },
  { key: "stepsMin", key2: "stepsMax", kind: "number-range", label: "Steps" },
  PUBLICATION_FACET,
  USED_AS_INPUT_FACET
];
var EMPTY_EXPORT_FACET_PARAMS = {};
var CSV_KEYS = ["tag", "reaction", "mediaType", "aspect", "publication", "workflow", "workflowMode"];
var STR_KEYS = ["dateFrom", "dateTo", "models"];
var FLAG_KEYS = [];
var NUM_KEYS = ["cfgMin", "cfgMax", "stepsMin", "stepsMax"];
function emptyQueryState() {
  const s = {};
  for (const k2 of CSV_KEYS) s[k2] = [];
  for (const k2 of STR_KEYS) s[k2] = "";
  for (const k2 of NUM_KEYS) s[k2] = null;
  for (const k2 of FLAG_KEYS) s[k2] = null;
  s.usedAsInput = null;
  return s;
}
function queryToState(query = {}) {
  const s = emptyQueryState();
  for (const k2 of CSV_KEYS) if (query[k2]) s[k2] = String(query[k2]).split(",").map((x) => x.trim()).filter(Boolean);
  for (const k2 of STR_KEYS) if (query[k2]) s[k2] = String(query[k2]);
  for (const k2 of NUM_KEYS) if (query[k2] != null && query[k2] !== "") s[k2] = Number(query[k2]);
  for (const k2 of FLAG_KEYS) s[k2] = query[k2] === "1" || query[k2] === true ? true : null;
  if (query.usedAsInput === "1" || query.usedAsInput === true) s.usedAsInput = true;
  return s;
}
function stateToQuery(state, q2) {
  const out = {};
  for (const k2 of CSV_KEYS) {
    const v = state[k2];
    if (Array.isArray(v) && v.length) out[k2] = v.join(",");
  }
  for (const k2 of STR_KEYS) {
    const v = state[k2];
    if (v) out[k2] = v;
  }
  for (const k2 of NUM_KEYS) {
    const v = state[k2];
    if (v != null && v !== "" && !Number.isNaN(v)) out[k2] = String(v);
  }
  for (const k2 of FLAG_KEYS) if (state[k2] === true) out[k2] = "1";
  if (state.usedAsInput === true) out.usedAsInput = "1";
  if (q2 && q2.trim()) out.q = q2.trim();
  return out;
}
function linkModeLabel(mode) {
  if (mode === "hardlink") return "Hard link";
  if (mode === "copy") return "Copy";
  return "Auto";
}
function exportOpenPath(rec) {
  const dest = rec.path || `media/exports/${rec.slug}`;
  if (dest.startsWith("media/") || dest.startsWith("media\\")) {
    return "/" + dest.replace(/\\/g, "/");
  }
  return dest;
}
function formatBytes(n) {
  if (!n || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
function formatEta(seconds) {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `~${minutes} min`;
  return `~${Math.round(minutes / 60)} h`;
}
function planPreviewText(plan, dest) {
  const add = (plan.add || 0).toLocaleString();
  const remove = (plan.remove || 0).toLocaleString();
  const head = `Saving will add ${add} / remove ${remove}`;
  if (plan.linkMode === "copy" && plan.bytesNeeded > 0) {
    const eta = formatEta(plan.estimatedSeconds);
    return `${head} \u2014 ${formatBytes(plan.bytesNeeded)} copied to ${dest}${eta ? `, ${eta}` : ""}. Your downloaded originals are untouched.`;
  }
  return `${head} \u2014 hard-linked into ${dest}; no bytes are duplicated. Your downloaded originals are untouched.`;
}
function notifyChange() {
  try {
    window.dispatchEvent(new Event("exportschange"));
  } catch {
  }
}
function FailureHint({ copy }) {
  return /* @__PURE__ */ u("span", { class: "export-status-label", children: [
    /* @__PURE__ */ u("em", { children: copy.sentence }),
    " ",
    /* @__PURE__ */ u("em", { class: "export-status-errno", children: [
      "Error: ",
      /* @__PURE__ */ u("code", { class: "mono", children: copy.code })
    ] })
  ] });
}
function StatusCell({ rec, job, busyLabel, onSyncNow, onRetry, onCancel }) {
  if (busyLabel) {
    return /* @__PURE__ */ u("div", { class: "export-status syncing", children: [
      /* @__PURE__ */ u("span", { class: "spinner spinner-sm" }),
      /* @__PURE__ */ u("span", { class: "export-status-label", children: busyLabel })
    ] });
  }
  const kind = exportRowKind(rec.status, job);
  if (kind === "blank") return null;
  if (kind === "syncing") {
    const total = job?.filesTotal ?? (rec.status?.drift?.add || 0) + (rec.status?.drift?.remove || 0);
    const done = job?.filesDone ?? 0;
    return /* @__PURE__ */ u("div", { class: "export-status syncing", children: [
      /* @__PURE__ */ u("span", { class: "spinner spinner-sm" }),
      /* @__PURE__ */ u("span", { class: "export-status-label", children: `Syncing\u2026 ${done}/${total || "?"}` }),
      /* @__PURE__ */ u("button", { type: "button", class: "text-btn", onClick: onCancel, children: "Cancel" })
    ] });
  }
  if (kind === "pending") {
    const copy = exportPendingCopy(rec.status);
    return /* @__PURE__ */ u("div", { class: "export-status pending", children: [
      copy.kind === "failure" ? /* @__PURE__ */ u(FailureHint, { copy }) : /* @__PURE__ */ u("span", { class: "export-status-label", children: copy.text }),
      /* @__PURE__ */ u("button", { type: "button", class: "action-btn", onClick: onSyncNow, children: "Sync" })
    ] });
  }
  if (kind === "error") {
    const copy = exportPendingCopy(rec.status);
    return /* @__PURE__ */ u("div", { class: "export-status error", children: [
      copy.kind === "failure" ? /* @__PURE__ */ u(FailureHint, { copy }) : /* @__PURE__ */ u("span", { class: "export-status-label", children: "Sync failed" }),
      /* @__PURE__ */ u("button", { type: "button", class: "text-btn", onClick: onRetry, children: "Retry" })
    ] });
  }
  return /* @__PURE__ */ u("span", { class: "export-status idle" });
}
function ExportRow({ rec, job, removing, removalPending, busyLabel, removalError, scopeNames, scopeTree, onEdit, onAskRemove, onConfirmRemove, onCancelRemove, onSyncNow, onCancel }) {
  const dest = rec.path || `media/exports/${rec.slug}`;
  const sentence = describeQuery(rec.query, scopeNames, scopeTree);
  return /* @__PURE__ */ u("div", { class: "export-row", children: [
    /* @__PURE__ */ u("div", { class: "export-row-main", children: [
      /* @__PURE__ */ u("div", { class: "export-row-name", children: rec.name }),
      /* @__PURE__ */ u("div", { class: "export-row-dest mono", children: dest }),
      /* @__PURE__ */ u("div", { class: "export-row-query", title: sentence, children: sentence })
    ] }),
    /* @__PURE__ */ u("div", { class: "export-row-status", children: /* @__PURE__ */ u(
      StatusCell,
      {
        rec,
        job,
        busyLabel,
        onSyncNow: () => onSyncNow(rec.slug),
        onRetry: () => onSyncNow(rec.slug),
        onCancel: () => onCancel(rec.slug)
      }
    ) }),
    /* @__PURE__ */ u("div", { class: "export-row-actions", children: removing ? /* @__PURE__ */ u("div", { class: "export-remove-confirm", children: [
      /* @__PURE__ */ u("span", { class: "export-remove-note", children: [
        "Remove this export? ",
        /* @__PURE__ */ u("strong", { children: "Detach" }),
        " keeps the folder's files on disk;",
        /* @__PURE__ */ u("strong", { children: " Delete files" }),
        " also unlinks them. Either way your downloaded originals are untouched."
      ] }),
      /* @__PURE__ */ u("button", { type: "button", class: "text-btn", disabled: removalPending, onClick: () => onConfirmRemove(rec.slug, { deleteFiles: false }), children: "Detach" }),
      /* @__PURE__ */ u("button", { type: "button", class: "text-btn danger", disabled: removalPending, onClick: () => onConfirmRemove(rec.slug, { deleteFiles: true }), children: "Delete files" }),
      /* @__PURE__ */ u("button", { type: "button", class: "text-btn", disabled: removalPending, onClick: onCancelRemove, children: "Cancel" })
    ] }) : /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u(OpenFolderButton, { path: exportOpenPath(rec) }),
      /* @__PURE__ */ u("button", { type: "button", class: "quiet-btn", onClick: () => onEdit(rec), children: "Edit" }),
      /* @__PURE__ */ u("button", { type: "button", class: "quiet-btn danger", onClick: () => onAskRemove(rec.slug), children: "Remove" }),
      removalError && /* @__PURE__ */ u("span", { class: "export-remove-error", children: removalError })
    ] }) })
  ] });
}
function ExportForm({ initial, confirmPlan, scopeNames, scopeTree, ensureScopeNames, onSave, onConfirm, onBack, onCancel, saving, error }) {
  const isEdit = !!initial;
  const [name, setName] = d(initial?.name || "");
  const [destPath, setDestPath] = d(initial?.path || "");
  const [linkMode, setLinkMode] = d(initial?.linkMode || "auto");
  const [includeInputMedia, setIncludeInputMedia] = d(initial?.includeInputMedia === true);
  const [query, setQuery] = d(() => queryToState(initial?.query));
  const [q2, setQ] = d(initial?.query?.q || "");
  const [touched, setTouched] = d(false);
  const nameId = g();
  const destId = g();
  const locked = !!confirmPlan;
  const updateQuery = q((partial) => setQuery((prev) => ({ ...prev, ...partial })), []);
  y(() => {
    if (scopeNeedsNames(stateToQuery(query, q2).models)) ensureScopeNames();
  }, [query, q2, ensureScopeNames]);
  function submit(e) {
    if (e) e.preventDefault();
    if (locked) {
      onConfirm();
      return;
    }
    if (!name.trim()) {
      setTouched(true);
      return;
    }
    const body = { name: name.trim(), query: stateToQuery(query, q2), linkMode, includeInputMedia };
    const p = destPath.trim();
    if (p) body.path = p;
    onSave(body);
  }
  return /* @__PURE__ */ u("form", { class: "export-form property-group", onSubmit: submit, children: [
    /* @__PURE__ */ u("h2", { class: "property-heading", children: isEdit ? `Edit ${initial.name}` : "New export" }),
    /* @__PURE__ */ u("div", { class: "property", children: [
      /* @__PURE__ */ u("label", { class: "property-name", for: nameId, children: "Name" }),
      /* @__PURE__ */ u(
        "input",
        {
          id: nameId,
          class: "export-input",
          type: "text",
          value: name,
          placeholder: "Wallpapers",
          disabled: locked,
          onInput: (e) => setName(e.target.value)
        }
      ),
      touched && !name.trim() && /* @__PURE__ */ u("div", { class: "export-field-note", children: "A name is required." })
    ] }),
    /* @__PURE__ */ u("div", { class: "property", children: [
      /* @__PURE__ */ u("label", { class: "property-name", for: destId, children: "Destination" }),
      /* @__PURE__ */ u(
        "input",
        {
          id: destId,
          class: "export-input mono",
          type: "text",
          value: destPath,
          placeholder: "media/exports/<slug> (or an absolute path)",
          disabled: locked,
          onInput: (e) => setDestPath(e.target.value)
        }
      )
    ] }),
    /* @__PURE__ */ u("fieldset", { class: "property", children: [
      /* @__PURE__ */ u("legend", { class: "property-name", children: "Link mode" }),
      /* @__PURE__ */ u("div", { class: "mode-selector", children: ["auto", "hardlink", "copy"].map((m) => /* @__PURE__ */ u(
        "label",
        {
          class: "mode-btn",
          title: m === "auto" ? "Probe the destination: hard link where possible, copy otherwise" : m === "hardlink" ? "Force hard links (no duplicated bytes)" : "Force copies (duplicates bytes; needed for exFAT / cloud-sync folders)",
          children: [
            /* @__PURE__ */ u(
              "input",
              {
                type: "radio",
                name: "link-mode",
                value: m,
                checked: linkMode === m,
                disabled: locked,
                onChange: () => setLinkMode(m)
              }
            ),
            linkModeLabel(m)
          ]
        },
        m
      )) })
    ] }),
    /* @__PURE__ */ u("div", { class: "property", children: [
      /* @__PURE__ */ u("label", { class: "switch", children: [
        /* @__PURE__ */ u(
          "input",
          {
            type: "checkbox",
            role: "switch",
            checked: includeInputMedia,
            disabled: locked,
            onChange: (e) => setIncludeInputMedia(e.target.checked)
          }
        ),
        /* @__PURE__ */ u("span", { class: "switch-track", "aria-hidden": "true" }),
        "Include input media"
      ] }),
      /* @__PURE__ */ u("div", { class: "export-field-help", children: "Also include files used as inputs of the matched items. Upload-only frames land under inputs/; a generated frame keeps its generations/ or posts/ path." })
    ] }),
    /* @__PURE__ */ u("div", { class: "property", children: [
      /* @__PURE__ */ u("div", { class: "property-name", children: "Filter" }),
      /* @__PURE__ */ u(
        FacetBar,
        {
          facets: EXPORT_FACETS,
          state: query,
          update: updateQuery,
          search: q2,
          onSearchInput: (v) => setQ(v),
          facetParams: EMPTY_EXPORT_FACET_PARAMS
        }
      ),
      /* @__PURE__ */ u("div", { class: "export-query-summary", children: describeQuery(stateToQuery(query, q2), scopeNames, scopeTree) })
    ] }),
    error && /* @__PURE__ */ u("div", { class: "property-error", children: error }),
    locked && /* @__PURE__ */ u("div", { class: "export-plan-preview", children: planPreviewText(confirmPlan, confirmPlan.dest) }),
    /* @__PURE__ */ u("div", { class: "property-actions", children: locked ? /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u("button", { type: "submit", class: "action-btn", disabled: saving, children: saving ? "Syncing\u2026" : "Confirm & sync" }),
      /* @__PURE__ */ u("button", { type: "button", class: "action-btn secondary-btn", onClick: onBack, disabled: saving, children: "Back" })
    ] }) : /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u("button", { type: "submit", class: "action-btn", disabled: saving, children: saving ? "Saving\u2026" : isEdit ? "Save" : "Create" }),
      /* @__PURE__ */ u("button", { type: "button", class: "action-btn secondary-btn", onClick: onCancel, disabled: saving, children: "Cancel" })
    ] }) })
  ] });
}
function ExportsView() {
  useDocumentTitle({ place: "exports" });
  const [exports, setExports] = d([]);
  const [loading, setLoading] = d(true);
  const [loadError, setLoadError] = d(null);
  const [jobs, setJobs] = d({});
  const [form, setForm] = d(null);
  const [saving, setSaving] = d(false);
  const [saveError, setSaveError] = d(null);
  const [pendingPlan, setPendingPlan] = d(null);
  const [removing, setRemoving] = d(null);
  const [removalPending, setRemovalPending] = d(null);
  const [removalBusy, setRemovalBusy] = d(null);
  const [removalErrors, setRemovalErrors] = d({});
  const [scopeNames, setScopeNames] = d(null);
  const [scopeTree, setScopeTree] = d(null);
  const jobMeta = A({});
  const namesState = A("idle");
  const viewAlive = A(true);
  const removalTimer = A(null);
  const removalCheck = A(null);
  const queueRunning = A(false);
  const [queueBusy, setQueueBusy] = d(false);
  const ensureScopeNames = q(() => {
    if (namesState.current !== "idle") return;
    namesState.current = "loading";
    getModelHierarchy({}).then((tree) => {
      if (!viewAlive.current) return;
      setScopeTree(tree);
      setScopeNames(scopeNamesFromTree(tree));
    }).catch(() => {
      if (viewAlive.current) setScopeNames(null);
    }).finally(() => {
      if (viewAlive.current) namesState.current = "done";
    });
  }, []);
  y(() => {
    if (exports.some((rec) => scopeNeedsNames(rec.query?.models || rec.query?.scope))) ensureScopeNames();
  }, [exports, ensureScopeNames]);
  const reload = q(async () => {
    try {
      const { exports: list = [] } = await listExports();
      setExports(list);
      setLoadError(null);
    } catch (e) {
      setLoadError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);
  y(() => {
    reload();
  }, [reload]);
  y(() => {
    const onChange = () => {
      reload();
    };
    window.addEventListener("exportschange", onChange);
    return () => window.removeEventListener("exportschange", onChange);
  }, [reload]);
  y(() => () => {
    viewAlive.current = false;
    clearTimeout(removalTimer.current);
    for (const meta of Object.values(jobMeta.current)) {
      if (meta?.resolveDone) meta.resolveDone({ status: "unmount", final: true });
      if (meta?.disconnect) meta.disconnect();
    }
    jobMeta.current = {};
  }, []);
  const startSync = q(async (slug) => {
    const resp = await syncExport(slug).catch(() => null);
    if (resp && resp.jobId) {
      let resolveDone;
      const done = new Promise((resolve) => {
        resolveDone = resolve;
      });
      setJobs((prev) => ({
        ...prev,
        [slug]: { filesDone: 0, filesTotal: (resp.add || 0) + (resp.remove || 0), status: "running", mode: resp.linkMode }
      }));
      const disconnect = connectExportSync(slug, resp.jobId, (ev) => {
        setJobs((prev) => ({
          ...prev,
          [slug]: { filesDone: ev.filesDone, filesTotal: ev.filesTotal, status: ev.status, mode: ev.mode }
        }));
        if (ev.final) {
          const meta = jobMeta.current[slug];
          if (meta?.disconnect) meta.disconnect();
          if (meta?.resolveDone) meta.resolveDone(ev);
          delete jobMeta.current[slug];
          setJobs((prev) => {
            const n = { ...prev };
            delete n[slug];
            return n;
          });
          reload();
          notifyChange();
        }
      });
      jobMeta.current[slug] = { jobId: resp.jobId, disconnect, resolveDone };
      notifyChange();
      return { ...resp, done };
    }
    await reload();
    notifyChange();
    return resp;
  }, [reload]);
  const syncAll = q(async () => {
    if (queueRunning.current) return;
    const slugs = syncAllSlugs(exports, jobs);
    if (!slugs.length) return;
    queueRunning.current = true;
    setQueueBusy(true);
    try {
      for (const slug of slugs) {
        if (!viewAlive.current) return;
        const resp = await startSync(slug);
        if (!viewAlive.current) return;
        if (!resp?.jobId) continue;
        const terminal = await resp.done;
        if (!viewAlive.current) return;
        if (terminal?.status === "cancelled" || terminal?.status === "unmount") return;
      }
    } finally {
      queueRunning.current = false;
      if (viewAlive.current) setQueueBusy(false);
    }
  }, [exports, jobs, startSync]);
  const cancelSync = q(async (slug) => {
    const meta = jobMeta.current[slug];
    if (meta?.jobId) await cancelExportSync(slug, meta.jobId).catch(() => {
    });
  }, []);
  const finishForm = q(() => {
    setForm(null);
    setPendingPlan(null);
    setSaveError(null);
  }, []);
  const writeExport = q(async (body, { isEdit, slug } = {}) => {
    const rec = isEdit ? await updateExport(slug, body).catch(() => null) : await createExport(body).catch(() => null);
    if (!rec || rec.error || !rec.slug) {
      setSaveError(rec?.error ? removalFailureCopy(rec.error, { pathEdit: true }) : "Could not save the export.");
      return null;
    }
    return rec;
  }, []);
  const handleSave = q(async (body) => {
    setSaving(true);
    setSaveError(null);
    const isEdit = !!form?.initial;
    const slug = form?.initial?.slug;
    const plan = await planExportDraft({ ...body, slug }).catch(() => null);
    if (!plan || plan.error || plan.pending) {
      setSaveError(plan?.pending ? "The destination folder can't be read, so the export was not changed." : "Could not save the export.");
      setSaving(false);
      return;
    }
    if (plan.mode === "confirm") {
      setPendingPlan({
        isEdit,
        slug,
        body,
        plan,
        dest: plan.path || `media/exports/${plan.slug || slug || ""}`
      });
      setSaving(false);
      return;
    }
    const rec = await writeExport(body, { isEdit, slug });
    setSaving(false);
    if (!rec) return;
    finishForm();
    notifyChange();
    await reload();
    await startSync(rec.slug);
  }, [form, reload, startSync, finishForm, writeExport]);
  const handleConfirmSync = q(async () => {
    if (!pendingPlan?.body) return;
    setSaving(true);
    setSaveError(null);
    const rec = await writeExport(pendingPlan.body, pendingPlan);
    setSaving(false);
    if (!rec) return;
    finishForm();
    notifyChange();
    await reload();
    await startSync(rec.slug);
  }, [pendingPlan, reload, startSync, finishForm, writeExport]);
  const handleBackToEdit = q(() => setPendingPlan(null), []);
  const handleRemove = q(async (slug, { deleteFiles = false } = {}) => {
    setRemovalErrors((prev) => {
      if (!prev[slug]) return prev;
      const next = { ...prev };
      delete next[slug];
      return next;
    });
    setRemovalPending(slug);
    setRemovalBusy(null);
    clearTimeout(removalTimer.current);
    removalTimer.current = setTimeout(() => {
      if (!viewAlive.current) return;
      setRemovalBusy({ slug, deleteFiles });
    }, REMOVAL_BUSY_MS);
    let body = null;
    try {
      body = await deleteExport(slug, { deleteFiles });
    } catch {
      body = null;
    }
    clearTimeout(removalTimer.current);
    if (!viewAlive.current) return;
    setRemovalPending(null);
    setRemovalBusy(null);
    setRemoving(null);
    if (body?.ok || body?.error === "not-found") {
      await reload();
      notifyChange();
      return;
    }
    setRemovalErrors((prev) => ({ ...prev, [slug]: removalFailureCopy(body?.error) }));
    await reload();
    notifyChange();
  }, [reload]);
  return /* @__PURE__ */ u("main", { class: "main-content exports-view", children: [
    /* @__PURE__ */ u("div", { class: "exports-header", children: [
      /* @__PURE__ */ u("h1", { class: "exports-title", children: "Exports" }),
      /* @__PURE__ */ u("div", { class: "exports-header-actions", children: [
        syncAllSlugs(exports, jobs).length > 0 && /* @__PURE__ */ u("button", { type: "button", class: "action-btn", disabled: queueBusy, onClick: syncAll, children: "Sync" }),
        !form && /* @__PURE__ */ u("button", { type: "button", class: "action-btn", onClick: () => {
          setSaveError(null);
          setPendingPlan(null);
          setForm({ initial: null });
        }, children: "New export" })
      ] })
    ] }),
    /* @__PURE__ */ u("p", { class: "exports-intro", children: "An export is a filter that saves a copy of matching downloads into a folder on the computer. Exported files are hard-linked to your original downloads, so they don't consume extra disk space." }),
    form && /* @__PURE__ */ u(
      ExportForm,
      {
        initial: form.initial,
        confirmPlan: pendingPlan ? { ...pendingPlan.plan, dest: pendingPlan.dest } : null,
        scopeNames,
        scopeTree,
        ensureScopeNames,
        onSave: handleSave,
        onConfirm: handleConfirmSync,
        onBack: handleBackToEdit,
        onCancel: finishForm,
        saving,
        error: saveError
      },
      form.initial?.slug || "new"
    ),
    loadError && /* @__PURE__ */ u("div", { class: "property-error", children: loadError }),
    loading ? /* @__PURE__ */ u("div", { class: "property-loading", children: /* @__PURE__ */ u("div", { class: "spinner" }) }) : exports.length === 0 && !form ? /* @__PURE__ */ u("div", { class: "exports-empty", children: "No exports yet. Create one to mirror a slice of your library in a folder." }) : /* @__PURE__ */ u("div", { class: "exports-list", children: exports.map((rec) => /* @__PURE__ */ u(
      ExportRow,
      {
        rec,
        job: jobs[rec.slug],
        removing: removing === rec.slug,
        removalPending: removalPending === rec.slug,
        busyLabel: removalBusy?.slug === rec.slug ? removalBusyLabel({ deleteFiles: removalBusy.deleteFiles, elapsedMs: REMOVAL_BUSY_MS }) : null,
        removalError: removalErrors[rec.slug],
        scopeNames,
        scopeTree,
        onEdit: (r) => {
          setSaveError(null);
          setPendingPlan(null);
          setForm({ initial: r });
          setRemoving(null);
        },
        onAskRemove: async (slug) => {
          if (removalCheck.current) return;
          removalCheck.current = slug;
          setRemovalErrors((prev) => {
            if (!prev[slug]) return prev;
            const next = { ...prev };
            delete next[slug];
            return next;
          });
          let files = null;
          try {
            const body = await removalFileCount(slug);
            if (body && Number.isFinite(body.files)) files = body.files;
          } catch {
          }
          removalCheck.current = null;
          if (!viewAlive.current) return;
          if (files === 0) {
            handleRemove(slug, { deleteFiles: false });
            return;
          }
          setRemoving(slug);
        },
        onConfirmRemove: handleRemove,
        onCancelRemove: () => setRemoving(null),
        onSyncNow: startSync,
        onCancel: cancelSync
      },
      rec.slug
    )) })
  ] });
}
export {
  ExportsView
};
