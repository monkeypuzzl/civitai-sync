import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import { mainMenu } from './mainMenu.mjs';
import { downloadMenu } from './downloadMenu.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { getDownloadTypes, generationDownloadTags, generationMenuChoice, rememberGenerationDownload } from './downloadTypes.mjs';

function withFilesNote (description) {
  if (CONFIG.downloadMedia === false) return `${description}\nFiles are not saved.`;
  return description;
}

export async function downloadGenerations (mode = 'latest') {
  const [
    { fetchGenerations, formatCompletion, listenForEscKeyPress },
    { getSecretKey, requestKey },
    { default: inquirer },
    { default: confirm }
  ] = await Promise.all([
    import('./downloadActions.mjs'),
    import('./keyActions.mjs'),
    import('inquirer'),
    import('@inquirer/confirm')
  ]);

  const secretKey = await getSecretKey();
  if (secretKey) await rememberGenerationDownload(mode);

  const tags = generationDownloadTags(mode);
  const ui = new inquirer.ui.BottomBar();
  const downloadTypes = getDownloadTypes();
  const labels = {
    'latest': 'Downloading latest generations',
    'missing-tags': `Downloading ${downloadTypes.join(', ')} generations`,
    'missing-all': 'Downloading all generations'
  };

  function log (text) {
    if (text) ui.updateBottomBar(text);
  }

  const escKeyController = listenForEscKeyPress({
    onAbort: () => ui.updateBottomBar(chalk.dim('  Stopping... finishing current download'))
  });

  const options = {
    secretKey,
    overwriteIfModified: true,
    withImages: CONFIG.downloadMedia !== false,
    tags,
    latest: mode === 'latest',
    resume: mode === 'missing-tags' || mode === 'missing-all',
    log,
    signal: escKeyController.signal
  };

  const label = labels[mode];
  let result;

  try {
    clearTerminal();

    ui.updateBottomBar(`${chalk.hex('#a5d8ff')(label)}...\n${chalk.dim('Press Esc to stop')}\n`);

    result = await fetchGenerations(options);

    log(formatCompletion(result));
    import('./ownModels.mjs').then(m => m.scheduleOwnModelsCheck({ secretKey })).catch(() => {});
  }

  catch (error) {
    console.error(error);
  }

  finally {
    ui.close();
    escKeyController.stop();
  }

  if ((result?.errors || []).some(e => e?.code === 'UNAUTHORIZED') || result?.error?.code === 'UNAUTHORIZED') {
    const answer = await confirm({ message: chalk.red('\nNot authorized. Your API key needs updating. Update now?'), default: true });

    if (answer) {
      await requestKey();
    }
  }

  return result;
}

export async function downloadGenerationsMenu (doClearTerminal = true) {
  const keySaved = !!CONFIG.secretKey;

  if (!keySaved) {
    return mainMenu();
  }

  const reactionChoice = generationMenuChoice(CONFIG.generationReactions);
  const choices = [
    {
      name: 'Latest',
      value: 'latest',
      description: withFilesNote('Download the most recent generations that have not yet been saved. Missing files on those jobs are fetched too.')
    }
  ];

  if (reactionChoice) {
    choices.push({
      name: reactionChoice.label,
      value: reactionChoice.value,
      description: withFilesNote(`Download ${reactionChoice.label} generations in the last 30 days.\nMissing records and files in that period are saved.`)
    });
  }

  choices.push(
    {
      name: 'All',
      value: 'missing-all',
      description: withFilesNote('Download all generations in the last 30 days.\nMissing records and files in that period are saved.')
    },
    new Separator(),
    {
      name: 'Back',
      value: 'back',
      description: 'Back to Downloads'
    }
  );

  let highlighted = 'latest';
  if (CONFIG.generationDownload === 'all') highlighted = 'missing-all';
  else if (CONFIG.generationDownload === 'reactions' && reactionChoice) highlighted = reactionChoice.value;

  if (doClearTerminal) {
    clearTerminal();
  }

  else {
    console.log();
  }

  const answer = await select({
    message: 'Download generations:',
    choices,
    theme: customTheme,
    default: highlighted
  });

  switch (answer) {
    case 'latest':
    await downloadGenerations('latest');
    return downloadGenerationsMenu(false);

    case 'missing-tags':
    await downloadGenerations('missing-tags');
    return downloadGenerationsMenu(false);

    case 'missing-all':
    await downloadGenerations('missing-all');
    return downloadGenerationsMenu(false);

    case 'back':
    return downloadMenu();
  }
}
