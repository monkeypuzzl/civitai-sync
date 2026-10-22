import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import { mainMenu } from './mainMenu.mjs';
import { downloadMenu } from './downloadMenu.mjs';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { hasSavedPosts } from './postsPresence.mjs';
import { rememberPostDownload, settleRememberedMode } from './downloadTypes.mjs';

let previousMenuItem;

// Started at load so Download → Posts usually finds the walk finished.
// Replaced when the data folder changes (Settings → Folders).
let presencePromise = null;
let presenceRoot;

function savedPostsPresence () {
  const root = CONFIG?.dataPath;
  if (presencePromise === null || presenceRoot !== root) {
    presenceRoot = root;
    presencePromise = hasSavedPosts();
  }
  return presencePromise;
}

savedPostsPresence();

async function resolveUsername (secretKey) {
  if (CONFIG.username) {
    return CONFIG.username;
  }

  const { fillIfMissing } = await import('./userData.mjs');
  await fillIfMissing({ secretKey });

  return CONFIG.username || null;
}

export async function downloadPosts (mode = 'latest') {
  const [
    { fetchPostsAllKinds, formatPostCompletion, listenForEscKeyPress },
    { getSecretKey, requestKey },
    { default: inquirer },
    { default: confirm }
  ] = await Promise.all([
    import('./downloadPostsActions.mjs'),
    import('./keyActions.mjs'),
    import('inquirer'),
    import('@inquirer/confirm')
  ]);

  const secretKey = await getSecretKey();
  const { requireLibraryAccount } = await import('./accountIdentity.mjs');
  const gate = await requireLibraryAccount(secretKey);
  if (!gate.ok) {
    console.log(chalk.red(gate.message));
    return;
  }
  const ui = new inquirer.ui.BottomBar();

  function log (text) {
    if (text) ui.updateBottomBar(text);
  }

  const escKeyController = listenForEscKeyPress({
    onAbort: () => ui.updateBottomBar(chalk.dim('  Stopping... finishing current download'))
  });

  let result;

  try {
    clearTerminal();
    ui.updateBottomBar(`${chalk.hex('#a5d8ff')('Resolving username...')}\n`);

    const username = await resolveUsername(secretKey);

    if (!username) {
      ui.updateBottomBar(chalk.red('Could not resolve username. Please check your API key.\n'));
      escKeyController.stop();
      return;
    }

    await rememberPostDownload(mode);

    const label = mode === 'latest' ? 'Downloading latest posts' : 'Downloading all posts';
    ui.updateBottomBar(`${chalk.hex('#a5d8ff')(label)}...\n${chalk.dim('Press Esc to stop')}\n`);

    result = await fetchPostsAllKinds({
      secretKey,
      username,
      latest: mode === 'latest',
      withImages: CONFIG.downloadMedia !== false,
      log,
      signal: escKeyController.signal
    });

    log(formatPostCompletion(result));
    const errors = (result?.errors || []).length;
    const status = result?.aborted ? 'aborted' : (errors && !result?.postsNew) ? 'error' : 'complete';
    await settleRememberedMode('posts', mode, { status, errors });
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

export async function downloadPostsMenu (doClearTerminal = true) {
  const keySaved = !!CONFIG.secretKey;

  if (!keySaved) {
    return mainMenu();
  }

  const hasPosts = await savedPostsPresence();
  // Same rule as the posts presence predicates: posts on disk, All not yet completed.
  const needGenerationData = hasPosts && CONFIG.postsGenerationDataFilled !== true;
  const needImageResources = hasPosts && CONFIG.postsImageResourcesFilled !== true;
  const needGenerationResponse = hasPosts && CONFIG.postsGenerationResponseFilled !== true;
  let latestDescription = 'Download posts from the last 30 days, and any post that is not saved yet. The newest saved post is included.';
  let allDescription = 'Download all posts. Any missing will be saved.';
  if (needGenerationData || needImageResources || needGenerationResponse) {
    latestDescription = 'Updates posts from the last 30 days. Older posts stay until All.';
    allDescription = 'Download All to update the posts.';
  }
  const choices = [];

  choices.push(
    {
      name: 'Latest',
      value: 'download-latest-posts',
      description: latestDescription
    }
  );

  if (hasPosts) {
    choices.push(
      {
        name: 'All',
        value: 'download-all-posts',
        description: allDescription
      }
    );
  }

  choices.push(
    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to Downloads'
    }
  );

  if (doClearTerminal) {
    clearTerminal();
  } else {
    console.log();
  }

  const choiceValues = choices.flatMap(choice => (choice && choice.value ? [choice.value] : []));
  let initial = 'download-latest-posts';
  if (needGenerationData || needImageResources || needGenerationResponse) initial = 'download-all-posts';
  else if (CONFIG.postDownload === 'all' && choiceValues.includes('download-all-posts')) {
    initial = 'download-all-posts';
  }
  const preferred = previousMenuItem && previousMenuItem !== 'back'
    ? previousMenuItem
    : initial;

  const answer = await select({
    message: 'Download posts:',
    choices,
    theme: customTheme,
    default: choiceValues.includes(preferred) ? preferred : initial
  });

  previousMenuItem = answer;

  switch (answer) {
    case 'download-latest-posts':
    await downloadPosts('latest');
    return downloadPostsMenu(false);

    case 'download-all-posts':
    await downloadPosts('all');
    return downloadPostsMenu(false);

    case 'back':
    return downloadMenu();
  }
}
