import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import confirm from '@inquirer/confirm';
import inquirer from 'inquirer';
import { fetchModel3ds, formatModel3dCompletion, listenForEscKeyPress } from './downloadModel3dsActions.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { getSecretKey, requestKey } from './keyActions.mjs';
import { model3dsDataDir } from './model3ds.mjs';
import { listDirectory } from './utils.mjs';
import { rememberModel3dDownload, settleRememberedMode } from './downloadTypes.mjs';
import { downloadMenu } from './downloadMenu.mjs';

let previousMenuItem;

async function hasSavedModel3ds () {
  try {
    const names = await listDirectory(model3dsDataDir());
    return names.some(name => /^\d{4}-\d{2}-\d{2}$/.test(name));
  } catch {
    return false;
  }
}

async function resolveUsername (secretKey) {
  if (CONFIG.username) return CONFIG.username;
  const { fillIfMissing } = await import('./userData.mjs');
  await fillIfMissing({ secretKey });
  return CONFIG.username || null;
}

export async function downloadModel3ds (mode = 'latest') {
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
    ui.updateBottomBar(`${chalk.hex('#a5d8ff')('Resolving username...')}\n`);
    const username = await resolveUsername(secretKey);
    if (!username) {
      ui.updateBottomBar(chalk.red('Could not resolve username. Please check your API key.\n'));
      escKeyController.stop();
      return;
    }

    await rememberModel3dDownload(mode);
    const label = mode === 'latest' ? 'Downloading latest 3D' : 'Downloading all 3D';
    ui.updateBottomBar(`${chalk.hex('#a5d8ff')(label)}...\n${chalk.dim('Press Esc to stop')}\n`);

    result = await fetchModel3ds({
      secretKey,
      username,
      latest: mode !== 'all',
      withImages: CONFIG.downloadMedia !== false,
      log,
      signal: escKeyController.signal
    });

    log(formatModel3dCompletion(result));
    const errors = (result?.errors || []).length;
    const status = result?.feedUnavailable
      ? 'error'
      : result?.aborted
        ? 'aborted'
        : (errors && !result?.model3dsNew) ? 'error' : 'complete';
    await settleRememberedMode('model3ds', mode, { status, errors: errors || (result?.feedUnavailable ? 1 : 0) });
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

export async function downloadModel3dsMenu (doClearTerminal = true) {
  const keySaved = !!CONFIG.secretKey;
  if (!keySaved) {
    const { mainMenu } = await import('./mainMenu.mjs');
    return mainMenu();
  }

  const hasModels = await hasSavedModel3ds();
  const choices = [
    {
      name: 'Latest',
      value: 'download-latest-model3ds',
      description: 'Download the newest published 3D. Drafts and unpublished are read through.'
    }
  ];
  if (hasModels) {
    choices.push({
      name: 'All',
      value: 'download-all-model3ds',
      description: 'Download all 3D. Any missing will be saved.'
    });
  }
  choices.push(new Separator(), { name: 'Back', value: 'back', description: 'Back to Downloads' });

  if (doClearTerminal) clearTerminal();
  else console.log();

  const choiceValues = choices.flatMap(choice => (choice && choice.value ? [choice.value] : []));
  let initial = 'download-latest-model3ds';
  if (CONFIG.model3dDownload === 'all' && choiceValues.includes('download-all-model3ds')) {
    initial = 'download-all-model3ds';
  }
  const preferred = previousMenuItem && previousMenuItem !== 'back' ? previousMenuItem : initial;

  const answer = await select({
    message: 'Download 3D:',
    choices,
    theme: customTheme,
    default: choiceValues.includes(preferred) ? preferred : initial
  });

  previousMenuItem = answer;

  if (answer === 'download-latest-model3ds') {
    await downloadModel3ds('latest');
    return downloadModel3dsMenu(false);
  }
  if (answer === 'download-all-model3ds') {
    await downloadModel3ds('all');
    return downloadModel3dsMenu(false);
  }
  return downloadMenu();
}
