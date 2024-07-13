import fs from 'node:fs';
import { fileExists, readFile, writeFile } from './utils.mjs';

const DEFAULT_CONFIG = {
  generationsDataPath: `generations/data`,
  generationsMediaPath: `generations/media`,
  keyEncrypt: false,
  excludeImages: false,
  secretKey: ''
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

  configPromise = getConfig(configPath)
  .then(config => {
    loaded = true;
    currentConfigPath = configPath;
    merge(currentConfig, config);
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

export async function createConfig (configPath) {
  const config = {...DEFAULT_CONFIG};
  await writeFile(configPath, JSON.stringify(config, null, 2));

  return config;
}

export async function removeConfig (configPath) {
  try {
    return await fs.promises.unlink(configPath);
  }

  catch (error) {
    console.error(error);
  }
}

export async function getConfig (configPath) {
  if (await fileExists(configPath)) {
    return await loadConfig(configPath);
  }

  return await createConfig(configPath);
}

/////

// Set loaded config
export async function setConfig (newParams) {
  const config = await getCurrentConfig();

  merge(config, newParams);
  await writeFile(currentConfigPath, JSON.stringify(currentConfig, null, 2));

  return config;
}

export async function setConfigParam (param, value) {
  return await setConfig({[param]: value});
}
