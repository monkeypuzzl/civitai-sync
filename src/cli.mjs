import process from 'node:process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import chalk from 'chalk';
import { getCurrentConfig, DEFAULT_CONFIG } from './config.mjs';
import { mainMenu } from './mainMenu.mjs';
import { checkForSoftwareUpdate, getCurrentVersion } from './softwareUpdate.mjs';
import { migrate } from './migrate.mjs';

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
const appHeader = `\n ${appName}${COMMANDS.configPathOrig ? `: ${COMMANDS.configPathOrig}` : ''}`;

let CONFIG, CURRENT_VERSION;

export {
  APP_DIRECTORY,
  CURRENT_VERSION,
  CONFIG,
  CONFIG_PATH,
  DEFAULT_CONFIG_PATH,
  DEFAULT_CONFIG,
  OS,
  customTheme,
  appHeader
}

export async function useConfig (path = CONFIG_PATH) {
  CONFIG = await getCurrentConfig(path);
}

export function clearTerminal ({ suffix = '\n' } = {}) {
  process.stdout.write('\x1Bc');
  console.log(`${appHeader}${suffix}`);
}

export async function launchCLI () {
  CURRENT_VERSION = await getCurrentVersion();
  await useConfig(CONFIG_PATH);
  await migrate();

  const abortController = new AbortController();

  checkForSoftwareUpdate()
  .then(() => {
    abortController.abort();
  })
  .catch(console.error);
  
  mainMenu({ abortSignal: abortController.signal });
}

function getCommandLineArgs () {
  const commandlineArgs = process.argv.slice(2);
  const args = {};

  if (commandlineArgs.length) {
    let configPath = commandlineArgs[0];

    if (configPath) {
      args.configPathOrig = configPath;
    }

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
