import fs from 'fs';
import { setConfigParam, DEFAULT_CONFIG } from './config.mjs';
import { setupWorkflowTags, getGenerationDates, getGenerationIdsByDate, getGeneration, getGeneratedMediaInfo, mediaFilepath, MEDIA_DIRECTORIES } from './generations.mjs';
import { CONFIG, CURRENT_VERSION } from './cli.mjs';
import { fileExists } from './utils.mjs';

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

export async function migrate () {
  if (CONFIG.version === CURRENT_VERSION) {
    return;
  }
  
  if (!Array.isArray(CONFIG.generationMediaTypes)) {
    await migrateGenerationTypes();
  }

  if (CURRENT_VERSION === '4.1.0' && !CONFIG.excludeImages) {
    await migrateVideoFilenames();
  }

  await setConfigParam('version', CURRENT_VERSION);
}