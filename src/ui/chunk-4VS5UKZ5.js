import {
  activateOriginTab
} from "./chunk-SNTDJ2GX.js";
import {
  originBagForHop
} from "./chunk-R5EOPP5W.js";
import {
  originQuery,
  readHistoryBag
} from "./chunk-JB7JSPAG.js";
import {
  completeAuthoredParams,
  formatUrl,
  getRoute,
  parseUrl,
  pushState
} from "./chunk-CPLX52FD.js";
import {
  y
} from "./chunk-OGIWOTNU.js";

// dev/ui/src/lib/magic-escape.js
var ORIGIN_TABS = /* @__PURE__ */ new Set(["generations", "posts", "comics", "models"]);
var CONTAINER_VIEWS = /* @__PURE__ */ new Set(["generations", "posts", "comics", "model3ds"]);
var CONTAINER_GRAIN = /* @__PURE__ */ new Set(["batch", "post", "comic"]);
function containerIdFromSlot(slot) {
  if (slot == null || slot === "") return null;
  const match = String(slot).match(/^c:(.*):(\d+)$/);
  if (!match || match[1] === "") return null;
  return match[1];
}
function asRoute(route) {
  if (route == null || typeof route !== "object") {
    return { view: void 0, entityId: null, params: {} };
  }
  return {
    view: route.view,
    entityId: route.entityId == null || route.entityId === "" ? null : route.entityId,
    params: route.params || {}
  };
}
function containerHref(route, containerId) {
  const params = route.params || {};
  const scope = params.from || "";
  const view = scope === "generations" || scope === "posts" || scope === "comics" ? scope : null;
  if (!view || !containerId) return "";
  const path = `/${view}/${containerId}`;
  return formatUrl({
    view,
    entityId: containerId,
    modelTrail: null,
    params: originQuery(params, null, { path })
  });
}
function magicEscapeTarget({ route, origin, mediaScope } = {}) {
  const r = asRoute(route);
  if (r.view !== "media" && r.entityId == null) return { action: "none" };
  if (CONTAINER_VIEWS.has(r.view) && r.entityId != null) {
    return { action: "origin-tab", tab: r.view };
  }
  if (r.view === "models" && r.entityId != null) {
    return { action: "origin-tab", tab: "models" };
  }
  if (r.view !== "media") return { action: "none" };
  if (r.params.usedIn === "1") return { action: "drop-used-in" };
  const from = r.params.from || "";
  if (from === "models" || mediaScope === "models") {
    return { action: "origin-tab", tab: "models" };
  }
  if (from === "imports") return { action: "none" };
  const slot = origin && origin.slot || r.params.slot || "";
  const containerGrain = CONTAINER_GRAIN.has(r.params.granularity) || String(slot).startsWith("c:");
  if (containerGrain) {
    const scope = from || origin && origin.scope || mediaScope || "";
    const withScope = scope && scope !== from ? { ...r, params: { ...r.params, from: scope } } : r;
    const href = containerHref(withScope, containerIdFromSlot(slot));
    if (!href) return { action: "none" };
    return { action: "container", href };
  }
  const tab = from || mediaScope || origin && origin.scope || "";
  if (ORIGIN_TABS.has(tab)) return { action: "origin-tab", tab };
  return { action: "none" };
}

// dev/ui/src/hooks/useMagicEscape.js
function typingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}
function overlayOpen() {
  try {
    return Boolean(document.querySelector(".media-fullscreen"));
  } catch {
    return false;
  }
}
function useMagicEscape({
  origin = null,
  modelReturn = null,
  mediaScope = null,
  enabled = true
} = {}) {
  y(() => {
    if (!enabled) return void 0;
    function onKey(e) {
      if (e.key !== "Escape" || e.repeat) return;
      if (typingTarget(e.target)) return;
      if (overlayOpen()) return;
      try {
        if (document.fullscreenElement) return;
      } catch {
      }
      const route = getRoute();
      const target = magicEscapeTarget({ route, origin, mediaScope });
      if (!target || target.action === "none") return;
      e.preventDefault();
      const bag = readHistoryBag();
      if (target.action === "drop-used-in") {
        pushState({
          view: route.view,
          entityId: route.entityId,
          modelTrail: route.modelTrail,
          params: { ...route.params || {}, usedIn: null }
        }, bag);
        return;
      }
      if (target.action === "origin-tab") {
        activateOriginTab(target.tab, route, {
          modelReturn,
          mediaScope,
          focus: bag.focus
        });
        return;
      }
      if (target.action === "container" && target.href) {
        const parsed = parseUrl(target.href);
        pushState({
          view: parsed.view,
          entityId: parsed.entityId,
          modelTrail: parsed.modelTrail,
          params: completeAuthoredParams(route.params, parsed.params)
        }, originBagForHop(bag));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, origin, modelReturn, mediaScope]);
}

export {
  useMagicEscape
};
