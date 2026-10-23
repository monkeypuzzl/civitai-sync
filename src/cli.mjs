import process from 'node:process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import chalk from 'chalk';
import { readFile } from './utils.mjs';
import { getCurrentConfig, DEFAULT_CONFIG } from './config.mjs';
import { nodeGate, nodeNoticeText, nodeUpdateSection } from './nodeGate.mjs';
import { reportAndHold } from './startupReport.mjs';

const KNOWN_COMMANDS = ['explorer'];

/////

const customTheme = {
  prefix: chalk.green('➜'),
  style: {
    message: chalk.yellowBright,
    answer: chalk.greenBright,
    error: chalk.redBright,
    help: chalk.yellowBright,
    highlight: chalk.hex('#a5d8ff').bgHex('#1971c2'),
    disabled: chalk.dim,
    description: chalk.hex('#a5d8ff')
  },
  helpMode: 'always'
};

const APP_DIRECTORY = dirname(dirname(fileURLToPath(import.meta.url)));
const COMMANDS = getCommandLineArgs();
const DEFAULT_CONFIG_PATH = 'config/default.json';
const CONFIG_PATH = COMMANDS.configPath || DEFAULT_CONFIG_PATH;
const OS = os.platform();
const appName = `${chalk.white.bgBlack.bold('ᴄɪᴠɪᴛ')}${chalk.hex('#4ca1f0').bgBlack.bold('ᴀɪ')}${chalk.white.bgBlack.bold('-sync')}`;

let CONFIG, CURRENT_VERSION;

// Update-check state. softwareUpdate.mjs mutates this object; the menu reads it.
// Defaults until the interactive prelude copies a same-version versions.json.
export const SOFTWARE = {
  current: {},
  latest: {},
  hasUpdate: false,
  checkedAt: 0
};

export {
  APP_DIRECTORY,
  CURRENT_VERSION,
  CONFIG,
  CONFIG_PATH,
  DEFAULT_CONFIG_PATH,
  DEFAULT_CONFIG,
  OS,
  customTheme
}

// True when migrate() still has work: no data path (layout move), or the
// version stamp differs (the rest of migrate). A matching stamp with a data
// path does not load that module.
export function migrationRequired (config, currentVersion) {
  return !config?.dataPath || config.version !== currentVersion;
}

// Copy a same-version update cache onto the target. A missing cache or a
// different currentVersion leaves the target unchanged.
export function applySoftwareCache (target, cached, currentVersion) {
  if (!cached || cached.currentVersion !== currentVersion) return false;
  for (const key of Object.keys(cached)) target[key] = cached[key];
  return true;
}

// Header identity: Civitai username once known, else the explicit config
// argument, else nothing. Default-config launches (`npm run cli`) show the
// username the same way — they never invent a "default" suffix. Recomputed
// on every paint so a background fillIfMissing can land on the next clear.
export function formatAppHeader ({ username, configLabel } = {}) {
  const name = typeof username === 'string' ? username.trim() : '';
  const label = typeof configLabel === 'string' ? configLabel.trim() : '';
  const identity = name || label;
  const suffix = identity ? chalk.dim(`: ${identity}`) : '';
  return `\n ${appName}${suffix}`;
}

export function getAppHeader () {
  return formatAppHeader({
    username: CONFIG?.username,
    configLabel: COMMANDS.configPathOrig
  });
}

export async function useConfig (path = CONFIG_PATH) {
  CONFIG = await getCurrentConfig(path);
}

export function clearTerminal ({ suffix = '\n' } = {}) {
  process.stdout.write('\x1Bc');
  console.log(`${getAppHeader()}${suffix}`);
}

// Same read as getCurrentVersion in softwareUpdate.mjs. Kept here so the
// prelude does not evaluate the update module.
async function readCurrentVersion () {
  try {
    const contents = await readFile(`${APP_DIRECTORY}/package.json`);
    const currentPackage = JSON.parse(contents);
    return (currentPackage && currentPackage.version) || '';
  } catch (error) {
    console.error('Could not get package version', error);
    return '';
  }
}

async function readSoftwareCache () {
  try {
    const contents = await readFile(`${APP_DIRECTORY}/software-updates/versions.json`);
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

// Plaintext config key only. At startup the in-memory key memo is empty, so
// this is the same input getAvailableSecretKey() would return, without
// loading keyActions.mjs. Not awaited: a downed Civitai must not delay the
// menu or `explorer`.
function scheduleIdentityFill () {
  const secretKey = CONFIG?.secretKey;
  if (!secretKey || CONFIG.keyEncrypt) return null;
  if (CONFIG.username && CONFIG.allowAltDomain !== undefined) return null;

  return import('./userData.mjs').then(({ fillIfMissing }) => (
    fillIfMissing({ secretKey }).catch(() => {})
  ));
}

// Downloads, Generations, and Posts menus. Not awaited. Comics stays on its
// row because that row starts the download. No key: Download is not offered.
// The explorer command returns before this runs.
function preloadDownloadMenus () {
  if (!CONFIG?.secretKey) return;
  for (const specifier of [
    './downloadMenu.mjs',
    './downloadGenerationsMenu.mjs',
    './downloadPostsMenu.mjs'
  ]) {
    import(specifier).catch(() => {});
  }
}

export function applyCurrentVersion (version) {
  CURRENT_VERSION = version || '';
}

export async function launchCLI () {
  // Before the version read and before migration. explorerServer imports
  // this module, so this import stays inside the function.
  const { enableInteractiveShutdown } = await import('./explorerServer.mjs');
  enableInteractiveShutdown();

  applyCurrentVersion(await readCurrentVersion());

  const gate = nodeGate(process.version);
  if (gate === 'stop') {
    console.log(nodeUpdateSection());
    await reportAndHold({
      version: CURRENT_VERSION,
      node: process.version,
      platform: process.platform,
      phase: 'node',
      operation: 'read',
      code: 'below-18'
    });
    process.exit(0);
  }

  await useConfig(CONFIG_PATH);

  // The download-choice rewrite does not wait on the version stamp.
  // migrate() still skips the export, cover, and input migrations when the
  // stamp matches, then runs migrateDownloadChoices. An already-rewritten
  // matching stamp (no old keys, data path set) does not load that module.
  const downloadChoicesPending = ['excludeImages', 'generationMediaTypes', 'generationDataTypes']
    .some(key => Object.prototype.hasOwnProperty.call(CONFIG, key));

  if (migrationRequired(CONFIG, CURRENT_VERSION) || downloadChoicesPending) {
    try {
      const { migrate } = await import('./migrate.mjs');
      await migrate();
    } catch (err) {
      const { layoutTooLongNote } = await import('./migrate.mjs');
      const note = layoutTooLongNote(err);
      if (note) console.log(note);
      await reportAndHold({
        version: CURRENT_VERSION,
        node: process.version,
        platform: process.platform,
        phase: 'library-layout',
        operation: err?.operation || 'rename',
        code: err?.code || err?.name || 'Error',
        where: err?.path,
        dataPath: CONFIG?.dataPath,
        mediaPath: CONFIG?.mediaPath,
        note
      });
      process.exit(0);
    }
  }

  if (gate === 'notice') {
    console.log(nodeNoticeText(process.version));
  }

  const identityFilled = scheduleIdentityFill();

  if (COMMANDS.command === 'explorer') {
    const { launchBrowser, resolveExplorerHost } = await import('./explorerServer.mjs');
    return launchBrowser({
      host: resolveExplorerHost({ access: CONFIG.explorerAccess, hostFlag: COMMANDS.host })
    });
  }

  applySoftwareCache(SOFTWARE, await readSoftwareCache(), CURRENT_VERSION);

  const { mainMenu, refreshMainMenu } = await import('./mainMenu.mjs');

  preloadDownloadMenus();

  if (identityFilled) {
    identityFilled.then(() => refreshMainMenu()).catch(() => {});
  }

  import('./softwareUpdate.mjs')
    .then(({ checkForSoftwareUpdate }) => checkForSoftwareUpdate())
    .then(() => refreshMainMenu())
    .catch(console.error);

  mainMenu();
}

function getCommandLineArgs () {
  const commandlineArgs = process.argv.slice(2);
  const args = {};

  const flags = commandlineArgs.filter(a => a.startsWith('--'));
  let positional = commandlineArgs.filter(a => !a.startsWith('--'));

  args.host = flags.includes('--host');

  if (positional.length && KNOWN_COMMANDS.includes(positional[0])) {
    args.command = positional.shift();
  }

  if (positional.length) {
    let configPath = positional[0];

    args.configPathOrig = configPath;

    if (!configPath.endsWith('.json')) {
      configPath += '.json';
    }

    if (!configPath.includes('/')) {
      configPath = `config/${configPath}`;
    }

    args.configPath = configPath;
  }

  return args;
}
