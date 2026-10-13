import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import input from '@inquirer/input';
import select, { Separator } from '@inquirer/select';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';
import { getSecretKey, requestKey, testKey, removeKey, encryptKey, unEncryptKey, getAvailableSecretKey } from './keyActions.mjs';
import { setConfigParam } from './config.mjs';
import { fileExists } from './utils.mjs';
import { normalizeGenerationReactions } from './downloadTypes.mjs';
import { CIVITAI_DOMAINS, getCivitaiDomain } from './civitaiDomain.mjs';
import {
  EXPLORER_ACCESS_DEVICE,
  EXPLORER_ACCESS_LAN,
  normalizeExplorerAccess,
  explorerAccessLabel,
  explorerAccessDescription
} from './explorerServer.mjs';

let previousMenuItem;

// Once per process, and not before the Settings prompt. Test and Update
// already talk to Civitai. Back covers a visit that only changed folders:
// Civitai domain can appear on the next open, not in the middle of this one.
function scheduleSettingsRefresh () {
  import('./userData.mjs')
    .then(({ refreshOnce }) => refreshOnce({ secretKey: getAvailableSecretKey() }))
    .catch(() => {});
}

const REACTION_OPTION_LABELS = {
  favorite: 'Favorited',
  'feedback:liked': 'Liked'
};

function reactionOptionsName () {
  const labels = normalizeGenerationReactions(CONFIG.generationReactions)
    .map(type => REACTION_OPTION_LABELS[type]);
  return `Reaction options: ${labels.length ? labels.join(', ') : 'none'}`;
}

export async function keyOptions ({ clear = true, message } = {}) {
  const countDirExists = await fileExists(`${CONFIG.dataPath}/generations`) || await fileExists(`${CONFIG.dataPath}/posts`);
  const showSyncDeleted = CONFIG.downloadMedia !== false
    && await fileExists(`${CONFIG.mediaPath}/generations`);
  const choices = [
    {
      name: 'Folders',
      value: 'change-directory',
      description: CONFIG.dataPath === CONFIG.mediaPath
        ? `Media & Data: ${chalk.italic(CONFIG.dataPath)}`
        : `Media: ${chalk.italic(CONFIG.mediaPath)}\nData: ${chalk.italic(CONFIG.dataPath)}`
    },
    {
      name: CONFIG.downloadMedia !== false ? 'Files: Media and data' : 'Files: Data only',
      value: 'files',
      description: CONFIG.downloadMedia !== false
        ? 'Generations, posts, and comics save their files.'
        : 'Generations, posts, and comics save the record only.'
    }
  ];

  if (CONFIG.allowAltDomain === true) {
    choices.push(
      {
        name: `Civitai domain: ${getCivitaiDomain()}`,
        value: 'change-domain',
        description: `Choose: ${chalk.italic(CIVITAI_DOMAINS.join(', '))}`
      }
    );
  }

  choices.push(
    {
      name: `Explorer access: ${explorerAccessLabel(CONFIG.explorerAccess)}`,
      value: 'explorer-access',
      description: explorerAccessDescription(CONFIG.explorerAccess)
    },
    {
      name: reactionOptionsName(),
      value: 'reaction-options',
      description: 'Choose reactions to include in the Download > Generations menu.'
    },

    new Separator(),

    {
      name: 'Test API key',
      value: 'test-key',
      description: 'Test your key'
    },

    CONFIG.keyEncrypt ? {
      name: 'Remove password protection',
      value: 'remove-password-key',
      description: 'Remove password from key'
    } : {
      name: 'Add password protection',
      value: 'add-password-key',
      description: 'Add password to key'
    },

    {
      name: 'Update API key',
      value: 'update-key',
      description: 'Update your key'
    },

    {
      name: 'Delete API key',
      value: 'delete-key',
      description: 'Delete key'
    }
  );

  if (countDirExists || showSyncDeleted) {
    choices.push(new Separator());
    if (countDirExists) {
      choices.push({
        name: 'Count downloads',
        value: 'count-downloads',
        description: 'Count generations, posts and media'
      });
    }
    if (showSyncDeleted) {
      choices.push({
        name: 'Sync deleted',
        value: 'sync-deleted',
        description: `Remove generation files from the last 30 days that you have since\ndeleted in the onsite generator.\n\nFirst, run ${chalk.bold('Download > Generations > All')}, then ${chalk.bold('Sync deleted')}.`
      });
    }
  }

  choices.push(
    new Separator(),
    {
      name: 'Back',
      value: 'back',
      description: 'Back to main menu'
    }
  );

  if (clear) {
    clearTerminal();
  } else {
    console.log();
  }

  if (message) {
    console.log(message);
  }

  const answer = await select({
    message: 'Settings:',
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    default: previousMenuItem !== 'back' ? previousMenuItem : undefined
  });

  previousMenuItem = answer;

  let secretKey, result, confirmDelete;

  switch (answer) {
    case 'change-directory':
    return changeDirectoryMenu();

    case 'files':
    return changeFilesMenu();

    case 'reaction-options': {
      const { setReactionOptions } = await import('./downloadOptionsMenu.mjs');
      return setReactionOptions();
    }

    case 'sync-deleted': {
      const { runSyncDeleted } = await import('./downloadOptionsMenu.mjs');
      return runSyncDeleted();
    }

    case 'count-downloads':
    return runCountDownloads();

    case 'change-domain':
    return changeDomainMenu();

    case 'explorer-access':
    return changeExplorerAccessMenu();

    case 'test-key':
    secretKey = await getSecretKey();

    if (!secretKey) {
      return keyOptions();
    }

    scheduleSettingsRefresh();
    result = await testKey(secretKey);

    if (result.success) {
      message = chalk.green(`Test API key: Your API key works.`);
    }

    else if (result.error) {
      const is5xx = result.httpStatus >= 500 && result.httpStatus < 600;
      if (is5xx || (result.retryable && result.httpStatus >= 500)) {
        message = chalk.red(`The web service is down. Please check again shortly.`);
      } else {
        const sentence = result.message || 'The API key was rejected.';
        message = chalk.red(`${sentence}\nDoes the key need updating?`);
      }
    }
    return keyOptions({ message });

    case 'update-key':
    await requestKey();
    return keyOptions();

    case 'delete-key':
    confirmDelete = await confirm({ message: 'Are you sure? This will delete the saved key?', default: false });

    if (confirmDelete) {
      await removeKey();
      console.log(chalk.green(`API key deleted`));
      return mainMenu();
    }

    return keyOptions();

    case 'add-password-key':
    await encryptKey(CONFIG.secretKey);
    
    return keyOptions();

    case 'remove-password-key':
    await unEncryptKey(CONFIG.secretKey);
    return keyOptions();
    
    case 'back':
    scheduleSettingsRefresh();
    return mainMenu();
  }
}

async function changeDomainMenu () {
  const choices = CIVITAI_DOMAINS.map(domain => ({
    name: domain,
    value: domain,
    description: domain === getCivitaiDomain() ? chalk.dim('(current)') : ''
  }));

  choices.push(new Separator(), {
    name: 'Back',
    value: 'back',
    description: 'Back to Settings'
  });

  clearTerminal();

  const answer = await select({
    message: 'Civitai domain:',
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    default: getCivitaiDomain()
  });

  if (answer === 'back') {
    return keyOptions();
  }

  if (CIVITAI_DOMAINS.includes(answer) && answer !== CONFIG.domain) {
    await setConfigParam('domain', answer);
  }

  return keyOptions({ message: chalk.green(`Domain set to ${getCivitaiDomain()}`) });
}

async function changeFilesMenu () {
  const savingFiles = CONFIG.downloadMedia !== false;
  const choices = [
    {
      name: 'Media and data',
      value: true,
      description: savingFiles ? chalk.dim('(current)') : ''
    },
    {
      name: 'Data only',
      value: false,
      description: savingFiles ? '' : chalk.dim('(current)')
    },
    new Separator(),
    {
      name: 'Back',
      value: 'back',
      description: 'Back to Settings'
    }
  ];

  clearTerminal();

  const answer = await select({
    message: 'Files:',
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    default: savingFiles
  });

  if (answer === 'back') {
    return keyOptions();
  }

  if (CONFIG.downloadMedia !== answer) {
    await setConfigParam('downloadMedia', answer);
  }

  return keyOptions({
    message: chalk.green(`Files set to ${answer ? 'Media and data' : 'Data only'}`)
  });
}

async function changeExplorerAccessMenu () {
  const current = normalizeExplorerAccess(CONFIG.explorerAccess);
  const choices = [
    {
      name: 'This device only',
      value: EXPLORER_ACCESS_DEVICE,
      description: current === EXPLORER_ACCESS_DEVICE
        ? chalk.dim('(current)')
        : explorerAccessDescription(EXPLORER_ACCESS_DEVICE)
    },
    {
      name: 'Local network',
      value: EXPLORER_ACCESS_LAN,
      description: current === EXPLORER_ACCESS_LAN
        ? chalk.dim('(current)')
        : explorerAccessDescription(EXPLORER_ACCESS_LAN)
    }
  ];

  choices.push(new Separator(), {
    name: 'Back',
    value: 'back',
    description: 'Back to Settings'
  });

  clearTerminal();

  const answer = await select({
    message: 'Explorer access:',
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    default: current
  });

  if (answer === 'back') {
    return keyOptions();
  }

  if (answer !== current) {
    await setConfigParam('explorerAccess', answer);
  }

  return keyOptions({
    message: chalk.green(`Explorer access set to ${explorerAccessLabel(answer)}`)
  });
}

async function runCountDownloads () {
  const [
    { countDownloads, formatCountReport, formatElapsed },
    { default: inquirer }
  ] = await Promise.all([
    import('./downloadActions.mjs'),
    import('inquirer')
  ]);
  const ui = new inquirer.ui.BottomBar();
  const startTime = Date.now();

  function progressText (report) {
    const elapsed = formatElapsed(Date.now() - startTime);
    const parts = [];
    if (report.generations > 0) parts.push(`${report.generations.toLocaleString()} generations`);
    if (report.posts > 0) parts.push(`${report.posts.toLocaleString()} posts`);
    const content = parts.length ? parts.join(', ') : 'scanning…';
    return `${chalk.hex('#a5d8ff')('Counting')} ${chalk.dim('·')} ${content}\n${chalk.dim(`  elapsed ${elapsed}`)}`;
  }

  const tick = setInterval(() => ui.updateBottomBar(progressText(lastReport)), 1000);
  let lastReport = { generations: 0, posts: 0 };

  try {
    const report = await countDownloads({
      onProgress: (r) => {
        lastReport = { ...r };
        ui.updateBottomBar(progressText(lastReport));
      }
    });

    clearInterval(tick);
    ui.updateBottomBar(formatCountReport(report));
  }

  catch (error) {
    clearInterval(tick);
    ui.updateBottomBar(chalk.red(`Error counting: ${error.message}`));
  }

  finally {
    ui.close();
  }

  return keyOptions({ clear: false });
}

let previousMenuItemEditDirectory;

async function changeDirectoryMenu (doClearTerminal = true) {
  const choices = [
    {
      name: 'Media',
      value: 'set-media-directory',
      description: `${chalk.italic(CONFIG.mediaPath)}${CONFIG.mediaPath === CONFIG.dataPath ? `\n${chalk.hex('#FFA500')('Media is currently set to download into the same directory as data')}` : ''}`,
    },

    {
      name: 'Data',
      value: 'set-data-directory',
      description: `${chalk.italic(CONFIG.dataPath)}${CONFIG.mediaPath === CONFIG.dataPath ? `\n${chalk.hex('#FFA500')('Media is currently set to download into the same directory as data')}` : ''}`,
    },

    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to Settings'
    }
  ];

  if (doClearTerminal) {
    clearTerminal();
  } else {
    console.log();
  }

  const answer = await select({
    message: 'Folders:',
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
    return keyOptions();
  }

  return changeDirectoryMenu();
}

async function setDataDownloadLocation () {
  const newPath = await input({
    message: `New DATA root directory, currently "${CONFIG.dataPath}" (press Enter to cancel):`
  });

  if (newPath) {
    await setConfigParam('dataPath', newPath);
    
    console.log(chalk.green(`Data directory changed to ${newPath}\n${newPath === CONFIG.mediaPath ? chalk.hex('#FFA500')('(Media will download into the same directory as data)\n') : ''}`));

    const answer = await confirm({ message: `Also change the MEDIA directory, currently: ${CONFIG.mediaPath}?`, default: false });

    if (answer) {
      return setMediaDownloadLocation();
    }
  }

  return changeDirectoryMenu();
}

async function setMediaDownloadLocation () {
  const newPath = await input({
    message: `New MEDIA root directory, currently ${CONFIG.mediaPath} (press Enter to cancel):`
  });

  if (newPath) {
    await setConfigParam('mediaPath', newPath);
    console.log(chalk.green(`Media directory changed to ${newPath}\n${newPath === CONFIG.dataPath ? chalk.hex('#FFA500')('(Media will download into the same directory as data)\n') : ''}`));
  }

  return changeDirectoryMenu();
}
