// AIR URN parser.
//
// AIR ("Artificial Intelligence Resource") is Civitai's URN-style scheme for
// identifying AI resources across platforms. The canonical spec is in
//   civitai-src/wiki/AIR-‐-Uniform-Resource-Names-for-AI.md
// and the upstream stringifier lives in
//   civitai-src/src/shared/utils/air.ts (which delegates to @civitai/client's
//   Air.parse / Air.stringify).
//
// Form:
//   urn:air:{ecosystem}:{type}:{source}:{id}@{version?}+{fileId?}.{format?}
//
// All segments after `{source}:{id}` are optional. The `urn:` and `air:`
// prefixes are also optional per the wiki spec. The `{ecosystem}` segment
// is the lowercase upstream ecosystem **root** key (e.g. `flux1`, `sdxl`,
// `sd1`) — Civitai's `stringifyAIR` walks `parentEcosystemId` to the root,
// so children (`pony`, `illustrious`, `noobai`) collapse to their parent
// (`sdxl`) before emission.
//
// The `+{fileId}` suffix is an upstream extension to the wiki-documented
// regex; it's emitted by `stringifyAIR` to disambiguate among the multiple
// `ModelFile` rows attached to a single `ModelVersion`. We accept it.
//
// This module is **pure**: regex + a tiny coercion layer. No I/O, no
// dependencies. The vendored display-name map (src/vendor/civitai-ecosystems
// .mjs, consumed via src/ecosystemDisplay.mjs) is used by callers to render
// the `ecosystem` segment as a user-facing label; this module returns the
// raw lowercase technical key.

// Regex: extension of the wiki-documented form to accept `+<fileId>`.
//   Captures:
//     1. ecosystem? (optional)  — lowercase technical key
//     2. type?      (optional)  — lowercase resource type ('checkpoint','lora',…)
//     3. source     (required)  — 'civitai' | 'huggingface' | 'openai' | 'orchestrator' | …
//     4. id         (required)  — string (numeric for civitai/civitai-r2; path-like for huggingface)
//     5. version?   (optional)  — string (numeric for civitai)
//     6. fileId?    (optional)  — upstream `+<fileId>` extension
//     7. format?    (optional)  — '.safetensor' | '.ckpt' | …
// Note: the upstream wiki regex uses `\-` and `\/` escapes inside character
// classes; both are unnecessary in JavaScript regex literals. Behaviour is
// identical with `-` placed at the end of each class (literal position) and
// `/` left unescaped.
const AIR_RE = /^(?:urn:)?(?:air:)?(?:([a-zA-Z0-9_/-]+):)?(?:([a-zA-Z0-9_/-]+):)?([a-zA-Z0-9_/-]+):([a-zA-Z0-9_/-]+)(?:@([a-zA-Z0-9_-]+))?(?:\+([a-zA-Z0-9_-]+))?(?:\.([a-zA-Z0-9_-]+))?$/;

/**
 * Parse an AIR URN string into its segments.
 *
 * Returns an object on success, or `null` for any input that doesn't match
 * the AIR regex (including null/undefined/non-string).
 *
 * Numeric coercion:
 *   - For `source === 'civitai'` (and `civitai-r2`), the `id` and `version`
 *     are numeric Civitai identifiers, so they are coerced to numbers.
 *     A coercion failure (NaN) leaves the field as the raw string.
 *   - For other sources (`huggingface`, `openai`, `orchestrator`, …) the
 *     `id` and `version` may be path- or string-shaped; left as strings.
 *   - `fileId`, when present, is always numeric on Civitai resources;
 *     coerced when possible.
 *
 * @param {string|null|undefined} input
 * @returns {{
 *   ecosystem: string|null,
 *   type: string|null,
 *   source: string,
 *   modelId: number|string,
 *   versionId: number|string|null,
 *   fileId: number|string|null,
 *   format: string|null,
 *   raw: string
 * } | null}
 */
export function parseAir (input) {
  if (typeof input !== 'string' || input.length === 0) return null;
  const m = input.match(AIR_RE);
  if (!m) return null;

  const [, ecosystem, type, source, id, version, fileId, format] = m;

  const isCivitaiSource = source === 'civitai' || source === 'civitai-r2';
  const numericModelId = isCivitaiSource ? coerceNumberOrKeep(id) : id;
  const numericVersionId = version === undefined
    ? null
    : (isCivitaiSource ? coerceNumberOrKeep(version) : version);
  const numericFileId = fileId === undefined ? null : coerceNumberOrKeep(fileId);

  return {
    ecosystem: ecosystem ?? null,
    type: type ?? null,
    source,
    modelId: numericModelId,
    versionId: numericVersionId,
    fileId: numericFileId,
    format: format ?? null,
    raw: input
  };
}

/**
 * Same as `parseAir` but throws on parse failure instead of returning null.
 * Useful in code paths where an AIR URN is a precondition.
 *
 * @param {string} input
 * @returns parsed AIR URN
 * @throws {TypeError} if the input does not match the AIR grammar
 */
export function parseAirOrThrow (input) {
  const parsed = parseAir(input);
  if (parsed === null) throw new TypeError(`Not a valid AIR URN: ${JSON.stringify(input)}`);
  return parsed;
}

/**
 * Cheap predicate; useful for filtering arrays of mixed strings before
 * calling parseAir on each.
 *
 * @param {string|null|undefined} input
 * @returns {boolean}
 */
export function isAir (input) {
  return typeof input === 'string' && AIR_RE.test(input);
}

function coerceNumberOrKeep (s) {
  const n = Number(s);
  return Number.isFinite(n) && String(n) === s ? n : s;
}
