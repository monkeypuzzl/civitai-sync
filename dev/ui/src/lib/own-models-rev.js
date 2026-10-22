// Quiet signal that the account-model record finished a walk.
// Open Mine surfaces refetch. No status line.

import { useState, useEffect } from 'preact/hooks';
import { getListOffer } from '../api.js';

let revision = 0;
const listeners = new Set();

export function ownModelsRevision () {
  return revision;
}

export function bumpOwnModelsRevision () {
  revision += 1;
  for (const fn of listeners) fn(revision);
}

export function useOwnModelsRevision () {
  const [rev, setRev] = useState(revision);
  useEffect(() => {
    listeners.add(setRev);
    return () => listeners.delete(setRev);
  }, []);
  return rev;
}

let knownCache = { rev: -1, known: false, pending: null };

/** True when the account-model record is on disk for this username. */
export function useOwnModelsKnown () {
  const rev = useOwnModelsRevision();
  const [known, setKnown] = useState(() => knownCache.rev === rev && knownCache.known);
  useEffect(() => {
    if (knownCache.rev === rev) {
      setKnown(knownCache.known);
      return undefined;
    }
    let cancelled = false;
    const pending = knownCache.pending && knownCache.pending.rev === rev
      ? knownCache.pending.promise
      : getListOffer({});
    if (!(knownCache.pending && knownCache.pending.rev === rev)) {
      knownCache.pending = { rev, promise: pending };
    }
    pending.then(offer => {
      const value = offer?.ownKnown === true;
      knownCache = { rev, known: value, pending: null };
      if (!cancelled) setKnown(value);
    }).catch(() => {
      if (!cancelled) setKnown(false);
    });
    return () => { cancelled = true; };
  }, [rev]);
  return known;
}
