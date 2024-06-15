import chalk from 'chalk';
import select from '@inquirer/select';
import { customTheme } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';

export async function showInfo () {
  console.log(`${chalk.bold('civitai-sync')} downloads and saves your Civitai on-site generations
to your computer. It is unofficial, third-party software.

${chalk.bold('About')}
Using your secret key from the Civitai website, this performs the
equivalent of scrolling through your on-site generations and downloading
each image individually. It downloads the generation data and media into
date-ordered subdirectories.

${chalk.bold('Usage')}

  ${chalk.bold.italic('cd civitai-sync')}
  ${chalk.bold.italic('npm run cli')}

By default, a config file is saved at "${chalk.bold('config/default.json')}".

Specify a custom config location, with optional ".json":
  ${chalk.bold.italic('npm run cli config/bob')}

The config file can be anywhere: 
  ${chalk.bold.italic('npm run cli /bob/civitai/alice.json')}

${chalk.white.bold('Find your secret key')}
- In your browser, go to the Civitai website (you must be logged in)
- Open ${chalk.bold('"Developer Tools"')} (press "Ctrl+Shift+I" / "F12", or choose
"More tools" in the browser menu).
- Open the "${chalk.bold('Storage')}" tab (Firefox) or "${chalk.bold('Application')}" tab (Chrome/Brave)
- Open the "${chalk.bold('Cookies')}" list, and click on "${chalk.bold('https://civitai.com')}".
- Click the cookie named "${chalk.bold('__Secure-civitai-token')}" and copy the value.

${chalk.white.bold('Set your secret key')}
- Back here, in the menu, choose "${chalk.bold('Set secret key')}".
- Paste your secret key (right-click, or use "Ctrl+Shift+V" or equivalent).
- Optionally, you can encrypt your key with a password.

The key will expire within a month.
The expiry date is shown in the browser Cookies list.

When it expires, go to "${chalk.bold('Key options')}" > "${chalk.bold('Update secret key')}".

In future, this process could be automated via a browser extension.
Or an official API.

${chalk.bold('Download generations')}
Once your key is saved, you'll have the option "${chalk.bold('Download generations')}".
Wait until any current on-site generations are complete, to ensure
those images are saved.

Change download location and other options in "${chalk.bold('Download options')}".

Once you've downloaded your back catalogue, you can do so again at any
time, and only your latest will be downloaded.

If you only want to download data (prompts and parameters) but ${chalk.italic('not')} images,
choose "${chalk.bold('Download options')}" > "${chalk.bold('Change download type to: only data')}".

If your first download was stopped early or interrupted, to resume
downloading older items,
choose "${chalk.bold('Download options')}" > "${chalk.bold('Download oldest')}".

If you need to fill any gaps in your download record, e.g. because
of deleted files, or you download only data and then want images,
choose "${chalk.bold('Download options')}" > "${chalk.bold('Download oldest')}".

By Prem, https://premasagar.com
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
