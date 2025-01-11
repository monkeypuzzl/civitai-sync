/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import { downloadGenerationsMenu } from './downloadGenerationsMenu.mjs';
import { keyOptions } from './keyOptionsMenu.mjs';
import { showInfo } from './showInfo.mjs';
import { CONFIG, CURRENT_VERSION, customTheme, clearTerminal } from './cli.mjs';
import { requestKey, getSecretKey } from './keyActions.mjs';
import { SOFTWARE, updateSoftware } from './softwareUpdate.mjs';

let previousMenuItem;

export async function mainMenu ({ clear = true, defaultValue = '', abortSignal = undefined } = {}) {
  const keySaved = !!CONFIG.secretKey;
  const choices = [];

  if (keySaved) {
    choices.push(
      {
        name: 'Download generations',
        value: 'download-generations',
        description: `Download generation data${CONFIG.excludeImages ? '' : ' and media'}`
      },

      {
        name: 'Settings',
        value: 'settings',
        description: 'Update API key, add/remove password'
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
    console.log('\n');
  }

  try {
    const answer = await select({
      message: 'Please select:',
      choices,
      theme: customTheme,
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

      case 'info':
      return showInfo();

      case 'software-update':
      // Use secretKey if it has been set; otherwise update without key
      secretKey = keySaved ? await getSecretKey() : undefined;

      if (await updateSoftware({ secretKey }) === true) {
        return;
      }
      break;

      case 'exit':
      return;
    }
  }

  catch (ignoreErr) {
    // Abort signal
  }

  return mainMenu();
}
