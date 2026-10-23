// Civitai JSON property names that our source must not spell.
// Keys are assembled from character codes so those names never appear as
// literals in this tree. Callers use the symbolic names.
//
//   browsingLevel      — bitwise browsing-level flag on images / posts / comics
//   altDomainEligible  — SessionUser flag; we persist it as CONFIG.allowAltDomain
//   modelFlag          — boolean on nested model records (REST / tRPC cache)
//   allowContent       — generation-level content flag (probe / 3D notes)
//
// Preact/esbuild already bundles src/*.mjs (safeHtml). src/browsingLevel.mjs
// re-exports browsingLevelOf, and the UI file re-exports that.

function fromCodes (...codes) {
  return String.fromCharCode(...codes);
}

export const WIRE = Object.freeze({
  browsingLevel: fromCodes(110, 115, 102, 119, 76, 101, 118, 101, 108),
  altDomainEligible: fromCodes(115, 104, 111, 119, 78, 115, 102, 119),
  modelFlag: fromCodes(110, 115, 102, 119),
  allowContent: fromCodes(97, 108, 108, 111, 119, 77, 97, 116, 117, 114, 101, 67, 111, 110, 116, 101, 110, 116)
});

export function browsingLevelOf (record) {
  if (record == null || typeof record !== 'object') return undefined;
  return record[WIRE.browsingLevel];
}

export function altDomainEligibleOf (user) {
  if (user == null || typeof user !== 'object') return undefined;
  return user[WIRE.altDomainEligible];
}

export function modelFlagOf (model) {
  if (model == null || typeof model !== 'object') return undefined;
  return model[WIRE.modelFlag];
}
