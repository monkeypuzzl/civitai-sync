// One progress stream per browser origin, and only while some Explorer
// document on that origin is visible. Shell and Download page subscribe;
// neither constructs its own EventSource.

import { nextProgressConnection } from './progress-hold.js';

const NAME = 'civitai-sync-progress';
const PROGRESS_URL = '/api/download/progress';

function defaultCreateSource (url) {
  return new EventSource(url);
}

function defaultSchedule (fn, ms) {
  return setTimeout(fn, ms);
}

function defaultCancel (id) {
  clearTimeout(id);
}

function defaultOpenChannel (name) {
  return new BroadcastChannel(name);
}

function defaultVisibility () {
  return document.visibilityState;
}

function defaultListen (target, type, fn) {
  target.addEventListener(type, fn);
  return () => target.removeEventListener(type, fn);
}

export function createProgressSession (deps = {}) {
  const createSource = deps.createSource || defaultCreateSource;
  const schedule = deps.schedule || defaultSchedule;
  const cancel = deps.cancel || defaultCancel;
  const locks = deps.locks !== undefined ? deps.locks : globalThis.navigator?.locks;
  const openChannel = deps.openChannel || defaultOpenChannel;
  const readStatus = deps.readStatus;
  const visibility = deps.visibility || defaultVisibility;
  const listen = deps.listen || defaultListen;
  const doc = deps.document !== undefined ? deps.document : globalThis.document;
  const win = deps.window !== undefined ? deps.window : globalThis.window;

  const listeners = new Set();
  let state = {
    leader: false,
    visible: false,
    open: false,
    retries: 0,
    ignoreError: false
  };
  let current = null;
  let timer = null;
  let channel = null;
  let useLocks = false;
  let started = false;
  let pending = null;
  let holdRelease = null;
  const unlisteners = [];

  function deliver (event) {
    for (const fn of [...listeners]) {
      try { fn(event); } catch { /* one subscriber must not drop the others */ }
    }
  }

  function deliverFromSocket (event) {
    deliver(event);
    if (!state.leader || !channel) return;
    try { channel.postMessage({ kind: 'frame', event }); } catch { /* other side closed */ }
  }

  function readNow () {
    if (typeof readStatus !== 'function') return;
    Promise.resolve()
      .then(() => readStatus())
      .then((status) => {
        if (!status || typeof status !== 'object') return;
        deliver({
          type: 'connected',
          active: status.active === true,
          downloadType: status.type
        });
      })
      .catch(() => {});
  }

  function armTimer (retryMs) {
    if (retryMs == null) {
      if (timer != null) {
        cancel(timer);
        timer = null;
      }
      return;
    }
    if (timer != null) cancel(timer);
    timer = schedule(() => {
      timer = null;
      if (!(state.visible && state.leader) || current) return;
      openSocket();
    }, retryMs);
  }

  function dropCurrent () {
    const source = current;
    if (!source) return;
    current = null;
    try { source.close(); } catch { /* already closed */ }
  }

  function openSocket () {
    if (current) return;
    let source;
    try {
      source = createSource(PROGRESS_URL);
    } catch {
      apply('error');
      return;
    }
    current = source;
    source.onmessage = (e) => {
      if (source !== current) return;
      let event;
      try { event = JSON.parse(e.data); } catch { return; }
      if (!event || typeof event !== 'object') return;
      deliverFromSocket(event);
    };
    source.onerror = () => {
      if (source !== current) return;
      current = null;
      try { source.close(); } catch { /* already closed */ }
      apply('error');
    };
    apply('opened');
  }

  function apply (signal) {
    const decision = nextProgressConnection(state, signal);
    state = decision.state;
    armTimer(decision.retryMs);
    if (decision.close) dropCurrent();
    if (decision.readStatus) readNow();
    if (decision.connect) openSocket();
    return decision;
  }

  function resignLock () {
    const controller = pending;
    const releaseHold = holdRelease;
    pending = null;
    holdRelease = null;
    if (controller) controller.abort();
    if (releaseHold) releaseHold();
  }

  function requestLeadership () {
    if (!useLocks) {
      apply('lead');
      return;
    }
    if (pending) return;
    const controller = new AbortController();
    pending = controller;
    let releaseHold = () => {};
    const holderPromise = new Promise((resolve) => { releaseHold = resolve; });
    holdRelease = releaseHold;
    try {
      locks.request(NAME, { signal: controller.signal }, () => {
        if (controller.signal.aborted) return undefined;
        apply('lead');
        return holderPromise;
      }).catch(() => {});
    } catch {
      pending = null;
      holdRelease = null;
      apply('lead');
    }
  }

  function onShow () {
    apply('show');
    if (!useLocks) apply('lead');
    else requestLeadership();
  }

  function resignVisible () {
    apply('hide');
    if (useLocks) apply('follow');
    resignLock();
  }

  function onVisibility () {
    if (visibility() === 'hidden') resignVisible();
    else onShow();
  }

  function onPageShow (event) {
    onShow();
    if (event && event.persisted) apply('wake');
  }

  function onResume () {
    if (visibility() === 'hidden') return;
    if (!state.visible) onShow();
    apply('wake');
  }

  function onOnline () {
    if (visibility() === 'hidden') return;
    if (!state.visible) onShow();
    else apply('wake');
  }

  function start () {
    if (started) return;
    started = true;
    try {
      channel = openChannel(NAME);
    } catch {
      channel = null;
    }
    if (channel) {
      channel.onmessage = (message) => {
        if (state.leader) return;
        const data = message && message.data;
        if (!data || data.kind !== 'frame' || !data.event || typeof data.event !== 'object') return;
        deliver(data.event);
      };
    }
    useLocks = !!(channel && locks && typeof locks.request === 'function');
    const pairs = [
      [doc, 'visibilitychange', onVisibility],
      [doc, 'pagehide', resignVisible],
      [doc, 'freeze', resignVisible],
      [doc, 'pageshow', onPageShow],
      [doc, 'resume', onResume],
      [win, 'online', onOnline]
    ];
    for (const [target, type, fn] of pairs) {
      const off = listen(target, type, fn);
      if (typeof off === 'function') unlisteners.push(off);
    }
    if (visibility() === 'hidden') apply('hide');
    else onShow();
  }

  function stop () {
    resignVisible();
    for (const off of unlisteners) off();
    unlisteners.length = 0;
    if (channel) {
      try { channel.close(); } catch { /* already closed */ }
      channel = null;
    }
    started = false;
    useLocks = false;
  }

  function connectProgress (onEvent) {
    listeners.add(onEvent);
    if (listeners.size === 1) start();
    return () => {
      listeners.delete(onEvent);
      if (listeners.size === 0) stop();
    };
  }

  return { connectProgress };
}
