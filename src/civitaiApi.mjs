/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { wait } from './utils.mjs';
import getHeaders from './headers.mjs';
import { apiBase } from './civitaiDomain.mjs';
import { WIRE, modelFlagOf } from './civitaiWire.mjs';
import { scheduledText, scheduledStream } from './requestScheduler.mjs';

// Endpoints are computed lazily from the current Civitai domain. Every call
// site reads the base at invocation time so a user-triggered domain change
// takes effect immediately for subsequent requests.
function endpoints () {
  const base = apiBase();
  return {
    API_QUERY_GENERATED_IMAGES: `${base}/trpc/orchestrator.queryGeneratedImages`,
    API_GET_WORKFLOW: `${base}/trpc/orchestrator.getWorkflow`,
    API_POSTS: `${base}/trpc/post.getInfinite`,
    API_POST_GET: `${base}/trpc/post.get`,
    API_POST_EDIT: `${base}/trpc/post.getEdit`,
    API_COMICS_MY_PROJECTS: `${base}/trpc/comics.getMyProjects`,
    API_COMICS_PROJECT_SHELL: `${base}/trpc/comics.getProjectShell`,
    API_COMICS_CHAPTER: `${base}/trpc/comics.getChapter`,
    API_MODEL3D_INFINITE: `${base}/trpc/model3d.getInfinite`,
    API_MODEL3D_GET: `${base}/trpc/model3d.getById`,
    API_MODEL3D_BY_POST: `${base}/trpc/model3d.getByPostId`,
    API_MODEL3D_FILES: `${base}/trpc/model3d.getFiles`,
    API_IMAGE_GET_GENERATION_DATA: `${base}/trpc/image.getGenerationData`,
    API_IMAGE_INFINITE: `${base}/trpc/image.getInfinite`,
    API_ME: `${base}/v1/me`,
    API_IMAGES: `${base}/v1/images`,
    API_MODELS: `${base}/v1/models`,
    API_MODEL_VERSIONS: `${base}/v1/model-versions`,
    API_MODEL_VERSION_GET_BY_ID: `${base}/trpc/modelVersion.getById`,
    API_TAG_GET_BY_ID: `${base}/trpc/tag.getById`
  };
}

// `auth.getUser` is intentionally pinned to civitai.com. The tRPC handler is
// host-agnostic: it returns the same SessionUser regardless of which Civitai
// host serves the request, so using a single stable host makes this call
// independent of the currently-selected CONFIG.domain.
const AUTH_GET_USER_URL = 'https://civitai.com/api/trpc/auth.getUser';
const AUTH_GET_USER_DOMAIN = 'civitai.com';

const MAX_ATTEMPTS = 10;
const GENERATION_TAKE = 100;
let generationTake = GENERATION_TAKE;

// Known-good fallback used if the resolution API call fails
const FALLBACK_IMAGE_CDN_BASE = 'https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA';
let _imageCdnBase = null;

function getGenerationsUrl (cursor, tags = []) {
  const json = { authed: true, tags: ["gen", ...tags], cursor };
  if (generationTake) json.take = generationTake;
  const inputParams = { json };
  const inputQuery = encodeURIComponent(JSON.stringify(inputParams));
  const url = `${endpoints().API_QUERY_GENERATED_IMAGES}?input=${inputQuery}`;

  return url;
}

function errorResponse ({ httpStatus = 0, path = '', message = '', url = '' }) {
  let code = '';

  switch (httpStatus) {
    case 500:
    message = 'Server Error. Please try again.';
    code = 'SERVER_ERROR';
  }

  // Same shape as Civitai API error response
  return {
    error: {
      json: {
        message,
        code: 11000 + httpStatus, // Arbitrary
        data: {
          code,
          httpStatus,
          path
        }
      },
      url
    }
  };
}

const RAW_PREVIEW_MAX = 180;
const FAIL_FAST_HTTP = new Set([400, 401, 403]);
const RETRY_HTTP = new Set([408, 429, 500, 502, 503]);
const FAIL_FAST_CODES = new Set(['UNAUTHORIZED', 'FORBIDDEN', 'BAD_REQUEST']);
const RETRY_CODES = new Set([
  'TOO_MANY_REQUESTS',
  'TIMEOUT',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_SERVER_ERROR',
  'BAD_GATEWAY'
]);

function isNormalizedError (value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    typeof value.retryable === 'boolean'
  );
}

function isGenericMessage (message) {
  if (message == null) return true;
  const trimmed = String(message).trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return lower === 'unknown' || lower === 'unknown error' || lower === 'error';
}

function clipPreview (value) {
  const text = typeof value === 'string'
    ? value
    : (() => {
      try { return JSON.stringify(value); } catch { return String(value); }
    })();
  return text.length > RAW_PREVIEW_MAX ? text.slice(0, RAW_PREVIEW_MAX) : text;
}

function isRetryable (code, httpStatus) {
  if (FAIL_FAST_CODES.has(code)) return false;
  if (FAIL_FAST_HTTP.has(httpStatus)) return false;
  if (httpStatus >= 400 && httpStatus < 500) return false;

  if (code === 'PARSE_ERROR') {
    return !httpStatus || httpStatus >= 500;
  }

  if (RETRY_CODES.has(code)) return true;
  if (RETRY_HTTP.has(httpStatus)) return true;
  if (!httpStatus || httpStatus >= 500) return true;
  return false;
}

function codeFromHttpStatus (httpStatus) {
  if (httpStatus === 401) return 'UNAUTHORIZED';
  if (httpStatus === 403) return 'FORBIDDEN';
  if (httpStatus === 400) return 'BAD_REQUEST';
  if (httpStatus === 408) return 'TIMEOUT';
  if (httpStatus === 429) return 'TOO_MANY_REQUESTS';
  if (httpStatus === 500) return 'INTERNAL_SERVER_ERROR';
  if (httpStatus === 502) return 'BAD_GATEWAY';
  if (httpStatus === 503) return 'SERVICE_UNAVAILABLE';
  return 'UNKNOWN';
}

function makeNormalizedError ({ code, httpStatus, message, url, rawPreview }) {
  const status = typeof httpStatus === 'number' && httpStatus > 0 ? httpStatus : 0;
  const msg = message == null ? '' : String(message);
  const resolvedCode = code || 'UNKNOWN';
  return {
    code: resolvedCode,
    httpStatus: status,
    message: msg,
    retryable: isRetryable(resolvedCode, status),
    url: url || '',
    rawPreview: isGenericMessage(msg) ? clipPreview(rawPreview || '') : ''
  };
}

export function normalizeCivitaiError (input, { httpStatus = 0, url = '' } = {}) {
  if (isNormalizedError(input)) return input;
  if (input && typeof input === 'object' && isNormalizedError(input.error)) {
    return input.error;
  }

  const envelope = (input && typeof input === 'object' && 'error' in input)
    ? input
    : { error: input };

  const err = envelope.error;
  const shape = (err && typeof err === 'object' && err.json != null && typeof err.json === 'object')
    ? err.json
    : err;

  // Superjson tRPC (`error.json` object) and untransformed tRPC (`error` object
  // with `data` / `message`) share this branch. Next-style `{ message }` too.
  if (shape && typeof shape === 'object') {
    const data = shape.data && typeof shape.data === 'object' ? shape.data : {};
    const status = (typeof data.httpStatus === 'number' && data.httpStatus > 0)
      ? data.httpStatus
      : (typeof httpStatus === 'number' && httpStatus > 0 ? httpStatus : 0);
    const message = (typeof shape.message === 'string' && shape.message)
      || (typeof data.message === 'string' && data.message)
      || (typeof err?.message === 'string' && err.message)
      || '';
    const code = (typeof data.code === 'string' && data.code)
      || (typeof shape.code === 'string' && shape.code)
      || (status ? codeFromHttpStatus(status) : 'UNKNOWN');
    return makeNormalizedError({
      code,
      httpStatus: status,
      message,
      url: (err && typeof err === 'object' && typeof err.url === 'string' && err.url) || url,
      rawPreview: envelope
    });
  }

  // Devalue / REST string: `error` is a string. Code is UNAUTHORIZED on 401,
  // otherwise UNKNOWN — retryability still follows HTTP status.
  if (typeof shape === 'string') {
    const status = typeof httpStatus === 'number' && httpStatus > 0 ? httpStatus : 0;
    const code = status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN';
    return makeNormalizedError({
      code,
      httpStatus: status,
      message: shape,
      url,
      rawPreview: shape
    });
  }

  return makeNormalizedError({
    code: 'UNKNOWN',
    httpStatus: typeof httpStatus === 'number' && httpStatus > 0 ? httpStatus : 0,
    message: '',
    url,
    rawPreview: envelope
  });
}

export function formatApiError (err) {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (typeof err !== 'object') return String(err);

  if (typeof err.code === 'string' && typeof err.retryable === 'boolean') {
    const message = err.message || err.code || 'Unknown error';
    return err.httpStatus
      ? `${err.code} (${err.httpStatus}): ${message}`
      : `${err.code}: ${message}`;
  }

  return err.message || err.json?.message || err.error || 'Unknown error';
}

export function readTrpcJson (body) {
  if (!body || typeof body !== 'object') return null;
  const data = body.result?.data;
  if (data == null) return null;
  if (typeof data === 'string') return null;

  if (data.json && typeof data.json === 'object') {
    return {
      items: Array.isArray(data.json.items) ? data.json.items : [],
      nextCursor: data.json.nextCursor ?? null
    };
  }

  if (typeof data === 'object' && 'items' in data) {
    return {
      items: Array.isArray(data.items) ? data.items : [],
      nextCursor: data.nextCursor ?? null
    };
  }

  return null;
}

function trpcCallLabel (url) {
  let procedure = '';
  let cursor = '';
  try {
    const parsed = new URL(url);
    procedure = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const raw = parsed.searchParams.get('input');
    if (raw) {
      const input = JSON.parse(raw);
      const json = input && typeof input === 'object' && input.json && typeof input.json === 'object' && !Array.isArray(input.json)
        ? input.json
        : input;
      const value = json && typeof json === 'object' ? json.cursor : undefined;
      if (typeof value === 'string' && value) cursor = value;
      else if (typeof value === 'number' && Number.isFinite(value)) cursor = String(value);
    }
  } catch { /* unlabeled request */ }
  if (!procedure) return '';
  return cursor ? `${procedure} (cursor ${cursor})` : procedure;
}

function connectionClosedMessage (url, error) {
  const where = trpcCallLabel(url);
  const reading = where ? ` while reading ${where}` : '';
  const message = error && typeof error.message === 'string' ? error.message : '';
  const cause = error && error.cause && typeof error.cause === 'object' ? error.cause : null;
  const causeCode = cause && typeof cause.code === 'string' ? cause.code : '';
  const causeMessage = cause && typeof cause.message === 'string' ? cause.message : '';
  let paren = '';
  if (causeCode && causeMessage && causeMessage !== message) paren = `${causeCode}: ${causeMessage}`;
  else if (causeCode) paren = causeCode;
  else if (causeMessage && causeMessage !== message) paren = causeMessage;
  const detail = [message, paren ? `(${paren})` : ''].filter(Boolean).join(' ');
  return detail ? `Connection closed${reading}: ${detail}` : `Connection closed${reading}`;
}

function nonJsonMessage (url, text, { contentType, parseMessage } = {}) {
  const where = trpcCallLabel(url);
  const from = where ? ` from ${where}` : '';
  const raw = text == null ? '' : String(text);
  const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, RAW_PREVIEW_MAX);
  const type = typeof contentType === 'string' ? contentType.split(';')[0].trim() : '';
  const meta = [type, `${raw.length} bytes`].filter(Boolean).join(', ');
  const parse = parseMessage ? ` (${parseMessage})` : '';
  const preview = snippet ? `: ${snippet}` : '';
  return `Non-JSON response${from}, ${meta}${parse}${preview}`;
}

function contentTypeOf (response) {
  const headers = response?.headers;
  if (!headers || typeof headers.get !== 'function') return '';
  const value = headers.get('content-type');
  return typeof value === 'string' ? value : '';
}

export async function parseTrpcFetchResponse (response, { url = '' } = {}) {
  const httpStatus = response.status || 0;
  let text = '';

  try {
    if (typeof response.text === 'function') {
      text = await response.text();
    } else if (typeof response.json === 'function') {
      const parsed = await response.json();
      text = typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? null);
    }
  } catch (error) {
    return {
      error: makeNormalizedError({
        code: 'PARSE_ERROR',
        httpStatus,
        message: connectionClosedMessage(url, error),
        url
      })
    };
  }

  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    return {
      error: makeNormalizedError({
        code: 'PARSE_ERROR',
        httpStatus,
        message: nonJsonMessage(url, text, {
          contentType: contentTypeOf(response),
          parseMessage: error?.message || ''
        }),
        url
      })
    };
  }

  if (Array.isArray(body) && body.length === 1) {
    body = body[0];
  }

  if (body && typeof body === 'object' && body.error) {
    return { error: normalizeCivitaiError(body, { httpStatus, url }) };
  }

  if (response.ok === false) {
    return {
      error: normalizeCivitaiError(
        { error: (text || `HTTP ${httpStatus}`).slice(0, RAW_PREVIEW_MAX) },
        { httpStatus, url }
      )
    };
  }

  return body;
}

function toIteratorPayload ({ items, nextCursor }) {
  return { result: { data: { json: { items, nextCursor } } } };
}

function missingSuccessEnvelope (body, { url } = {}) {
  const keys = body && typeof body === 'object' ? Object.keys(body) : [];
  return {
    code: 'UNKNOWN',
    httpStatus: 0,
    message: 'Unexpected API response shape',
    retryable: false,
    url: url || '',
    rawPreview: keys.join(', ').slice(0, RAW_PREVIEW_MAX)
  };
}

async function paginateOnError (err, options, retry) {
  const { attempts = 0, log = console.log } = options;
  const normalized = normalizeCivitaiError(err);
  const line = `API error: ${formatApiError(normalized)}`;

  if (!normalized.retryable) {
    log(line);
    return { error: normalized, aborted: false, complete: false };
  }

  if (attempts < MAX_ATTEMPTS) {
    log(`${line}, retrying ${attempts + 1}/${MAX_ATTEMPTS}`);
    await wait(1000);
    return retry();
  }

  log(line);
  return { error: normalized, aborted: false, complete: false };
}

async function fetchTrpcJson (url, { secretKey, signal, path, heavy = false }) {
  const headers = getHeaders();

  try {
    const response = await scheduledText(url, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` },
      signal
    }, { heavy, signal });
    const parsed = await parseTrpcFetchResponse(response, { url });
    if (parsed?.error && response.retrySpent) parsed.error.retryable = false;
    return parsed;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return {
      error: normalizeCivitaiError({
        error: {
          message: error.message,
          data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path }
        }
      }, { httpStatus: 500, url })
    };
  }
}

export async function getGenerations ({cursor, tags, secretKey, signal }) {
  const url = getGenerationsUrl(cursor, tags);
  return fetchTrpcJson(url, { secretKey, signal, path: 'orchestrator.queryGeneratedImages' });
}

/**
 * Raw orchestrator workflow by id (the generation id). Unlike
 * `queryGeneratedImages`, this is not run through `formatStep` /
 * `normalizeStepOutput`, so ACE simple-mode `chatCompletion.output.parsed`
 * is still present while the job is within the ~30-day retention window.
 * 404 after expiry is terminal — callers record it on the fetch-miss store.
 * Input `{ workflowId: string }`. `TokenScope.AIServicesRead`.
 */
export function workflowFetchUrl (workflowId) {
  const id = workflowId == null ? '' : String(workflowId);
  if (!id) return '';
  const inputQuery = encodeURIComponent(JSON.stringify({ json: { workflowId: id } }));
  return `${endpoints().API_GET_WORKFLOW}?input=${inputQuery}`;
}

export async function getWorkflow ({ workflowId, secretKey, signal } = {}) {
  const url = workflowFetchUrl(workflowId);
  if (!url) {
    return { error: { message: 'Missing workflowId' } };
  }
  const body = await fetchTrpcJson(url, { secretKey, signal, path: 'orchestrator.getWorkflow' });
  if (body?.error) return body;
  const json = unwrapTrpcData(body);
  if (json && typeof json === 'object' && !Array.isArray(json)) return json;
  return { error: { message: 'Unexpected orchestrator.getWorkflow shape', url } };
}

export async function getAllRequests (options, iterator) {
  const { secretKey, cursor, previousCursor, tags, attempts = 0, log = console.log, signal } = options;
  const report = { aborted: false, complete: false };

  // Earliest generation reached
  if (cursor && cursor === previousCursor) {
    report.complete = true;
    return report;
  }

  const url = getGenerationsUrl(cursor, tags);
  const data = await getGenerations({ cursor, tags, secretKey, signal });

  if (data?.error) {
    const err = normalizeCivitaiError(data.error, { url });
    if (err.httpStatus === 400 && generationTake && !options.takeFallback) {
      generationTake = 0;
      return getAllRequests({ ...options, takeFallback: true }, iterator);
    }
    return paginateOnError(err, options, () => getAllRequests({ ...options, attempts: attempts + 1 }, iterator));
  }

  const parsed = readTrpcJson(data);
  if (!parsed) {
    const err = missingSuccessEnvelope(data, { url });
    log(`API error: ${formatApiError(err)}`);
    report.error = err;
    return report;
  }

  const { items, nextCursor } = parsed;

  if (typeof iterator === 'function') {
    const result = await iterator(toIteratorPayload({ items, nextCursor }), { cursor, previousCursor, nextCursor });

    // Callback returned `false`, exit
    if (result === false) {
      return false;
    }
  }

  if (nextCursor) {
    return await getAllRequests({ ...options, cursor: nextCursor, previousCursor: cursor }, iterator);
  }

  return false;
}


export async function getMe ({ secretKey }) {
  const { API_ME } = endpoints();
  const headers = getHeaders();

  try {
    const response = await scheduledText(API_ME, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` }
    });
    return await response.json();
  }

  catch (error) {
    return errorResponse({ httpStatus: 500, path: 'me', message: error.message, url: API_ME });
  }
}

// Fetches the authenticated user via tRPC `auth.getUser` on civitai.com.
// The handler returns `ctx.user` — the same SessionUser shape the site uses
// internally, including the alt-domain eligibility flag, `browsingLevel`,
// `tier`, etc.
//
// Returns the user object on success, or `null` on any error, non-200, or
// when the response does not contain a user (logged out / invalid key).
export async function getCivitaiUser ({ secretKey }) {
  if (!secretKey) return null;

  // tRPC accepts an empty `input` for void procedures, or an explicit
  // `{"json":null}`. Omitting `input` is the simplest form and is what the
  // site uses for this procedure.
  const headers = getHeaders({ forceDomain: AUTH_GET_USER_DOMAIN });

  try {
    const response = await scheduledText(AUTH_GET_USER_URL, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` }
    });

    if (!response.ok) return null;

    const body = await response.json();

    if (body && body.error) return null;

    const user = body?.result?.data?.json;
    if (!user) return null;

    return user;
  }

  catch (ignoreErr) {
    return null;
  }
}

async function getImages ({ secretKey, limit = 1 }) {
  const url = `${endpoints().API_IMAGES}?limit=${limit}`;
  const headers = getHeaders();

  try {
    const response = await scheduledText(url, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` }
    }, { heavy: true });
    return await response.json();
  }

  catch (ignoreErr) {
    return { items: [] };
  }
}

/**
 * Returns the Civitai Cloudflare Images CDN base URL, resolved lazily from the
 * REST API on first call and cached for the lifetime of the process.
 * Falls back to a known-good constant if the API call fails.
 */
export async function getCivitaiImageBase ({ secretKey }) {
  if (_imageCdnBase) return _imageCdnBase;

  const data = await getImages({ secretKey });
  const firstUrl = data?.items?.[0]?.url;

  if (firstUrl && firstUrl.startsWith('http')) {
    // URL shape: https://image.civitai.com/{accountHash}/{uuid}/...
    const parts = firstUrl.split('/');
    _imageCdnBase = `${parts[0]}//${parts[2]}/${parts[3]}`;
  } else {
    _imageCdnBase = FALLBACK_IMAGE_CDN_BASE;
  }

  return _imageCdnBase;
}

function getPostsUrl (username, cursor, { draftOnly = false, scheduled = false } = {}) {
  const json = { username, limit: 200, sort: 'Newest', period: 'AllTime', cursor };

  // Phase 5c: `draftOnly` makes post.getInfinite return ONLY the user's drafts
  // (`publishedAt: null`); the service then date-ranges on `createdAt` rather
  // than `publishedAt` (see internal/civitai-source-reference.md → Post.publishedAt).
  // Only attach the key when requested so the published-post request shape is
  // byte-for-byte what it was before this phase.
  if (draftOnly) json.draftOnly = true;

  // Phase 5c2: in the OWNER-request branch (post.service.ts:255-285), pairing
  // `draftOnly:true` with `scheduled:true` widens the filter to
  // `publishedAt IS NULL OR publishedAt > NOW()` — drafts AND scheduled posts
  // together. Only attach `scheduled` when set so the published-post request
  // shape (no params) is unchanged.
  if (scheduled) json.scheduled = true;

  const inputParams = { json };
  const inputQuery = encodeURIComponent(JSON.stringify(inputParams));
  return `${endpoints().API_POSTS}?input=${inputQuery}`;
}

export async function getPosts ({ username, cursor, secretKey, signal, draftOnly = false, scheduled = false }) {
  const url = getPostsUrl(username, cursor, { draftOnly, scheduled });
  return fetchTrpcJson(url, { secretKey, signal, path: 'post.getInfinite' });
}

// Newest published images for this account. sortAt puts a new image row first
// even when its post is old. The search index can lag a new publish; the post
// listing is the timely source. This feed is the backstop for an older post.
export async function getImageFeed ({ username, cursor, secretKey, signal, limit = 200 } = {}) {
  const json = { username, limit, sort: 'Newest', period: 'AllTime' };
  if (cursor != null) json.cursor = cursor;
  const inputQuery = encodeURIComponent(JSON.stringify({ json }));
  const url = `${endpoints().API_IMAGE_INFINITE}?input=${inputQuery}`;
  return fetchTrpcJson(url, { secretKey, signal, path: 'image.getInfinite', heavy: true });
}

export async function getPost ({ id, secretKey, signal }) {
  const inputQuery = encodeURIComponent(JSON.stringify({ json: { id } }));
  const url = `${endpoints().API_POST_GET}?input=${inputQuery}`;
  const headers = getHeaders();

  try {
    const response = await scheduledText(url, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` },
      signal
    }, { signal });
    return await response.json();
  }

  catch (error) {
    return errorResponse({ httpStatus: 500, path: 'post.get', message: error.message, url });
  }
}

// Owner editor read. Uncapped images, description, and post tags.
// A non-200 is an error object so the caller can continue the walk.
export async function getPostEdit ({ id, secretKey, signal }) {
  const inputQuery = encodeURIComponent(JSON.stringify({ json: { id } }));
  const url = `${endpoints().API_POST_EDIT}?input=${inputQuery}`;
  const headers = getHeaders();

  try {
    const response = await scheduledText(url, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` },
      signal
    }, { signal });

    if (!response.ok) {
      return { error: { httpStatus: response.status, message: `HTTP ${response.status}` } };
    }

    const body = await response.json();
    if (body?.error) return { error: body.error };
    return body;
  }

  catch (error) {
    return errorResponse({ httpStatus: 500, path: 'post.getEdit', message: error.message, url });
  }
}

function unwrapTrpcData (body) {
  return body?.result?.data?.json;
}

// Own-corpus list. The procedure takes no input and returns a JSON array
// (not `{ items, nextCursor }`). Do not run this through readTrpcJson.
export async function getMyProjects ({ secretKey, signal } = {}) {
  const url = endpoints().API_COMICS_MY_PROJECTS;
  const body = await fetchTrpcJson(url, { secretKey, signal, path: 'comics.getMyProjects' });
  if (body?.error) return body;
  const json = unwrapTrpcData(body);
  if (Array.isArray(json)) return json;
  return { error: { message: 'Unexpected comics.getMyProjects shape', url } };
}

export async function getProjectShell ({ id, secretKey, signal } = {}) {
  const inputQuery = encodeURIComponent(JSON.stringify({ json: { id } }));
  const url = `${endpoints().API_COMICS_PROJECT_SHELL}?input=${inputQuery}`;
  const body = await fetchTrpcJson(url, { secretKey, signal, path: 'comics.getProjectShell' });
  if (body?.error) return body;
  const json = unwrapTrpcData(body);
  if (json && typeof json === 'object' && !Array.isArray(json)) return json;
  return { error: { message: 'Unexpected comics.getProjectShell shape', url } };
}

export function model3dInfiniteInput (username, cursor, { status, includeDrafts, sort } = {}) {
  const json = { username, limit: 100, cursor };
  if (status) json.status = status;
  if (includeDrafts === true) json.includeDrafts = true;
  if (sort) json.sort = sort;
  return json;
}

function model3dProcedureUrl (endpoint, json) {
  const inputQuery = encodeURIComponent(JSON.stringify({ json }));
  return `${endpoint}?input=${inputQuery}`;
}

export function getModel3dsUrl (username, cursor, pass = {}) {
  return model3dProcedureUrl(
    endpoints().API_MODEL3D_INFINITE,
    model3dInfiniteInput(username, cursor, pass)
  );
}

export async function getModel3ds ({ username, cursor, secretKey, signal, status, includeDrafts, sort } = {}) {
  const url = getModel3dsUrl(username, cursor, { status, includeDrafts, sort });
  return fetchTrpcJson(url, { secretKey, signal, path: 'model3d.getInfinite' });
}

export async function getModel3d ({ id, secretKey, signal } = {}) {
  const url = model3dProcedureUrl(endpoints().API_MODEL3D_GET, { id: Number(id) });
  const body = await fetchTrpcJson(url, { secretKey, signal, path: 'model3d.getById' });
  if (body?.error) return body;
  const json = unwrapTrpcData(body);
  if (json && typeof json === 'object' && !Array.isArray(json)) return json;
  return { error: { message: 'Unexpected model3d.getById shape', url } };
}

export async function getModel3dByPostId ({ postId, secretKey, signal } = {}) {
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const url = model3dProcedureUrl(endpoints().API_MODEL3D_BY_POST, { postId: id });
  const body = await fetchTrpcJson(url, { secretKey, signal, path: 'model3d.getByPostId' });
  if (body?.error) return body;
  const json = unwrapTrpcData(body);
  if (json == null) return null;
  if (json && typeof json === 'object' && !Array.isArray(json) && json.id != null) return json;
  return { error: { message: 'Unexpected model3d.getByPostId shape', url } };
}

export async function getModel3dFiles ({ id, secretKey, signal } = {}) {
  const url = model3dProcedureUrl(endpoints().API_MODEL3D_FILES, { id: Number(id) });
  const body = await fetchTrpcJson(url, { secretKey, signal, path: 'model3d.getFiles' });
  if (body?.error) return body;
  const json = unwrapTrpcData(body);
  if (json && typeof json === 'object' && !Array.isArray(json)) return json;
  return { error: { message: 'Unexpected model3d.getFiles shape', url } };
}

export async function getChapter ({ projectId, chapterPosition, secretKey, signal } = {}) {
  const inputQuery = encodeURIComponent(JSON.stringify({ json: { projectId, chapterPosition } }));
  const url = `${endpoints().API_COMICS_CHAPTER}?input=${inputQuery}`;
  const body = await fetchTrpcJson(url, { secretKey, signal, path: 'comics.getChapter' });
  if (body?.error) return body;
  const json = unwrapTrpcData(body);
  if (json && typeof json === 'object' && !Array.isArray(json)) return json;
  return { error: { message: 'Unexpected comics.getChapter shape', url } };
}

/**
 * Site-parity generation parameters for one Image id. Same procedure the
 * Civitai website uses (`ImageGenerationData` / the post info popover /
 * `/images/[imageId]`). Input `{ id: number }`. `hideMeta` omits `meta`.
 * Sibling `resources[]` are resolved names from `imageResourcesCache`.
 *
 * REST `GET /api/v1/images` is not this path: `withMeta` defaults false and
 * the feed is PG-only unless a browsing-level query flag is passed. CDN base
 * discovery still uses `getImages` (`limit=1`).
 */
export async function getImageGenerationData ({ id, secretKey, signal } = {}) {
  const inputQuery = encodeURIComponent(JSON.stringify({ json: { id: Number(id) } }));
  const url = `${endpoints().API_IMAGE_GET_GENERATION_DATA}?input=${inputQuery}`;
  const body = await fetchTrpcJson(url, { secretKey, signal, path: 'image.getGenerationData' });
  if (body?.error) return body;
  const json = unwrapTrpcData(body);
  if (json && typeof json === 'object' && !Array.isArray(json)) return json;
  return { error: { message: 'Unexpected image.getGenerationData shape', url } };
}

export async function getAllPostRequests (options, iterator) {
  const { secretKey, username, cursor, previousCursor, attempts = 0, log = console.log, signal, draftOnly = false, scheduled = false } = options;
  const report = { aborted: false, complete: false };

  if (cursor && cursor === previousCursor) {
    report.complete = true;
    return report;
  }

  const url = getPostsUrl(username, cursor, { draftOnly, scheduled });
  const data = await getPosts({ username, cursor, secretKey, signal, draftOnly, scheduled });

  if (data?.error) {
    const err = normalizeCivitaiError(data.error, { url });
    return paginateOnError(err, options, () => getAllPostRequests({ ...options, attempts: attempts + 1 }, iterator));
  }

  const parsed = readTrpcJson(data);
  if (!parsed) {
    const err = missingSuccessEnvelope(data, { url });
    log(`API error: ${formatApiError(err)}`);
    report.error = err;
    return report;
  }

  const { items, nextCursor } = parsed;

  if (typeof iterator === 'function') {
    const result = await iterator(toIteratorPayload({ items, nextCursor }), { cursor, previousCursor, nextCursor });

    if (result === false) {
      return false;
    }
  }

  if (nextCursor) {
    return await getAllPostRequests({ ...options, cursor: nextCursor, previousCursor: cursor }, iterator);
  }

  return false;
}

// Integer Content-Length when the body is not content-encoded. A gzip
// Content-Length is the compressed size, so the caller must not compare it
// to bytes written after decompression. Absent or unparsable → null, and a
// clean stream end is the completion signal.
function declaredByteLength (response) {
  const encoding = response.headers?.get?.('content-encoding');
  if (encoding && String(encoding).toLowerCase() !== 'identity') return null;
  const raw = response.headers?.get?.('content-length');
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

// Headers: Requirement is
// "Referer": "https://<civitai-host>" or path of domain.
// Returns { ok, status, body, contentLength }. Throws on abort.
// A non-200 is ok:false — a removed blob, not a short body. The scheduler
// already retried rate limits, busy sheds, and transport failures.
// No total deadline: an idle watch in mediaDownload.mjs aborts a stall.
export async function fetchCivitaiImage (url, { signal } = {}) {
  if (signal?.aborted) {
    throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
  }

  const headers = getHeaders();
  const response = await scheduledStream(url, {
    headers: { ...headers.sharedHeaders, ...headers.imageHeaders },
    signal
  }, { lane: 'media', signal });

  if (!response.ok) {
    return { ok: false, status: response.status, body: null, contentLength: null };
  }

  const contentLength = declaredByteLength(response);
  return { ok: true, status: 200, body: response.body, contentLength };
}

export async function fetchModel (modelId) {
  const url = `${endpoints().API_MODELS}/${modelId}`;

  try {
    const response = await scheduledText(url);
    const data = await response.json();
    return data;
  }

  catch (error) {
    return errorResponse({
      httpStatus: 500,
      path: 'models',
      message: error.message,
      url,
      request: {
        modelId
      }
    });
  }
}

/**
 * Map a tRPC `modelVersion.getById` payload to the REST-shaped object the
 * model-version cache and Explorer label helpers expect (`data.model.name`,
 * `data.name`, …). Exported for unit tests.
 *
 * @param {object|null|undefined} raw — `result.data.json` from tRPC.
 * @returns {object|null}
 */
export function normalizeTrpcModelVersion (raw) {
  if (!raw || typeof raw !== 'object') return null;

  const model = raw.model && typeof raw.model === 'object' ? raw.model : {};
  const modelId = model.id ?? raw.modelId ?? null;

  return {
    id: raw.id,
    name: raw.name,
    modelId,
    baseModel: raw.baseModel ?? null,
    baseModelType: raw.baseModelType ?? null,
    description: raw.description ?? null,
    trainedWords: Array.isArray(raw.trainedWords) ? raw.trainedWords : [],
    status: raw.status ?? null,
    availability: raw.availability ?? null,
    usageControl: raw.usageControl ?? null,
    uploadType: raw.uploadType ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    images: Array.isArray(raw.images) ? raw.images : [],
    files: Array.isArray(raw.files) ? raw.files : [],
    stats: raw.stats ?? { downloadCount: 0, thumbsUpCount: 0 },
    model: {
      id: modelId,
      name: model.name ?? null,
      type: model.type ?? null,
      [WIRE.modelFlag]: modelFlagOf(model),
      poi: model.poi,
      status: model.status,
      availability: model.availability,
      uploadType: model.uploadType
    },
    canGenerate: raw.canGenerate,
    generationCoverage: raw.generationCoverage
  };
}

/**
 * Fetch a single model version via tRPC `modelVersion.getById`.
 *
 * @returns {object} REST-shaped body, `{ notFound: true }`, or `errorResponse`.
 */
export async function getModelVersionTrpc ({ id, secretKey, signal } = {}) {
  const inputQuery = encodeURIComponent(JSON.stringify({ json: { id: Number(id) } }));
  const url = `${endpoints().API_MODEL_VERSION_GET_BY_ID}?input=${inputQuery}`;
  const headers = getHeaders();
  const requestHeaders = { ...headers.sharedHeaders, ...headers.jsonHeaders };
  if (secretKey) requestHeaders.Authorization = `Bearer ${secretKey}`;

  try {
    const response = await scheduledText(url, { headers: requestHeaders, signal }, { signal });

    if (response.status === 404) {
      return { notFound: true, status: 404, url };
    }

    if (!response.ok) {
      return errorResponse({
        httpStatus: response.status,
        path: 'modelVersion.getById',
        message: `HTTP ${response.status}`,
        url
      });
    }

    const body = await response.json();
    if (body?.error) {
      const httpStatus = body.error?.json?.data?.httpStatus ?? 500;
      return errorResponse({
        httpStatus,
        path: 'modelVersion.getById',
        message: body.error?.json?.message ?? 'tRPC error',
        url
      });
    }

    const raw = body?.result?.data?.json;
    const normalized = normalizeTrpcModelVersion(raw);
    if (!normalized || normalized.name == null) {
      return { notFound: true, status: 200, url };
    }

    return normalized;
  }

  catch (error) {
    return errorResponse({
      httpStatus: 500,
      path: 'modelVersion.getById',
      message: error.message,
      url,
      request: { id }
    });
  }
}

/**
 * Unified model-version resolver: REST first, tRPC fallback on 404.
 *
 * Used by `src/modelVersionCache.mjs` as the default fetcher. Policy and
 * procedure contracts: `docs/guides/civitai-sync/api-contract.md` → Model
 * version resolution.
 *
 * Optional `fetchRest` / `fetchTrpc` overrides exist for unit tests.
 */
export async function resolveModelVersion ({
  id,
  secretKey,
  signal,
  fetchRest = getModelVersion,
  fetchTrpc = getModelVersionTrpc
} = {}) {
  const rest = await fetchRest({ id, secretKey, signal });
  if (rest && !rest.notFound && !rest.error) return rest;
  if (rest?.error) return rest;

  const trpc = await fetchTrpc({ id, secretKey, signal });
  if (trpc && !trpc.notFound && !trpc.error) return trpc;
  if (trpc?.error) return trpc;

  return rest?.notFound ? rest : (trpc ?? { notFound: true, status: 404 });
}

/**
 * Fetch a single model version's metadata via the public REST API only.
 *
 * Endpoint: `GET /api/v1/model-versions/{id}`. Prefer `resolveModelVersion`
 * for cache population — it falls back to tRPC when REST returns 404 for
 * file-less `ExternalGeneration` versions.
 *
 * Returns:
 *   - The full response body when HTTP 200.
 *   - `{ notFound: true, status, url }` when HTTP 404.
 *   - An `errorResponse(...)`-shaped object on network / non-200 errors.
 */
export async function getModelVersion ({ id, secretKey, signal } = {}) {
  const url = `${endpoints().API_MODEL_VERSIONS}/${id}`;
  const headers = getHeaders();
  const requestHeaders = { ...headers.sharedHeaders, ...headers.jsonHeaders };
  if (secretKey) requestHeaders.Authorization = `Bearer ${secretKey}`;

  try {
    const response = await scheduledText(url, { headers: requestHeaders, signal }, { signal });

    if (response.status === 404) {
      return { notFound: true, status: 404, url };
    }

    if (!response.ok) {
      return errorResponse({
        httpStatus: response.status,
        path: 'model-versions',
        message: `HTTP ${response.status}`,
        url
      });
    }

    return await response.json();
  }

  catch (error) {
    return errorResponse({
      httpStatus: 500,
      path: 'model-versions',
      message: error.message,
      url,
      request: { id }
    });
  }
}

/**
 * Resolve a single content tag's human-readable name from its numeric id.
 *
 * Endpoint: tRPC `tag.getById` (`GET /api/trpc/tag.getById?input=<JSON>`),
 * a `publicProcedure` in `civitai-src/src/server/routers/tag.router.ts`
 * whose service (`getTag` in `tag.service.ts`) selects `{ id, name, type }`.
 * Post-image content tags arrive from `post.getInfinite` as numeric
 * `tagIds` only (see api-contract.md → "Note on tags"); this is how the
 * per-account tag-name cache (`src/tagCache.mjs`) turns those ids into the
 * names the Explorer's `tag=` filter matches on.
 *
 * Returns:
 *   - `{ id, name, type }` when the tag resolves (HTTP 200, non-null json).
 *   - `{ notFound: true, ... }` when the tag id has no record (json === null)
 *     or HTTP 404. The cache treats this as "leave unresolved" — no
 *     tombstone (tag deletion is benign; the UI falls back to `tag-<id>`).
 *   - An `errorResponse(...)`-shaped object on network / non-200 errors.
 *
 * Authentication: a Bearer token is attached when `secretKey` is provided.
 * The procedure is public, so an anonymous request also resolves public
 * tags; the key only matters for moderation-gated tags.
 */
export async function getTag ({ id, secretKey, signal } = {}) {
  const inputQuery = encodeURIComponent(JSON.stringify({ json: { id: Number(id) } }));
  const url = `${endpoints().API_TAG_GET_BY_ID}?input=${inputQuery}`;
  const headers = getHeaders();
  const requestHeaders = { ...headers.sharedHeaders, ...headers.jsonHeaders };
  if (secretKey) requestHeaders.Authorization = `Bearer ${secretKey}`;

  try {
    const response = await scheduledText(url, { headers: requestHeaders, signal }, { signal });

    if (response.status === 404) {
      return { notFound: true, status: 404, url };
    }

    if (!response.ok) {
      return errorResponse({
        httpStatus: response.status,
        path: 'tag.getById',
        message: `HTTP ${response.status}`,
        url
      });
    }

    const body = await response.json();
    if (body && body.error) {
      return errorResponse({ httpStatus: 500, path: 'tag.getById', message: 'tRPC error', url });
    }
    const tag = body?.result?.data?.json;
    // `findUnique` returns null when the id is unknown — surface as notFound
    // so the cache leaves it unresolved rather than caching a bad record.
    if (!tag || typeof tag.name !== 'string') {
      return { notFound: true, status: 200, url };
    }
    return { id: tag.id ?? Number(id), name: tag.name, type: tag.type ?? null };
  }

  catch (error) {
    return errorResponse({
      httpStatus: 500,
      path: 'tag.getById',
      message: error.message,
      url,
      request: { id }
    });
  }
}

export async function fetchFile (url, filepath, { secretKey }) {
  const headers = {};

  if (secretKey) {
    headers['Authorization'] = `Bearer ${secretKey}`;
  }

  try {
    const response = await scheduledStream(url, { headers }, { lane: 'media' });

    if (response.status !== 200) {
      console.error('Unexpected software fetch response', response);
      return false;
    }

    // e.g. error page response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.startsWith('text/plain')) {
      if (response.body && typeof response.body.cancel === 'function') {
        try { await response.body.cancel(); } catch { /* already closed */ }
      }
      return false;
    }

    const fileStream = fs.createWriteStream(filepath, { flags: 'wx' });

    await pipeline(Readable.fromWeb(response.body), fileStream);
    return true;
  }

  catch (error) {
    return new Error(`Error fetching software from ${url} to ${filepath}, ${error.message}`);
  }
}

/**
 * One page of `GET /api/v1/models?username=`. `WIRE.modelFlag=true` is the
 * query the handler uses to widen browsing level to the full bitfield.
 * `availability` is set only for the Private pass. Cursor pages until
 * `metadata.nextCursor` is empty. Throws on non-200.
 *
 * @returns {Promise<{ items: object[], nextCursor: string }>}
 */
export async function getModelsByUsernamePage ({ username, cursor, secretKey, signal, availability } = {}) {
  const url = new URL(endpoints().API_MODELS);
  url.searchParams.set('limit', '100');
  url.searchParams.set('username', String(username || ''));
  url.searchParams.set(WIRE.modelFlag, 'true');
  if (availability) url.searchParams.set('availability', String(availability));
  if (cursor) url.searchParams.set('cursor', String(cursor));

  const headers = getHeaders();
  const requestHeaders = { ...headers.sharedHeaders, ...headers.jsonHeaders };
  if (secretKey) requestHeaders.Authorization = `Bearer ${secretKey}`;

  const response = await scheduledText(url, { headers: requestHeaders, signal }, { signal });
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.httpStatus = response.status;
    throw err;
  }
  const body = await response.json();
  const items = Array.isArray(body?.items) ? body.items : [];
  const nextCursor = body?.metadata?.nextCursor ? String(body.metadata.nextCursor) : '';
  return { items, nextCursor };
}
