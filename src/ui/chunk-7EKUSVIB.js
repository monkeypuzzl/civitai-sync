import {
  navTabHref
} from "./chunk-XWICPOXM.js";
import {
  completeAuthoredParams,
  parseUrl,
  pushState
} from "./chunk-Z6L3MMX7.js";

// dev/ui/src/lib/nav-activate.js
function activateOriginTab(tabId, route, { modelReturn, mediaScope, focus } = {}) {
  const r = route && typeof route === "object" ? route : { view: void 0, entityId: null, params: {} };
  const href = navTabHref(tabId, r, { modelReturn, mediaScope });
  const parsed = parseUrl(href);
  const opts = focus != null ? { focus } : void 0;
  pushState({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: completeAuthoredParams(r.params, parsed.params)
  }, opts);
}

export {
  activateOriginTab
};
