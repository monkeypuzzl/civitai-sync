// Model names for models chips on a container page. One hierarchy read
// when the address has a models string. No spinner on the chip.

import { useEffect, useState } from 'preact/hooks';
import { getModelHierarchy } from '../api.js';

export function useScopeChipTree (scope) {
  const [tree, setTree] = useState(null);
  const wanted = typeof scope === 'string' && scope !== '';
  useEffect(() => {
    if (!wanted) return undefined;
    let cancelled = false;
    getModelHierarchy().then(body => {
      if (!cancelled) setTree(body || null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [wanted]);
  return wanted ? tree : null;
}
