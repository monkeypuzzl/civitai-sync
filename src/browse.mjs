import process from 'node:process';
import os from 'node:os';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import { startServer, closeSSEClients } from './server.mjs';
import { OS, appHeader } from './cli.mjs';

let browseState = null;
let interactiveShutdownEnabled = false;
let shutdownInProgress = false;

export function getBrowseState () {
  return browseState;
}

export async function startBrowseServer ({ host = '127.0.0.1' } = {}) {
  if (browseState) return browseState;

  const { server, port } = await startServer({ host });
  const url = `http://127.0.0.1:${port}`;
  browseState = { server, port, host, url };

  openBrowser(url);
  return browseState;
}

export async function stopBrowseServer () {
  if (!browseState) return;
  disableInteractiveShutdown();
  const { server } = browseState;
  browseState = null;
  closeSSEClients();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

// --- Interactive-mode shutdown (Ctrl+C / Ctrl+D while Inquirer prompts own stdin) ---

function gracefulExit () {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  disableInteractiveShutdown();

  console.log(chalk.dim('\n  Shutting down...'));

  stopBrowseServer()
    .catch(() => {})
    .finally(() => process.exit(0));
}

function onShutdownKeypress (_char, key) {
  if (!key) return;
  if ((key.ctrl && key.name === 'c') || (key.ctrl && key.name === 'd')) {
    gracefulExit();
  }
}

function onShutdownSignal () {
  gracefulExit();
}

export function enableInteractiveShutdown () {
  if (interactiveShutdownEnabled) return;
  interactiveShutdownEnabled = true;
  shutdownInProgress = false;
  process.stdin.on('keypress', onShutdownKeypress);
  process.on('SIGINT', onShutdownSignal);
  process.on('SIGTERM', onShutdownSignal);
}

function disableInteractiveShutdown () {
  if (!interactiveShutdownEnabled) return;
  interactiveShutdownEnabled = false;
  process.stdin.removeListener('keypress', onShutdownKeypress);
  process.removeListener('SIGINT', onShutdownSignal);
  process.removeListener('SIGTERM', onShutdownSignal);
}

/**
 * Blocking mode for `node . browse` — starts the server, opens the browser,
 * and waits for SIGINT/SIGTERM to shut down.
 */
export async function launchBrowser ({ host = '127.0.0.1' } = {}) {
  console.log(appHeader);
  console.log();
  console.log(chalk.dim('  Building index...'));

  await startBrowseServer({ host });
  const { url, port } = browseState;

  console.log();
  console.log(`  ${chalk.green('Explorer server running at')} ${chalk.hex('#a5d8ff').underline(url)}`);

  if (host === '0.0.0.0') {
    const lanIp = getLanIp();
    if (lanIp) {
      const lanUrl = `http://${lanIp}:${port}`;
      console.log(`  ${chalk.green('Network access:')}          ${chalk.hex('#a5d8ff').underline(lanUrl)}`);
    }
  }

  console.log(chalk.dim('  Press Ctrl+C to stop\n'));

  await new Promise((resolve) => {
    let shuttingDown = false;
    function shutdown () {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(chalk.dim('\n  Shutting down...'));
      stopBrowseServer().then(resolve, resolve);
    }
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}

function getLanIp () {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

export function getBrowseDisplayUrl () {
  if (!browseState) return null;
  if (browseState.host === '0.0.0.0') {
    const lanIp = getLanIp();
    if (lanIp) return `http://${lanIp}:${browseState.port}`;
  }
  return browseState.url;
}

function openBrowser (url) {
  const command = OS === 'darwin'
    ? `open "${url}"`
    : OS === 'win32'
      ? `explorer "${url}"`
      : `xdg-open "${url}"`;

  exec(command, () => {});
}
