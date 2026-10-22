// A container this install took on and did not finish. Terminal 404 and 410
// are remembered on the fetch-miss store and do not keep the container open.
// The flag itself lives on the container JSON so a restart can see it.

export function byteMissKeepsOpen (result) {
  if (!result || typeof result !== 'object') return false;
  if (result.status === 'published' || result.status === 'skipped' || result.status === 'aborted') return false;
  if (result.remembered === true) return false;
  const http = Number(result.httpStatus) || 0;
  if (http === 404 || http === 410) return false;
  return result.status === 'failed' || result.status === 'unavailable';
}

// Sets the flag and awaits commit once. A container that is already open
// is left as it is. A failed commit stays in memory so the end of the walk
// can write it again.
export async function markContainerOpen (doc, commit) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return;
  if (doc.downloadOpen === true) return;
  doc.downloadOpen = true;
  try {
    await commit(doc);
  } catch {
    // The end-of-walk write tries again.
  }
}

// Dynamic import: serverIndex imports comics, and comics import posts.
// A static import from either of those modules would cycle.
export async function commitOpenContainer (doc, kind, write) {
  const wrote = await write(doc);
  if (wrote === '' || wrote === false) throw new Error('open write failed');
  const { upsertIndexEntries } = await import('./serverIndex.mjs');
  await upsertIndexEntries({ [kind]: [doc] });
}

export function withoutDownloadOpen (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (value.downloadOpen !== true) return value;
  const next = { ...value };
  delete next.downloadOpen;
  return next;
}
