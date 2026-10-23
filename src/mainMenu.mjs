/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import process from 'node:process';
import chalk from 'chalk';
import { Separator } from '@inquirer/select';
import liveSelect from './liveSelect.mjs';
import { fileExists } from './utils.mjs';
import { CONFIG, CURRENT_VERSION, customTheme, getAppHeader, SOFTWARE } from './cli.mjs';
import { nodeGate, nodeNoticeText } from './nodeGate.mjs';
import { getBrowseState, getBrowseDisplayUrl, startBrowseServerAndOpen, stopBrowseServer, isPromptForceClose, requestShutdown, resolveExplorerHost, normalizeExplorerAccess, explorerAccessDescription, EXPLORER_ACCESS_LAN, EXPLORER_LAN_SUFFIX } from './explorerServer.mjs';

function formatTimeAgo (timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

let previousMenuItem;
let refreshOpenMenu = () => {};
let menuOpen = false;
let refreshPending = false;

// The update check and the username fill both finish after the first paint.
// If the menu is open, refresh it in place. If it is not (still starting, or
// the user is in a sub-menu), remember that a refresh was asked for; the next
// open applies it, and a closed menu's next entry rebuilds from current state.
export function refreshMainMenu () {
  if (!menuOpen) {
    refreshPending = true;
    return;
  }
  refreshOpenMenu();
}

function attachMenuRefresh (refresh) {
  refreshOpenMenu = refresh;
  menuOpen = true;
  if (refreshPending) {
    refreshPending = false;
    refresh();
  }
  return () => {
    menuOpen = false;
    if (refreshOpenMenu === refresh) refreshOpenMenu = () => {};
  };
}

function mainMenuPreamble () {
  let text = `${getAppHeader()}\n\n`;
  if (nodeGate(process.version) === 'notice') {
    text += `  ${chalk.dim(nodeNoticeText(process.version))}\n\n`;
  }
  if (getBrowseState()) {
    text += `  ${chalk.green('\u25CF')} ${chalk.dim('Explorer:')} ${chalk.hex('#a5d8ff').underline(getBrowseDisplayUrl())}\n\n`;
  }
  return text;
}

async function dataLibraryExists () {
  const root = CONFIG.dataPath;
  return await fileExists(`${root}/generations`)
    || await fileExists(`${root}/posts`)
    || await fileExists(`${root}/comics`);
}

function buildMainMenuChoices (libraryOnDisk) {
  const keySaved = !!CONFIG.secretKey;
  const choices = [];
  const browseState = getBrowseState();
  const browsing = !!browseState;
  const accessIsLan = normalizeExplorerAccess(CONFIG.explorerAccess) === EXPLORER_ACCESS_LAN;
  const bindIsLan = browseState?.host === '0.0.0.0';

  if (keySaved) {
    choices.push(
      browsing
        ? {
            name: `${chalk.red('Stop')} Explorer server${bindIsLan ? EXPLORER_LAN_SUFFIX : ''}`,
            value: 'browse-stop',
            description: `Running at ${getBrowseDisplayUrl()}`
          }
        : {
            name: `Start Explorer${accessIsLan ? EXPLORER_LAN_SUFFIX : ''}`,
            value: 'browse',
            description: accessIsLan
              ? explorerAccessDescription(EXPLORER_ACCESS_LAN)
              : 'Open your library in the browser'
          },

      {
        name: 'Download',
        value: 'download',
        description: 'Generations, posts, comics, and 3D'
      }
    );

    if (libraryOnDisk) {
      choices.push({
        name: 'Open folder',
        value: 'open-folder',
        description: CONFIG.dataPath === CONFIG.mediaPath
          ? `Open ${chalk.italic(CONFIG.dataPath)} in file explorer`
          : 'Open data or media folder in file explorer'
      });
    }

    choices.push(
      new Separator(),

      {
        name: 'Settings',
        value: 'settings',
        description: 'Update API key, add/remove password'
      }
    );
  } else {
    choices.unshift({
      name: 'Set API key',
      value: 'set-key',
      description: 'Set your API key. Read "About" for how to find it.'
    });
  }

  choices.push(
    {
      name: 'About',
      value: 'info',
      description: `About civitai-sync ${chalk.italic(`(version ${CURRENT_VERSION})`)}`
    }
  );

  if (SOFTWARE.hasUpdate) {
    choices.push(
      {
        name: `${chalk.hex('#a5d8ff')(`Install software update — v${SOFTWARE.latest.version}`)}`,
        value: 'software-update',
        description: SOFTWARE.latest.summary
      }
    );
  } else {
    choices.push(
      {
        name: 'Check for updates',
        value: 'check-update',
        description: SOFTWARE.checkedAt ? chalk.dim(`Last checked ${formatTimeAgo(SOFTWARE.checkedAt)}`) : chalk.dim(`version ${CURRENT_VERSION}`)
      }
    );
  }

  choices.push(
    new Separator(),

    {
      name: 'Exit',
      value: 'exit',
      description: 'Exit'
    }
  );

  return choices;
}

export async function shutdownBrowseServer () {
  if (getBrowseState()) {
    await stopBrowseServer();
  }
}

export async function mainMenu ({ clear = true, defaultValue = '' } = {}) {
  // The header and the Explorer status line are part of the prompt, so a
  // later refresh can rewrite them without clearing the screen. Wipe first
  // so that preamble is the only copy.
  const libraryOnDisk = CONFIG.secretKey ? await dataLibraryExists() : false;

  if (clear) {
    process.stdout.write('\x1Bc');
  } else {
    console.log();
  }

  try {
    const answer = await liveSelect({
      message: 'Select:',
      readChoices: () => buildMainMenuChoices(libraryOnDisk),
      preamble: mainMenuPreamble,
      aliases: { 'check-update': 'software-update' },
      theme: customTheme,
      default: defaultValue || previousMenuItem || undefined,
      subscribe: attachMenuRefresh
    });

    previousMenuItem = answer;

    let secretKey;

    switch (answer) {
      case 'set-key': {
      const { requestKey } = await import('./keyActions.mjs');
      await requestKey();
      break;
      }

      case 'settings': {
      const { keyOptions } = await import('./keyOptionsMenu.mjs');
      return keyOptions();
      }

      case 'download': {
      const { downloadMenu } = await import('./downloadMenu.mjs');
      return downloadMenu();
      }

      case 'open-folder': {
      const { openDownloadFolder } = await import('./openDirectory.mjs');
      return openDownloadFolder();
      }

      case 'info': {
      const { showInfo } = await import('./showInfo.mjs');
      return showInfo();
      }

      case 'check-update': {
      const { checkForSoftwareUpdate } = await import('./softwareUpdate.mjs');
      console.log(chalk.dim('\n  Checking for updates...'));
      await checkForSoftwareUpdate({ force: true });
      if (SOFTWARE.hasUpdate) {
        console.log(chalk.hex('#a5d8ff')(`\n  Update available: v${SOFTWARE.latest.version}`));
      } else {
        console.log(chalk.dim(`\n  You're up to date (v${CURRENT_VERSION})`));
      }
      break;
      }

      case 'software-update': {
      const { getSecretKey } = await import('./keyActions.mjs');
      const { updateSoftware } = await import('./softwareUpdate.mjs');
      secretKey = CONFIG.secretKey ? await getSecretKey() : undefined;

      if (await updateSoftware({ secretKey }) === true) {
        const { holdForEnter } = await import('./startupReport.mjs');
        await holdForEnter();
        return;
      }
      break;
      }

      case 'browse': {
      console.log(chalk.dim('\n  Building index...'));
      try {
        await startBrowseServerAndOpen({
          host: resolveExplorerHost({ access: CONFIG.explorerAccess })
        });
      } catch (err) {
        console.error(chalk.red(`\n  Could not start Explorer: ${err.message || err}`));
        break;
      }
      console.log(`  ${chalk.green('Explorer server started at')} ${chalk.hex('#a5d8ff').underline(getBrowseDisplayUrl())}`);
      break;
      }

      case 'browse-stop': {
      await stopBrowseServer();
      console.log(chalk.dim('\n  Explorer server stopped.'));
      break;
      }

      case 'exit':
      await shutdownBrowseServer();
      return;
    }
  }

  catch (err) {
    if (isPromptForceClose(err)) {
      requestShutdown();
      return;
    }
    if (err) console.error(err);
  }

  return mainMenu();
}
