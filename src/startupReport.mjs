// One pasteable failure. The screen and startup-report.txt are the same
// bytes. A path is included only under the library roots, as <media> or
// <data>. The home directory is never written.

import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { writeFile } from 'node:fs/promises';

export const STARTUP_REPORT_NAME = 'startup-report.txt';

let holding = false;

export function redactPath (filepath, { dataPath, mediaPath } = {}) {
  if (!filepath) return null;
  const full = path.resolve(String(filepath));
  const roots = [[mediaPath, '<media>'], [dataPath, '<data>']];
  for (const [root, token] of roots) {
    if (!root) continue;
    const base = path.resolve(String(root));
    if (full === base) return token;
    const prefix = base.endsWith(path.sep) ? base : base + path.sep;
    if (full.startsWith(prefix)) {
      const rest = full.slice(prefix.length).split(path.sep).join('/');
      return rest ? `${token}/${rest}` : token;
    }
  }
  return null;
}

export function redactHome (text, homeDir = os.homedir()) {
  const raw = String(text || '');
  if (!raw || !homeDir) return raw;
  return raw.split(homeDir).join('');
}

export function npmFailureLine (stderr) {
  const lines = String(stderr || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('npm ERR!')) return lines[i];
  }
  return lines.length ? lines[lines.length - 1] : '';
}

export function formatStartupReport (fields = {}) {
  const where = redactPath(fields.where, fields);
  const lines = [
    `civitai-sync: ${fields.version || ''}`,
    `node: ${fields.node || ''}`,
    `platform: ${fields.platform || ''}`,
    `phase: ${fields.phase || ''}`,
    `operation: ${fields.operation || ''}`,
    `code: ${fields.code || ''}`
  ];
  if (where) lines.push(`where: ${where}`);
  if (fields.note) {
    const note = redactHome(fields.note, fields.homeDir).trim();
    if (note) lines.push(`note: ${note}`);
  }
  if (fields.npm) {
    const npm = redactHome(fields.npm, fields.homeDir).trim();
    if (npm) lines.push(`npm: ${npm}`);
  }
  return `${lines.join('\n')}\n`;
}

export async function writeStartupReport (fields, { directory } = {}) {
  const dir = directory || (await import('./cli.mjs')).APP_DIRECTORY;
  const text = typeof fields === 'string' ? fields : formatStartupReport(fields);
  await writeFile(path.join(dir, STARTUP_REPORT_NAME), text);
  return text;
}

export function holdForEnter () {
  if (!process.stdin.isTTY) return Promise.resolve();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Press Enter to close.\n', () => {
      rl.close();
      resolve();
    });
  });
}

// One wait. A second failure during the hold does not ask again.
export async function reportAndHold (fields) {
  if (holding) return;
  holding = true;
  let text = '';
  try {
    text = await writeStartupReport(fields);
  } catch {
    text = formatStartupReport(fields);
  }
  console.log(text);
  await holdForEnter();
}
