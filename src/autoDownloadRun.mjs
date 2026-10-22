// Wall-clock wait between auto downloads. The queue itself stays in the server.
// `schedule(fn, ms, { repeat })` and `clear(handle)` are injected so a test
// does not sleep. A firing callback that is still before dueAt re-arms the
// one-shot timer. The 15s repeat is only the wake-from-sleep backstop.

import { decideAuto, periodById } from './autoDownload.mjs';

const WATCH_MS = 15 * 1000;

function blankState (periodMs) {
  return {
    phase: 'idle',
    repeat: false,
    periodMs,
    anchorAt: null,
    dueAt: null,
    recoveryStep: 0
  };
}

export function createAutoRunner ({
  now = () => Date.now(),
  schedule,
  clear,
  startQueue,
  readSpec,
  onPhase
} = {}) {
  const initial = periodById('1h');
  let state = blankState(initial.ms);
  let every = initial.id;
  let on = false;
  let timeoutHandle = null;
  let intervalHandle = null;
  let starting = false;

  function snapshot () {
    return {
      phase: state.phase,
      dueAt: state.dueAt,
      on,
      every
    };
  }

  function emit () {
    if (typeof onPhase === 'function') onPhase(snapshot());
  }

  function clearTimers () {
    if (timeoutHandle != null) {
      clear(timeoutHandle);
      timeoutHandle = null;
    }
    if (intervalHandle != null) {
      clear(intervalHandle);
      intervalHandle = null;
    }
  }

  function armTimeout () {
    if (timeoutHandle != null) {
      clear(timeoutHandle);
      timeoutHandle = null;
    }
    if (state.phase !== 'waiting' || state.dueAt == null) return;
    const delay = Math.max(0, state.dueAt - now());
    timeoutHandle = schedule(() => { onFire(); }, delay);
  }

  function arm () {
    clearTimers();
    if (state.phase !== 'waiting' || state.dueAt == null) return;
    armTimeout();
    intervalHandle = schedule(() => { onFire(); }, WATCH_MS, { repeat: true });
  }

  function store (next) {
    const start = next.start === true;
    if (start) {
      const stored = { ...next };
      delete stored.start;
      state = stored;
    } else {
      state = next;
    }
    if (state.phase === 'waiting') arm();
    else clearTimers();
    return start;
  }

  function apply (event) {
    const next = decideAuto(state, event);
    if (next === state) return false;
    const start = store(next);
    emit();
    if (start) begin();
    return true;
  }

  function onFire () {
    if (state.phase !== 'waiting' || state.dueAt == null) return;
    if (now() < state.dueAt) {
      armTimeout();
      return;
    }
    apply({ type: 'tick', now: now() });
  }

  async function begin () {
    if (starting) return;
    if (typeof startQueue !== 'function' || typeof readSpec !== 'function') return;
    starting = true;
    try {
      const spec = await readSpec();
      if (!spec) {
        apply({ type: 'empty' });
        return;
      }
      const result = await startQueue(spec);
      if (result && result.code === 'busy') return;
      if (result && result.error) {
        const kind = result.fatal ? 'fatal' : 'transient';
        apply({ type: 'finish', kind, now: now() });
      }
    } catch (error) {
      const kind = error && (error.code === 'ENOSPC' || error.code === 'EDQUOT' || error.code === 'EROFS')
        ? 'fatal'
        : 'transient';
      apply({ type: 'finish', kind, now: now() });
    } finally {
      starting = false;
    }
  }

  return {
    snapshot,
    noteClick (autoOn) {
      apply({ type: 'click', autoOn: autoOn === true, now: now() });
    },
    noteStop () {
      apply({ type: 'stop', now: now() });
    },
    noteSwitch (autoOn) {
      on = autoOn === true;
      apply({ type: 'switch', autoOn: on, now: now() });
    },
    notePeriod (id) {
      const period = periodById(id);
      every = period.id;
      apply({ type: 'period', periodMs: period.ms, now: now() });
    },
    noteFinish (kind) {
      apply({ type: 'finish', kind, now: now() });
    },
    noteBoot ({ open = false } = {}) {
      apply({ type: 'boot', autoOn: on, open: open === true, now: now() });
    },
    hydrate ({ autoOn, every: everyId } = {}) {
      on = autoOn === true;
      const period = periodById(everyId);
      every = period.id;
      state = { ...state, periodMs: period.ms };
    }
  };
}
