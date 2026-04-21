import chalk from 'chalk';
import inquirer from 'inquirer';
import confirm from '@inquirer/confirm';
import select, { Separator } from '@inquirer/select';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';
import { getSecretKey, requestKey, testKey, removeKey, encryptKey, unEncryptKey, getAvailableSecretKey } from './keyActions.mjs';
import { openDataDirectory, openMediaDirectory, countDownloads, formatCountReport, formatElapsed } from './downloadActions.mjs';
import { setConfigParam } from './config.mjs';
import { fileExists } from './utils.mjs';
import { CIVITAI_DOMAINS, getCivitaiDomain } from './civitaiDomain.mjs';
import { refreshOnce } from './userData.mjs';

let previousMenuItem;

export async function keyOptions ({ clear = true, message } = {}) {
  // Kick off (at most) one background refresh per CLI session so the
  // allowAltDomain / username fields reflect recent Civitai-side changes.
  // The menu renders from current CONFIG; when the refresh completes, the
  // updated state will appear the next time keyOptions is re-invoked after a
  // user action (which it always is on selection).
  refreshOnce({ secretKey: getAvailableSecretKey() }).catch(() => {});

  const dataDirExists = await fileExists(`${CONFIG.dataPath}/generations`) || await fileExists(`${CONFIG.dataPath}/posts`);
  const choices = [];

  if (dataDirExists) {
    choices.push(
      {
        name: 'Open download directory',
        value: 'open-directory',
        description: CONFIG.dataPath === CONFIG.mediaPath
          ? `Open ${chalk.italic(CONFIG.dataPath)} in file explorer`
          : 'Open data or media directory in file explorer'
      }
    );
  }

  choices.push(
    {
      name: 'Change download directory',
      value: 'change-directory',
      description: CONFIG.dataPath === CONFIG.mediaPath
        ? `Data & media: ${chalk.italic(CONFIG.dataPath)}`
        : `Data: ${chalk.italic(CONFIG.dataPath)}\nMedia: ${chalk.italic(CONFIG.mediaPath)}`
    }
  );

  if (dataDirExists) {
    choices.push(new Separator());

    choices.push(
      {
        name: 'Count downloads',
        value: 'count-downloads',
        description: 'Count saved generations, posts, images and videos'
      }
    );
  }

  choices.push(new Separator());

  if (CONFIG.allowAltDomain === true) {
    choices.push(
      {
        name: `Change Domain: ${getCivitaiDomain()}`,
        value: 'change-domain',
        description: `Choose: ${chalk.italic(CIVITAI_DOMAINS.join(', '))}`
      }
    );
  }

  choices.push(
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
    },

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
    case 'open-directory':
    if (CONFIG.dataPath !== CONFIG.mediaPath) {
      return openDirectoryMenu();
    }
    openDataDirectory();
    return keyOptions({ clear: false });

    case 'change-directory':
    return changeDirectoryMenu();

    case 'count-downloads':
    return runCountDownloads();

    case 'change-domain':
    return changeDomainMenu();

    case 'test-key':
    secretKey = await getSecretKey();

    if (!secretKey) {
      return keyOptions();
    }

    result = await testKey(secretKey);

    if (result.success) {
      message = chalk.green(`Test API key: Your API key works.`);
    }

    else if (result.error) {
      if (result.httpStatus === 500) {
        message = chalk.red(`The web service is down. Please check again shortly.`);
      }

      else {
        message = chalk.red(`Your API key does not work. Does it need updating?`);
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

async function runCountDownloads () {
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
      name: 'Data directory',
      value: 'set-data-directory',
      description: `${chalk.italic(CONFIG.dataPath)}${CONFIG.mediaPath === CONFIG.dataPath ? `\n${chalk.hex('#FFA500')('Media is currently set to download into the same directory as data')}` : ''}`,
    },

    {
      name: 'Media directory',
      value: 'set-media-directory',
      description: `${chalk.italic(CONFIG.mediaPath)}${CONFIG.mediaPath === CONFIG.dataPath ? `\n${chalk.hex('#FFA500')('Media is currently set to download into the same directory as data')}` : ''}`,
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
    return keyOptions();
  }

  return changeDirectoryMenu();
}

let previousMenuItemDirectory;

async function openDirectoryMenu (doClearTerminal = true) {
  const mediaDirExists = CONFIG.dataPath !== CONFIG.mediaPath && (
    await fileExists(`${CONFIG.mediaPath}/generations`) || await fileExists(`${CONFIG.mediaPath}/posts`)
  );

  const choices = [
    {
      name: 'Data directory',
      value: 'open-data-directory',
      description: `Open ${chalk.italic(CONFIG.dataPath)} in file explorer`,
    }
  ];

  if (mediaDirExists) {
    choices.push(
      {
        name: 'Media directory',
        value: 'open-media-directory',
        description: `Open ${chalk.italic(CONFIG.mediaPath)} in file explorer`,
      }
    );
  }

  choices.push(
    new Separator(),

    {
      name: 'Back',
      value: 'back',
      description: 'Back to Settings'
    }
  );

  if (doClearTerminal) {
    clearTerminal();
  } else {
    console.log();
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
    return keyOptions();
  }

  return openDirectoryMenu();
}

async function setDataDownloadLocation () {
  const result = await inquirer.prompt([
    {
      type: 'input',
      message: `New DATA root directory, currently "${CONFIG.dataPath}" (press Enter to cancel):`,
      name: 'download-directory'
    }
  ]);

  const newPath = result['download-directory'];

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
  const result = await inquirer.prompt([
    {
      type: 'input',
      message: `New MEDIA root directory, currently ${CONFIG.mediaPath} (press Enter to cancel):`,
      name: 'download-directory'
    }
  ]);

  const newPath = result['download-directory'];

  if (newPath) {
    await setConfigParam('mediaPath', newPath);
    console.log(chalk.green(`Media directory changed to ${newPath}\n${newPath === CONFIG.dataPath ? chalk.hex('#FFA500')('(Media will download into the same directory as data)\n') : ''}`));
  }

  return changeDirectoryMenu();
}
