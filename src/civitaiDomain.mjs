// Civitai domain layer.
//
// civitai-sync supports multiple Civitai hostnames. `civitai.com` is the
// default public surface (smaller catalog in the new arrangement); alternative
// hostnames like `civitai.red` expose the full set. The user's ability to
// choose an alternative domain is gated on `CONFIG.allowAltDomain`, which is
// derived from `user.showNsfw` returned by `auth.getUser`.
//
// All callers that build API URLs, Referer headers, or informational links in
// the CLI/Explorer UI must route through `getCivitaiDomain()` so the effective
// domain is consistent.

import { CONFIG } from './cli.mjs';

export const CIVITAI_DOMAINS = ['civitai.com', 'civitai.red'];

// Effective domain used for API calls, the Referer header, and CLI/Explorer
// links. Falls back to the default domain when:
//   - allowAltDomain is anything other than `true` (including `undefined`,
//     which means we have not yet confirmed the user's eligibility), or
//   - the stored CONFIG.domain is not one of CIVITAI_DOMAINS.
export function getCivitaiDomain () {
  if (CONFIG && CONFIG.allowAltDomain === true && CIVITAI_DOMAINS.includes(CONFIG.domain)) {
    return CONFIG.domain;
  }

  return CIVITAI_DOMAINS[0];
}

// Build a full https URL at the current Civitai domain. `pathOrEmpty` may be
// an empty string or a path starting with `/`.
export function civitaiUrl (pathOrEmpty = '') {
  const path = pathOrEmpty || '';
  return `https://${getCivitaiDomain()}${path}`;
}

// Base URL for API requests, e.g. `${apiBase()}/trpc/auth.getUser`.
export function apiBase () {
  return `https://${getCivitaiDomain()}/api`;
}

// Referer used for all API requests except the host-pinned auth.getUser call.
// The path is currently fixed at `/generate`; varying per endpoint is a future
// refinement.
export function refererForApi () {
  return `https://${getCivitaiDomain()}/generate`;
}
