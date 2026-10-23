// Two floors. runsOn is the oldest Node this build executes. supported is
// the oldest Node the release is tested on. engines in package.json stays
// at supported. Node does not read that field.

export const RUNS_ON = 18;
export const SUPPORTED = 20;

export function nodeMajor (version) {
  const match = String(version || '').match(/v?(\d+)/);
  return match ? Number(match[1]) : 0;
}

// stop: do not migrate. notice: run, and say so. ok: say nothing.
export function nodeGate (version) {
  const major = nodeMajor(version);
  if (major < RUNS_ON) return 'stop';
  if (major < SUPPORTED) return 'notice';
  return 'ok';
}

// null on ok and on stop. The Explorer line is only the in-between case.
export function nodeNoticeFor (version) {
  if (nodeGate(version) !== 'notice') return null;
  return { current: String(version), supported: String(SUPPORTED) };
}

export function nodeNoticeText (version) {
  return `Node ${version}. This build is tested on Node ${SUPPORTED} and newer. https://nodejs.org`;
}

export function nodeUpdateSection () {
  return [
    'Node update required.',
    'Close civitai-sync.',
    'Download the current long-term support installer from https://nodejs.org.',
    'On Windows, the Windows Installer (.msi). On macOS, the macOS Installer (.pkg).',
    'Run it and accept the defaults. It replaces the Node that installer put there before.',
    'Open a terminal, run node -v, and open civitai-sync again.',
    'If node -v is still the old version, Node is also installed another way. This installer did not replace that copy.'
  ].join('\n');
}
