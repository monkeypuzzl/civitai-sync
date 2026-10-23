import {
  d,
  u,
  y
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/hooks/useDebouncedUrlParam.js
function useDebouncedUrlParam(urlValue, update, key = "q", delay = 300) {
  const [input, setInput] = d(urlValue);
  y(() => {
    setInput(urlValue);
  }, [urlValue]);
  y(() => {
    if (input === urlValue) return;
    const t = setTimeout(() => update({ [key]: input }), delay);
    return () => clearTimeout(t);
  }, [input, urlValue, update, key, delay]);
  return [input, setInput];
}

// dev/ui/src/lib/gallery-query.js
function galleryRequestQuery(state, extra = {}) {
  const s = state || {};
  const more = { ...extra && typeof extra === "object" ? extra : {} };
  delete more.mine;
  delete more.usedAsInput;
  return {
    tag: s.tag,
    postTag: s.postTag,
    rating: s.rating,
    reaction: s.reaction,
    q: s.q,
    sort: s.sort,
    mediaType: s.mediaType,
    models: s.models,
    aspect: s.aspect,
    dateFrom: s.dateFrom,
    dateTo: s.dateTo,
    cfgMin: s.cfgMin,
    cfgMax: s.cfgMax,
    stepsMin: s.stepsMin,
    stepsMax: s.stepsMax,
    usedAsInput: s.usedAsInput === true ? true : null,
    workflow: s.workflow,
    workflowMode: s.workflowMode,
    groupBy: s.groupBy,
    groupSort: s.groupSort,
    granularity: s.granularity,
    ...more
  };
}

// dev/ui/src/lib/grain.js
var HEART_SORT_FIELDS = /* @__PURE__ */ new Set([
  "hearts",
  "likes",
  "dislikes",
  "comments",
  "collected"
]);
var CONTAINER_GRAINS = /* @__PURE__ */ new Set(["post", "comic", "batch"]);
function pruneGrainParams(grain, state = {}) {
  const overlay = {};
  if (grain === "media") {
    overlay.engagement = null;
    const field = String(state.sort || "").split(":")[0];
    if (HEART_SORT_FIELDS.has(field)) overlay.sort = "date:desc";
  } else if (CONTAINER_GRAINS.has(grain)) {
    overlay.select = "";
  }
  return overlay;
}

// dev/ui/src/components/GranularityToggle.jsx
function GranularityToggle({ value, options, onChange }) {
  return /* @__PURE__ */ u("fieldset", { class: "granularity-toggle", children: [
    /* @__PURE__ */ u("legend", { class: "granularity-label", children: "View" }),
    (options || []).map((opt) => /* @__PURE__ */ u("label", { class: "granularity-option", children: [
      /* @__PURE__ */ u(
        "input",
        {
          type: "radio",
          name: "granularity",
          value: opt.value,
          checked: value === opt.value,
          onChange: () => onChange(opt.value)
        }
      ),
      opt.label
    ] }, opt.value))
  ] });
}

export {
  useDebouncedUrlParam,
  galleryRequestQuery,
  pruneGrainParams,
  GranularityToggle
};
