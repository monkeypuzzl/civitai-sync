// Latest's fine check of containers already saved. Rolling 30 days from the
// moment of the comparison, not a calendar month. A future timestamp is not
// inside the window.

export const LATEST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function withinLatestWindow (iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  if (t > now) return false;
  return now - t <= LATEST_WINDOW_MS;
}
