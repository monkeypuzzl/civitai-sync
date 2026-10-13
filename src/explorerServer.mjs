import process from 'node:process';
import os from 'node:os';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import { OS, getAppHeader } from './cli.mjs';

let browseState = null;
let serverModulePromise = null;
let indexModulePromise = null;

function loadServerModule () {
  if (!serverModulePromise) serverModulePromise = import('./server.mjs');
  return serverModulePromise;
}

function loadIndexModule () {
  if (!indexModulePromise) indexModulePromise = import('./serverIndex.mjs');
  return indexModulePromise;
}

let interactiveShutdownEnabled = false;
let shutdownInProgress = false;

export function getBrowseState () {
  return browseState;
}

export const EXPLORER_ACCESS_DEVICE = 'device';
export const EXPLORER_ACCESS_LAN = 'lan';
export const EXPLORER_LAN_SUFFIX = ' (local network)';

export function normalizeExplorerAccess (value) {
  return value === EXPLORER_ACCESS_LAN ? EXPLORER_ACCESS_LAN : EXPLORER_ACCESS_DEVICE;
}

export function resolveExplorerHost ({ access, hostFlag = false } = {}) {
  if (hostFlag || normalizeExplorerAccess(access) === EXPLORER_ACCESS_LAN) {
    return '0.0.0.0';
  }
  return '127.0.0.1';
}

export function explorerAccessLabel (access) {
  return normalizeExplorerAccess(access) === EXPLORER_ACCESS_LAN
    ? 'Local network'
    : 'This device only';
}

export function explorerAccessDescription (access) {
  return normalizeExplorerAccess(access) === EXPLORER_ACCESS_LAN
    ? 'Accessible to other devices on your network. Only use on a trusted network — no password protection.'
    : 'Access from this computer only';
}

export async function startBrowseServer ({ host = '127.0.0.1' } = {}) {
  if (browseState) return browseState;

  const { startServer } = await loadServerModule();
  const { server, port } = await startServer({ host });
  const url = `http://127.0.0.1:${port}`;
  browseState = { server, port, host, url };

  return browseState;
}

// Composite entry point used by call sites that represent a user-initiated
// GUI launch (the menu's "Start Explorer" branch and the `explorer` CLI). Tests
// and any future headless callers use `startBrowseServer` directly and never
// reach the OS opener.
export async function startBrowseServerAndOpen ({ host = '127.0.0.1' } = {}) {
  const state = await startBrowseServer({ host });
  openBrowser(state.url);
  return state;
}

export async function stopBrowseServer () {
  if (!browseState) return;
  // Ctrl+C stays armed. Stop Explorer returns to the menu; it does not
  // detach the shutdown listeners, and it does not exit the process.
  const { server } = browseState;
  browseState = null;
  const { compactIndex } = await loadIndexModule();
  const { closeSSEClients } = await loadServerModule();
  // Compact the index NDJSON so the next session starts from a deduped file.
  // Internally a no-op when the session made no appends.
  await compactIndex().catch(() => {});
  closeSSEClients();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

// --- Interactive-mode shutdown (Ctrl+C / Ctrl+D while prompts own stdin) ---

// Checkbox prompts throw a different ExitPromptError class (nested
// @inquirer/core). Match the name, not instanceof.
export function isPromptForceClose (err) {
  return !!err && err.name === 'ExitPromptError';
}

export function requestShutdown () {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  console.log(chalk.dim('\n  Shutting down...'));

  // Leave the listeners in place. A bottom bar sends SIGINT in the same
  // keypress turn; detaching here lets that signal kill the process
  // before the server stop finishes. The flag above swallows the re-entry.
  stopBrowseServer()
    .catch(() => {})
    .finally(() => process.exit(0));
}

function onShutdownKeypress (_char, key) {
  if (!key) return;
  if ((key.ctrl && key.name === 'c') || (key.ctrl && key.name === 'd')) {
    requestShutdown();
  }
}

function onShutdownSignal () {
  requestShutdown();
}

// `signalTarget` / `input` default to the real process. Tests pass fakes
// and must not emit: requestShutdown calls process.exit. A second call
// does not add listeners and does not clear an in-progress shutdown.
export function enableInteractiveShutdown ({ signalTarget = process, input = process.stdin } = {}) {
  if (interactiveShutdownEnabled) return;
  interactiveShutdownEnabled = true;
  shutdownInProgress = false;
  input.on('keypress', onShutdownKeypress);
  signalTarget.on('SIGINT', onShutdownSignal);
  signalTarget.on('SIGTERM', onShutdownSignal);
}

/**
 * Blocking mode for `node . explorer` — starts the server, opens the browser,
 * and stays in the foreground until requestShutdown exits the process.
 */
export async function launchBrowser ({ host = '127.0.0.1' } = {}) {
  console.log(getAppHeader());
  console.log();
  console.log(chalk.dim('  Building index...'));

  await startBrowseServerAndOpen({ host });
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

  enableInteractiveShutdown();
  // The server keeps the process alive. This wait keeps the command in the
  // foreground if those handles close. Ctrl+C is requestShutdown, which exits.
  await new Promise(() => {});
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
