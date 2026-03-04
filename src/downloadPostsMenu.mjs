import inquirer from 'inquirer';
import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import { fetchPosts, formatPostCompletion, listenForEscKeyPress } from './downloadPostsActions.mjs';
import { mainMenu } from './mainMenu.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { getSecretKey } from './keyActions.mjs';
import { getMe } from './civitaiApi.mjs';
import { setConfigParam } from './config.mjs';
import { getPostDates } from './posts.mjs';

let previousMenuItem;

async function resolveUsername (secretKey) {
  if (CONFIG.username) {
    return CONFIG.username;
  }

  const data = await getMe({ secretKey });

  if (data && data.username) {
    await setConfigParam('username', data.username);
    return data.username;
  }

  return null;
}

export async function downloadPosts (mode = 'latest') {
  const secretKey = await getSecretKey();
  const ui = new inquirer.ui.BottomBar();

  function log (text) {
    if (text) ui.updateBottomBar(text);
  }

  const escKeyController = listenForEscKeyPress({
    onAbort: () => ui.updateBottomBar(chalk.dim('  Stopping... finishing current download'))
  });

  try {
    clearTerminal();
    ui.updateBottomBar(`${chalk.hex('#a5d8ff')('Resolving username...')}\n`);

    const username = await resolveUsername(secretKey);

    if (!username) {
      ui.updateBottomBar(chalk.red('Could not resolve username. Please check your API key.\n'));
      escKeyController.stop();
      return;
    }

    const label = mode === 'latest' ? 'Downloading latest posts' : 'Downloading all posts';
    ui.updateBottomBar(`${chalk.hex('#a5d8ff')(label)}...\n${chalk.dim('Press Esc to stop')}\n`);

    const result = await fetchPosts({
      secretKey,
      username,
      latest: mode === 'latest',
      withImages: !CONFIG.excludeImages,
      log,
      signal: escKeyController.signal
    });

    log(formatPostCompletion(result));

    return result;
  }

  catch (error) {
    console.error(error);
  }

  finally {
    ui.close();
    escKeyController.stop();
  }
}

export async function downloadPostsMenu (doClearTerminal = true) {
  const keySaved = !!CONFIG.secretKey;

  if (!keySaved) {
    return mainMenu();
  }

  const dates = await getPostDates();
  const hasPosts = !!dates.length;
  const choices = [];

  choices.push(
    {
      name: 'Latest',
      value: 'download-latest-posts',
      description: 'Download the most recent posts not yet saved.'
    }
  );

  if (hasPosts) {
    choices.push(
      {
        name: 'All',
        value: 'download-all-posts',
        description: 'Download all posts. Any missing will be saved.'
      }
    );
  }

  choices.push(
    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to main menu'
    }
  );

  if (doClearTerminal) {
    clearTerminal();
  } else {
    console.log();
  }

  const answer = await select({
    message: 'Download posts:',
    choices,
    theme: customTheme,
    default: previousMenuItem !== 'back' ? previousMenuItem : undefined
  });

  previousMenuItem = answer;

  switch (answer) {
    case 'download-latest-posts':
    await downloadPosts('latest');
    return downloadPostsMenu(false);

    case 'download-all-posts':
    await downloadPosts('all');
    return downloadPostsMenu(false);

    case 'back':
    return mainMenu();
  }
}
