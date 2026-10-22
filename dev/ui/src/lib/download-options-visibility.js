// What Download options and Advanced contain.
// `recheck` is the boolean recheckShown already decided.
// `domainOffered` is the existing host gate, decided at the call.

export function downloadOptionsVisibility ({
  selected,
  recheck = false,
  domainOffered = false
} = {}) {
  const files = Array.isArray(selected) && selected.length > 0;
  const domain = domainOffered === true;
  const showRecheck = recheck === true;
  const advanced = files || domain || showRecheck;
  return {
    section: advanced,
    advanced,
    files,
    recheck: showRecheck,
    domain
  };
}
