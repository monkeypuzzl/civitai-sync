#!/usr/bin/env node

import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { ExitPromptError } from '@inquirer/core';
import { launchCLI } from './src/cli.mjs';

// signal-exit throws ExitPromptError synchronously during process teardown,
// which bypasses async try/catch. Intercept it here and exit cleanly.
process.on('uncaughtException', async (err) => {
  if (err instanceof ExitPromptError) {
    try {
      const { shutdownBrowseServer } = await import('./src/mainMenu.mjs');
      await shutdownBrowseServer();
    } catch { /* best-effort */ }
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

const appDirectory = dirname(fileURLToPath(import.meta.url));

launchCLI(appDirectory);
