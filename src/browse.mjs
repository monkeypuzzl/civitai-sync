import process from 'node:process';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import { startServer, closeSSEClients } from './server.mjs';
import { OS, appHeader } from './cli.mjs';

let browseState = null;

export function getBrowseState () {
  return browseState;
}

export async function startBrowseServer () {
  if (browseState) return browseState;

  const { server, port } = await startServer();
  const url = `http://127.0.0.1:${port}`;
  browseState = { server, port, url };

  openBrowser(url);
  return browseState;
}

export async function stopBrowseServer () {
  if (!browseState) return;
  const { server } = browseState;
  browseState = null;
  closeSSEClients();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

/**
 * Blocking mode for `node . browse` — starts the server, opens the browser,
 * and waits for SIGINT/SIGTERM to shut down.
 */
export async function launchBrowser () {
  console.log(appHeader);
  console.log();
  console.log(chalk.dim('  Building index...'));

  await startBrowseServer();
  const { url } = browseState;

  console.log();
  console.log(`  ${chalk.green('Explorer server running at')} ${chalk.hex('#a5d8ff').underline(url)}`);
  console.log(chalk.dim('  Press Ctrl+C to stop\n'));

  await new Promise((resolve) => {
    function shutdown () {
      stopBrowseServer().then(resolve, resolve);
    }
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}

function openBrowser (url) {
  const command = OS === 'darwin'
    ? `open "${url}"`
    : OS === 'win32'
      ? `explorer "${url}"`
      : `xdg-open "${url}"`;

  exec(command, () => {});
}
