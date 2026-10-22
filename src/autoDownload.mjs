// Auto-download decisions. No timer, no CONFIG, no fetch.
// A period is the gap after a queue finishes, measured from that finish.

import { canonicalizeDownloadTypes } from './downloadQueue.mjs';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const RECOVERY_FLOOR = 2 * MINUTE;

export const DOWNLOAD_PERIODS = Object.freeze([
  Object.freeze({ id: '5m', ms: 5 * MINUTE, label: '5 mins' }),
  Object.freeze({ id: '15m', ms: 15 * MINUTE, label: '15 mins' }),
  Object.freeze({ id: '30m', ms: 30 * MINUTE, label: '30 mins' }),
  Object.freeze({ id: '1h', ms: HOUR, label: '1 hour' }),
  Object.freeze({ id: '3h', ms: 3 * HOUR, label: '3 hours' }),
  Object.freeze({ id: '6h', ms: 6 * HOUR, label: '6 hours' }),
  Object.freeze({ id: '12h', ms: 12 * HOUR, label: '12 hours' }),
  Object.freeze({ id: '1d', ms: 24 * HOUR, label: '1 day' })
]);

const PERIOD_BY_ID = new Map(DOWNLOAD_PERIODS.map(period => [period.id, period]));
const DEFAULT_PERIOD = PERIOD_BY_ID.get('1h');

export function periodById (id) {
  return PERIOD_BY_ID.get(id) || DEFAULT_PERIOD;
}

export function periodLabel (id) {
  return periodById(id).label;
}

function idleFrom (state) {
  return {
    phase: 'idle',
    repeat: false,
    periodMs: state.periodMs,
    anchorAt: null,
    dueAt: null,
    recoveryStep: 0
  };
}

function sameState (a, b) {
  return a.phase === b.phase
    && a.repeat === b.repeat
    && a.periodMs === b.periodMs
    && a.anchorAt === b.anchorAt
    && a.dueAt === b.dueAt
    && a.recoveryStep === b.recoveryStep;
}

function withStart (state, start) {
  if (!start) return state;
  const next = { ...state, start: true };
  return next;
}

function recoveryDelay (step, periodMs) {
  const raw = RECOVERY_FLOOR * (2 ** (Math.max(1, step) - 1));
  return Math.min(periodMs, raw);
}

/**
 * @returns {object} next state. `start: true` means one queue should start.
 * The same object is returned when nothing changed.
 */
export function decideAuto (state, event) {
  let base = state && state.phase ? state : {
    phase: 'idle',
    repeat: false,
    periodMs: DEFAULT_PERIOD.ms,
    anchorAt: null,
    dueAt: null,
    recoveryStep: 0
  };
  if (base.start) {
    base = { ...base };
    delete base.start;
  }
  if (!event || typeof event !== 'object') return base;
  const now = Number(event.now);
  let next = null;
  let start = false;

  if (event.type === 'click') {
    if (base.phase === 'running') return base;
    next = {
      ...base,
      phase: 'running',
      repeat: event.autoOn === true,
      dueAt: null,
      recoveryStep: 0
    };
  } else if (event.type === 'stop' || event.type === 'empty') {
    next = idleFrom(base);
  } else if (event.type === 'switch') {
    const autoOn = event.autoOn === true;
    if (!autoOn && base.phase === 'waiting') next = idleFrom(base);
    else if (!autoOn && base.phase === 'running') next = { ...base, repeat: false };
    else if (autoOn && base.phase === 'running') next = { ...base, repeat: true };
    else return base;
  } else if (event.type === 'period') {
    const periodMs = Number(event.periodMs);
    if (!Number.isFinite(periodMs) || periodMs <= 0) return base;
    if (base.phase !== 'waiting') {
      if (base.periodMs === periodMs) return base;
      next = { ...base, periodMs };
    } else {
      const dueAt = base.anchorAt + periodMs;
      if (dueAt <= now) {
        next = {
          ...base,
          phase: 'running',
          periodMs,
          dueAt: null,
          recoveryStep: 0,
          repeat: true
        };
        start = true;
      } else {
        next = {
          ...base,
          periodMs,
          dueAt,
          recoveryStep: 0
        };
      }
    }
  } else if (event.type === 'boot') {
    if (event.autoOn !== true || base.phase !== 'idle') return base;
    if (event.open === true) {
      next = { ...base, phase: 'running', repeat: true, dueAt: null, recoveryStep: 0 };
      start = true;
    } else {
      next = {
        ...base,
        phase: 'waiting',
        repeat: true,
        anchorAt: now,
        dueAt: now + base.periodMs,
        recoveryStep: 0
      };
    }
  } else if (event.type === 'tick') {
    if (base.phase !== 'waiting' || base.dueAt == null || !(now >= base.dueAt)) return base;
    next = { ...base, phase: 'running', dueAt: null };
    start = true;
  } else if (event.type === 'finish') {
    if (base.phase !== 'running') return base;
    const kind = event.kind;
    if (kind === 'fatal' || kind === 'aborted' || !base.repeat) {
      next = idleFrom(base);
    } else if (kind === 'transient') {
      const recoveryStep = base.recoveryStep + 1;
      next = {
        ...base,
        phase: 'waiting',
        anchorAt: now,
        dueAt: now + recoveryDelay(recoveryStep, base.periodMs),
        recoveryStep
      };
    } else {
      next = {
        ...base,
        phase: 'waiting',
        anchorAt: now,
        dueAt: now + base.periodMs,
        recoveryStep: 0
      };
    }
  } else {
    return base;
  }

  if (!next || sameState(next, base)) return start ? withStart(base, true) : base;
  return start ? withStart(next, true) : next;
}

export function classifyDownloadFinish ({ status, fault, userStop } = {}) {
  if (userStop) return 'aborted';
  if (fault === 'storage' || fault === 'auth') return 'fatal';
  if (fault === 'network' || status === 'error' || status === 'aborted') return 'transient';
  return 'steady';
}

export function worsenQueueClass (prev, next) {
  const rank = { steady: 0, transient: 1, aborted: 2, fatal: 3 };
  const a = rank[prev] || 0;
  const b = rank[next] || 0;
  if (b > a) return next;
  return prev || 'steady';
}

export function buildAutoSpec (input = {}) {
  const types = canonicalizeDownloadTypes(input.downloadTypes);
  if (!types.length) return null;
  const body = { types };
  if (types.includes('generations')) {
    const reactions = Array.isArray(input.generationReactions) ? input.generationReactions : [];
    const mode = input.generationDownload === 'all'
      ? 'missing-all'
      : input.generationDownload === 'reactions' && reactions.length
        ? 'missing-tags'
        : 'latest';
    body.generations = { mode };
  }
  const postsMode = input.postsNeedUpdate === true
    ? 'all'
    : (input.postDownload === 'all' ? 'all' : 'latest');
  const comicsMode = input.comicDownload === 'all' ? 'all' : 'latest';
  const model3dMode = input.model3dDownload === 'all' ? 'all' : 'latest';
  if (types.includes('posts')) body.posts = { mode: postsMode };
  if (types.includes('comics')) body.comics = { mode: comicsMode };
  if (types.includes('model3ds')) body.model3ds = { mode: model3dMode };
  const recheck = input.downloadRecheck === true && (
    (types.includes('posts') && postsMode === 'all')
    || (types.includes('comics') && comicsMode === 'all')
  );
  if (recheck) body.recheck = true;
  return body;
}
