import {
  d,
  y
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/lib/index-settle.js
var DOWNLOAD_TYPES = /* @__PURE__ */ new Set(["generations", "posts", "comics", "model3ds"]);
function isSettleFrame(event) {
  if (!event || typeof event !== "object") return false;
  if (event.final === true && DOWNLOAD_TYPES.has(event.type)) return true;
  if (event.type === "model-cache" && event.final === true) return true;
  if (event.type === "tag-cache" && event.final === true) return true;
  if (event.type === "own-models" && event.status === "ready") return true;
  return false;
}
var epoch = 0;
var listeners = /* @__PURE__ */ new Set();
var timer = null;
var pending = false;
function flush() {
  timer = null;
  if (!pending) return;
  pending = false;
  epoch += 1;
  for (const fn of listeners) fn(epoch);
}
function noteSettleFrame(event) {
  if (!isSettleFrame(event)) return;
  pending = true;
  if (timer != null) return;
  timer = setTimeout(flush, 50);
}
function subscribeIndexEpoch(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function useIndexEpoch() {
  const [value, setValue] = d(epoch);
  y(() => subscribeIndexEpoch(setValue), []);
  return value;
}

export {
  noteSettleFrame,
  subscribeIndexEpoch,
  useIndexEpoch
};
