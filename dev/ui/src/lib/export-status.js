// Export badge and row status. Unchecked means this process has not stored
// a status yet. That is not a dot and not "in sync."

export function exportsBadgeKind (exports) {
  const rows = Array.isArray(exports) ? exports : [];
  if (rows.some(row => row?.status?.state === 'syncing')) return 'syncing';
  if (rows.some(row => row?.status?.checked && (row.status.state === 'pending' || row.status.state === 'error'))) {
    return 'dot';
  }
  return 'none';
}

export function exportRowKind (status, job) {
  if (job) return 'syncing';
  if (!status?.checked) return 'blank';
  if (status.state === 'pending') return 'pending';
  if (status.state === 'error') return 'error';
  return 'idle';
}

// Filesystem failure copy. Drift counts do not replace this. The code is the
// stored reason code (an errno, or insufficient-space), not the Node message.
const FAILURE_SENTENCE = {
  library: "Pending: the downloads folder can't be read.",
  'destination-missing': "Pending: the destination folder can't be created.",
  'destination-denied': "Pending: the destination folder can't be written.",
  hardlink: "Pending: this folder can't use hard links.",
  'destination-space': 'Pending: not enough free space.',
  'destination-io': "Pending: the destination disk couldn't be read."
};

export function exportPendingCopy (status) {
  const code = status?.reason?.code;
  const fault = status?.reason?.fault;
  if (code && code !== 'drift' && code !== 'cancelled') {
    let sentence = FAILURE_SENTENCE[fault];
    if (code === 'ENOSPC' || code === 'insufficient-space') sentence = FAILURE_SENTENCE['destination-space'];
    else if (!sentence && code === 'EIO') sentence = FAILURE_SENTENCE['destination-io'];
    else if (!sentence && code === 'ENOENT') sentence = FAILURE_SENTENCE['destination-missing'];
    else if (!sentence && (code === 'EACCES' || code === 'EPERM')) sentence = FAILURE_SENTENCE['destination-denied'];
    else if (!sentence) sentence = "Pending: the export couldn't be updated.";
    return { kind: 'failure', sentence, code };
  }
  const drift = status?.drift;
  if (drift && (drift.add || drift.remove)) {
    return { kind: 'drift', text: `Pending: +${drift.add || 0} / \u2212${drift.remove || 0}` };
  }
  if (code === 'cancelled') return { kind: 'cancelled', text: 'Pending: sync cancelled' };
  return { kind: 'plain', text: 'Pending' };
}

// Show a removal label only once the request has already taken this long.
// A faster Detach or Delete files does not flash the status cell.
export const REMOVAL_BUSY_MS = 1000;

export function removalBusyLabel ({ deleteFiles, elapsedMs, busyMs = REMOVAL_BUSY_MS } = {}) {
  if (!(elapsedMs >= busyMs)) return null;
  return deleteFiles ? 'Deleting\u2026' : 'Removing\u2026';
}

export function removalFailureCopy (error, { pathEdit = false } = {}) {
  if (pathEdit && error === 'incomplete') {
    return "The old folder couldn't be removed, so the destination was not changed.";
  }
  if (error === 'incomplete') return 'Some files are still in the folder.';
  if (error === 'unsafe-root') return "This folder can't be removed from here.";
  if (error === 'shared-destination') return 'Another export uses this folder.';
  if (pathEdit) return 'Could not save the export.';
  return "The export wasn't removed.";
}
