import inquirer from 'inquirer';
import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import { fetchComics, formatComicCompletion, listenForEscKeyPress } from './downloadComicsActions.mjs';
import { CONFIG, clearTerminal } from './cli.mjs';
import { getSecretKey, requestKey } from './keyActions.mjs';

export async function downloadComics () {
  const secretKey = await getSecretKey();
  const ui = new inquirer.ui.BottomBar();

  function log (text) {
    if (text) ui.updateBottomBar(text);
  }

  const escKeyController = listenForEscKeyPress({
    onAbort: () => ui.updateBottomBar(chalk.dim('  Stopping... finishing current download'))
  });

  let result;

  try {
    clearTerminal();
    ui.updateBottomBar(`${chalk.hex('#a5d8ff')('Downloading comics')}...\n${chalk.dim('Press Esc to stop')}\n`);

    result = await fetchComics({
      secretKey,
      withImages: CONFIG.downloadMedia !== false,
      log,
      signal: escKeyController.signal
    });

    log(formatComicCompletion(result));
    import('./ownModels.mjs').then(m => m.scheduleOwnModelsCheck({ secretKey })).catch(() => {});
  } catch (error) {
    console.error(error);
  } finally {
    ui.close();
    escKeyController.stop();
  }

  if ((result?.errors || []).some(e => e?.code === 'UNAUTHORIZED') || result?.error?.code === 'UNAUTHORIZED') {
    const answer = await confirm({ message: chalk.red('\nNot authorized. Your API key needs updating. Update now?'), default: true });
    if (answer) {
      await requestKey();
    }
  }

  return result;
}
