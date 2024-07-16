import inquirer from 'inquirer';
import select, { Separator } from '@inquirer/select';
import { setDownloadOptions } from './downloadOptionsMenu.mjs';
import { fetchGenerations } from './downloadActions.mjs';
import { keyOptions } from './keyOptionsMenu.mjs';
import { showInfo } from './showInfo.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { getSecretKey, requestKey } from './keyActions.mjs';

export async function mainMenu (doClearTerminal = true) {
  const keySaved = !!CONFIG.secretKey;
  const choices = [];

  if (keySaved) {
    choices.push(
      {
        name: 'Download generations',
        value: 'download-generations',
        description: 'Download latest data and images'
      },

      {
        name: 'Download options',
        value: 'download-options',
        description: 'Select options for downloads'
      },

      {
        name: 'Key options',
        value: 'options-key',
        description: 'Update, add/remove password, delete your API key',
      }
    );
  }

  else {
    choices.unshift({
      name: 'Set API key',
      value: 'set-key',
      description: 'Set your API key. Read "Show info" for how to get it.',
    });
  }

  choices.push(
    {
      name: 'Show info',
      value: 'info',
      description: 'About this software',
    },

    new Separator(),

    {
      name: 'Exit',
      value: 'exit',
      description: 'Exit'
    }
  );

  if (doClearTerminal) {
    clearTerminal();
  }

  else {
    console.log('\n');
  }

  const answer = await select({
    message: 'Please select:',
    choices,
    theme: customTheme
  });

  let secretKey, ui;

  switch (answer) {
    case 'set-key':
    await requestKey();
    return mainMenu();

    case 'options-key':
    return keyOptions();

    case 'download-generations':
    secretKey = await getSecretKey();
    
    if (!secretKey) {
      return mainMenu();
    }

    try {
      clearTerminal();
      ui = new inquirer.ui.BottomBar();
      await fetchGenerations({ secretKey, overwrite: false, withImages: !CONFIG.excludeImages }, txt => ui.updateBottomBar(txt));
    }

    catch (error) {
      console.error(error);
    }

    return mainMenu(false);

    case 'download-options':
    return setDownloadOptions();

    case 'info':
    return showInfo();

    case 'exit':
    return;
  }
}
