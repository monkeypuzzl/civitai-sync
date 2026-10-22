// Library preparation. One in-memory phase for the walks that start after
// listen. A job stays on until every arm has a matching settle, so a second
// own-models walk does not clear the first. The listener runs on a microtask
// when the boolean or the named group changes, so a settle and an arm in the
// same turn do not emit false.

const FILE_JOBS = new Set(['content-hash', 'file-dims', 'ace', 'model3d-repair']);

const counts = new Map();
const listeners = new Set();
let lastActive = false;
let lastPhase = null;
let deliverScheduled = false;

function isActive () {
  for (const n of counts.values()) {
    if (n > 0) return true;
  }
  return false;
}

function jobOn (name) {
  return (counts.get(name) || 0) > 0;
}

function currentPhase () {
  if (!isActive()) return null;
  for (const name of counts.keys()) {
    if ((counts.get(name) || 0) > 0 && FILE_JOBS.has(name)) return 'files';
  }
  if (jobOn('exports')) return 'exports';
  if (jobOn('own-models')) return 'models';
  if (jobOn('measurement')) return 'index';
  return 'files';
}

function deliver () {
  deliverScheduled = false;
  const active = isActive();
  const phase = active ? currentPhase() : null;
  if (active === lastActive && phase === lastPhase) return;
  lastActive = active;
  lastPhase = phase;
  const payload = { active, phase };
  for (const fn of [...listeners]) {
    try { fn(payload); } catch { /* one listener must not drop the others */ }
  }
}

function scheduleDeliver () {
  if (deliverScheduled) return;
  deliverScheduled = true;
  queueMicrotask(deliver);
}

export function armLibraryPreparation (job) {
  if (!job) return;
  counts.set(job, (counts.get(job) || 0) + 1);
  scheduleDeliver();
}

export function settleLibraryPreparation (job) {
  const n = counts.get(job) || 0;
  if (n <= 1) counts.delete(job);
  else counts.set(job, n - 1);
  scheduleDeliver();
}

export function libraryPreparationActive () {
  return isActive();
}

export function libraryPreparationPhase () {
  return isActive() ? currentPhase() : null;
}

export function onLibraryPreparationChange (fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function __resetLibraryPreparationForTest () {
  counts.clear();
  lastActive = false;
  lastPhase = null;
  deliverScheduled = false;
}
