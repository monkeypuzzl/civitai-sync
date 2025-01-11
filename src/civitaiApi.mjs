/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

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
  const inputParams = { json: { authed: true, tags: ["gen", ...tags], cursor } };
  const inputQuery = encodeURIComponent(JSON.stringify(inputParams));
  const url = `${API_QUERY_GENERATED_IMAGES}?input=${inputQuery}`;

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
      message: error.message,
      url,
      request: {
        cursor,
        tags
      }
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
      // if (data.error.json.data.code === 'INTERNAL_SERVER_ERROR') {
      //   if (data.error.json.message.startsWith('failed to extract generation resources')) {
      //     // console.error(`Missing generation data from the generation before "${cursor}". Skipping...`);

      //     // console.log('ERROR...', { data: JSON.stringify(data, null, 2), options, cursor, tags, _previousCursor, _attempts });
      //     const [prefix, suffix] = cursor.split('-');

      //     if (suffix.length !== 17) {
      //       console.error(`Unexpected generation cursor format "${cursor}".`);
      //       return false;
      //     }

      //     const year = suffix.slice(0, 4);
      //     const month = suffix.slice(4, 6);
      //     const day = suffix.slice(6, 8);
      //     const hour = suffix.slice(8, 10);
      //     const minutes = suffix.slice(10, 12);
      //     const seconds = suffix.slice(12, 14);
      //     const ms = suffix.slice(14, 17);
      //     const dateObj = new Date(`${year}-${month}-${day}T${hour}:${minutes}:${seconds}.${ms}Z`)
          
      //     dateObj.setUTCSeconds(dateObj.getUTCSeconds() -1);

      //     const nextCursor = `${prefix}-${dateObj.toISOString().replace(/\D/g, '')}`;
      //     console.log({ cursor, nextCursor });

      //     return await getAllRequests(progressFn, options, nextCursor, tags, _previousCursor);
      //   }
      // }

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


let previousFetch;

// Headers: The only requirement is
// "Referer": "https://civitai.com" or a path at the domain
export async function fetchCivitaiImage (url) {
  let now = Date.now();

  if (previousFetch && (now - previousFetch) < IMAGE_RATE_LIMIT) {
    await wait(IMAGE_RATE_LIMIT - (now - previousFetch));
    now = Date.now();
  }

  previousFetch = now;

  try {
    const response = await fetch(url, {
      headers: { ...headers.sharedHeaders, ...headers.imageHeaders }
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
  const url = `${API_MODELS}/${modelId}`;

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

    await finished(Readable.fromWeb(response.body).pipe(fileStream));
    return true;
  }

  catch (error) {
    return new Error(`Error fetching software from ${url} to ${filepath}, ${error.message}`);
  }
}
