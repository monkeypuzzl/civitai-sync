import { wait } from './utils.mjs';
import headers from './headers.mjs';

const API_GET_REQUESTS = 'https://civitai.com/api/trpc/orchestrator.queryGeneratedImages';
// const API_GET_REQUESTS = 'https://civitai.com/api/trpc/generation.getRequests';
const dataRateLimit = 1000;

function getGenerationsUrl (cursor) {
  const inputParams = { json: { authed: true, cursor } };
  const inputQuery = encodeURIComponent(JSON.stringify(inputParams));
  const url = `${API_GET_REQUESTS}?input=${inputQuery}`;

  return url;
}

function errorResponse ({ httpStatus = 0, path = '' }) {
  let message = '';
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

export async function getGenerations (cursor, { secretKey }) {
  const url = getGenerationsUrl(cursor);

  const response = await fetch(url, {
    headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, Authorization: `Bearer ${secretKey}` }
  });

  let data;

  try {
    data = await response.json();
  }

  catch (error) {
    return errorResponse({
      httpStatus: 500,
      path: 'generation.getRequests'
    });
  }

  return data;
}

export async function getAllRequests (progressFn, options, cursor, _previousCursor) {
  // First generation reached
  if (cursor && cursor === _previousCursor) {
    return false;
  }

  const data = await getGenerations(cursor, options);
  const progressResult =  await progressFn(data);

  // Progress callback returned `false`, exit
  if (progressResult === false) {
    return false;
  }

  const nextCursor = data.result.data.json.nextCursor;
  
  if (nextCursor) {
    await wait(dataRateLimit);
    return await getAllRequests(progressFn, options, nextCursor, cursor);
  }

  return false;
}

// Headers: The only requirement is
// "Referer": "https://civitai.com" or a path at the domain
export async function fetchCivitaiImage (url) {
  const response = await fetch(url, {
    headers: { ...headers.sharedHeaders, ...headers.imageHeaders }
  });

  if (response.status === 200) {
    return response.body;
  }

  return false;
}
