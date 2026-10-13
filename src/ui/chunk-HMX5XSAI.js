import {
  d,
  y
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/lib/own-models-rev.js
var revision = 0;
var listeners = /* @__PURE__ */ new Set();
function bumpOwnModelsRevision() {
  revision += 1;
  for (const fn of listeners) fn(revision);
}
function useOwnModelsRevision() {
  const [rev, setRev] = d(revision);
  y(() => {
    listeners.add(setRev);
    return () => listeners.delete(setRev);
  }, []);
  return rev;
}

export {
  bumpOwnModelsRevision,
  useOwnModelsRevision
};
