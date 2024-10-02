import { setConfigParam, DEFAULT_CONFIG } from './config.mjs';
import { setupWorkflowTags } from './generations.mjs';
import { CONFIG } from './cli.mjs';

export async function migrateGenerationTypes () {
  await setConfigParam('generationMediaTypes', DEFAULT_CONFIG.generationMediaTypes);
  await setConfigParam('generationDataTypes', DEFAULT_CONFIG.generationDataTypes);

  console.log('Updating file structure, please wait...');
  await setupWorkflowTags();
}

export async function migrate () {
  if (!Array.isArray(CONFIG.generationMediaTypes)) {
    await migrateGenerationTypes();
  }
}