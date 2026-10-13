import path from 'node:path';
import { execFile } from 'node:child_process';
import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import { fileExists } from './utils.mjs';
import { APP_DIRECTORY, CONFIG, OS, customTheme, clearTerminal } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';
import { buildOpenFolderLaunch } from './openFolderLaunch.mjs';

function getRootDataPath () {
  if (!CONFIG.dataPath.startsWith('/')) {
    return path.join(APP_DIRECTORY, CONFIG.dataPath);
  }
  return CONFIG.dataPath;
}

function getRootMediaPath () {
  if (!CONFIG.mediaPath.startsWith('/')) {
    return path.join(APP_DIRECTORY, CONFIG.mediaPath);
  }
  return CONFIG.mediaPath;
}

function openDirectory (dir) {
  const launch = buildOpenFolderLaunch({
    platform: OS,
    folderPath: dir,
    fileExists: false
  });
  // Windows explorer often exits 1 after a successful open.
  execFile(launch.cmd, launch.args, (error) => {
    if (error && OS !== 'win32') {
      console.log('The directory does not exist. It will be created when you start downloading.');
    }
  });
}

export async function openDataDirectory () {
  openDirectory(getRootDataPath());
}

export async function openMediaDirectory () {
  openDirectory(getRootMediaPath());
}

export async function openDownloadFolder () {
  if (CONFIG.dataPath !== CONFIG.mediaPath) {
    return openDirectoryMenu();
  }
  openDataDirectory();
  return mainMenu({ clear: false });
}

let previousMenuItemDirectory;

async function openDirectoryMenu (doClearTerminal = true) {
  const mediaDirExists = CONFIG.dataPath !== CONFIG.mediaPath && (
    await fileExists(`${CONFIG.mediaPath}/generations`)
    || await fileExists(`${CONFIG.mediaPath}/posts`)
    || await fileExists(`${CONFIG.mediaPath}/comics`)
  );

  const choices = [];

  if (mediaDirExists) {
    choices.push(
      {
        name: 'Media',
        value: 'open-media-directory',
        description: `Open ${chalk.italic(CONFIG.mediaPath)} in file explorer`,
      }
    );
  }

  choices.push(
    {
      name: 'Data',
      value: 'open-data-directory',
      description: `Open ${chalk.italic(CONFIG.dataPath)} in file explorer`,
    }
  );

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
  } else {
    console.log();
  }

  const answer = await select({
    message: 'Open folder:',
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
    return mainMenu();
  }

  return openDirectoryMenu();
}
