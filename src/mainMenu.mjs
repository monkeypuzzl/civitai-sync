/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import process from 'node:process';
import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import { ExitPromptError } from '@inquirer/core';
import { downloadGenerationsMenu } from './downloadGenerationsMenu.mjs';
import { downloadPostsMenu } from './downloadPostsMenu.mjs';
import { keyOptions } from './keyOptionsMenu.mjs';
import { showInfo } from './showInfo.mjs';
import { CONFIG, CURRENT_VERSION, customTheme, clearTerminal } from './cli.mjs';
import { requestKey, getSecretKey } from './keyActions.mjs';
import { SOFTWARE, updateSoftware, checkForSoftwareUpdate } from './softwareUpdate.mjs';
import { getBrowseState, getBrowseDisplayUrl, startBrowseServer, stopBrowseServer, enableInteractiveShutdown } from './browse.mjs';

let previousMenuItem;

function formatTimeAgo (timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

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
            description: `Running at ${getBrowseDisplayUrl()}`
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
        name: `${chalk.hex('#a5d8ff')(`Install software update — v${SOFTWARE.latest.version}`)}`,
        value: 'software-update',
        description: SOFTWARE.latest.summary
      }
    );
  } else {
    choices.push(
      {
        name: 'Check for updates',
        value: 'check-update',
        description: SOFTWARE.checkedAt ? chalk.dim(`Last checked ${formatTimeAgo(SOFTWARE.checkedAt)}`) : chalk.dim(`version ${CURRENT_VERSION}`)
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
    console.log(`  ${chalk.green('\u25CF')} ${chalk.dim('Explorer:')} ${chalk.hex('#a5d8ff').underline(getBrowseDisplayUrl())}\n`);
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

      case 'check-update':
      console.log(chalk.dim('\n  Checking for updates...'));
      await checkForSoftwareUpdate({ force: true });
      if (SOFTWARE.hasUpdate) {
        console.log(chalk.hex('#a5d8ff')(`\n  Update available: v${SOFTWARE.latest.version}`));
      } else {
        console.log(chalk.dim(`\n  You're up to date (v${CURRENT_VERSION})`));
      }
      break;

      case 'software-update':
      secretKey = keySaved ? await getSecretKey() : undefined;

      if (await updateSoftware({ secretKey }) === true) {
        return;
      }
      break;

      case 'browse': {
      const networkAnswer = await select({
        message: 'Open Explorer on:',
        choices: [
          {
            name: 'This device only',
            value: '127.0.0.1',
            description: 'Access from this computer only'
          },
          {
            name: 'Local network',
            value: '0.0.0.0',
            description: 'Accessible to other devices on your network. Only use on a trusted network — no password protection.'
          }
        ],
        theme: customTheme
      });
      console.log(chalk.dim('\n  Starting Explorer server...'));
      await startBrowseServer({ host: networkAnswer });
      enableInteractiveShutdown();
      console.log(`  ${chalk.green('Explorer server started at')} ${chalk.hex('#a5d8ff').underline(getBrowseDisplayUrl())}`);
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
      process.exit(0);
    }
    // Otherwise: abort signal from software update checker — re-enter menu
  }

  return mainMenu();
}
