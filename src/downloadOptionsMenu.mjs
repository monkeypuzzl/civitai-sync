import checkbox from '@inquirer/checkbox';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { keyOptions } from './keyOptionsMenu.mjs';
import { setConfigParam } from './config.mjs';
import { normalizeGenerationReactions } from './downloadTypes.mjs';

export async function setReactionOptions () {
  clearTerminal();
  const current = normalizeGenerationReactions(CONFIG.generationReactions);

  const answer = await checkbox({
    message: 'Choose reactions to include in the Download > Generations menu.',
    choices: [
      {
        name: 'Favorited',
        value: 'favorite',
        checked: current.includes('favorite')
      },
      {
        name: 'Liked',
        value: 'feedback:liked',
        checked: current.includes('feedback:liked')
      }
    ],
    theme: customTheme,
    pageSize: 2,
    loop: false,
    required: false,
    instructions: '\nPress <space> to select, <enter> to proceed, ↑↓ arrow keys to change option.',
  });

  await setConfigParam('generationReactions', normalizeGenerationReactions(answer));
  return keyOptions();
}

export async function runSyncDeleted () {
  const { getAvailableSecretKey } = await import('./keyActions.mjs');
  const { requireLibraryAccount } = await import('./accountIdentity.mjs');
  const gate = await requireLibraryAccount(getAvailableSecretKey());
  if (!gate.ok) {
    console.log(gate.message);
    return keyOptions({ clear: false });
  }
  const { deleteAllDeletedMedia } = await import('./generations.mjs');
  await deleteAllDeletedMedia();
  return keyOptions({ clear: false });
}

export async function runRecheckMetadata () {
  const { getSecretKey } = await import('./keyActions.mjs');
  const { listenForEscKeyPress } = await import('./downloadActions.mjs');
  const { recheckSavedMetadata } = await import('./recheckMetadata.mjs');
  const secretKey = await getSecretKey();
  if (!secretKey) return keyOptions();
  const esc = listenForEscKeyPress({
    onAbort: () => console.log('Stopping…')
  });
  try {
    await recheckSavedMetadata({ secretKey, signal: esc.signal });
  } finally {
    esc.stop();
  }
  return keyOptions({ clear: false });
}
