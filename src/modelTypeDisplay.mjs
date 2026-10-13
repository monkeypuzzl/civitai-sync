// Civitai user-facing labels for Prisma ModelType enum values.
// Ports src/utils/string-helpers.ts nameOverrides (civitai-src) for the
// types the Explorer shows. URL tokens stay the enum (`LORA`, `LoCon`).
// Keep in lockstep with dev/ui/src/lib/modelTypeDisplay.js.

const MODEL_TYPE_LABELS = Object.freeze({
  LORA: 'LoRA',
  LoCon: 'LyCORIS',
  DoRA: 'DoRA',
  VAE: 'VAE',
  TextualInversion: 'Embedding',
  MotionModule: 'Motion',
  ComfyWorkflows: 'ComfyUI Workflows',
  CLIPVision: 'CLIP Vision',
  VisionLanguage: 'VLM'
});

export function modelTypeLabel (type) {
  if (type == null || type === '') return '';
  const key = String(type);
  return MODEL_TYPE_LABELS[key] || key;
}
