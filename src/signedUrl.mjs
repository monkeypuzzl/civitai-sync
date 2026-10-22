// A re-signed orchestration blob URL is not a change to the saved record.
// Compare-only. A file that is written for a real change keeps the URL it was given.

function isExpiryKey (key) {
  return typeof key === 'string' && key.endsWith('ExpiresAt');
}

function unsignedBlobUrl (value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  const signed = url.pathname.includes('/blobs/') || url.searchParams.has('sig');
  if (!signed) return value;
  return url.origin + url.pathname;
}

function stripSigned (value) {
  if (typeof value === 'string') return unsignedBlobUrl(value);
  if (Array.isArray(value)) return value.map(stripSigned);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'downloadOpen' || isExpiryKey(key)) continue;
    out[key] = stripSigned(item);
  }
  return out;
}

export function comparableDownloadJson (value) {
  return JSON.stringify(stripSigned(value));
}

export function resourceIdentity (value) {
  if (typeof value !== 'string') return value;
  return unsignedBlobUrl(value);
}

export function sameResourceUrl (a, b) {
  if (a === b) return true;
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return unsignedBlobUrl(a) === unsignedBlobUrl(b);
}
