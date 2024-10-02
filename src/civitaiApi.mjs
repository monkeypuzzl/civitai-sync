import fs from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { wait } from './utils.mjs';
import headers from './headers.mjs';

const API_QUERY_GENERATED_IMAGES = 'https://civitai.com/api/trpc/orchestrator.queryGeneratedImages';
const API_MODELS = 'https://civitai.com/api/v1/models';
const DATA_RATE_LIMIT = 100;
const IMAGE_RATE_LIMIT = 100;
const MAX_ATTEMPTS = 10;

function getGenerationsUrl (cursor, tags = []) {
  const inputParams = { json: { authed: true, tags, cursor } };
  const inputQuery = encodeURIComponent(JSON.stringify(inputParams));
  const url = `${API_QUERY_GENERATED_IMAGES}?input=${inputQuery}`;

  return url;
}

function errorResponse ({ httpStatus = 0, path = '', message = '' }) {
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
      }
    }
  };
}

export async function getGenerations (cursor, tags, { secretKey }) {
  const url = getGenerationsUrl(cursor, tags);

  const response = await fetch(url, {
    headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` }
  });

  try {
    const data = await response.json();
    return data;
  }

  catch (error) {
    return errorResponse({
      httpStatus: 500,
      path: 'orchestrator.queryGeneratedImages',
      message: error.message
    });
  }
}

export async function getAllRequests (progressFn, options, cursor, tags, _previousCursor, _attempts = 0) {
  // First generation reached
  if (cursor && cursor === _previousCursor) {
    return false;
  }

  const data = await getGenerations(cursor, tags, options);

  if ('error' in data) {
    if (data.error.json.data.httpStatus === 500) {
      if (_attempts < MAX_ATTEMPTS) {
        await wait(1000);
        return await getAllRequests(progressFn, options, cursor, tags, _previousCursor, _attempts + 1);
      }
    }
  }

  const progressResult = await progressFn(data);

  // Progress callback returned `false`, exit
  if (progressResult === false) {
    return false;
  }

  const nextCursor = data.result.data.json.nextCursor;
  
  if (nextCursor) {
    await wait(DATA_RATE_LIMIT);
    return await getAllRequests(progressFn, options, nextCursor, tags, cursor);
  }

  return false;
}

// Headers: The only requirement is
// "Referer": "https://civitai.com" or a path at the domain

let previousFetch;

export async function fetchCivitaiImage (url) {
  let now = Date.now();

  if (previousFetch && (now - previousFetch) < IMAGE_RATE_LIMIT) {
    await wait(IMAGE_RATE_LIMIT - (now - previousFetch));
    now = Date.now();
  }

  previousFetch = now;

  const response = await fetch(url, {
    headers: { ...headers.sharedHeaders, ...headers.imageHeaders }
  });

  if (response.status === 200) {
    return response.body;
  }

  return false;
}

export async function getModel (modelId) {
  const url = `${API_MODELS}/${modelId}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  }

  catch (error) {
    return errorResponse({
      httpStatus: 500,
      path: 'getModel',
      message: error.message
    });
  }
}

export async function fetchFile (url, filepath, { secretKey }) {
  const headers = {};

  if (secretKey) {
    headers['Authorization'] = `Bearer ${secretKey}`;
  }

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

  try {
    const fileStream = fs.createWriteStream(filepath, { flags: 'wx' });

    await finished(Readable.fromWeb(response.body).pipe(fileStream));
    return true;
  }

  catch (error) {
    return new Error(`Error fetching software from ${url} to ${filepath}, ${error.message}`);
  }
}
