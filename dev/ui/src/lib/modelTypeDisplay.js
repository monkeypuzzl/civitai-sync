// Civitai user-facing labels for Prisma ModelType enum values.
// Keep in lockstep with src/modelTypeDisplay.mjs.

export const MODEL_TYPE_LABELS = {
  LORA: 'LoRA',
  LoCon: 'LyCORIS',
  DoRA: 'DoRA',
  VAE: 'VAE',
  TextualInversion: 'Embedding',
  MotionModule: 'Motion',
  ComfyWorkflows: 'ComfyUI Workflows',
  CLIPVision: 'CLIP Vision',
  VisionLanguage: 'VLM'
};

// Prisma ModelType values used as the first segment of the pre-_v=3
// Models path (`/models/Checkpoint/…`). Numeric-prefix tokens are the
// post-_v=3 model page.
export const MODEL_TYPES = [
  'Checkpoint',
  'TextualInversion',
  'Hypernetwork',
  'AestheticGradient',
  'LORA',
  'LoCon',
  'DoRA',
  'Controlnet',
  'Upscaler',
  'MotionModule',
  'VAE',
  'TextEncoder',
  'UNet',
  'CLIPVision',
  'Poses',
  'Wildcards',
  'Workflows',
  'ComfyWorkflows',
  'Detection',
  'VisionLanguage',
  'CLIP',
  'LLM',
  'Other'
];

const MODEL_TYPE_SET = new Set(MODEL_TYPES);

export function isModelTypeToken (token) {
  return MODEL_TYPE_SET.has(String(token ?? ''));
}

export function modelTypeLabel (type) {
  if (type == null || type === '') return '';
  const key = String(type);
  return MODEL_TYPE_LABELS[key] || key;
}
