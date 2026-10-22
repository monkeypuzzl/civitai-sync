import {
  d,
  getListOffer,
  y
} from "./chunk-OGIWOTNU.js";

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
var knownCache = { rev: -1, known: false, pending: null };
function useOwnModelsKnown() {
  const rev = useOwnModelsRevision();
  const [known, setKnown] = d(() => knownCache.rev === rev && knownCache.known);
  y(() => {
    if (knownCache.rev === rev) {
      setKnown(knownCache.known);
      return void 0;
    }
    let cancelled = false;
    const pending = knownCache.pending && knownCache.pending.rev === rev ? knownCache.pending.promise : getListOffer({});
    if (!(knownCache.pending && knownCache.pending.rev === rev)) {
      knownCache.pending = { rev, promise: pending };
    }
    pending.then((offer) => {
      const value = offer?.ownKnown === true;
      knownCache = { rev, known: value, pending: null };
      if (!cancelled) setKnown(value);
    }).catch(() => {
      if (!cancelled) setKnown(false);
    });
    return () => {
      cancelled = true;
    };
  }, [rev]);
  return known;
}

export {
  bumpOwnModelsRevision,
  useOwnModelsRevision,
  useOwnModelsKnown
};
