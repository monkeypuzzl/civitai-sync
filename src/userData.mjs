/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// User-identity layer for civitai-sync.
//
// A single entry point (`getCivitaiUserData`) talks to Civitai to learn who
// the stored API key belongs to and whether the user is eligible to pick an
// alternative domain. Two wrappers gate the call:
//
//   fillIfMissing  — lazy: runs only when username or allowAltDomain is missing.
//                    Used at CLI start-up and inside resolveUsername (posts flow).
//   refreshOnce    — forced refresh at most once per process lifetime.
//                    Used on the first CLI Settings entry and the Explorer
//                    Settings mount (via POST /api/user/refresh).
//
// Both functions no-op when no secretKey is available (first run, locked
// encrypted key). Neither throws on network / auth errors; in those cases
// existing CONFIG values are preserved (see H3 / #9).

import { CONFIG } from './cli.mjs';
import { setConfig, setConfigParam } from './config.mjs';
import { getCivitaiUser, getMe } from './civitaiApi.mjs';

let hasRefreshedThisSession = false;
let inflight = null;

// Reset the session-scoped refresh flag. Called on API key change so the new
// key triggers a fresh auth.getUser the next time Settings is entered.
export function resetUserDataSession () {
  hasRefreshedThisSession = false;
  inflight = null;
}

function isValidUser (user) {
  return (
    user
    && typeof user.username === 'string'
    && user.username.length > 0
    && typeof user.showNsfw === 'boolean'
  );
}

// Fetch the current user via auth.getUser (pinned to civitai.com) and persist
// the fields civitai-sync uses. Falls back to /api/v1/me for `username` only
// when auth.getUser does not return a valid user.
//
// Known limitation (H3 + N1): the `/api/v1/me` fallback response does not
// include `showNsfw`, so `allowAltDomain` is NOT updated on that path. The
// next successful auth.getUser call will fill it in.
//
// Note: Civitai caches the SessionUser server-side for up to 4 hours (see
// getSessionUser in the Civitai source). Recent changes to showNsfw made in
// the browser may take a few minutes to propagate to this call.
export async function getCivitaiUserData ({ secretKey }) {
  if (!secretKey) return null;

  const user = await getCivitaiUser({ secretKey });

  if (isValidUser(user)) {
    await setConfig({
      username: user.username,
      allowAltDomain: user.showNsfw
    });

    return { username: user.username, allowAltDomain: user.showNsfw };
  }

  // Fallback: /api/v1/me only returns `username` (no `showNsfw`). Writes
  // username if present but leaves `allowAltDomain` untouched.
  const me = await getMe({ secretKey });

  if (me && typeof me.username === 'string' && me.username.length > 0) {
    await setConfigParam('username', me.username);
    return { username: me.username, allowAltDomain: CONFIG.allowAltDomain };
  }

  return null;
}

// Call getCivitaiUserData only when required fields are missing. Dedups
// concurrent callers via the inflight promise.
export async function fillIfMissing ({ secretKey }) {
  if (!secretKey) return null;
  if (CONFIG.username && CONFIG.allowAltDomain !== undefined) return null;

  if (inflight) return inflight;

  inflight = getCivitaiUserData({ secretKey })
    .finally(() => { inflight = null; });

  return inflight;
}

// Force a single refresh per process. Subsequent calls are no-ops until the
// flag is reset (on API key change). Dedups concurrent callers via inflight.
export async function refreshOnce ({ secretKey }) {
  if (!secretKey) return null;
  if (hasRefreshedThisSession) return null;

  if (inflight) return inflight;

  hasRefreshedThisSession = true;
  inflight = getCivitaiUserData({ secretKey })
    .finally(() => { inflight = null; });

  return inflight;
}
