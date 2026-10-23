#!/usr/bin/env node

import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { isPromptForceClose, requestShutdown } from './src/explorerServer.mjs';
import { launchCLI } from './src/cli.mjs';
import { reportAndHold } from './src/startupReport.mjs';

// signal-exit rejects the open prompt with ExitPromptError during teardown,
// which bypasses async try/catch. Checkbox uses a second copy of that class.
// requestShutdown is idempotent, so this does not cut off a shutdown the
// keypress listener already started, and it does not print the stack.
process.on('uncaughtException', (err) => {
  if (isPromptForceClose(err)) {
    requestShutdown();
    return;
  }
  // Hold until Enter. Do not exit on this tick: the report is async.
  reportAndHold({
    node: process.version,
    platform: process.platform,
    phase: 'startup',
    operation: 'read',
    code: err?.code || err?.name || 'Error',
    where: err?.path
  }).finally(() => process.exit(0));
});

const appDirectory = dirname(fileURLToPath(import.meta.url));

launchCLI(appDirectory);
