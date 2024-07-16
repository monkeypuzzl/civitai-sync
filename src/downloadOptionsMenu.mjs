import chalk from 'chalk';
import inquirer from 'inquirer';
import confirm from '@inquirer/confirm';
import select, { Separator } from '@inquirer/select';
import { fileExists } from './utils.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';
import { getSecretKey } from './keyActions.mjs';
import { setConfigParam } from './config.mjs';
import { fetchGenerations, countGenerations, openDataDirectory, openMediaDirectory } from './downloadActions.mjs';

export async function setDownloadOptions (doClearTerminal = true) {
  const choices = [];

  const [dataDirExists, mediaDirExists] = await Promise.all([
    fileExists(CONFIG.generationsDataPath),
    !CONFIG.excludeImages && CONFIG.generationsDataPath !== CONFIG.generationsMediaPath && fileExists(CONFIG.generationsMediaPath)
  ]);

  if (dataDirExists) {
    choices.push(
      {
        name: 'Download oldest',
        value: 'download-oldest',
        description: `For when a download has been stopped early, this resumes downloading older generations.`,
      },

      {
        name: 'Download missing',
        value: 'download-missing',
        description: `If you have deleted data, or it you download only data and later change to download media, this downloads anything missing.`,
      }
    );
  }

  choices.push(
    {
      name: 'Data download location',
      value: 'set-data-location',
      description: `Currently: "${CONFIG.generationsDataPath}"${!CONFIG.excludeImages && CONFIG.generationsMediaPath === CONFIG.generationsDataPath ? chalk.hex('#FFA500')(' (Media will download into the same directory as data)') : ''}`,
    }
  );

  if (!CONFIG.excludeImages) {
    choices.push(
      {
        name: 'Media download location',
        value: 'set-media-location',
        description: `Currently: "${CONFIG.generationsMediaPath}"${CONFIG.generationsMediaPath === CONFIG.generationsDataPath ? chalk.hex('#FFA500')(' (Media will download into the same directory as data)') : ''}`,
      }
    );
  }

  if (dataDirExists) {
    choices.push(
      {
        name: `${!CONFIG.excludeImages && CONFIG.generationsMediaPath === CONFIG.generationsDataPath ? 'Open download directory' : 'Open data directory'}`,
        value: 'open-data-directory',
        description: `Open: "${CONFIG.generationsDataPath}"`,
      }
    );
  }

  if (mediaDirExists) {
    choices.push(
      {
        name: 'Open media directory',
        value: 'open-media-directory',
        description: `Open: "${CONFIG.generationsMediaPath}"`,
      }
    );
  }

  if (dataDirExists) {
    choices.push(
      {
        name: 'Count generations',
        value: 'count-generations',
        description: 'Show number of downloaded generations'
      }
    );
  }

  if (CONFIG.excludeImages) {
    choices.push(
      {
        name: `Change download type to: data ${chalk.italic('and')} media?`,
        value: 'set-download-type',
        description: `Currently: ${chalk.italic('only')} data`,
      }
    );
  }

  else {
    choices.push(
      {
        name: `Change download type to: ${chalk.italic('only')} data?`,
        value: 'set-download-type',
        description: `Currently: data ${chalk.italic('and')} media`,
      }
    )
  }

  choices.push(
    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to main menu'
    }
  );

  if (doClearTerminal) {
    clearTerminal();
  }

  else {
    console.log('\n');
  }

  const answer = await select({
    message: 'Download options:',
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false
  });

  let secretKey, report, reportText, ui;

  switch (answer) {
    case 'set-download-type':
    await setConfigParam('excludeImages', !CONFIG.excludeImages);
    return setDownloadOptions();

    case 'download-oldest':
    secretKey = await getSecretKey();
    
    if (!secretKey) {
      return setDownloadOptions();
    }

    clearTerminal();
    ui = new inquirer.ui.BottomBar();

    try {
      await fetchGenerations({ secretKey, oldest: true, withImages: !CONFIG.excludeImages }, txt => ui.updateBottomBar(txt));
    }

    catch (error) {
      console.error(error);
    }

    return setDownloadOptions(false);

    case 'download-missing':
    secretKey = await getSecretKey();
    
    if (!secretKey) {
      return setDownloadOptions(false);
    }

    clearTerminal();
    ui = new inquirer.ui.BottomBar();

    try {
      await fetchGenerations({ secretKey, resume: true, withImages: !CONFIG.excludeImages, checkImages: !CONFIG.excludeImages }, txt => ui.updateBottomBar(txt));
    }

    catch (error) {
      console.error(error);
    }

    return setDownloadOptions(false);

    case 'set-data-location':
    return setDataDownloadLocation();

    case 'set-media-location':
    return setMediaDownloadLocation();

    case 'open-data-directory':
    return openDataDirectory();

    case 'open-media-directory':
    return openMediaDirectory();

    case 'count-generations':
    console.log('Counting...');
    report = await countGenerations({ withImages: !CONFIG.excludeImages });
    
    if (report.generations) {
      reportText = `\nThere are ${report.generations} generations downloaded, between ${report.fromDate} and ${report.toDate}.`;
    
      if (!CONFIG.excludeImages) {
        reportText += `\n${report.imagesSaved} images are saved.`;
      }

      console.log(reportText);
    }

    else {
      console.log(`\nThere are no generations downloaded in the data directory.`);
    }
    
    return setDownloadOptions(false);

    case 'back':
    return mainMenu();
  }

  return mainMenu();
}

async function setDataDownloadLocation () {
  const generationsDataPath = await inquirer.prompt([
    {
      type: 'input',
      message: `New DATA location, currently "${CONFIG.generationsDataPath}" (press Enter to cancel):`,
      name: 'download-location'
    }
  ]);

  const newPath = generationsDataPath['download-location'];

  if (newPath) {
    await setConfigParam('generationsDataPath', newPath);
    
    console.log(chalk.green(`Data location changed to ${newPath}\n${newPath === CONFIG.generationsMediaPath ? chalk.hex('#FFA500')('(Media will download into the same directory as data)\n') : ''}`));

    const answer = await confirm({ message: `Also change the MEDIA location, currently: ${CONFIG.generationsMediaPath}?`, default: false });

    if (answer) {
      return setMediaDownloadLocation();
    }
  }

  return setDownloadOptions();
}

async function setMediaDownloadLocation () {
  const generationsDataPath = await inquirer.prompt([
    {
      type: 'input',
      message: `New MEDIA location, currently ${CONFIG.generationsMediaPath} (press Enter to cancel):`,
      name: 'download-location'
    }
  ]);

  const newPath = generationsDataPath['download-location'];

  if (newPath) {
    await setConfigParam('generationsMediaPath', newPath);
    console.log(chalk.green(`Media location changed to ${newPath}\n${newPath === CONFIG.generationsDataPath ? chalk.hex('#FFA500')('(Media will download into the same directory as data)\n') : ''}`));

  }

  return setDownloadOptions();
}

