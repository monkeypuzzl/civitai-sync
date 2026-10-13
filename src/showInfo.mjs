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

${chalk.bold('Discussion page')} for ideas, issues, comments:  
${civitaiUrl('/articles/5676')}

${chalk.bold('Create API key')}:
${civitaiUrl('/user/account')}

${chalk.bold('Download')}: save your Generations, Posts, and Comics.
${chalk.bold('Explore')}: open the "Explorer" for a website library of your creations.
${chalk.bold('Settings')}: change download folder, civitai domain, API key and more.
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
