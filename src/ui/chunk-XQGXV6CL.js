// dev/ui/src/lib/modelTypeDisplay.js
var MODEL_TYPE_LABELS = {
  LORA: "LoRA",
  LoCon: "LyCORIS",
  DoRA: "DoRA",
  VAE: "VAE",
  TextualInversion: "Embedding",
  MotionModule: "Motion",
  ComfyWorkflows: "ComfyUI Workflows",
  CLIPVision: "CLIP Vision",
  VisionLanguage: "VLM"
};
var MODEL_TYPES = [
  "Checkpoint",
  "TextualInversion",
  "Hypernetwork",
  "AestheticGradient",
  "LORA",
  "LoCon",
  "DoRA",
  "Controlnet",
  "Upscaler",
  "MotionModule",
  "VAE",
  "TextEncoder",
  "UNet",
  "CLIPVision",
  "Poses",
  "Wildcards",
  "Workflows",
  "ComfyWorkflows",
  "Detection",
  "VisionLanguage",
  "CLIP",
  "LLM",
  "Other"
];
var MODEL_TYPE_SET = new Set(MODEL_TYPES);
function modelTypeLabel(type) {
  if (type == null || type === "") return "";
  const key = String(type);
  return MODEL_TYPE_LABELS[key] || key;
}

export {
  modelTypeLabel
};
