// Wrong-account sentence shared by the CLI and the Download page.
// No imports. Node loads this file. The UI file re-exports these names.
// The release zip ships src/ and does not ship dev/.

const STEM = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/;

export function accountMismatchParagraphs (libraryUsername, keyUsername) {
  const library = libraryUsername || 'this';
  const keyName = keyUsername || 'another';
  const first = `This library is for the ${library} account. This API key is for the ${keyName} account. Downloads stay off until this library has a key for ${library}.`;
  if (typeof keyUsername !== 'string' || !STEM.test(keyUsername)) {
    return [
      first,
      `To use the ${keyName} account, open a separate config with its own folders.`
    ];
  }
  return [
    first,
    `To use the ${keyName} account, open a separate config. It starts with its own folders, data-${keyUsername} and media-${keyUsername}. In a terminal, \`civitai-sync explorer ${keyUsername}\` starts a new Explorer. \`civitai-sync ${keyUsername}\` starts a new CLI.`
  ];
}

export function accountMismatchText (libraryUsername, keyUsername) {
  return accountMismatchParagraphs(libraryUsername, keyUsername).join('\n\n');
}
