import path from 'node:path';
import { fileExists, readFile, writeFile, rename, unlink } from './utils.mjs';
import { APP_DIRECTORY } from './cli.mjs';
import { CIVITAI_DOMAINS } from './civitaiDomain.mjs';

// Default Civitai domain. Kept as a string literal rather than
// `CIVITAI_DOMAINS[0]` to avoid a module-evaluation-order deadlock between
// config.mjs and civitaiDomain.mjs (they form a cycle via cli.mjs). The
// runtime validation inside `getCurrentConfig` still uses CIVITAI_DOMAINS to
// reject stale/invalid values on disk.
export const DEFAULT_CONFIG = {
  dataPath: `data`,
  mediaPath: `media`,
  username: '',
  // Files and the record when true. The record only when false. Generations,
  // posts, comics, and generation inputs share this switch.
  downloadMedia: true,
  // `favorite` and/or `feedback:liked`, in that order, or []. Never `all`
  // or `feedback:disliked`. Remembered runs (`generationDownload`,
  // `postDownload`, `comicDownload`, `model3dDownload`) are written by a
  // download start, not defaulted here. A clean All portion writes `latest`.
  generationReactions: [],
  keyEncrypt: false,
  secretKey: '',
  domain: 'civitai.com',
  // Who can reach the Explorer process: this device (loopback) or the LAN
  // (all interfaces). Bind addresses stay in explorerServer.mjs — this key is the
  // user-facing preference. Missing/invalid values coerce to 'device' at
  // resolveExplorerHost; old configs are not rewritten on load.
  explorerAccess: 'device'
};

const currentConfig = {};
let currentConfigPath;
let configPromise;
let loaded = false;

export async function getCurrentConfig (configPath) {
  if (loaded) {
    return currentConfig;
  }

  if (configPromise) {
    return configPromise;
  }

  if (!configPath) {
    throw new Error('getCurrentConfig: No config path');
  }

  let fullConfigPath = configPath;
  
  if (!configPath.startsWith('/') && !configPath.includes(':')) {
    fullConfigPath = path.join(APP_DIRECTORY, configPath);
  }

  configPromise = getConfig(fullConfigPath)
  .then(async config => {
    loaded = true;
    currentConfigPath = fullConfigPath;
    merge(currentConfig, config);

    // Normalize CONFIG.domain: write default to disk if missing or invalid.
    if (!CIVITAI_DOMAINS.includes(currentConfig.domain)) {
      currentConfig.domain = CIVITAI_DOMAINS[0];
      await writeFile(currentConfigPath, JSON.stringify(currentConfig, null, 2));
    }

    return currentConfig;
  });

  return configPromise;
}

function merge (target, obj) {
  for (let param in obj) {
    if (target[param] !== obj[param]) {
      target[param] = obj[param];
    }
  }

  return target;
}

export async function loadConfig (configPath) {
  try {
    const contents = await readFile(configPath);
    return JSON.parse(contents);
  }

  catch (error) {
    console.error(error);
  }
}

function configFolderPair (configPath) {
  const base = path.basename(configPath || '');
  const stem = base.endsWith('.json') ? base.slice(0, -'.json'.length) : base;
  if (!stem || stem === '.' || stem === '..' || base === 'default.json') {
    return { dataPath: 'data', mediaPath: 'media' };
  }
  return { dataPath: `data-${stem}`, mediaPath: `media-${stem}` };
}

export async function createConfig (configPath) {
  const config = { ...DEFAULT_CONFIG, ...configFolderPair(configPath) };
  await writeFile(configPath, JSON.stringify(config, null, 2));

  return config;
}

export async function removeConfig (configPath) {
  try {
    return await unlink(configPath);
  }

  catch (error) {
    console.error(error);
  }
}

export async function getConfig (configPath) {
  const hasNoParentDirectory = !configPath.includes('/') && !configPath.includes('\\');
  
  if (hasNoParentDirectory) {
    const expandedConfigPath = `config/${configPath}`;

    if (await fileExists(expandedConfigPath)) {
      return await loadConfig(expandedConfigPath);
    }

    if (await fileExists(configPath)) {
      // Move to config folder
      await rename(configPath, expandedConfigPath);
      return await loadConfig(expandedConfigPath);
    }
  }

  else if (await fileExists(configPath)) {
    return await loadConfig(configPath);
  }

  return await createConfig(configPath);
}

/////

// One config writer at a time. A rejected write does not stall the next.
export function createWriteQueue () {
  let tail = Promise.resolve();
  return function enqueue (work) {
    const run = tail.then(() => work());
    tail = run.then(() => {}, () => {});
    return run;
  };
}

const enqueueConfigWrite = createWriteQueue();

function snapshotConfigWrite () {
  const path = currentConfigPath;
  const json = JSON.stringify(currentConfig, null, 2);
  return enqueueConfigWrite(() => writeFile(path, json));
}

// Set loaded config
export async function setConfig (newParams) {
  const config = await getCurrentConfig();

  merge(config, newParams);
  await snapshotConfigWrite();

  return config;
}

export async function setConfigParam (param, value) {
  return await setConfig({[param]: value});
}

export async function removeConfigParam (param) {
  await getCurrentConfig();
  delete currentConfig[param];
  await snapshotConfigWrite();
}
