// One replay of the open page per burst of settle frames.
// A progress tick is not a settle. Two settle frames with nothing between
// them are one bump. The timer that merges a burst is not part of the test.

import { useEffect, useState } from 'preact/hooks';

const DOWNLOAD_TYPES = new Set(['generations', 'posts', 'comics', 'model3ds']);

export function isSettleFrame (event) {
  if (!event || typeof event !== 'object') return false;
  if (event.final === true && DOWNLOAD_TYPES.has(event.type)) return true;
  if (event.type === 'model-cache' && event.final === true) return true;
  if (event.type === 'tag-cache' && event.final === true) return true;
  if (event.type === 'own-models' && event.status === 'ready') return true;
  return false;
}

export function foldSettleFrames (events) {
  const list = Array.isArray(events) ? events : [];
  let bumps = 0;
  let open = false;
  for (const event of list) {
    if (isSettleFrame(event)) {
      if (!open) {
        bumps += 1;
        open = true;
      }
    } else {
      open = false;
    }
  }
  return bumps;
}

let epoch = 0;
const listeners = new Set();
let timer = null;
let pending = false;

function flush () {
  timer = null;
  if (!pending) return;
  pending = false;
  epoch += 1;
  for (const fn of listeners) fn(epoch);
}

export function noteSettleFrame (event) {
  if (!isSettleFrame(event)) return;
  pending = true;
  if (timer != null) return;
  timer = setTimeout(flush, 50);
}

export function subscribeIndexEpoch (fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useIndexEpoch () {
  const [value, setValue] = useState(epoch);
  useEffect(() => subscribeIndexEpoch(setValue), []);
  return value;
}
