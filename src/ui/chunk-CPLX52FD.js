import {
  T,
  d,
  isRatingTagName,
  q,
  stringLiftQuery,
  y
} from "./chunk-OGIWOTNU.js";

// dev/ui/src/lib/url-migrations.js
var CURRENT_PROTOCOL_VERSION = 6;
function liftRatingParams(params) {
  const next = { ...params || {} };
  const parts = String(next.tag || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return next;
  const tags = [];
  const lifted = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (isRatingTagName(part)) lifted.push(key);
    else tags.push(part);
  }
  if (!lifted.length) return next;
  const existing = String(next.rating || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const token of [...existing, ...lifted]) {
    if (seen.has(token)) continue;
    seen.add(token);
    merged.push(token);
  }
  next.rating = merged.join(",");
  if (tags.length) next.tag = tags.join(",");
  else delete next.tag;
  return next;
}
function leadingId(token) {
  const m = String(token ?? "").match(/^(\d+)/);
  return m ? m[1] : null;
}
var migrations = [
  {
    // _v=1 → _v=2 (Phase 3): the legacy sort tokens `newest` / `oldest`
    // become the protocol's `<field>:<direction>` form. Left unmigrated, a
    // bare `sort=oldest` bookmark would silently resolve as newest-first —
    // a semantic flip, hence the version bump (see
    // explorer-url-protocol.md § Versioning). All other params pass through.
    from: 1,
    to: 2,
    migrate(state) {
      const params = { ...state.params };
      if (params.sort === "newest") params.sort = "date:desc";
      else if (params.sort === "oldest") params.sort = "date:asc";
      return { ...state, params, v: 2 };
    }
  },
  {
    // _v=2 → _v=3: Models catalog + model page. Old type/ecosystem/model/version
    // path folders become `/models/{modelId}-{slug}?modelVersionId=` (or
    // catalog query params for type/ecosystem interiors). `e.` scope terms
    // are not rewritten (lossy).
    from: 2,
    to: 3,
    migrate(state) {
      if (state.view !== "models") {
        return { ...state, v: 3 };
      }
      const trail = Array.isArray(state.modelTrail) ? state.modelTrail : [];
      const params = { ...state.params };
      if (trail.length >= 4) {
        const verId = leadingId(trail[3]);
        if (verId) params.modelVersionId = verId;
        return { ...state, entityId: trail[2], modelTrail: null, params, v: 3 };
      }
      if (trail.length === 3) {
        return { ...state, entityId: trail[2], modelTrail: null, params, v: 3 };
      }
      if (trail.length === 2) {
        params.resourceType = trail[0];
        params.ecosystem = trail[1];
        return { ...state, entityId: null, modelTrail: null, params, v: 3 };
      }
      if (trail.length === 1) {
        params.resourceType = trail[0];
        return { ...state, entityId: null, modelTrail: null, params, v: 3 };
      }
      return { ...state, modelTrail: null, v: 3 };
    }
  },
  {
    // _v=3 → _v=4: Publication key rename. Posts/Comics used `status=` and
    // `groupBy=status`; Generations already used `publication=`. Copy
    // leftover `status` onto `publication` when publication is absent, then
    // drop `status`. `groupBy=status` becomes `groupBy=publication`.
    from: 3,
    to: 4,
    migrate(state) {
      const params = { ...state.params };
      const hasPublication = params.publication != null && params.publication !== "";
      const hasStatus = params.status != null && params.status !== "";
      if (!hasPublication && hasStatus) params.publication = params.status;
      delete params.status;
      if (params.groupBy === "status") params.groupBy = "publication";
      return { ...state, params, v: 4 };
    }
  },
  {
    // _v=4 → _v=5: Rating is the image browsing-level bit, not a content-tag
    // name. Ladder tokens move from tag= to rating=. Other tag values stay.
    // A URL already at _v=5 is untouched, including one that still names a
    // ladder word as a content tag.
    from: 4,
    to: 5,
    migrate(state) {
      return { ...state, params: liftRatingParams(state.params), v: 5 };
    }
  },
  {
    // _v=5 → _v=6: gallery model filters are one `models` term list.
    // Media type is mediaType. Model type is resourceType. mine=1 is a
    // mine term. The source is the v6.0.0 keys. A type. segment is not
    // rewritten. The models catalog keeps its own keys. A URL already at
    // _v=6 is untouched.
    from: 5,
    to: 6,
    migrate(state) {
      return { ...state, params: stringLiftQuery(state.params, { view: state.view }), v: 6 };
    }
  }
];
function applyMigrations(state) {
  if (!state) return state;
  let current = state;
  for (const m of migrations) {
    const cv = current.v == null ? 1 : current.v;
    if (cv >= m.to) continue;
    current = m.migrate(current);
  }
  return current;
}

// dev/ui/src/lib/view-params.js
var CONTROL_KEYS = Object.freeze([
  "groupBy",
  "groupSort",
  "sort",
  "q",
  "select",
  "granularity",
  "from",
  "_v"
]);
function paramSet(...keys) {
  return new Set(keys);
}
var VIEW_PARAM_KEYS = Object.freeze({
  generations: paramSet(
    "mediaType",
    "models",
    "aspect",
    "tag",
    "reaction",
    "dateFrom",
    "dateTo",
    "cfgMin",
    "cfgMax",
    "stepsMin",
    "stepsMax",
    "inPost",
    "publication",
    "usedAsInput",
    "workflow",
    "workflowMode",
    "from",
    "slot",
    // prune-only: retired media-view generation= (API hop kept). Option F
    // still drops a carried generation= rather than treating it as unknown.
    "generation"
  ),
  posts: paramSet(
    "mediaType",
    "models",
    "tag",
    "postTag",
    "rating",
    "reaction",
    "aspect",
    "dateFrom",
    "dateTo",
    "status",
    "publication",
    "engagement",
    "cfgMin",
    "cfgMax",
    "stepsMin",
    "stepsMax",
    "usedAsInput",
    "workflow",
    "workflowMode",
    "title",
    "from",
    "slot",
    "generation"
    // prune-only; see generations
  ),
  model3ds: paramSet(
    "publication",
    "status",
    "from"
  ),
  comics: paramSet(
    "mediaType",
    "models",
    "tag",
    "rating",
    "reaction",
    "aspect",
    "dateFrom",
    "dateTo",
    "status",
    "publication",
    "engagement",
    "cfgMin",
    "cfgMax",
    "stepsMin",
    "stepsMax",
    "usedAsInput",
    "workflow",
    "workflowMode",
    "title",
    "from",
    "slot",
    "generation"
    // prune-only; see generations
  ),
  media: paramSet(
    "mediaType",
    "models",
    "aspect",
    "tag",
    "postTag",
    "rating",
    "reaction",
    "dateFrom",
    "dateTo",
    "cfgMin",
    "cfgMax",
    "stepsMin",
    "stepsMax",
    "inPost",
    "publication",
    "usedAsInput",
    "workflow",
    "workflowMode",
    "title",
    "from",
    "slot",
    // Used in… gallery on this page. Only the string `1` opens it. Other
    // views do not list it, so a view change drops a carried value.
    "usedIn"
  ),
  overview: paramSet(),
  models: paramSet(
    "resourceType",
    "family",
    "variant",
    "modelVersionId",
    "familyId",
    "mine",
    "from"
  ),
  download: paramSet(),
  exports: paramSet("workflow", "workflowMode"),
  "resources-redirect": paramSet()
});
var KNOWN_PARAM_KEYS = /* @__PURE__ */ new Set([
  ...CONTROL_KEYS,
  ...Object.values(VIEW_PARAM_KEYS).flatMap((s) => [...s])
]);
var ENTITY_PARAM_KEYS = /* @__PURE__ */ new Set();
function pruneCarriedParams(params, { fromView, toView, explicitKeys } = {}) {
  const src = params || {};
  if (fromView === toView) return { ...src };
  const explicit = explicitKeys instanceof Set ? explicitKeys : new Set(explicitKeys || []);
  const out = {};
  for (const key of Object.keys(src)) {
    if (explicit.has(key)) {
      out[key] = src[key];
      continue;
    }
    if (!KNOWN_PARAM_KEYS.has(key)) {
      out[key] = src[key];
      continue;
    }
  }
  return out;
}
function dropEntityScopedParams(params, { entityChanged, explicitKeys } = {}) {
  const src = { ...params || {} };
  if (!entityChanged) return src;
  const explicit = explicitKeys instanceof Set ? explicitKeys : new Set(explicitKeys || []);
  for (const key of ENTITY_PARAM_KEYS) {
    if (!explicit.has(key)) delete src[key];
  }
  return src;
}

// dev/ui/src/lib/router.js
var URLSTATE_EVENT = "urlstatechange";
function getRoute() {
  const parsed = parseUrl(location.pathname + location.search);
  return applyMigrations(parsed);
}
function replaceState(partial, opts) {
  const next = mergePartial(getRoute(), partial);
  history.replaceState(mergeHistoryState(opts, { inherit: true }), "", formatUrl(next));
  dispatchUrlStateEvent();
}
function pushState(partial, opts) {
  const next = mergePartial(getRoute(), partial);
  history.pushState(mergeHistoryState(opts, { inherit: false }), "", formatUrl(next));
  dispatchUrlStateEvent();
}
function navigate(target, opts) {
  if (typeof target !== "string") return;
  if (target.includes("/") || target.startsWith("/")) {
    const parsed = parseUrl(target.startsWith("/") ? target : "/" + target);
    pushState({
      view: parsed.view,
      entityId: parsed.entityId,
      modelTrail: parsed.modelTrail,
      params: parsed.params
    }, opts);
    return;
  }
  pushState({ view: target, entityId: null, modelTrail: null }, opts);
}
function subscribe(cb) {
  const handler = () => cb();
  window.addEventListener("popstate", handler);
  window.addEventListener(URLSTATE_EVENT, handler);
  return () => {
    window.removeEventListener("popstate", handler);
    window.removeEventListener(URLSTATE_EVENT, handler);
  };
}
var HISTORY_STATE_KEYS = ["list", "mediaList", "originHref", "focus", "originPage", "anchorSlot"];
function snapshotHistoryState() {
  const s = typeof history === "undefined" ? null : history.state;
  if (s == null || typeof s !== "object" || Array.isArray(s)) return {};
  return { ...s };
}
function mergeHistoryState(opts, { inherit } = {}) {
  const next = inherit ? snapshotHistoryState() : {};
  if (opts != null && typeof opts === "object") {
    for (const key of HISTORY_STATE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(opts, key)) continue;
      if ((key === "focus" || key === "anchorSlot") && opts[key] == null) delete next[key];
      else next[key] = opts[key];
    }
  }
  return Object.keys(next).length === 0 ? null : next;
}
function mergePartial(cur, partial) {
  if (!partial) return cur;
  const paramsPassed = Object.prototype.hasOwnProperty.call(partial, "params");
  const emptyParams = paramsPassed && partial.params != null && typeof partial.params === "object" && !Array.isArray(partial.params) && Object.keys(partial.params).length === 0;
  const bareViewReset = emptyParams && "view" in partial && "entityId" in partial && partial.entityId == null;
  const next = {
    view: "view" in partial ? partial.view : cur.view,
    entityId: "entityId" in partial ? partial.entityId : cur.entityId,
    modelTrail: "modelTrail" in partial ? partial.modelTrail : cur.modelTrail,
    params: bareViewReset ? {} : { ...cur.params, ...partial.params || {} },
    v: "v" in partial ? partial.v : cur.v,
    viewWasUnknown: false
  };
  for (const k of Object.keys(next.params)) {
    const val = next.params[k];
    if (val == null || val === "" || Array.isArray(val) && val.length === 0) {
      delete next.params[k];
    }
  }
  const explicitKeys = new Set(Object.keys(partial.params || {}));
  if (partial.view != null && partial.view !== cur.view) {
    if (!("entityId" in partial)) next.entityId = null;
    if (!("modelTrail" in partial)) next.modelTrail = null;
    next.params = pruneCarriedParams(next.params, {
      fromView: cur.view,
      toView: partial.view,
      explicitKeys
    });
  }
  const entityChanged = "entityId" in partial && partial.entityId !== cur.entityId;
  if (entityChanged) {
    next.params = dropEntityScopedParams(next.params, {
      entityChanged: true,
      explicitKeys
    });
  }
  return next;
}
function dispatchUrlStateEvent() {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  try {
    window.dispatchEvent(new Event(URLSTATE_EVENT));
  } catch {
  }
}

// dev/ui/src/lib/url-state.js
var KNOWN_VIEWS = Object.freeze([
  "overview",
  "generations",
  "posts",
  "comics",
  "model3ds",
  "models",
  "media",
  "exports",
  "resources-redirect",
  "download"
]);
var KNOWN_VIEW_SET = new Set(KNOWN_VIEWS);
var VIEW_ALIASES = Object.freeze({
  resources: "resources-redirect"
});
var DETAIL_VIEWS = /* @__PURE__ */ new Set(["posts", "comics", "model3ds", "media", "generations"]);
var CONTROL_ORDER = Object.freeze(["groupBy", "groupSort", "sort", "q", "select", "granularity", "from"]);
var CONTROL_KEYS2 = /* @__PURE__ */ new Set([...CONTROL_ORDER, "_v"]);
var CURRENT_VERSION = CURRENT_PROTOCOL_VERSION;
var PROTOCOL_FLOOR_VERSION = 1;
function parseUrl(href) {
  const url = new URL(href, "http://_internal_/");
  const rawSegments = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const segments = rawSegments.map((s) => safeDecode(s));
  let view = "overview";
  let viewWasUnknown = false;
  let unknownView = null;
  let entityId = null;
  let modelTrail = null;
  const top = segments[0];
  const rest = segments.slice(1);
  if (top == null) {
    view = "overview";
  } else if (KNOWN_VIEW_SET.has(top)) {
    view = top;
  } else if (Object.prototype.hasOwnProperty.call(VIEW_ALIASES, top)) {
    view = VIEW_ALIASES[top];
  } else {
    view = "overview";
    viewWasUnknown = true;
    unknownView = top;
  }
  if (!viewWasUnknown) {
    if (view === "models") {
      if (rest.length > 0) {
        if (/^\d/.test(rest[0])) {
          entityId = rest[0];
        } else {
          modelTrail = rest;
        }
      }
    } else if (DETAIL_VIEWS.has(view) && rest.length > 0) {
      entityId = rest[0];
    }
  }
  const params = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "_v") continue;
    if (params[key] != null) {
      params[key] = params[key] + "," + value;
    } else {
      params[key] = value;
    }
  }
  const vRaw = url.searchParams.get("_v");
  let v = PROTOCOL_FLOOR_VERSION;
  if (vRaw != null) {
    const parsed = parseInt(vRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) v = parsed;
  }
  return {
    view,
    entityId,
    modelTrail,
    params,
    v,
    viewWasUnknown,
    ...unknownView != null ? { unknownView } : {}
  };
}
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
function formatUrl(state) {
  const view = state && state.view ? state.view : "overview";
  const rawParams = state && state.params ? state.params : {};
  const paramsCopy = { ...rawParams };
  if (paramsCopy.mine === "0" || paramsCopy.mine === "false") delete paramsCopy.mine;
  const paramV = paramsCopy._v;
  delete paramsCopy._v;
  let v = state && state.v != null ? state.v : null;
  if (v == null && paramV != null) {
    const parsed = parseInt(paramV, 10);
    if (Number.isFinite(parsed) && parsed > 0) v = parsed;
  }
  if (v == null) v = CURRENT_VERSION;
  const pathname = buildPathname(view, state);
  const presentKeys = Object.keys(paramsCopy).filter((k) => !isEmptyValue(paramsCopy[k]));
  const facetKeys = presentKeys.filter((k) => !CONTROL_KEYS2.has(k)).sort();
  const controlKeys = CONTROL_ORDER.filter((k) => paramsCopy[k] != null && !isEmptyValue(paramsCopy[k]));
  const parts = [];
  for (const k of facetKeys) parts.push(emitPair(k, paramsCopy[k]));
  for (const k of controlKeys) parts.push(emitPair(k, paramsCopy[k]));
  if (v !== CURRENT_VERSION) parts.push(emitPair("_v", String(v)));
  return parts.length === 0 ? pathname : `${pathname}?${parts.join("&")}`;
}
function buildPathname(view, state) {
  if (view === "models" && state && state.entityId != null && state.entityId !== "") {
    return `/models/${encodeSegment(String(state.entityId))}`;
  }
  if (view === "models" && state && Array.isArray(state.modelTrail) && state.modelTrail.length > 0) {
    return "/models/" + state.modelTrail.map(encodeSegment).join("/");
  }
  if (DETAIL_VIEWS.has(view) && state && state.entityId != null && state.entityId !== "") {
    return `/${view}/${encodeSegment(String(state.entityId))}`;
  }
  return `/${view}`;
}
function encodeSegment(s) {
  return encodeURIComponent(s);
}
function encodeValue(s) {
  return encodeURIComponent(s).replace(/%2C/g, ",").replace(/%3A/g, ":");
}
function emitPair(key, value) {
  const str = Array.isArray(value) ? value.join(",") : String(value);
  return `${encodeURIComponent(key)}=${encodeValue(str)}`;
}
function isEmptyValue(v) {
  if (v == null) return true;
  if (v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}
function completeAuthoredParams(currentParams, nextParams) {
  const params = { ...nextParams || {} };
  const current = currentParams || {};
  for (const key of Object.keys(current)) {
    if (!Object.prototype.hasOwnProperty.call(params, key)) params[key] = null;
  }
  return params;
}
function readSchemaState(params, schema) {
  const out = {};
  for (const key of Object.keys(schema)) {
    const def = schema[key] || {};
    const raw = params[key];
    if (raw == null || raw === "") {
      out[key] = cloneDefault(def);
      continue;
    }
    switch (def.type) {
      case "csv":
        out[key] = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "number":
        out[key] = Number(raw);
        break;
      case "integer":
        out[key] = parseInt(raw, 10);
        break;
      case "boolean":
        out[key] = raw === "1" || raw === "true";
        break;
      case "string":
      default:
        out[key] = String(raw);
    }
  }
  return out;
}
function cloneDefault(def) {
  if (def.default === void 0) {
    if (def.type === "csv") return [];
    return "";
  }
  if (Array.isArray(def.default)) return [...def.default];
  return def.default;
}
function serializeSchemaPartial(partial, schema) {
  const out = {};
  for (const key of Object.keys(partial)) {
    const def = schema[key] || {};
    const v = partial[key];
    switch (def.type) {
      case "csv":
        if (!Array.isArray(v) || v.length === 0) out[key] = null;
        else out[key] = v.map(String).filter(Boolean).join(",");
        break;
      case "boolean":
        out[key] = v == null ? null : v ? "1" : "0";
        break;
      case "number":
      case "integer":
        out[key] = v == null || v === "" || Number.isNaN(v) ? null : String(v);
        break;
      case "string":
      default:
        out[key] = v == null || v === "" ? null : String(v);
    }
  }
  return out;
}
var _pendingPartial = null;
var _pendingMode = "replace";
var _rafId = null;
function flushPending() {
  _rafId = null;
  const partial = _pendingPartial;
  const mode = _pendingMode;
  _pendingPartial = null;
  _pendingMode = "replace";
  if (!partial) return;
  if (mode === "push") pushState({ params: partial });
  else replaceState({ params: partial });
}
function schedulePartial(partial, mode) {
  if (!_pendingPartial) _pendingPartial = {};
  Object.assign(_pendingPartial, partial);
  if (mode === "push") _pendingMode = "push";
  if (_rafId == null) {
    if (typeof requestAnimationFrame === "function") {
      _rafId = requestAnimationFrame(flushPending);
    } else {
      _rafId = 1;
      Promise.resolve().then(flushPending);
    }
  }
}
function useUrlState(schema) {
  const [route, setRoute] = d(getRoute);
  y(() => {
    const update2 = () => setRoute(getRoute());
    return subscribe(update2);
  }, []);
  const state = T(() => readSchemaState(route.params || {}, schema), [route, schema]);
  const present = T(() => {
    const params = route.params || {};
    const out = {};
    for (const key of Object.keys(schema)) {
      out[key] = params[key] != null && params[key] !== "";
    }
    return out;
  }, [route, schema]);
  const update = q((partial, options) => {
    const mode = options && options.history === "push" ? "push" : "replace";
    const serialized = serializeSchemaPartial(partial, schema);
    schedulePartial(serialized, mode);
  }, [schema]);
  return [state, update, { present, view: route.view }];
}

// dev/ui/src/lib/nav-tabs.js
var NAV_TABS = [
  { id: "overview", label: "Overview" },
  { id: "generations", label: "Generations" },
  { id: "posts", label: "Posts" },
  { id: "comics", label: "Comics" },
  { id: "model3ds", label: "3D" },
  { id: "models", label: "Models" },
  { id: "exports", label: "Exports" },
  { id: "download", label: "Download" }
];
var ALWAYS = /* @__PURE__ */ new Set(["overview", "exports", "download"]);
var KEEP_WHEN_CURRENT = /* @__PURE__ */ new Set(["generations", "posts", "comics", "model3ds", "models"]);
var ORIGIN_TABS = /* @__PURE__ */ new Set(["generations", "posts", "comics", "model3ds", "models"]);
var ORIGIN_MEMBERSHIP_KIND = {
  generations: "generation",
  posts: "post",
  comics: "comic",
  models: "model"
};
function originMembershipKind(scope) {
  if (scope == null || scope === "") return null;
  return ORIGIN_MEMBERSHIP_KIND[scope] || null;
}
var CORPUS_CHANGE_EVENT = "corpuschange";
function notifyCorpusChange() {
  try {
    window.dispatchEvent(new Event(CORPUS_CHANGE_EVENT));
  } catch {
  }
}
function asRoute(route) {
  if (route == null) return { view: void 0, entityId: null, params: {} };
  if (typeof route === "string") return { view: route, entityId: null, params: {} };
  return {
    view: route.view,
    entityId: route.entityId == null ? null : route.entityId,
    params: route.params || {}
  };
}
function visibleNavTabs({ stats, status, route, mediaScope } = {}) {
  const ids = new Set(ALWAYS);
  const r = asRoute(route);
  if (status === "error") {
    for (const tab of NAV_TABS) ids.add(tab.id);
  } else if (status === "ready") {
    const hasGenerations = Number(stats?.totalGenerations) > 0;
    const hasPosts = Number(stats?.totalPosts) > 0;
    const hasComics = Number(stats?.totalComics) > 0;
    const hasModel3ds = Number(stats?.totalModel3ds) > 0;
    if (hasGenerations) ids.add("generations");
    if (hasPosts) ids.add("posts");
    if (hasComics) ids.add("comics");
    if (hasModel3ds) ids.add("model3ds");
    if (hasGenerations || hasPosts || hasComics || hasModel3ds) ids.add("models");
  }
  if (KEEP_WHEN_CURRENT.has(r.view)) ids.add(r.view);
  if (KEEP_WHEN_CURRENT.has(r.params.from)) ids.add(r.params.from);
  if (mediaScope && KEEP_WHEN_CURRENT.has(mediaScope)) ids.add(mediaScope);
  return NAV_TABS.filter((tab) => ids.has(tab.id));
}
function mediaOriginTab(route, mediaScope) {
  const r = asRoute(route);
  if (r.view !== "media") return null;
  if (r.params.from) return r.params.from;
  if (mediaScope) return mediaScope;
  return null;
}
function navTabActive(tab, route, { mediaScope } = {}) {
  const r = asRoute(route);
  if (r.view === "media") return mediaOriginTab(r, mediaScope) === tab;
  return r.view === tab;
}
function paramsWithoutFrom(params) {
  const out = { ...params || {} };
  delete out.from;
  delete out.usedIn;
  return out;
}
function navTabHref(tab, route, { modelReturn, mediaScope } = {}) {
  const r = asRoute(route);
  if (!ORIGIN_TABS.has(tab)) return `/${tab}`;
  const mediaFrom = mediaOriginTab(r, mediaScope);
  if (tab === "models" && r.view === "media" && mediaFrom === "models") {
    return modelReturn || "/models";
  }
  if (r.entityId == null && r.view === tab) return `/${tab}`;
  const isOriginReturn = r.view === "media" && mediaFrom === tab || r.view === tab && r.entityId != null;
  if (isOriginReturn) {
    const params = paramsWithoutFrom(r.params);
    if (r.view === "generations" && r.entityId != null && tab === "generations") {
      params.granularity = "batch";
    }
    return formatUrl({
      view: tab,
      entityId: null,
      params
    });
  }
  return `/${tab}`;
}

export {
  parseUrl,
  formatUrl,
  completeAuthoredParams,
  useUrlState,
  VIEW_PARAM_KEYS,
  getRoute,
  replaceState,
  pushState,
  navigate,
  subscribe,
  originMembershipKind,
  CORPUS_CHANGE_EVENT,
  notifyCorpusChange,
  visibleNavTabs,
  navTabActive,
  navTabHref
};
