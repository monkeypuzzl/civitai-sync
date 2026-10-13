// Stable identity in model-tree path tokens.
//
// Models URLs use `<id>-<slug>` path tokens (explorer-url-protocol.md
// § "Stable identity in path tokens"). The numeric prefix is the resolution
// key; the slug is purely cosmetic, regenerated at render time from the most
// recent cached `Model.name` / `ModelVersion.name`. A renamed model keeps its
// URL and collapses to ONE node — the slug changes, the id does not.
//
// Pure functions, no Preact / DOM dependency, so the contract is unit-testable
// from tests/ without a browser harness.

// Kebab-case a display name: lowercase, non-alphanumeric runs → a single
// hyphen, leading/trailing hyphens trimmed. Empty / falsy input → ''.
export function slugForName (name) {
  if (name == null) return '';
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Build the `<id>-<slug>` path token. When the name yields no slug (empty /
// all-punctuation), the token is the bare id so it still resolves.
export function pathToken (id, name) {
  const slug = slugForName(name);
  return slug ? `${id}-${slug}` : String(id);
}

// Resolve a `<id>-<slug>` path token back to its numeric id STRING. Resolution
// is by the leading numeric prefix ONLY — the slug is ignored, so a stale
// bookmarked slug still resolves the current node. Returns null when the token
// has no numeric prefix.
export function idFromToken (token) {
  const m = String(token ?? '').match(/^(\d+)/);
  return m ? m[1] : null;
}
