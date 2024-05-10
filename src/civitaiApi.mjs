import { wait } from './utils.mjs';
import headers from './headers.mjs';

const getGenerationsAPI =  `https://civitai.com/api/trpc/generation.getRequests`;
const dataRateLimit = 1000;

function getGenerationsUrl (cursor) {
  const inputParams = { json: { authed: true, cursor } };
  const inputQuery = encodeURIComponent(JSON.stringify(inputParams));
  const url = `${getGenerationsAPI}?input=${inputQuery}`;

  return url;
}

export async function getGenerations (cursor, { secretKey }) {
  const url = getGenerationsUrl(cursor);

  const response = await fetch(url, {
    headers: { ...headers.sharedHeaders, ...headers.jsonHeaders, cookie: `__Secure-civitai-token=${secretKey}` }
  });

  const data = await response.json();

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

export async function fetchCivitaiImage (url, secretKey) {
  const response = await fetch(url, {
    headers: { ...headers.sharedHeaders, ...headers.imageHeadersHeaders, cookie: `__Secure-civitai-token=${secretKey}` }
  });

  if (response.status === 200) {
    return response.body;
  }

  return false;
}
