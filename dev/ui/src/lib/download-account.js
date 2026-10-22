// Which account controls the Download page shows. The sheet does not paint
// until stats have settled, so this has no loading status.

function countsOf (containerCounts) {
  const source = containerCounts || {};
  return ['generations', 'posts', 'comics', 'model3ds']
    .some(key => Number(source[key]) > 0);
}

export function downloadAccountVisibility ({
  hasKey = false,
  needsUnlock = false,
  mismatch = false,
  stats = null,
  containerCounts = null
} = {}) {
  const failed = stats == null;
  const hasCorpus = !failed && countsOf(containerCounts);
  const rebuild = failed || hasCorpus;
  return {
    setup: !hasKey && !mismatch,
    unlock: !!hasKey && !!needsUnlock && !mismatch,
    mismatch: !!mismatch,
    modelsLine: !!hasKey && !mismatch && hasCorpus,
    refreshModels: !!hasKey && !needsUnlock && !mismatch && hasCorpus,
    rebuildIndex: (!!rebuild && !!hasKey) || (!hasKey && failed)
  };
}
