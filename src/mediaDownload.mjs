/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// Publish a media file only after the HTTP body ends cleanly. Bytes live in
// a sibling `.partial` until then. A stream error, idle stall, user abort, or
// short Content-Length deletes that temporary file. The final path is the
// Explorer thumbnail path; existence there means a finished publish.

import fs from 'node:fs';
import { dirname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { mkdirp } from 'mkdirp';
import { fileExists, rename, unlink } from './utils.mjs';
import { fetchCivitaiImage } from './civitaiApi.mjs';
import {
  recallFetchMiss,
  recordFetchMiss,
  clearFetchMiss,
  failureCause,
  reportTransientFetch
} from './fetchMiss.mjs';

export const MEDIA_DOWNLOAD_ATTEMPTS = 3;
export const MEDIA_IDLE_MS = 30_000;

function byteTap (bump) {
  return new Transform({
    transform (chunk, encoding, callback) {
      void encoding;
      bump();
      callback(null, chunk);
    }
  });
}

function createIdleWatch (userSignal, idleMs) {
  const ctrl = new AbortController();
  let timer;
  const arm = () => {
    clearTimeout(timer);
    if (ctrl.signal.aborted) return;
    timer = setTimeout(() => ctrl.abort(), idleMs);
  };
  const onUserAbort = () => ctrl.abort();
  if (userSignal) {
    if (userSignal.aborted) ctrl.abort();
    else userSignal.addEventListener('abort', onUserAbort, { once: true });
  }
  arm();
  return {
    signal: ctrl.signal,
    bump: arm,
    dispose () {
      clearTimeout(timer);
      userSignal?.removeEventListener('abort', onUserAbort);
    }
  };
}

async function discard (filepath) {
  if (await fileExists(filepath)) await unlink(filepath);
}

async function releaseBody (body) {
  if (body && typeof body.cancel === 'function') {
    try {
      await body.cancel();
    } catch (ignoreErr) {
      // Already closed or cancelled.
    }
  }
}

async function publishPartial (tempPath, finalPath, { replace }) {
  let existing = null;
  if (replace && await fileExists(finalPath)) {
    try {
      existing = await fs.promises.stat(finalPath);
    } catch (ignoreErr) {
      existing = null;
    }
  }

  if (existing && existing.nlink > 1) {
    try {
      await fs.promises.copyFile(tempPath, finalPath);
    } catch (error) {
      await discard(tempPath);
      return { status: 'failed', message: error.message };
    }
    await discard(tempPath);
    return { status: 'published' };
  }

  if (existing) {
    try {
      await unlink(finalPath);
    } catch (error) {
      await discard(tempPath);
      return { status: 'failed', message: error.message };
    }
  }

  try {
    await rename(tempPath, finalPath);
  } catch (error) {
    await discard(tempPath);
    if (error.code === 'EEXIST') return { status: 'skipped' };
    return { status: 'failed', message: error.message };
  }
  return { status: 'published' };
}

async function attemptOnce (url, finalPath, tempPath, { signal, idleMs, replace }) {
  const idle = createIdleWatch(signal, idleMs);
  let fileStream;
  try {
    if (signal?.aborted) return { status: 'aborted' };

    const fetched = await fetchCivitaiImage(url, { signal: idle.signal });
    idle.bump();

    if (signal?.aborted) {
      await releaseBody(fetched.body);
      return { status: 'aborted' };
    }

    if (!fetched.ok) {
      await releaseBody(fetched.body);
      return { status: 'unavailable', httpStatus: fetched.status };
    }

    if (!fetched.body) {
      return { status: 'failed', message: 'empty response body', cause: '' };
    }

    fileStream = fs.createWriteStream(tempPath, { flags: 'wx' });
    await pipeline(
      Readable.fromWeb(fetched.body, { signal: idle.signal }),
      byteTap(() => idle.bump()),
      fileStream
    );
    fileStream = undefined;

    if (signal?.aborted) {
      await discard(tempPath);
      return { status: 'aborted' };
    }

    if (fetched.contentLength != null) {
      const size = (await fs.promises.stat(tempPath)).size;
      if (size !== fetched.contentLength) {
        await discard(tempPath);
        return { status: 'failed', message: `short body ${size}/${fetched.contentLength}`, cause: '' };
      }
    }

    return await publishPartial(tempPath, finalPath, { replace });
  } catch (error) {
    if (fileStream) fileStream.destroy();
    await discard(tempPath);
    if (signal?.aborted) return { status: 'aborted' };
    if (idle.signal.aborted) {
      return { status: 'failed', message: 'no bytes for 30s', cause: '' };
    }
    return {
      status: 'failed',
      message: error.message || 'fetch failed',
      cause: failureCause(error),
      code: typeof error.code === 'string' ? error.code : ''
    };
  } finally {
    idle.dispose();
  }
}

function isTerminalStatus (status) {
  return status === 404 || status === 410;
}

/**
 * Download `url` to `finalPath`.
 * `recall` is `download` (default), `auto`, or `recheck`.
 *
 * @returns {Promise<{ status: 'published'|'skipped'|'unavailable'|'aborted'|'failed', message?: string, cause?: string, httpStatus?: number, remembered?: boolean }>}
 */
export async function downloadMediaFile (url, finalPath, {
  signal,
  idleMs = MEDIA_IDLE_MS,
  attempts = MEDIA_DOWNLOAD_ATTEMPTS,
  replace = false,
  recall = 'download'
} = {}) {
  const tempPath = `${finalPath}.partial`;

  if (!replace && await fileExists(finalPath)) {
    await discard(tempPath);
    return { status: 'skipped' };
  }

  const prior = await recallFetchMiss(url);
  if (recall !== 'recheck' && prior?.outcome === 'terminal') {
    return { status: 'unavailable', httpStatus: prior.httpStatus || 404, remembered: true };
  }

  await mkdirp(dirname(finalPath));
  await discard(tempPath);

  let last = { status: 'failed', message: 'no attempt', cause: '' };
  const tries = Math.max(1, attempts);

  for (let attempt = 1; attempt <= tries; attempt++) {
    if (signal?.aborted) {
      await discard(tempPath);
      return { status: 'aborted' };
    }

    last = await attemptOnce(url, finalPath, tempPath, { signal, idleMs, replace });

    if (last.status === 'published') {
      await clearFetchMiss(url);
      return last;
    }

    if (last.status === 'unavailable' && isTerminalStatus(last.httpStatus)) {
      await recordFetchMiss(url, {
        outcome: 'terminal',
        httpStatus: last.httpStatus,
        message: '',
        cause: ''
      });
      return last;
    }

    if (last.status === 'skipped' || last.status === 'unavailable' || last.status === 'aborted') {
      return last;
    }
  }

  await discard(tempPath);
  const message = last.message || '';
  const cause = last.cause || '';
  await reportTransientFetch(url, {
    message,
    cause,
    recall,
    prefix: 'Warning: media download failed for'
  });
  return { status: 'failed', message, cause };
}
