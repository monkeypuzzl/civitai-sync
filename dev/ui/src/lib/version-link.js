// The caller passes the version on screen and the version the link names.
// This module does not read the route.
export function versionClickHistory (shownId, targetId) {
  return String(shownId) === String(targetId) ? 'replace' : 'push';
}
