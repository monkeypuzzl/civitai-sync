/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import { ExitPromptError } from '@inquirer/core';
import { downloadGenerationsMenu } from './downloadGenerationsMenu.mjs';
import { downloadPostsMenu } from './downloadPostsMenu.mjs';
import { keyOptions } from './keyOptionsMenu.mjs';
import { showInfo } from './showInfo.mjs';
import { CONFIG, CURRENT_VERSION, customTheme, clearTerminal } from './cli.mjs';
import { requestKey, getSecretKey } from './keyActions.mjs';
import { SOFTWARE, updateSoftware } from './softwareUpdate.mjs';
import { getBrowseState, startBrowseServer, stopBrowseServer } from './browse.mjs';

let previousMenuItem;

export async function shutdownBrowseServer () {
  if (getBrowseState()) {
    await stopBrowseServer();
  }
}

export async function mainMenu ({ clear = true, defaultValue = '', abortSignal = undefined } = {}) {
  const keySaved = !!CONFIG.secretKey;
  const choices = [];
  const browsing = !!getBrowseState();

  if (keySaved) {
    choices.push(
      {
        name: 'Download generations',
        value: 'download-generations',
        description: `Download generation data${CONFIG.excludeImages ? '' : ' and media'}`
      },

      {
        name: 'Download posts',
        value: 'download-posts',
        description: 'Download your published posts and their images/videos'
      },

      {
        name: 'Settings',
        value: 'settings',
        description: 'Update API key, add/remove password'
      },

      new Separator(),

      browsing
        ? {
            name: `${chalk.red('Stop')} Explorer server`,
            value: 'browse-stop',
            description: `Running at ${getBrowseState().url}`
          }
        : {
            name: 'Start Explorer',
            value: 'browse',
            description: 'Open your local library of creations in the browser'
          }
    );
  }

  else {
    choices.unshift({
      name: 'Set API key',
      value: 'set-key',
      description: 'Set your API key. Read "About" for how to find it.'
    });
  }

  choices.push(
    {
      name: 'About',
      value: 'info',
      description: `About this software, ${chalk.italic(`version ${CURRENT_VERSION}`)}`
    }
  );

  if (SOFTWARE.hasUpdate) {
    choices.push(
      {
        name: `${chalk.hex('#a5d8ff')(`Install software update, v${SOFTWARE.latest.version}`)}`,
        value: 'software-update',
        description: SOFTWARE.latest.summary
      }
    );
  }

  choices.push(
    new Separator(),

    {
      name: 'Exit',
      value: 'exit',
      description: 'Exit'
    }
  );

  if (clear) {
    clearTerminal();
  }

  else {
    console.log();
  }

  if (browsing) {
    console.log(`  ${chalk.green('\u25CF')} ${chalk.dim('Explorer:')} ${chalk.hex('#a5d8ff').underline(getBrowseState().url)}\n`);
  }

  try {
    const answer = await select({
      message: 'Please select:',
      choices,
      theme: customTheme,
      pageSize: choices.length,
      default: defaultValue || previousMenuItem
    }, { signal: abortSignal });

    previousMenuItem = answer;

    let secretKey;

    switch (answer) {
      case 'set-key':
      await requestKey();
      break;

      case 'settings':
      return keyOptions();

      case 'download-generations':
      return downloadGenerationsMenu();

      case 'download-posts':
      return downloadPostsMenu();

      case 'info':
      return showInfo();

      case 'software-update':
      secretKey = keySaved ? await getSecretKey() : undefined;

      if (await updateSoftware({ secretKey }) === true) {
        return;
      }
      break;

      case 'browse': {
      console.log(chalk.dim('\n  Starting Explorer server...'));
      await startBrowseServer();
      console.log(`  ${chalk.green('Explorer server started at')} ${chalk.hex('#a5d8ff').underline(getBrowseState().url)}`);
      break;
      }

      case 'browse-stop': {
      await stopBrowseServer();
      console.log(chalk.dim('\n  Explorer server stopped.'));
      break;
      }

      case 'exit':
      await shutdownBrowseServer();
      return;
    }
  }

  catch (err) {
    if (err instanceof ExitPromptError) {
      await shutdownBrowseServer();
      return;
    }
    // Otherwise: abort signal from software update checker — re-enter menu
  }

  return mainMenu();
}
