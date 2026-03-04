import process from 'node:process';
import { getSecretKey } from './keyActions.mjs';
import { fetchGenerationsInterval } from './downloadActions.mjs';
import { deleteAllDeletedMedia } from './generations.mjs';
import { DEFAULT_CONFIG_PATH, useConfig, CONFIG } from './cli.mjs';

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

let options, secretKey;

switch (command) {
  case 'auto-fetch':
  secretKey = await getSecretKey();

  options = {
    interval: 60, // seconds
    withImages: !CONFIG.excludeImages,
    latest: true,
    overwriteIfModified: true,
    tags: [],           // "favorite", "liked", "disliked"
    secretKey,
    listeningForKeyPress: false
  };
  fetchGenerationsInterval(options);
  break;

  case 'remove-deleted':
  deleteAllDeletedMedia();
  break;
}
