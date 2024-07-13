import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import select, { Separator } from '@inquirer/select';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';
import { getSecretKey, requestKey, testKey, removeKey, encryptKey, unEncryptKey } from './keyActions.mjs';

export async function keyOptions (message) {
  const choices = [
    {
      name: 'Test API key',
      value: 'test-key',
      description: 'Test your key'
    },

    {
      name: 'Update API key',
      value: 'update-key',
      description: 'Update your key'
    },

    CONFIG.keyEncrypt ? {
      name: 'Remove password-protection',
      value: 'remove-password-key',
      description: 'Remove password from key'
    } : {
      name: 'Add password-protection',
      value: 'add-password-key',
      description: 'Add password to key'
    },

    {
      name: 'Delete API key',
      value: 'delete-key',
      description: 'Delete key'
    },

    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to main menu'
    }
  ];

  clearTerminal();

  if (message) {
    console.log(message);
  }

  const answer = await select({
    message: 'Key options:',
    choices,
    theme: customTheme
  });

  let secretKey, result, confirmDelete;

  switch (answer) {
    case 'test-key':
    secretKey = await getSecretKey();

    if (!secretKey) {
      return keyOptions();
    }

    result = await testKey(secretKey);

    let message = '';

    if (result.success) {
      message = chalk.green(`Test API key: Your API key works.`);
    }

    else if (result.error) {
      if (result.httpStatus === 500) {
        message = chalk.red(`It looks like the service is down. Please check again shortly.`);
      }

      else {
        message = chalk.red(`Your API key does not work. Does it need updating?`);
      }
    }
    return keyOptions(message);

    case 'view-key':
    secretKey = await getSecretKey();

    if (!secretKey) {
      return keyOptions();
    }

    await confirm({ message: `Your API key is: "${secretKey}". (Press Enter)`, default: true });
    return keyOptions();

    case 'update-key':
    await requestKey();
    return keyOptions();

    case 'delete-key':
    confirmDelete = await confirm({ message: 'Are you sure? This will delete the saved key?', default: false });

    if (confirmDelete) {
      await removeKey();
      console.log(chalk.green(`Key deleted`));
      return mainMenu();
    }

    return keyOptions();

    case 'add-password-key':
    await encryptKey(CONFIG.secretKey);
    
    return keyOptions();

    case 'remove-password-key':
    await unEncryptKey(CONFIG.secretKey);
    return keyOptions();
    
    case 'back':
    return mainMenu();
  }
}
