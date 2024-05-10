import inquirer from 'inquirer';
import select, { Separator } from '@inquirer/select';
import { setDownloadOptions } from './downloadOptionsMenu.mjs';
import { fetchGenerations } from './downloadActions.mjs';
import { keyOptions } from './keyOptionsMenu.mjs';
import { showInfo } from './showInfo.mjs';
import { CONFIG, customTheme } from './cli.mjs';
import { getSecretKey, requestKey } from './keyActions.mjs';

export async function mainMenu () {
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
        value: 'options-secretkey',
        description: 'Update, add/remove password, delete your secret key',
      }
    );
  }

  else {
    choices.unshift({
      name: 'Set secret key',
      value: 'set-secretkey',
      description: 'Set your secret key. Read "Show info" for how to get it.',
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

  const answer = await select({
    message: 'Please select:',
    choices,
    theme: customTheme
  });

  let secretKey, ui;

  switch (answer) {
    case 'set-secretkey':
    await requestKey();
    return mainMenu();

    case 'options-secretkey':
    return keyOptions();

    case 'download-generations':
    secretKey = await getSecretKey();
    
    if (!secretKey) {
      return mainMenu();
    }

    ui = new inquirer.ui.BottomBar();

    try {
      await fetchGenerations({ secretKey, overwrite: false, withimages: !CONFIG.excludeImages }, txt => ui.updateBottomBar(txt));
    }

    catch (err) {
      console.error(err);
    }

    return mainMenu();

    case 'download-options':
    return setDownloadOptions();

    case 'info':
    return showInfo();

    case 'exit':
    return;
  }
}
