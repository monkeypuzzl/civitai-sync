import {
  d,
  u,
  y
} from "./chunk-QDJYYBZC.js";

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
  pruneGrainParams,
  GranularityToggle
};
