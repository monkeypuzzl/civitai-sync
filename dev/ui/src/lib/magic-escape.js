// Escape one level toward the origin list. Pure: no history, no DOM.
// Gallery return is activateOriginTab (navTabHref). Container grain opens
// this walk's container (c: slot), not sidebar membership.

import { originQuery } from './media-href.js';
import { formatUrl } from './url-state.js';

const ORIGIN_TABS = new Set(['generations', 'posts', 'comics', 'models']);
const CONTAINER_VIEWS = new Set(['generations', 'posts', 'comics', 'model3ds']);
const CONTAINER_GRAIN = new Set(['batch', 'post', 'comic']);

/**
 * Container id from a walk token `c:<containerId>:<ordinal>`.
 * The id is greedy; the ordinal is the trailing integer. `g:` tokens and
 * anything else return null.
 */
export function containerIdFromSlot (slot) {
  if (slot == null || slot === '') return null;
  const match = String(slot).match(/^c:(.*):(\d+)$/);
  if (!match || match[1] === '') return null;
  return match[1];
}

function asRoute (route) {
  if (route == null || typeof route !== 'object') {
    return { view: undefined, entityId: null, params: {} };
  }
  return {
    view: route.view,
    entityId: route.entityId == null || route.entityId === '' ? null : route.entityId,
    params: route.params || {}
  };
}

function containerHref (route, containerId) {
  const params = route.params || {};
  const scope = params.from || '';
  const view = scope === 'generations' || scope === 'posts' || scope === 'comics'
    ? scope
    : null;
  if (!view || !containerId) return '';
  const path = `/${view}/${containerId}`;
  return formatUrl({
    view,
    entityId: containerId,
    modelTrail: null,
    params: originQuery(params, null, { path })
  });
}

/**
 * @returns {{ action: 'none' } | { action: 'drop-used-in' } | { action: 'origin-tab', tab: string } | { action: 'container', href: string }}
 */
export function magicEscapeTarget ({ route, origin, mediaScope } = {}) {
  const r = asRoute(route);
  if (r.view !== 'media' && r.entityId == null) return { action: 'none' };

  if (CONTAINER_VIEWS.has(r.view) && r.entityId != null) {
    return { action: 'origin-tab', tab: r.view };
  }
  if (r.view === 'models' && r.entityId != null) {
    return { action: 'origin-tab', tab: 'models' };
  }
  if (r.view !== 'media') return { action: 'none' };

  if (r.params.usedIn === '1') return { action: 'drop-used-in' };

  const from = r.params.from || '';
  if (from === 'models' || mediaScope === 'models') {
    return { action: 'origin-tab', tab: 'models' };
  }
  if (from === 'imports') return { action: 'none' };

  const slot = (origin && origin.slot) || r.params.slot || '';
  const containerGrain = CONTAINER_GRAIN.has(r.params.granularity) || String(slot).startsWith('c:');
  if (containerGrain) {
    const scope = from || (origin && origin.scope) || mediaScope || '';
    const withScope = scope && scope !== from
      ? { ...r, params: { ...r.params, from: scope } }
      : r;
    const href = containerHref(withScope, containerIdFromSlot(slot));
    if (!href) return { action: 'none' };
    return { action: 'container', href };
  }

  const tab = from || mediaScope || (origin && origin.scope) || '';
  if (ORIGIN_TABS.has(tab)) return { action: 'origin-tab', tab };
  return { action: 'none' };
}
