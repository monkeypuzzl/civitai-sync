import process from 'node:process';
import { getSecretKey } from './keyActions.mjs';
import { fetchGenerationsInterval } from './downloadActions.mjs';
import { deleteAllDeletedMedia } from './generations.mjs';
import { healMedia } from './mediaHeal.mjs';
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
  {
    const { requireLibraryAccount } = await import('./accountIdentity.mjs');
    const gate = await requireLibraryAccount(secretKey);
    if (!gate.ok) {
      console.log(gate.message);
      break;
    }
  }

  options = {
    interval: 60, // seconds
    withImages: CONFIG.downloadMedia !== false,
    latest: true,
    overwriteIfModified: true,
    tags: [],
    secretKey,
    listeningForKeyPress: false
  };
  fetchGenerationsInterval(options);
  break;

  case 'sync-deleted':
  {
    const { getAvailableSecretKey } = await import('./keyActions.mjs');
    const { requireLibraryAccount } = await import('./accountIdentity.mjs');
    const gate = await requireLibraryAccount(getAvailableSecretKey());
    if (!gate.ok) {
      console.log(gate.message);
      break;
    }
  }
  await deleteAllDeletedMedia();
  break;

  case 'heal-media':
  secretKey = await getSecretKey();
  {
    const report = await healMedia({ secretKey });
    const parts = [
      `${report.healed} healed`,
      `${report.unrecoverable} unrecoverable`,
      `${report.failed} still broken`,
      `${report.unchanged} unchanged`
    ];
    console.log(`Media heal: ${parts.join(', ')}`);
  }
  break;
}
