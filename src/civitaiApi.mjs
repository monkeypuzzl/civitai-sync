/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { wait } from './utils.mjs';
import getHeaders from './headers.mjs';
import { apiBase } from './civitaiDomain.mjs';

// Endpoints are computed lazily from the current Civitai domain. Every call
// site reads the base at invocation time so a user-triggered domain change
// takes effect immediately for subsequent requests.
function endpoints () {
  const base = apiBase();
  return {
    API_QUERY_GENERATED_IMAGES: `${base}/trpc/orchestrator.queryGeneratedImages`,
    API_POSTS: `${base}/trpc/post.getInfinite`,
    API_POST_GET: `${base}/trpc/post.get`,
    API_ME: `${base}/v1/me`,
    API_IMAGES: `${base}/v1/images`,
    API_MODELS: `${base}/v1/models`
  };
}

// `auth.getUser` is intentionally pinned to civitai.com. The tRPC handler is
// host-agnostic: it returns the same SessionUser regardless of which Civitai
// host serves the request, so using a single stable host makes this call
// independent of the currently-selected CONFIG.domain.
const AUTH_GET_USER_URL = 'https://civitai.com/api/trpc/auth.getUser';
const AUTH_GET_USER_DOMAIN = 'civitai.com';

const DATA_RATE_LIMIT = 100;
const IMAGE_RATE_LIMIT = 100;
const MAX_ATTEMPTS = 10;

// Known-good fallback used if the resolution API call fails
const FALLBACK_IMAGE_CDN_BASE = 'https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA';
let _imageCdnBase = null;

function getGenerationsUrl (cursor, tags = []) {
  const inputParams = { json: { authed: true, tags: ["gen", ...tags], cursor } };
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

export async function getGenerations ({cursor, tags, secretKey, signal }) {
  const url = getGenerationsUrl(cursor, tags);
  const headers = getHeaders();

  try {
    const response = await fetch(url, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` },
      signal
    });
    return await response.json();
  }

  catch (error) {
    return errorResponse({
      httpStatus: 500,
      path: 'orchestrator.queryGeneratedImages',
      message: error.message,
      url,
      request: {
        cursor,
        tags
      }
    });
  }
}

export async function getAllRequests (options, iterator) {
  const { secretKey, cursor, previousCursor, tags, attempts = 0, log = console.log, signal } = options;
  const report = { aborted: false, complete: false };

  // Earliest generation reached
  if (cursor && cursor === previousCursor) {
    report.complete = true;
    return report;
  }

  const data = await getGenerations({ cursor, tags, secretKey, signal });

  if ('error' in data) {
    // if (data.error.json.data.httpStatus === 500) { }

    try {
      const { code, httpStatus } = data.error.json.data;
      log(`API error: ${code} (${httpStatus}), retrying...`);
    }

    catch (error) {
      log(`API error: ${error.message}, retrying...`);
    }

    if (attempts < MAX_ATTEMPTS) {
      await wait(1000);
      return await getAllRequests({ ...options, attempts: attempts + 1 }, iterator );
    }

    report.error = data.error;
    return report;
  }

  const nextCursor = data.result.data.json.nextCursor;

  if (typeof iterator === 'function') {
    const result = await iterator(data, { cursor, previousCursor, nextCursor });

    // Callback returned `false`, exit
    if (result === false) {
      return false;
    }
  }
  
  if (nextCursor) {
    await wait(DATA_RATE_LIMIT);
    return await getAllRequests({ ...options, cursor: nextCursor, previousCursor: cursor }, iterator);
  }

  return false;
}


export async function getMe ({ secretKey }) {
  const { API_ME } = endpoints();
  const headers = getHeaders();

  try {
    const response = await fetch(API_ME, {
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
// internally, including `showNsfw`, `browsingLevel`, `tier`, etc.
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
    const response = await fetch(AUTH_GET_USER_URL, {
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
    const response = await fetch(url, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` }
    });
    return await response.json();
  }

  catch (ignoreErr) {
    return { items: [] };
  }
}

export async function getPostImageMeta ({ postId, secretKey, signal }) {
  const url = `${endpoints().API_IMAGES}?postId=${postId}&limit=200`;
  const headers = getHeaders();

  try {
    const response = await fetch(url, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` },
      signal
    });
    const data = await response.json();
    return data?.items || [];
  }

  catch (ignoreErr) {
    return [];
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

function getPostsUrl (username, cursor) {
  const inputParams = { json: { username, limit: 100, sort: 'Newest', period: 'AllTime', cursor } };
  const inputQuery = encodeURIComponent(JSON.stringify(inputParams));
  return `${endpoints().API_POSTS}?input=${inputQuery}`;
}

export async function getPosts ({ username, cursor, secretKey, signal }) {
  const url = getPostsUrl(username, cursor);
  const headers = getHeaders();

  try {
    const response = await fetch(url, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` },
      signal
    });
    return await response.json();
  }

  catch (error) {
    return errorResponse({ httpStatus: 500, path: 'post.getInfinite', message: error.message, url });
  }
}

export async function getPost ({ id, secretKey, signal }) {
  const inputQuery = encodeURIComponent(JSON.stringify({ json: { id } }));
  const url = `${endpoints().API_POST_GET}?input=${inputQuery}`;
  const headers = getHeaders();

  try {
    const response = await fetch(url, {
      headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` },
      signal
    });
    return await response.json();
  }

  catch (error) {
    return errorResponse({ httpStatus: 500, path: 'post.get', message: error.message, url });
  }
}

export async function getAllPostRequests (options, iterator) {
  const { secretKey, username, cursor, previousCursor, attempts = 0, log = console.log, signal } = options;
  const report = { aborted: false, complete: false };

  if (cursor && cursor === previousCursor) {
    report.complete = true;
    return report;
  }

  const data = await getPosts({ username, cursor, secretKey, signal });

  if ('error' in data) {
    try {
      const { code, httpStatus } = data.error.json.data;
      log(`API error: ${code} (${httpStatus}), retrying...`);
    }

    catch (error) {
      log(`API error: ${error.message}, retrying...`);
    }

    if (attempts < MAX_ATTEMPTS) {
      await wait(1000);
      return await getAllPostRequests({ ...options, attempts: attempts + 1 }, iterator);
    }

    report.error = data.error;
    return report;
  }

  const nextCursor = data.result.data.json.nextCursor;

  if (typeof iterator === 'function') {
    const result = await iterator(data, { cursor, previousCursor, nextCursor });

    if (result === false) {
      return false;
    }
  }

  if (nextCursor) {
    await wait(DATA_RATE_LIMIT);
    return await getAllPostRequests({ ...options, cursor: nextCursor, previousCursor: cursor }, iterator);
  }

  return false;
}

let previousFetch;

// Headers: Requirement is
// "Referer": "https://<civitai-host>" or path of domain
export async function fetchCivitaiImage (url, { signal } = {}) {
  let now = Date.now();

  if (previousFetch && (now - previousFetch) < IMAGE_RATE_LIMIT) {
    await wait(IMAGE_RATE_LIMIT - (now - previousFetch));
    now = Date.now();
  }

  previousFetch = now;

  try {
    const timeoutSignal = AbortSignal.timeout(60000);
    const fetchSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const headers = getHeaders();

    const response = await fetch(url, {
      headers: { ...headers.sharedHeaders, ...headers.imageHeaders },
      signal: fetchSignal
    });

    if (response.status === 200) {
      return response.body;
    }
  }

  catch (ignoreErr) {
    return null;
  }

  return null;
}

export async function fetchModel (modelId) {
  const url = `${endpoints().API_MODELS}/${modelId}`;

  try {
    const response = await fetch(url);
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

export async function fetchFile (url, filepath, { secretKey }) {
  const headers = {};

  if (secretKey) {
    headers['Authorization'] = `Bearer ${secretKey}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (response.status !== 200) {
      console.error('Unexpected software fetch response', response);
      return false;
    }

    // e.g. error page response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.startsWith('text/plain')) {
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
