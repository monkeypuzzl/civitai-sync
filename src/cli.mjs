import process from 'node:process';
import os from 'node:os';
import chalk from 'chalk';
import { getCurrentConfig } from './config.mjs';
import { mainMenu } from './mainMenu.mjs';


/////

const customTheme = {
  prefix: chalk.green('➜'),
  style: {
    message: chalk.yellow,
    answer: chalk.green,
    error: chalk.red,
    help: chalk.yellow,
    highlight: chalk.hex('#a5d8ff').bgHex('#1971c2'),
    disabled: chalk.dim
  }
};

const appName = `${chalk.white.bgBlack.bold('ᴄɪᴠɪᴛ')}${chalk.hex('#4ca1f0').bgBlack.bold('ᴀɪ')}${chalk.white.bgBlack.bold('-sync')}`;
const appHeader = `\n ${appName} generations downloader\n`;

const COMMANDS = getCommandLineArgs();
const DEFAULT_CONFIG_PATH = 'config/default.json';
const CONFIG_PATH = COMMANDS.configPath || DEFAULT_CONFIG_PATH;
const OS = os.platform();
let CONFIG, APP_DIRECTORY;

export {
  APP_DIRECTORY,
  CONFIG,
  CONFIG_PATH,
  OS,
  customTheme
}

function clearTerminal () {
  process.stdout.write('\x1Bc');
}

export async function launchCLI (appDirectory) {
  APP_DIRECTORY = appDirectory;
  CONFIG = await getCurrentConfig(CONFIG_PATH);
  clearTerminal();
  
  console.log(appHeader);

  if (CONFIG_PATH !== DEFAULT_CONFIG_PATH) {
    console.log(`  config: ${CONFIG_PATH}\n`);
  }

  await mainMenu();
}

function getCommandLineArgs () {
  const commandlineArgs = process.argv.slice(2);
  const args = {};

  if (commandlineArgs.length) {
    let configPath = commandlineArgs[0];

    if (!configPath.endsWith('.json')) {
      configPath += '.json';
    }

    args.configPath = configPath;
  }

  return args;
}
