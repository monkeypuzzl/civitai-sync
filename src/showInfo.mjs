import chalk from 'chalk';
import select from '@inquirer/select';
import { customTheme } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';

export async function showInfo () {
  console.log(`${chalk.bold('civitai-sync')} downloads your Civitai onsite generations
to your computer.

${chalk.bold('Tool page')} for details:  
https://civitai.com/models/526058

${chalk.bold('Create API key')}:
https://civitai.com/user/account

${chalk.bold('Download generations')}
Downloads are saved inside the program folder in "generations".
Change the location in "${chalk.bold('Download options')}".

${chalk.bold('Download only data')}
For just the data files with prompts and parameters:
Select "${chalk.bold('Download options')}" > "${chalk.bold('Change download type to: only data')}".

${chalk.bold('Download problems?')}
Resume downloading oldest generations after an interruption:
Choose "${chalk.bold('Download options')}" > "${chalk.bold('Download oldest')}".

Fill gaps in your downloads:
Choose "${chalk.bold('Download options')}" > "${chalk.bold('Download missing')}".

${chalk.bold('Multiple accounts')}
You can run the CLI without specifying an account name:

  ${chalk.bold.italic('npm run cli')}

This saves a config file at "config/default.json".

To use another account, specify a unique name and path
for the config file:

  ${chalk.bold.italic('npm run cli config/bob')}

This will save a config file at "config/bob.json".  
You can give a full path to anywhere on the file system, and the
config file will be loaded from there.
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
