import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import select, { Separator } from '@inquirer/select';
import { CONFIG, customTheme } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';
import { getSecretKey, requestKey, testKey, removeKey, encryptKey, unEncryptKey } from './keyActions.mjs';

export async function keyOptions () {
  const choices = [
    {
      name: 'Test secret key',
      value: 'test-secretkey',
      description: 'Test your key'
    },

    {
      name: 'View secret key',
      value: 'view-secretkey',
      description: 'View your key'
    },

    {
      name: 'Update secret key',
      value: 'update-secretkey',
      description: 'Update your key'
    },

    CONFIG.keyEncrypt ? {
      name: 'Remove password-protection from key',
      value: 'remove-password-secretkey',
      description: 'Remove password from secret key'
    } : {
      name: 'Encrypt key with password',
      value: 'add-password-secretkey',
      description: 'Add password to secret key'
    },

    {
      name: 'Delete secret key',
      value: 'delete-secretkey',
      description: 'Delete secret key'
    },

    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to main menu'
    }
  ];

  const answer = await select({
    message: 'Key options:',
    choices,
    theme: customTheme
  });

  let secretKey, result, confirmDelete;

  switch (answer) {
    case 'test-secretkey':
    secretKey = await getSecretKey();

    if (!secretKey) {
      return keyOptions();
    }

    result = await testKey(secretKey);

    if (result.success) {
      console.log(chalk.green(`Your secret key works.`));
    }

    else if (result.error) {
      if (result.httpStatus === 500) {
        console.log(chalk.red(`It looks like the service is down. Please check again shortly.`));
      }

      else {
        console.log(chalk.red(`Your secret key does not work. Does it need updating?`));
      }
    }
    return keyOptions();

    case 'view-secretkey':
    secretKey = await getSecretKey();

    if (!secretKey) {
      return keyOptions();
    }

    await confirm({ message: `Your secret key is: "${secretKey}". (Press Enter)`, default: true });
    return keyOptions();

    case 'update-secretkey':
    await requestKey();
    return keyOptions();

    case 'delete-secretkey':
    confirmDelete = await confirm({ message: 'Are you sure? This will delete the saved key?', default: false });

    if (confirmDelete) {
      await removeKey();
      console.log(chalk.green(`Key deleted`));
      return mainMenu();
    }

    return keyOptions();

    case 'add-password-secretkey':
    await encryptKey(CONFIG.secretKey);
    
    return keyOptions();

    case 'remove-password-secretkey':
    await unEncryptKey(CONFIG.secretKey);
    return keyOptions();
    
    case 'back':
    return mainMenu();
  }
}
