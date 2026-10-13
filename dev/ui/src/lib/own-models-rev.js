// Quiet signal that the account-model record finished a walk.
// Open Mine surfaces refetch. No status line.

import { useState, useEffect } from 'preact/hooks';

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
