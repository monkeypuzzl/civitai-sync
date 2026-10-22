// Explorer page requests vs after-listen preparation.
//
// Hash, header-probe, and ACE walks call waitForExplorerIdle between files.
// handleRequest holds the in-flight count only until the handler returns.
// The progress socket returns after writeHead, and a media byte stream
// returns when the file is piped. Neither pins preparation for the life of
// the socket. Closing the response destroys the file stream. CLI migrate
// runs before armExplorerIdle and does not yield per file. Settings rebuild
// uses allowBackgroundDuringRequest so its own walk is not parked on the
// request that awaits it; a second request still parks it.
//
// Export reconcile must not call this module. A gate check inside it would
// deadlock if a status GET still awaited that walk.

let armed = false;
let inflight = 0;
let allowance = 0;
let measurementSuspended = false;
const waiters = [];

let scheduled = false;
let job = null;

// A page request parks preparation. A download suspends it even with no
// request open. Settings rebuild raises the allowance so its own walk is
// not parked on the suspend flag (that request is awaiting the walk).
function preparationBlocked () {
  if (!armed) return false;
  if (inflight > allowance) return true;
  return measurementSuspended && allowance === 0;
}

function flushWaiters () {
  if (preparationBlocked() || waiters.length === 0) return;
  const ready = waiters.splice(0, waiters.length);
  for (const resume of ready) resume();
}

function wake () {
  if (preparationBlocked() || waiters.length === 0) return;
  setImmediate(flushWaiters);
}

export function armExplorerIdle () {
  armed = true;
}

export function beginExplorerRequest () {
  inflight++;
}

export function endExplorerRequest () {
  if (inflight > 0) inflight--;
  wake();
}

export function explorerIdleWaiterCount () {
  return waiters.length;
}

export function setMeasurementWalksSuspended (on) {
  measurementSuspended = !!on;
  if (!measurementSuspended) wake();
}

export function waitForExplorerIdle () {
  if (!armed) return Promise.resolve();
  if (preparationBlocked()) {
    return new Promise((resolve) => { waiters.push(resolve); });
  }
  return new Promise((resolve) => { setImmediate(resolve); });
}

// A light stat. Park only when a page request or a download already holds
// the thread. An idle skip must not wait a turn per file.
export function parkIfExplorerBusy () {
  if (!armed || !preparationBlocked()) return null;
  return new Promise((resolve) => { waiters.push(resolve); });
}

export async function allowBackgroundDuringRequest (fn) {
  allowance++;
  wake();
  try {
    return await fn();
  } finally {
    allowance--;
    wake();
  }
}

// One coalesced turn. A walk that finishes while the job is running calls
// again and gets a later turn (scheduled is already false inside the job).
export function scheduleWhenExplorerIdle (fn) {
  job = fn;
  if (scheduled) return;
  scheduled = true;
  const run = () => {
    if (preparationBlocked()) {
      waiters.push(run);
      return;
    }
    scheduled = false;
    const go = job;
    if (go) go();
  };
  setImmediate(run);
}

export function __resetExplorerIdleForTest () {
  armed = false;
  inflight = 0;
  allowance = 0;
  measurementSuspended = false;
  waiters.length = 0;
  scheduled = false;
  job = null;
}
