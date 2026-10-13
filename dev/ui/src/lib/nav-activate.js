// Same push as clicking the highlighted origin tab: navTabHref plus
// authored params (drop keys the destination omitted) and history.state.focus.

import { pushState } from './router.js';
import { completeAuthoredParams, parseUrl } from './url-state.js';
import { navTabHref } from './nav-tabs.js';

export function activateOriginTab (tabId, route, { modelReturn, mediaScope, focus } = {}) {
  const r = route && typeof route === 'object'
    ? route
    : { view: undefined, entityId: null, params: {} };
  const href = navTabHref(tabId, r, { modelReturn, mediaScope });
  const parsed = parseUrl(href);
  const opts = focus != null ? { focus } : undefined;
  pushState({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: completeAuthoredParams(r.params, parsed.params)
  }, opts);
}
