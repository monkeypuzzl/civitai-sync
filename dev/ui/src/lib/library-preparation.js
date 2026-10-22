// Library preparation line. One sentence for the startup phase. The dwell
// starts when this client first learns the phase is active. A later group
// name does not restart it. A Download spinner hides the sentence and does
// not move that clock.

import { getDownloadMark } from './download-mark.js';

export const LIBRARY_PREP_DWELL_MS = 1000;
export const LIBRARY_PREP_TEXT = 'Preparing the library…';

const PHASE_SUFFIX = Object.freeze({
  files: 'checking files',
  exports: 'checking exports',
  models: 'checking models',
  index: 'updating index'
});

const IDLE = Object.freeze({ active: false, since: null, phase: null });

export function libraryPreparationSentence (phase) {
  const suffix = PHASE_SUFFIX[phase];
  return suffix ? `${LIBRARY_PREP_TEXT} ${suffix}` : LIBRARY_PREP_TEXT;
}

export function nextLibraryPreparation (state, { preparation, phase, downloadKind, now } = {}) {
  const prev = state && state.active ? state : IDLE;
  let active = prev.active;
  let since = prev.since;
  let nextPhase = prev.phase ?? null;

  if (preparation === true) {
    active = true;
    if (since == null) since = now;
    if (phase !== undefined) nextPhase = PHASE_SUFFIX[phase] ? phase : null;
  } else if (preparation === false) {
    active = false;
    since = null;
    nextPhase = null;
  }

  const elapsed = since == null ? 0 : now - since;
  const text = active && downloadKind !== 'spinner' && since != null && elapsed >= LIBRARY_PREP_DWELL_MS
    ? libraryPreparationSentence(nextPhase)
    : '';

  return {
    state: { active, since, phase: nextPhase },
    text
  };
}

let state = IDLE;
let text = '';
let timer = null;
const listeners = new Set();

function emit (nextText) {
  if (nextText === text) return;
  text = nextText;
  for (const fn of [...listeners]) fn(text);
}

function clearTimer () {
  if (timer == null) return;
  clearTimeout(timer);
  timer = null;
}

function armTimer (downloadKind) {
  clearTimer();
  if (!state.active || state.since == null || downloadKind === 'spinner') return;
  const wait = LIBRARY_PREP_DWELL_MS - (Date.now() - state.since);
  if (wait <= 0) return;
  timer = setTimeout(() => {
    timer = null;
    noteLibraryPreparation(
      { type: 'preparation', active: true },
      getDownloadMark().kind
    );
  }, wait);
}

export function noteLibraryPreparation (event, downloadKind, now = Date.now()) {
  let preparation;
  let phase;
  if (event && event.type === 'preparation' && typeof event.active === 'boolean') {
    preparation = event.active;
    if ('phase' in event) phase = event.phase;
  } else if (event && event.type === 'connected' && typeof event.preparation === 'boolean') {
    preparation = event.preparation;
    if ('phase' in event) phase = event.phase;
  }
  const next = nextLibraryPreparation(state, { preparation, phase, downloadKind, now });
  state = next.state;
  armTimer(downloadKind);
  emit(next.text);
}

export function getLibraryPreparationText () {
  return text;
}

export function subscribeLibraryPreparation (fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
