// Admits every outbound Civitai call. Two lanes, one pause clock each.
// Facts: docs/guides/civitai-sync/civitai-api-rate-limits.md
// Contract: docs/guides/civitai-sync/rate-limit-client.md

import { AsyncLocalStorage } from 'node:async_hooks';

export const API_POOL_WIDTH = 6;
export const MEDIA_POOL_WIDTH = 4;

const ATTEMPTS = 5;
const SUCCESS_STREAK = 20;
const TRANSIENT_BURST = 3;
const TRANSIENT_WINDOW_MS = 10_000;
const BACKOFF_CAP_MS = 30_000;
const HINT_CAP_MS = 15 * 60 * 1000;
const JITTER_MS = 250;

const priorityScope = new AsyncLocalStorage();

const deps = {
  now: () => Date.now(),
  sleep: (ms, signal) => sleepMs(ms, signal),
  random: () => Math.random(),
  fetch: (url, init) => globalThis.fetch(url, init)
};

let epoch = 0;
let lanes = freshLanes();

function freshLane (cap, max) {
  return {
    cap,
    max,
    downloadInFlight: 0,
    backgroundInFlight: 0,
    heavyInFlight: 0,
    pauseUntil: 0,
    successes: 0,
    transientAt: [],
    waiters: [],
    waking: false,
    loggedHintCap: false
  };
}

function freshLanes () {
  return {
    api: freshLane(2, API_POOL_WIDTH),
    media: freshLane(3, MEDIA_POOL_WIDTH)
  };
}

function isNetworkError (error) {
  if (!error || error.name === 'AbortError') return false;
  if (error.name === 'TypeError') return true;
  const code = error.code || error.cause?.code;
  return code === 'ECONNRESET'
    || code === 'ECONNREFUSED'
    || code === 'ETIMEDOUT'
    || code === 'ENOTFOUND'
    || code === 'EAI_AGAIN'
    || code === 'UND_ERR_CONNECT_TIMEOUT'
    || code === 'UND_ERR_SOCKET';
}

function abortError () {
  return Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
}

function sleepMs (ms, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function runAsBackground (fn) {
  return priorityScope.run('background', fn);
}

function currentPriority () {
  return priorityScope.getStore() === 'background' ? 'background' : 'download';
}

export function resetSchedulerForTests () {
  epoch += 1;
  lanes = freshLanes();
  deps.now = () => Date.now();
  deps.sleep = (ms, signal) => sleepMs(ms, signal);
  deps.random = () => Math.random();
  deps.fetch = (url, init) => globalThis.fetch(url, init);
}

export function configureSchedulerForTests ({ now, sleep, random } = {}) {
  if (now) deps.now = now;
  if (sleep) deps.sleep = sleep;
  if (random) deps.random = random;
}

function headerGet (headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return null;
}

function trpcShape (json) {
  if (!json || typeof json !== 'object') return null;
  const err = json.error;
  if (err == null) return null;
  if (typeof err === 'string') return { message: err };
  const shape = err.json && typeof err.json === 'object' ? err.json : err;
  if (!shape || typeof shape !== 'object') return { message: '' };
  const data = shape.data && typeof shape.data === 'object' ? shape.data : {};
  return {
    httpStatus: typeof data.httpStatus === 'number' ? data.httpStatus : 0,
    code: typeof data.code === 'string' ? data.code : (typeof shape.code === 'string' ? shape.code : ''),
    message: (typeof shape.message === 'string' && shape.message)
      || (typeof data.message === 'string' && data.message)
      || '',
    rateLimit: data.rateLimit && typeof data.rateLimit === 'object' ? data.rateLimit : null
  };
}

function hintMs (headers, rateLimit) {
  const now = deps.now();
  const values = [];
  const header = headerGet(headers, 'retry-after');
  if (header != null && header !== '') {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) values.push(Math.max(0, seconds * 1000));
    else {
      const stamp = Date.parse(header);
      if (Number.isFinite(stamp)) values.push(Math.max(0, stamp - now));
    }
  }
  if (rateLimit && Number.isFinite(Number(rateLimit.retryAfterSeconds))) {
    values.push(Math.max(0, Number(rateLimit.retryAfterSeconds) * 1000));
  }
  if (rateLimit && rateLimit.retryAt) {
    const stamp = Date.parse(rateLimit.retryAt);
    if (Number.isFinite(stamp)) values.push(Math.max(0, stamp - now));
  }
  if (!values.length) return null;
  return Math.max(...values);
}

function honoredHint (laneName, retryAfterMs) {
  if (retryAfterMs == null) return null;
  if (retryAfterMs <= HINT_CAP_MS) return retryAfterMs;
  const lane = lanes[laneName];
  if (lane && !lane.loggedHintCap) {
    lane.loggedHintCap = true;
    console.log('Rate limit wait capped at 15 minutes.');
  }
  return HINT_CAP_MS;
}

export function classifyExchange ({ httpStatus = 0, headers, text = '', json, jsonUnparsed = false }) {
  const trpc = trpcShape(json);
  const message = trpc?.message || (typeof json?.error === 'string' ? json.error : '') || String(text || '');
  let status = (trpc && trpc.httpStatus) || httpStatus || 0;
  const code = trpc?.code || '';
  if (!status && code === 'TOO_MANY_REQUESTS') status = 429;
  if (!status && (code === 'INTERNAL_SERVER_ERROR' || code === 'BAD_GATEWAY' || code === 'SERVICE_UNAVAILABLE' || code === 'TIMEOUT')) {
    status = code === 'TIMEOUT' ? 408 : (code === 'BAD_GATEWAY' ? 502 : (code === 'SERVICE_UNAVAILABLE' ? 503 : 500));
  }
  const retryAfterMs = hintMs(headers, trpc?.rateLimit);
  const paging = status === 429 && /too many pages/i.test(message) && /cursor/i.test(message);
  if (paging) return { class: 'paging', retry: false, retryAfterMs: null };
  if (status === 429 && /server busy/i.test(message)) return { class: 'busy', retry: true, retryAfterMs };
  if (status === 503 && retryAfterMs != null) return { class: 'busy', retry: true, retryAfterMs };
  if (status === 429 || code === 'TOO_MANY_REQUESTS') return { class: 'rate_limit', retry: true, retryAfterMs };
  if (status === 401 || status === 403 || code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
    return { class: 'auth', retry: false, retryAfterMs: null };
  }
  if (status >= 400 && status < 500) return { class: 'client', retry: false, retryAfterMs: null };
  if (status === 408 || status >= 500) return { class: 'transient', retry: true, retryAfterMs };
  if (trpc) return { class: 'client', retry: false, retryAfterMs: null };
  if (jsonUnparsed && status >= 200 && status < 300) {
    return { class: 'transient', retry: true, retryAfterMs: null };
  }
  return { class: 'ok', retry: false, retryAfterMs: null };
}

function asResponse ({ status, headers, text, json, retrySpent }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers || { get: () => null },
    retrySpent: !!retrySpent,
    text: async () => text ?? '',
    json: async () => (json !== undefined ? json : (text ? JSON.parse(text) : null))
  };
}

function networkFailure (error) {
  const message = error?.message || 'fetch failed';
  const json = { error: { message, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 } } };
  return asResponse({ status: 500, text: JSON.stringify(json), json, retrySpent: true });
}

function dropAborted (lane) {
  const s = lanes[lane];
  for (let i = s.waiters.length - 1; i >= 0; i--) {
    if (s.waiters[i].signal?.aborted) {
      const waiter = s.waiters.splice(i, 1)[0];
      waiter.clear?.();
      waiter.reject(abortError());
    }
  }
}

function pump (laneName) {
  const s = lanes[laneName];
  const myEpoch = epoch;
  const now = deps.now();
  if (s.pauseUntil > now) {
    if (!s.waking) {
      s.waking = true;
      deps.sleep(s.pauseUntil - now).then(() => {
        if (myEpoch !== epoch) return;
        s.waking = false;
        pump(laneName);
      }, () => {
        if (myEpoch !== epoch) return;
        s.waking = false;
      });
    }
    return;
  }
  s.loggedHintCap = false;
  dropAborted(laneName);
  let progressed = true;
  while (progressed) {
    progressed = false;
    const downloadBusy = s.downloadInFlight > 0 || s.waiters.some(waiter => waiter.priority === 'download');
    for (let i = 0; i < s.waiters.length; i++) {
      const waiter = s.waiters[i];
      if (waiter.priority === 'background') {
        if (downloadBusy || s.backgroundInFlight >= 1) continue;
      } else if (s.downloadInFlight >= s.cap) {
        continue;
      }
      if (waiter.heavy && s.heavyInFlight >= 1) continue;
      s.waiters.splice(i, 1);
      if (waiter.priority === 'background') s.backgroundInFlight += 1;
      else s.downloadInFlight += 1;
      if (waiter.heavy) s.heavyInFlight += 1;
      waiter.clear?.();
      waiter.resolve(makeRelease(laneName, waiter));
      progressed = true;
      break;
    }
  }
}

function makeRelease (laneName, waiter) {
  let released = false;
  return (ok) => {
    if (released || epoch !== waiter.epoch) return;
    released = true;
    const s = lanes[laneName];
    if (waiter.priority === 'background') s.backgroundInFlight = Math.max(0, s.backgroundInFlight - 1);
    else {
      s.downloadInFlight = Math.max(0, s.downloadInFlight - 1);
      if (ok) {
        s.successes += 1;
        if (s.successes >= SUCCESS_STREAK && s.cap < s.max) {
          s.cap += 1;
          s.successes = 0;
        }
      }
    }
    if (waiter.heavy) s.heavyInFlight = Math.max(0, s.heavyInFlight - 1);
    pump(laneName);
  };
}

function acquire ({ lane, heavy, signal, front }) {
  if (signal?.aborted) return Promise.reject(abortError());
  const s = lanes[lane];
  return new Promise((resolve, reject) => {
    const waiter = {
      priority: currentPriority(),
      heavy: heavy === true,
      signal,
      resolve,
      reject,
      epoch,
      clear: null
    };
    const onAbort = () => {
      const index = s.waiters.indexOf(waiter);
      if (index >= 0) s.waiters.splice(index, 1);
      reject(abortError());
    };
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
      waiter.clear = () => signal.removeEventListener('abort', onAbort);
    }
    if (front) s.waiters.unshift(waiter);
    else s.waiters.push(waiter);
    pump(lane);
  });
}

function noteTransient (laneName) {
  const s = lanes[laneName];
  const now = deps.now();
  s.transientAt.push(now);
  s.transientAt = s.transientAt.filter(stamp => now - stamp <= TRANSIENT_WINDOW_MS);
  return s.transientAt.length >= TRANSIENT_BURST;
}

async function backoff (laneName, cls, attempt, signal) {
  const burst = cls.class === 'transient' && noteTransient(laneName);
  const shed = cls.class === 'rate_limit' || cls.class === 'busy' || burst;
  const hinted = honoredHint(laneName, cls.retryAfterMs);
  const base = hinted != null
    ? hinted
    : Math.min(BACKOFF_CAP_MS, 1000 * (2 ** (attempt - 1)));
  const delay = base + Math.floor(deps.random() * JITTER_MS);
  if (shed) {
    const s = lanes[laneName];
    s.cap = 1;
    s.successes = 0;
    const until = deps.now() + delay;
    if (until > s.pauseUntil) s.pauseUntil = until;
    return;
  }
  await deps.sleep(delay, signal);
}

function holdBody (body, release) {
  if (!body || typeof body.getReader !== 'function') {
    release(true);
    return body || null;
  }
  const reader = body.getReader();
  let released = false;
  const finish = (ok) => {
    if (released) return;
    released = true;
    release(ok);
  };
  return new ReadableStream({
    async pull (controller) {
      try {
        const step = await reader.read();
        if (step.done) {
          finish(true);
          controller.close();
          return;
        }
        controller.enqueue(step.value);
      } catch (error) {
        finish(false);
        controller.error(error);
      }
    },
    cancel (reason) {
      finish(false);
      return reader.cancel(reason);
    }
  });
}

async function exchange (url, init, { lane, heavy, signal, stream }) {
  let last = networkFailure(new Error('no attempt'));
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (signal?.aborted) throw abortError();
    const release = await acquire({ lane, heavy, signal, front: attempt > 1 });
    try {
      const response = await deps.fetch(url, init);
      const status = typeof response.status === 'number'
        ? response.status
        : (response.ok ? 200 : 0);
      if (stream && status === 200) {
        const body = holdBody(response.body, release);
        return { ok: true, status: 200, headers: response.headers, body, retrySpent: false };
      }
      let text = '';
      let json;
      let parsedJson = false;
      if (typeof response.text === 'function') {
        text = await response.text();
        if (text) {
          try {
            json = JSON.parse(text);
            parsedJson = true;
          } catch {
            json = null;
          }
        } else {
          parsedJson = true;
        }
      } else if (typeof response.json === 'function') {
        json = await response.json();
        parsedJson = true;
        try { text = JSON.stringify(json ?? null); } catch { text = ''; }
      }
      const headers = response.headers || { get: () => null };
      const cls = classifyExchange({
        httpStatus: status,
        headers,
        text,
        json,
        jsonUnparsed: !parsedJson && String(text || '').trim() !== ''
      });
      const spent = !!cls.retry && attempt === ATTEMPTS;
      last = stream
        ? { ok: false, status, headers, body: null, text, retrySpent: spent }
        : asResponse({ status, headers, text, json, retrySpent: spent });
      if (!cls.retry || attempt === ATTEMPTS) {
        release(cls.class === 'ok');
        return last;
      }
      release(false);
      await backoff(lane, cls, attempt, signal);
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') {
        release(false);
        throw error;
      }
      if (!isNetworkError(error) || attempt === ATTEMPTS) {
        release(false);
        if (stream && isNetworkError(error)) throw error;
        return stream
          ? { ok: false, status: 0, headers: { get: () => null }, body: null, text: error.message || 'fetch failed', retrySpent: isNetworkError(error) }
          : networkFailure(error);
      }
      release(false);
      await backoff(lane, { class: 'transient', retry: true, retryAfterMs: null }, attempt, signal);
    }
  }
  return last;
}

export function scheduledText (url, init = {}, meta = {}) {
  const signal = meta.signal || init.signal;
  return exchange(url, init, {
    lane: meta.lane || 'api',
    heavy: meta.heavy === true,
    signal,
    stream: false
  });
}

export function scheduledStream (url, init = {}, meta = {}) {
  const signal = meta.signal || init.signal;
  return exchange(url, init, {
    lane: meta.lane || 'media',
    heavy: meta.heavy === true,
    signal,
    stream: true
  });
}

export async function mapPool (items, width, fn, { signal } = {}) {
  const list = Array.from(items || []);
  const results = new Array(list.length);
  let cursor = 0;
  let stop = false;
  const child = new AbortController();
  const onParentAbort = () => child.abort();
  if (signal) {
    if (signal.aborted) child.abort();
    else signal.addEventListener('abort', onParentAbort, { once: true });
  }
  const workers = Math.max(0, Math.min(width, list.length));
  async function worker () {
    while (!stop && !child.signal.aborted) {
      const index = cursor;
      cursor += 1;
      if (index >= list.length) return;
      let out;
      try {
        out = await fn(list[index], index, child.signal);
      } catch (error) {
        if (child.signal.aborted || error?.name === 'AbortError') return;
        throw error;
      }
      results[index] = out;
      if (out && out.stop) {
        stop = true;
        child.abort();
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: workers }, () => worker()));
  } finally {
    signal?.removeEventListener('abort', onParentAbort);
  }
  return results;
}
