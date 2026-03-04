import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import checkbox from '@inquirer/checkbox';
import { fileExists, removeDirectoryIfEmpty } from './utils.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { downloadGenerationsMenu } from './downloadGenerationsMenu.mjs';
import { setConfigParam } from './config.mjs';
import { copyAllGeneratedMediaTypes, MEDIA_DIRECTORIES, deleteAllDeletedMedia } from './generations.mjs';

let previousMenuItem;

export async function setDownloadOptions ({ clear = true, defaultValue = '' } = {}) {
  const choices = [];
  const mediaDirExists = await fileExists(`${CONFIG.mediaPath}/generations`);
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

  if (mediaDirExists && !CONFIG.excludeImages) {
    choices.push(
      {
        name: 'Remove deleted media',
        value: 'remove-deleted-media',
        description: `Remove generation media that has been deleted from the onsite generator.\n\nIf you delete media onsite that has already been downloaded:\nFirst, ${chalk.bold('download all generations')} to update your data, then run this.`
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
    console.log();
  }

  const answer = await select({
    message: 'Generation options:',
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    default: defaultValue || previousMenuItem !== 'back' ? previousMenuItem : undefined
  });

  previousMenuItem = answer;

  let newValue;

  switch (answer) {
    case 'set-save-media':
    await setConfigParam('excludeImages', !CONFIG.excludeImages);
    return setDownloadOptions();

    case 'set-media-types':
    return setGenerationMediaTypes();

    case 'set-data-types':
    return setGenerationDataTypes();

    case 'set-data-filter':
    if (CONFIG.generationDataTypes.includes('all')) {
      newValue = CONFIG.generationMediaTypes;
    }

    else {
      newValue = ['all'];
    }

    await setConfigParam('generationDataTypes', newValue);
    return setDownloadOptions();

    case 'remove-deleted-media':
    await deleteAllDeletedMedia();
    return setDownloadOptions({ clear: false });

    case 'back':
    return downloadGenerationsMenu();
  }

  return setDownloadOptions();
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
        const dir = `${CONFIG.mediaPath}/generations/${directoryName}`;
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
