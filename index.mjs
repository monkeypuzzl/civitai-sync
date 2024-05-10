import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { launchCLI } from './src/cli.mjs';

const appDirectory = dirname(fileURLToPath(import.meta.url));

launchCLI(appDirectory);
