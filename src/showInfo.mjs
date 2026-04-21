import chalk from 'chalk';
import select from '@inquirer/select';
import { customTheme, CURRENT_VERSION, clearTerminal } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';
import { civitaiUrl } from './civitaiDomain.mjs';

export async function showInfo () {
  clearTerminal({ suffix: ` / v${CURRENT_VERSION}` });

  console.log(`
${chalk.bold('Model page')}:
${civitaiUrl('/models/526058')}

${chalk.bold('Discussion page')} for ideas, issues, newest comments:  
${civitaiUrl('/articles/5676')}

${chalk.bold('Create API key')}:
${civitaiUrl('/user/account')}

${chalk.bold('Download generations, posts, and media')} by following the instructions in the "Download" menu. You can also browse your local library of creations in the browser by selecting "Browse Creations" from the main menu.
Choose a download directory. By default, Data and media is saved in the program folder in "data" and "media" and config files are saved in the "config".
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
