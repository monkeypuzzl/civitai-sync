import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import confirm from '@inquirer/confirm';
import inquirer from 'inquirer';
import { fetchComics, formatComicCompletion, listenForEscKeyPress } from './downloadComicsActions.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { getSecretKey, requestKey } from './keyActions.mjs';
import { comicsDataDir } from './comics.mjs';
import { listDirectory } from './utils.mjs';
import { rememberComicDownload, settleRememberedMode } from './downloadTypes.mjs';
import { downloadMenu } from './downloadMenu.mjs';

let previousMenuItem;

async function hasSavedComics () {
  try {
    const names = await listDirectory(comicsDataDir());
    return names.some(name => /^\d{4}-\d{2}-\d{2}$/.test(name));
  } catch {
    return false;
  }
}

export async function downloadComics (mode = 'latest') {
  const secretKey = await getSecretKey();
  const { requireLibraryAccount } = await import('./accountIdentity.mjs');
  const gate = await requireLibraryAccount(secretKey);
  if (!gate.ok) {
    console.log(chalk.red(gate.message));
    return;
  }
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
    await rememberComicDownload(mode);
    const label = mode === 'latest' ? 'Downloading latest comics' : 'Downloading all comics';
    ui.updateBottomBar(`${chalk.hex('#a5d8ff')(label)}...\n${chalk.dim('Press Esc to stop')}\n`);

    result = await fetchComics({
      secretKey,
      latest: mode !== 'all',
      withImages: CONFIG.downloadMedia !== false,
      log,
      signal: escKeyController.signal
    });

    log(formatComicCompletion(result));
    const errors = (result?.errors || []).length;
    const status = result?.aborted ? 'aborted' : (errors && !result?.comicsNew) ? 'error' : 'complete';
    await settleRememberedMode('comics', mode, { status, errors });
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

export async function downloadComicsMenu (doClearTerminal = true) {
  const keySaved = !!CONFIG.secretKey;
  if (!keySaved) {
    const { mainMenu } = await import('./mainMenu.mjs');
    return mainMenu();
  }

  const hasComics = await hasSavedComics();
  const choices = [
    {
      name: 'Latest',
      value: 'download-latest-comics',
      description: 'Download the newest comic changes. Opens a comic when its shell is newer.'
    }
  ];
  if (hasComics) {
    choices.push({
      name: 'All',
      value: 'download-all-comics',
      description: 'Download all comics. Any missing will be saved.'
    });
  }
  choices.push(new Separator(), { name: 'Back', value: 'back', description: 'Back to Downloads' });

  if (doClearTerminal) clearTerminal();
  else console.log();

  const choiceValues = choices.flatMap(choice => (choice && choice.value ? [choice.value] : []));
  let initial = 'download-latest-comics';
  if (CONFIG.comicDownload === 'all' && choiceValues.includes('download-all-comics')) {
    initial = 'download-all-comics';
  }
  const preferred = previousMenuItem && previousMenuItem !== 'back' ? previousMenuItem : initial;

  const answer = await select({
    message: 'Download comics:',
    choices,
    theme: customTheme,
    default: choiceValues.includes(preferred) ? preferred : initial
  });

  previousMenuItem = answer;

  if (answer === 'download-latest-comics') {
    await downloadComics('latest');
    return downloadComicsMenu(false);
  }
  if (answer === 'download-all-comics') {
    await downloadComics('all');
    return downloadComicsMenu(false);
  }
  return downloadMenu();
}
