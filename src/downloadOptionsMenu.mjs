import chalk from 'chalk';
import inquirer from 'inquirer';
import confirm from '@inquirer/confirm';
import select, { Separator } from '@inquirer/select';
import checkbox from '@inquirer/checkbox';
import { fileExists, removeDirectoryIfEmpty } from './utils.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { downloadGenerationsMenu } from './downloadGenerationsMenu.mjs';
import { setConfigParam } from './config.mjs';
import { countGenerations, openDataDirectory, openMediaDirectory } from './downloadActions.mjs';
import { copyAllGeneratedMediaTypes, MEDIA_DIRECTORIES, deleteAllDeletedMedia } from './generations.mjs';

let COUNT_REPORT;
let previousMenuItem;

export async function setDownloadOptions ({ clear = true, defaultValue = '' } = {}) {
  const choices = [];
  const dataDirExists = await fileExists(CONFIG.generationsDataPath);
  const mediaDirExists = await fileExists(CONFIG.generationsMediaPath);
  const currentMediaDirectories = (CONFIG.generationMediaTypes || []).map(type => MEDIA_DIRECTORIES[type]);
  const currentDataTypes = (CONFIG.generationDataTypes || []).map(type => MEDIA_DIRECTORIES[type]);

  choices.push(
    {
      name: `Save media: ${chalk.bold(CONFIG.excludeImages ? 'no' : currentMediaDirectories.join(', '))}`,
      value: 'set-media-types',
      description: CONFIG.excludeImages ? 'No media will be downloaded' : `Media will be downloaded into folders: ${currentMediaDirectories.join(', ')}.\nAll generation data will be saved.`
    }
  );

  if (CONFIG.excludeImages) {
    const value = !currentDataTypes.length ? 'all' : currentDataTypes.join(', ');

    choices.push(
      {
        name: `Save data: ${chalk.bold(value)}`,
        value: 'set-data-types',
        description: `${currentDataTypes.length ? `Only ${value}` : 'All'} generation data will be saved.`
      }
    );
  }

  else if (!CONFIG.generationMediaTypes.includes('all')) {
    const currentDataFilter = CONFIG.generationDataTypes.includes('all') ? 'all' : 'media-folders';
    const FILTER_LABELS = {
      'all': 'all',
      'media-folders': `${currentMediaDirectories.join(', ')}`
    };
    const filterLabel = FILTER_LABELS[currentDataFilter];
    const otherFilterLabel = FILTER_LABELS[currentDataFilter === 'all' ? 'media-folders' : 'all'];

    choices.push(
      {
        name: `Save data: ${chalk.bold(filterLabel)}`,
        value: 'set-data-filter',
        description: currentDataFilter === 'all' ?
          `All generation data will be downloaded.\nPress Enter to download only ${chalk.italic(otherFilterLabel)} generation data.` :
          `Only ${chalk.italic(filterLabel)} generation data will be downloaded.\nPress Enter to download all generation data.`
      }
    );
  }

  if (dataDirExists) {
    if (CONFIG.excludeImages) { 
      choices.push(
        {
          name: 'Open download directory',
          value: 'open-data-directory',
          description: `Open: "${CONFIG.generationsDataPath}" in file explorer`,
        }
      );
    }

    else {
      choices.push(
        {
          name: 'Open download directory',
          value: 'open-directory',
          description: `Open directory in file explorer`,
        }
      );
    }
  }

  if (CONFIG.excludeImages) {  
    choices.push(
      {
        name: 'Change download directory',
        value: 'set-data-directory',
        description: `"${CONFIG.generationsDataPath}"`,
      }
    );
  }

  else {
    choices.push(
      {
        name: 'Change download directory',
        value: 'change-directory',
        description: `${
          CONFIG.generationsDataPath === CONFIG.generationsMediaPath ?
          `Data & media: ${chalk.italic(CONFIG.generationsDataPath)}\n${chalk.hex('#FFA500')('Media is set to download into the same directory as data')}` :
          `Data: ${chalk.italic(CONFIG.generationsDataPath)}\nMedia: ${chalk.italic(CONFIG.generationsMediaPath)}`
          }`
      }
    );
  }

  if (dataDirExists) {
    choices.push(
      {
        name: `Count generations${COUNT_REPORT ? ` (${COUNT_REPORT.generations})` : ''}`,
        value: 'count-generations',
        description: 'Show number of downloaded generations'
      }
    );
  }

  if (mediaDirExists && !CONFIG.excludeImages) {
    choices.push(
      {
        name: 'Remove deleted media',
        value: 'remove-deleted-media',
        description: `Remove downloaded media that has been deleted from the onsite generator.\n\nIf you delete media onsite that has already been downloaded:\nFirst, ${chalk.bold('download all generations')} to update your data, then run this.\nCurrently, deletion isn't detected when ${chalk.italic('every image')} in a generation has been deleted.`
      }
    );
  }

  choices.push(
    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to Download generations'
    }
  );

  if (clear) {
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
    loop: false,
    default: defaultValue || previousMenuItem !== 'back' ? previousMenuItem : undefined
  });

  previousMenuItem = answer;

  let report, reportText, newValue;

  switch (answer) {
    case 'change-directory':
    return changeDirectoryMenu();
    
    case 'open-directory':
    return openDirectoryMenu();

    case 'set-data-directory':
    return setDataDownloadLocation();

    case 'open-data-directory':
    openDataDirectory();
    break;

    case 'set-save-media':
    await setConfigParam('excludeImages', !CONFIG.excludeImages);
    return setDownloadOptions();

    case 'set-media-types':
    return setGenerationMediaTypes();

    case 'set-data-types':
    return setGenerationDataTypes();

    case 'set-data-filter':
    // There is media, but not all media
    if (CONFIG.generationDataTypes.includes('all')) {
      newValue = CONFIG.generationMediaTypes;
    }

    else {
      newValue = ['all'];
    }

    await setConfigParam('generationDataTypes', newValue);
    return setDownloadOptions();

    case 'count-generations':
    console.log('Counting...');
    report = await countGenerations({ withImages: !CONFIG.excludeImages });
    COUNT_REPORT = report;
    
    if (report.generations) {
      reportText = `\nThere are ${report.generations} generations downloaded between ${report.fromDate} and ${report.toDate}.`;
    
      if (!CONFIG.excludeImages) {
        reportText += `\n${report.imagesSaved} images are saved.`;
      }

      console.log(reportText);
    }

    else {
      console.log(`\nThere are no generations downloaded in the data directory.`);
    }
    
    return setDownloadOptions({ clear: false });

    case 'remove-deleted-media':
    await deleteAllDeletedMedia();
    return setDownloadOptions({ clear: false });

    case 'back':
    return downloadGenerationsMenu();
  }

  return setDownloadOptions();
}

let previousMenuItemEditDirectory;

async function changeDirectoryMenu (doClearTerminal = true) {
  const choices = [
    {
      name: 'Data directory',
      value: 'set-data-directory',
      description: `"${CONFIG.generationsDataPath}"${CONFIG.generationsMediaPath === CONFIG.generationsDataPath ? chalk.hex('#FFA500')('\nMedia is currently set to download into the same directory as data') : ''}`,
    },

    {
      name: 'Media directory',
      value: 'set-media-directory',
      description: `"${CONFIG.generationsMediaPath}"${CONFIG.generationsMediaPath === CONFIG.generationsDataPath ? chalk.hex('#FFA500')('\nMedia is currently set to download into the same directory as data') : ''}`,
    },

    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to download options'
    }
  ];

  if (doClearTerminal) {
    clearTerminal();
  }

  else {
    console.log('\n');
  }

  const answer = await select({
    message: 'Change directory:',
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    default: previousMenuItemEditDirectory !== 'back' ? previousMenuItemEditDirectory : undefined
  });

  previousMenuItemEditDirectory = answer;

  switch (answer) {
    case 'set-data-directory':
    return setDataDownloadLocation();

    case 'set-media-directory':
    return setMediaDownloadLocation();

    case 'back':
    return setDownloadOptions();
  }

  return changeDirectoryMenu();
}

let previousMenuItemDirectory;

async function openDirectoryMenu (doClearTerminal = true) {
  const mediaDirExists = !CONFIG.excludeImages && CONFIG.generationsDataPath !== CONFIG.generationsMediaPath && await fileExists(CONFIG.generationsMediaPath);

  const choices = [
    {
      name: 'Data directory',
      value: 'open-data-directory',
      description: `Open "${CONFIG.generationsDataPath}" in file explorer`,
    }
  ];

  if (mediaDirExists) {
    choices.push(
      {
        name: 'Media directory',
        value: 'open-media-directory',
        description: `Open "${CONFIG.generationsMediaPath}" in file explorer`,
      }
    );
  }

  choices.push(
    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to download options'
    }
  );

  if (doClearTerminal) {
    clearTerminal();
  }

  else {
    console.log('\n');
  }

  const answer = await select({
    message: 'Open directory:',
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    default: previousMenuItemDirectory !== 'back' ? previousMenuItemDirectory : undefined
  });

  previousMenuItemDirectory = answer;

  switch (answer) {
    case 'open-data-directory':
    openDataDirectory();
    break;

    case 'open-media-directory':
    openMediaDirectory();
    break;

    case 'back':
    return setDownloadOptions();
  }

  return openDirectoryMenu();
}

async function setDataDownloadLocation () {
  const generationsDataPath = await inquirer.prompt([
    {
      type: 'input',
      message: `New DATA directory, currently "${CONFIG.generationsDataPath}" (press Enter to cancel):`,
      name: 'download-directory'
    }
  ]);

  const newPath = generationsDataPath['download-directory'];

  if (newPath) {
    await setConfigParam('generationsDataPath', newPath);
    
    console.log(chalk.green(`Data directory changed to ${newPath}\n${newPath === CONFIG.generationsMediaPath ? chalk.hex('#FFA500')('(Media will download into the same directory as data)\n') : ''}`));

    const answer = await confirm({ message: `Also change the MEDIA directory, currently: ${CONFIG.generationsMediaPath}?`, default: false });

    if (answer) {
      return setMediaDownloadLocation();
    }
  }

  if (CONFIG.excludeImages) {
    return setDownloadOptions();
  }

  return changeDirectoryMenu();
}

async function setMediaDownloadLocation () {
  const generationsDataPath = await inquirer.prompt([
    {
      type: 'input',
      message: `New MEDIA directory, currently ${CONFIG.generationsMediaPath} (press Enter to cancel):`,
      name: 'download-directory'
    }
  ]);

  const newPath = generationsDataPath['download-directory'];

  if (newPath) {
    await setConfigParam('generationsMediaPath', newPath);
    console.log(chalk.green(`Media directory changed to ${newPath}\n${newPath === CONFIG.generationsDataPath ? chalk.hex('#FFA500')('(Media will download into the same directory as data)\n') : ''}`));

  }

  return changeDirectoryMenu();
}

async function setGenerationMediaTypes () {
  clearTerminal();
  const generationTypes = CONFIG.generationMediaTypes;

  const choices = [
    {
      name: `All`,
      value: 'all',
      description: `All media (can be selected with others)`,
      checked: generationTypes.includes('all')
    },

    {
      name: `Favorite`,
      value: 'favorite',
      description: `Favorite media`,
      checked: generationTypes.includes('favorite')
    },

    {
      name: 'Liked',
      value: 'feedback:liked',
      description: `Liked media`,
      checked: generationTypes.includes('feedback:liked')
    },

    {
      name: 'Disliked',
      value: 'feedback:disliked',
      description: `Disliked media`,
      checked: generationTypes.includes('feedback:disliked')
    }
  ];

  const message = 'Select media to download. A folder is made for each type.\n  Unselect everything to download only data. /';

  const answer = await checkbox({
    message,
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    // instructions: 'Press <space> to select, <a> to toggle all, <i> to invert selection, and <enter> to proceed'
    instructions: '\nPress <space> to select, <enter> to proceed, ↑↓ arrow keys to change option.',
  });
  
  const newGenerationTypes = answer.sort();
  const shouldExcludeImages = !newGenerationTypes.length;

  if (CONFIG.excludeImages !== shouldExcludeImages) {
    await setConfigParam('excludeImages', shouldExcludeImages);
  }

  if (newGenerationTypes.join() !== generationTypes.join()) {
    await setConfigParam('generationMediaTypes', newGenerationTypes);

    if (newGenerationTypes.length) {
      await setConfigParam('generationDataTypes', newGenerationTypes);
    }

    const addedTypes = newGenerationTypes.filter(type => !generationTypes.includes(type));
    const removedTypes = generationTypes.filter(type => !newGenerationTypes.includes(type));
    
    if (addedTypes.length) {
      console.log('Updating file structure, please wait...');
      await copyAllGeneratedMediaTypes();
    }

    if (removedTypes) {
      for (let type of removedTypes) {
        const directoryName = MEDIA_DIRECTORIES[type];
        const dir = `${CONFIG.generationsMediaPath}/${directoryName}`;
        await removeDirectoryIfEmpty(dir);
      }
    }
  }

  return setDownloadOptions();
}


async function setGenerationDataTypes () {
  clearTerminal();
  const generationTypes = CONFIG.generationDataTypes || ['all'];

  const choices = [
    {
      name: `All`,
      value: 'all',
      description: `All generations (this includes all other types)`,
      checked: generationTypes.includes('all')
    },

    {
      name: `Favorite`,
      value: 'favorite',
      description: `Favorite generations`,
      checked: generationTypes.includes('favorite')
    },

    {
      name: 'Liked',
      value: 'feedback:liked',
      description: `Liked generations`,
      checked: generationTypes.includes('feedback:liked')
    },

    {
      name: 'Disliked',
      value: 'feedback:disliked',
      description: `Disliked generations`,
      checked: generationTypes.includes('feedback:disliked')
    }
  ];

  const message = 'Save data:\nSelect "All" to download all generation data.\nOr select which types of generation data to download. /';

  const answer = await checkbox({
    message,
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    // instructions: 'Press <space> to select, <a> to toggle all, <i> to invert selection, and <enter> to proceed'
    instructions: '\nPress <space> to select, <enter> to proceed, ↑↓ arrow keys to change option.',
    onInput: console.log
  });
  
  let newGenerationTypes = answer.sort();

  if (!newGenerationTypes.length) {
    newGenerationTypes = ['all'];
  }

  if (newGenerationTypes.join() !== generationTypes.join()) {
    await setConfigParam('generationDataTypes', newGenerationTypes);
  }

  return setDownloadOptions();
}
