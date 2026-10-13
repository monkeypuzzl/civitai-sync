// Lookup module for AIR URN ecosystem display names.
//
// Reads the vendored snapshot under `src/vendor/` and applies a
// title-case fallback for ecosystem keys not present in the map. This
// module is the single approved consumer of `src/vendor/civitai-ecosystems.mjs`
// — see `src/vendor/README.md` and
// `docs/guides/civitai-sync/internal/vendored-snapshots.md` for the
// isolation policy. The lint test in `tests/vendor-isolation.test.mjs`
// enforces it.
//
// Usage:
//   import { getEcosystemDisplayName } from './ecosystemDisplay.mjs';
//   getEcosystemDisplayName('flux1');     // → 'Flux.1'
//   getEcosystemDisplayName('kolors');    // → 'Kolors' (title-case fallback)
//   getEcosystemDisplayName('unknown');   // → 'Unknown' (title-case fallback)
//   getEcosystemDisplayName('');          // → ''
//   getEcosystemDisplayName(null);        // → ''
//
// AIR URN ecosystem keys are lowercase technical strings (e.g. `flux1`,
// `sdxl`, `wanvideo-25-i2v`). Civitai's own AIR stringifier collapses
// children to roots, so child keys (`pony`, `illustrious`, `noobai`) do
// not appear in saved data; the vendored map only carries root keys.
//
// The fallback is intentionally simple: capitalise the first letter of
// each whitespace-, hyphen-, or underscore-separated segment. It produces
// reasonable output for casual keys (`kolors` → `Kolors`) and ugly output
// for acronyms (`sdxl` → `Sdxl`); the latter is exactly the case the
// vendored map is for, and any ecosystem whose lowercase title-cased form
// does not match its upstream `displayName` has an explicit override
// shipped in the snapshot.

import { ECOSYSTEM_DISPLAY_NAMES } from './vendor/civitai-ecosystems.mjs';

/**
 * Title-case a lowercase ecosystem key for display fallback.
 * Capitalises the first character of each `[\s\-_]`-separated segment.
 *
 * @param {string} key
 * @returns {string}
 */
export function titleCase (key) {
  if (!key) return '';
  return String(key).replace(/(^|[\s\-_])(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());
}

/**
 * Resolve an AIR URN ecosystem key to a user-facing display name.
 *
 * Lookup order:
 *   1. Exact match in the vendored `ECOSYSTEM_DISPLAY_NAMES` map.
 *   2. Title-case fallback on the lowercase key.
 *   3. Empty string for falsy / non-string input.
 *
 * @param {string|null|undefined} key
 *   The lowercase ecosystem segment from an AIR URN (e.g. `'flux1'`,
 *   `'sdxl'`, `'wanvideo-25-i2v'`). Already lowercased by AIR URN's
 *   stringifier; passing a mixed-case value coerces to lowercase here.
 * @returns {string}
 *   The display name, or `''` if the input is falsy.
 */
export function getEcosystemDisplayName (key) {
  if (!key || typeof key !== 'string') return '';
  const lower = key.toLowerCase();
  return ECOSYSTEM_DISPLAY_NAMES[lower] ?? titleCase(lower);
}

function normalizeTaxon (s) {
  if (s == null || s === '') return '';
  return String(s).toLowerCase().replace(/[\s_\-.]/g, '');
}

/**
 * True when `baseModel` is the same taxon as an AIR ecosystem key — the
 * ecosystems-table key, or that key's display name, ignoring case / spaces /
 * `_` / `-` / `.`. `Pony` vs `sdxl` is false. `Flux.1 D` vs `flux1` is
 * false. Used so hydrate can prefer the Prisma token and the Models catalog
 * can omit Ecosystem chips that merely respell a Base model token.
 *
 * @param {string|null|undefined} baseModel
 * @param {string|null|undefined} ecosystemKey
 * @returns {boolean}
 */
export function isEcosystemKeyAlias (baseModel, ecosystemKey) {
  const nBase = normalizeTaxon(baseModel);
  const nEco = normalizeTaxon(ecosystemKey);
  if (!nBase || !nEco) return false;
  if (nBase === nEco) return true;
  const nDisplay = normalizeTaxon(getEcosystemDisplayName(ecosystemKey));
  return Boolean(nDisplay) && nBase === nDisplay;
}
