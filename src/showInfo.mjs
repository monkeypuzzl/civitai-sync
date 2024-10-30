import chalk from 'chalk';
import select from '@inquirer/select';
import { customTheme } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';
import { getCurrentVersion } from './softwareUpdate.mjs';

export async function showInfo () {
  console.log(`${chalk.bold('civitai-sync')} downloads your Civitai creations.

${chalk.bold('Model page')}:
https://civitai.com/models/526058

${chalk.bold('Discussion page')} for ideas, issues, newest comments:  
https://civitai.com/articles/5676

${chalk.bold('Create API key')}:
https://civitai.com/user/account

${chalk.bold('Download generations')}
Data and media is saved inside the program folder in "generations".

Change the download directory, choose to download all or favorite generations,
or only data, in "${chalk.bold('Download generations')}" > "${chalk.bold('Options')}".

${chalk.bold('Multiple accounts')}
The program is normally run as:

  ${chalk.bold.italic('npm run cli')}

To download from an alternative account, specify a unique name for it:

  ${chalk.bold.italic('npm run cli bob')}

Or give the name as a file system path to where a config file can be created.
`);

  const choices = [
    {
      name: 'Back',
      value: 'back',
      description: 'Back to main menu'
    }
  ];

  const answer = await select({
    message: 'Back to main menu:',
    choices,
    theme: customTheme
  });

  switch (answer) {
    case 'back':
    return mainMenu();
  }
}
