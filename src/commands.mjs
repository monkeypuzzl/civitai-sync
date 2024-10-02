import process from 'node:process';
import { deleteAllDeletedMedia } from './generations.mjs';
import { DEFAULT_CONFIG_PATH, useConfig } from './cli.mjs';

const commandlineArgs = process.argv.slice(2);
const command = commandlineArgs[0];
let configPath = commandlineArgs[1];

if (configPath) {
  if (!configPath.endsWith('.json')) {
    configPath += '.json';
  }

  if (!configPath.includes('/')) {
    configPath = `config/${configPath}`;
  }
}

else {
  configPath = DEFAULT_CONFIG_PATH;
}

await useConfig(configPath);

switch (command) {
  case 'remove-deleted':
  deleteAllDeletedMedia();
  break;
}
