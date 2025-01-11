import inquirer from 'inquirer';
import select, { Separator } from '@inquirer/select';
import { fetchGenerations } from './downloadActions.mjs';
import { mainMenu } from './mainMenu.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { getSecretKey } from './keyActions.mjs';
import { dateIsOlderThanDays, fileExists } from './utils.mjs';
import { getGenerationDates, getDownloadTypes } from './generations.mjs';
import { setDownloadOptions } from './downloadOptionsMenu.mjs';

let previousMenuItem;

export async function downloadGenerations (mode = 'latest') {
  const secretKey = await getSecretKey(); 
  const tags = [];
  const ui = new inquirer.ui.BottomBar();
  const downloadTypes = getDownloadTypes('data');
  const labels = {
    'latest': 'Downloading latest generations',
    'oldest': 'Downloading oldest generations',
    'missing-tags': `Downloading ${downloadTypes.join(', ')} generations`,
    'missing-all': 'Downloading all generations'
  };

  if (CONFIG.excludeImages && !CONFIG.generationDataTypes.includes('all')) {
    tags.push(...CONFIG.generationDataTypes);
  }
  
  else if (!CONFIG.excludeImages && (mode === 'missing-tags' || !CONFIG.generationMediaTypes.includes('all'))) {
    tags.push(...CONFIG.generationMediaTypes.filter(type => type !== 'all'));
  }

  const options = {
    secretKey,
    overwriteIfModified: true,
    withImages: !CONFIG.excludeImages,
    tags,
    latest: mode === 'latest',
    oldest: mode === 'oldest',
    resume: mode === 'missing-tags' || mode === 'missing-all'
  };

  const label = labels[mode];

  try {
    clearTerminal();

    ui.updateBottomBar(`${label}...`);

    // TD: capture cursor and mode, for later resume
    await fetchGenerations(options, report => {
      ui.updateBottomBar(report);
    });
  }

  catch (error) {
    console.error(error);
  }
}

export async function downloadGenerationsMenu (doClearTerminal = true) {
  const keySaved = !!CONFIG.secretKey;

  if (!keySaved) {
    return mainMenu();
  }

  const dataDirExists = await fileExists(CONFIG.generationsDataPath);
  const dates = await getGenerationDates();
  const hasGenerations = !!dates.length;
  const oldestDate = dates[0];
  const hasOldGenerations = hasGenerations && dateIsOlderThanDays(oldestDate, 30);
  const downloadTypes = getDownloadTypes(CONFIG.excludeImages ? 'data' : 'media');
  const typesSentenceCase = downloadTypes.length ? downloadTypes[0][0].toUpperCase() + downloadTypes.join('/').slice(1) : '';
  const choices = [];

  choices.push(
    {
      name: 'Latest',
      value: 'download-latest-generations',
      description: `Download the most recent generations that have not yet been saved.${CONFIG.generationDataTypes.includes('all') ? '' : `\n${typesSentenceCase} generations will be downloaded.` }`
    }
  );
  
  if (hasGenerations && !hasOldGenerations) {
    choices.push(
      {
        name: 'Oldest',
        value: 'download-oldest-generations',
        description: 'Resume downloading the oldest generations that have not yet been saved.'
      }
    );
  }

  if (downloadTypes.length) {
    choices.push({
      name: typesSentenceCase,
      value: 'download-missing-workflow-tags',
      description: `Download ${downloadTypes.join('/')} generations in the last 30 days.\nAny missing will be saved.`
    });
  }

  if (dataDirExists && CONFIG.generationDataTypes.includes('all')) {
    choices.push({
      name: 'All',
      value: 'download-missing-all',
      description: `Download all generations in the last 30 days${downloadTypes.length ? ` (including ${downloadTypes.join('/')})` : ''}.\nAny missing will be saved.`
    });
  }
  
  choices.push(
    {
      name: 'Options',
      value: 'download-options',
      description: 'Select options for generation downloads'
    },

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
    message: 'Download generations:',
    choices,
    theme: customTheme,
    default: previousMenuItem !== 'back' ? previousMenuItem : undefined
  });

  previousMenuItem = answer;

  switch (answer) {
    case 'download-latest-generations':
    await downloadGenerations('latest');
    return downloadGenerationsMenu(false);

    case 'download-oldest-generations':
    await downloadGenerations('oldest');
    return downloadGenerationsMenu(false);

    case 'download-missing-workflow-tags':
    await downloadGenerations('missing-tags');
    return downloadGenerationsMenu(false);

    case 'download-missing-all':
    await downloadGenerations('missing-all');
    return downloadGenerationsMenu(false);

    case 'download-options':
    return setDownloadOptions();

    case 'back':
    return mainMenu();
  }
}
