import {
  k,
  timeDatetime,
  u
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/components/TimeText.jsx
function TimeText({ at, datetime, class: className, children }) {
  if (children == null || children === false || children === "") return null;
  const resolved = datetime != null && datetime !== "" ? String(datetime) : timeDatetime(at);
  if (!resolved) {
    if (className) return /* @__PURE__ */ u("span", { class: className, children });
    return /* @__PURE__ */ u(k, { children });
  }
  return /* @__PURE__ */ u("time", { class: className, datetime: resolved, children });
}

export {
  TimeText
};
