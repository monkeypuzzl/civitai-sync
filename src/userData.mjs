/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// User-identity layer for civitai-sync.
//
// A single entry point (`getCivitaiUserData`) talks to Civitai to learn who
// the stored API key belongs to and whether the user is eligible to pick an
// alternative domain. The first write of `allowAltDomain` also seeds
// `CONFIG.domain` (civitai.red when the SessionUser flag is true). Two
// wrappers gate the call:
//
//   fillIfMissing  — lazy: runs only when username or allowAltDomain is missing.
//                    Used at CLI start-up, after API-key save, and inside
//                    resolveUsername (posts flow). Callers must not await it
//                    on a paint path — a failing Civitai cannot block the CLI.
//   refreshOnce    — forced refresh at most once per process lifetime.
//                    Used on the first CLI Settings entry and the Explorer
//                    Settings mount (via POST /api/user/refresh).
//
// Both functions no-op when no secretKey is available (first run, locked
// encrypted key). Neither throws on network / auth errors; in those cases
// existing CONFIG values are preserved (see H3 / #9).

import { CONFIG } from './cli.mjs';
import { getCivitaiUser, getMe } from './civitaiApi.mjs';
import { altDomainEligibleOf } from './civitaiWire.mjs';
import { applyAccountIdentity, resetAccountIdentityMemory } from './accountIdentity.mjs';

let hasRefreshedThisSession = false;
let inflight = null;

// Reset the session-scoped refresh flag. Called on API key change so the new
// key triggers a fresh auth.getUser the next time Settings is entered.
export function resetUserDataSession () {
  hasRefreshedThisSession = false;
  inflight = null;
  resetAccountIdentityMemory();
}

function isValidUser (user) {
  return (
    user
    && typeof user.username === 'string'
    && user.username.length > 0
    && typeof altDomainEligibleOf(user) === 'boolean'
  );
}

// Fetch the current user via auth.getUser (pinned to civitai.com) and persist
// the fields civitai-sync uses. Falls back to /api/v1/me for `username` only
// when auth.getUser does not return a valid user.
//
// First write of `allowAltDomain` (absent / undefined — new config, upgraded
// config that never stored the field, or a key rotation that cleared it) also
// seeds `CONFIG.domain`: civitai.red when the SessionUser flag is true,
// otherwise civitai.com. Later refreshes update allowAltDomain from that flag
// but leave an already-chosen domain alone.
//
// Known limitation (H3 + N1): the `/api/v1/me` fallback response does not
// include the SessionUser flag, so `allowAltDomain` is NOT updated on that
// path. The next successful auth.getUser call will fill it in.
//
// Note: Civitai caches the SessionUser server-side for up to 4 hours (see
// getSessionUser in the Civitai source). Recent changes to the flag made in
// the browser may take a few minutes to propagate to this call.
function positiveId (value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function identityFromSession (user) {
  if (!isValidUser(user)) return null;
  const id = positiveId(user.id);
  if (!id) return null;
  return { id, username: user.username, eligible: altDomainEligibleOf(user) };
}

function identityFromMe (me) {
  if (!me || typeof me !== 'object' || me.error) return null;
  const id = positiveId(me.id);
  const username = typeof me.username === 'string' ? me.username : '';
  if (!id || !username) return null;
  return { id, username };
}

export async function getCivitaiUserData ({ secretKey }) {
  if (!secretKey) return null;

  const session = identityFromSession(await getCivitaiUser({ secretKey }));
  const identity = session || identityFromMe(await getMe({ secretKey }));
  if (!identity) return null;
  return applyAccountIdentity(identity);
}

// Call getCivitaiUserData only when required fields are missing. Dedups
// concurrent callers via the inflight promise.
export async function fillIfMissing ({ secretKey }) {
  if (!secretKey) return null;
  if (CONFIG.username && CONFIG.allowAltDomain !== undefined && positiveId(CONFIG.accountId)) return null;

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
