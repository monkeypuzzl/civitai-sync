/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import fs from 'fs';
import { mkdirp } from 'mkdirp';
import { setConfigParam, removeConfigParam, DEFAULT_CONFIG } from './config.mjs';
import { setupWorkflowTags, getGenerationDates, getGenerationIdsByDate, getGeneration, getGeneratedMediaInfo, mediaFilepath, MEDIA_DIRECTORIES } from './generations.mjs';
import { CONFIG, CURRENT_VERSION, OS } from './cli.mjs';
import { fileExists, listDirectory, isDate } from './utils.mjs';

export async function migrateDirectoryLayout () {
  // Skip if already migrated
  if (CONFIG.dataPath || !CONFIG.generationsDataPath) {
    return;
  }

  const oldDataPath = CONFIG.generationsDataPath;
  const oldMediaPath = CONFIG.generationsMediaPath || oldDataPath;

  console.log('Migrating directory layout, please wait...');

  // Migrate data directory: move date dirs into generations/ subfolder
  const newDataGenerationsDir = `${oldDataPath}/generations`;
  await mkdirp(newDataGenerationsDir);

  const dataEntries = await listDirectory(oldDataPath);
  for (const entry of dataEntries) {
    if (isDate(entry)) {
      await fs.promises.rename(`${oldDataPath}/${entry}`, `${newDataGenerationsDir}/${entry}`);
    }
  }

  // Migrate media directory: move type dirs and legacy date dirs into generations/ subfolder
  const newMediaGenerationsDir = `${oldMediaPath}/generations`;
  await mkdirp(newMediaGenerationsDir);

  const KNOWN_MEDIA_DIRS = Object.values(MEDIA_DIRECTORIES);
  const mediaEntries = await listDirectory(oldMediaPath);
  for (const entry of mediaEntries) {
    if (KNOWN_MEDIA_DIRS.includes(entry) || isDate(entry)) {
      await fs.promises.rename(`${oldMediaPath}/${entry}`, `${newMediaGenerationsDir}/${entry}`);
    }
  }

  // Update config to new schema
  await setConfigParam('dataPath', oldDataPath);
  await setConfigParam('mediaPath', oldMediaPath);
  await setConfigParam('username', DEFAULT_CONFIG.username);
  await removeConfigParam('generationsDataPath');
  await removeConfigParam('generationsMediaPath');
}

export async function migrateGenerationTypes () {
  await setConfigParam('generationMediaTypes', DEFAULT_CONFIG.generationMediaTypes);
  await setConfigParam('generationDataTypes', DEFAULT_CONFIG.generationDataTypes);

  console.log('Updating file structure, please wait...');
  await setupWorkflowTags();
}

export async function migrateVideoFilenames () {
  const fromDate = '2024-11-14';

  const dates = await getGenerationDates();
  const datesFiltered = dates.slice(dates.indexOf(dates.find(date => date >= fromDate)));
  const currentMediaDirectories = (CONFIG.generationMediaTypes || []).map(type => MEDIA_DIRECTORIES[type]);
  
  for (let date of datesFiltered) {
    const generationIds = await getGenerationIdsByDate(date);
    
    for (let generationId of generationIds) {
      const generation = await getGeneration(date, generationId);
      const media = getGeneratedMediaInfo(generation);
      const mediaToRename = media.filter(({ mediaId }) => mediaId.includes('.'));
      
      if (mediaToRename.length) {
        for (let directory of currentMediaDirectories) {
          const filepaths = media.map(mediaInfo => mediaFilepath({ ...mediaInfo, directory }));

          for (let filepath of filepaths) {
            const [ jpegFilepathExists, correctFilepathExists ] = await Promise.all([
              fileExists(`${filepath}.jpeg`),
              fileExists(filepath)
            ]);

            if (jpegFilepathExists && !correctFilepathExists) {
              await fs.promises.rename(`${filepath}.jpeg`, filepath);
            }
          }
        }
      }
    }
  }
}

export async function removeEmptyMediaDirectories () {
  const fromDate = '2024-11-14';

  const dates = await getGenerationDates();
  const datesFiltered = dates.slice(dates.indexOf(dates.find(date => date >= fromDate)));
  const currentMediaDirectories = (CONFIG.generationMediaTypes || []).map(type => MEDIA_DIRECTORIES[type]);
  
  for (let date of datesFiltered) {
    const generationIds = await getGenerationIdsByDate(date);
    
    for (let generationId of generationIds) {
      const generation = await getGeneration(date, generationId);
      const media = getGeneratedMediaInfo(generation);
      
      if (media.length) {
        for (let directory of currentMediaDirectories) {
          const filepaths = media.map(mediaInfo => mediaFilepath({ ...mediaInfo, directory }));

          for (let filepath of filepaths) {
            const invalidDirectory = filepath.slice(0, -1);

            if (await fileExists(invalidDirectory)) {
              try {
                await fs.promises.rmdir(invalidDirectory);
              }

              catch (ignoreErr) {
                continue;
              }
            }
          }
        }
      }
    }
  }
}

export async function migrate () {
  await migrateDirectoryLayout();

  if (CONFIG.version === CURRENT_VERSION) {
    return;
  }

  if (!Array.isArray(CONFIG.generationMediaTypes)) {
    await migrateGenerationTypes();
  }

  if (!CONFIG.excludeImages) {
    if (CURRENT_VERSION < '4.1.1') {
      await migrateVideoFilenames();
    }

    if (CURRENT_VERSION < '4.1.2' && CURRENT_VERSION >= '4.0.0' && OS === 'win32') {
      await removeEmptyMediaDirectories();
    }
  }

  await setConfigParam('version', CURRENT_VERSION);
}