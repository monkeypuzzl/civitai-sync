// Which Civitai account a library belongs to. The key write does not decide
// this. applyAccountIdentity does, after a key has already been saved.

import fs from 'node:fs';
import { CONFIG } from './cli.mjs';
import { setConfig, removeConfigParam } from './config.mjs';
import { CIVITAI_DOMAINS } from './civitaiDomain.mjs';
import { getCivitaiUser, getMe } from './civitaiApi.mjs';
import { altDomainEligibleOf } from './civitaiWire.mjs';
import { ensureIndexLoaded, getIndex } from './serverIndex.mjs';
import { clearModelVersionCache } from './modelVersionCache.mjs';
import { clearTagCache } from './tagCache.mjs';
import { abortOwnModelsCheck, forgetOwnModels } from './ownModels.mjs';
import { accountMismatchText } from './accountMismatch.mjs';

export { accountMismatchText };

let checkedKey = null;
let beforePurge = async () => {};

export function onBeforeAccountCachePurge (fn) {
  beforePurge = typeof fn === 'function' ? fn : async () => {};
}

export function resetAccountIdentityMemory () {
  checkedKey = null;
}

function positiveId (value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function appendPreviousUsername (previous) {
  if (!previous) return;
  const list = Array.isArray(CONFIG.previousUsernames) ? CONFIG.previousUsernames.slice() : [];
  if (list.includes(previous)) return;
  list.push(previous);
  return list;
}

async function libraryIsCommitted () {
  await ensureIndexLoaded();
  const stats = getIndex().stats || {};
  return ['totalGenerations', 'totalPosts', 'totalComics', 'totalModel3ds']
    .some(key => Number(stats[key]) > 0);
}

async function purgeAccountCaches () {
  await beforePurge();
  abortOwnModelsCheck();
  forgetOwnModels();
  await clearModelVersionCache();
  await clearTagCache();
  const own = `${CONFIG.dataPath}/model-cache/own-models.json`;
  await fs.promises.unlink(own).catch(() => {});
}

async function seedDomain (eligible) {
  if (typeof eligible !== 'boolean') return;
  await setConfig({
    allowAltDomain: eligible,
    domain: eligible ? CIVITAI_DOMAINS[1] : CIVITAI_DOMAINS[0]
  });
}

export async function applyAccountIdentity ({ id, username, eligible } = {}) {
  const nextId = positiveId(id);
  const nextName = typeof username === 'string' ? username : '';
  if (!nextId || !nextName) return { kind: 'unresolved' };

  const storedId = positiveId(CONFIG.accountId);
  const storedName = CONFIG.username || '';

  if (!storedId) {
    const previous = appendPreviousUsername(storedName && storedName !== nextName ? storedName : '');
    const write = { accountId: nextId, username: nextName };
    if (previous) write.previousUsernames = previous;
    await setConfig(write);
    if (CONFIG.allowAltDomain === undefined) await seedDomain(eligible);
    else if (typeof eligible === 'boolean') await setConfig({ allowAltDomain: eligible });
    return { kind: 'recorded', username: nextName };
  }

  if (storedId === nextId) {
    const previous = appendPreviousUsername(storedName && storedName !== nextName ? storedName : '');
    const write = {};
    if (storedName !== nextName) write.username = nextName;
    if (previous) write.previousUsernames = previous;
    if (typeof eligible === 'boolean') write.allowAltDomain = eligible;
    if (Object.keys(write).length) await setConfig(write);
    return {
      kind: storedName !== nextName ? 'renamed' : 'recorded',
      username: CONFIG.username || nextName
    };
  }

  if (!(await libraryIsCommitted())) {
    await setConfig({ accountId: nextId, username: nextName });
    await removeConfigParam('previousUsernames');
    await removeConfigParam('allowAltDomain');
    await seedDomain(eligible);
    await purgeAccountCaches();
    return { kind: 'replaced', username: nextName };
  }

  return {
    kind: 'blocked',
    libraryUsername: storedName,
    keyUsername: nextName,
    username: storedName
  };
}

function parseSessionUser (user) {
  if (!user || typeof user !== 'object') return null;
  const id = positiveId(user.id);
  const username = typeof user.username === 'string' ? user.username : '';
  if (!id || !username) return null;
  const eligible = altDomainEligibleOf(user);
  const parsed = { id, username };
  if (typeof eligible === 'boolean') parsed.eligible = eligible;
  return parsed;
}

function parseMe (me) {
  if (!me || typeof me !== 'object' || me.error) return null;
  const id = positiveId(me.id);
  const username = typeof me.username === 'string' ? me.username : '';
  if (!id || !username) return null;
  return { id, username };
}

async function readIdentity (secretKey) {
  const session = parseSessionUser(await getCivitaiUser({ secretKey }));
  if (session) return session;
  return parseMe(await getMe({ secretKey }));
}

function gateResult (applied) {
  if (applied && applied.kind === 'blocked') {
    return {
      ok: false,
      message: accountMismatchText(applied.libraryUsername, applied.keyUsername)
    };
  }
  return { ok: true };
}

export function rememberAccountKey (secretKey, applied) {
  if (!secretKey) return;
  checkedKey = { key: secretKey, result: gateResult(applied) };
}

export async function requireLibraryAccount (secretKey) {
  const { getAvailableSecretKey } = await import('./keyActions.mjs');
  if (!CONFIG.secretKey) return { ok: false, message: 'Set an API key to download.' };
  if (CONFIG.keyEncrypt && !getAvailableSecretKey()) {
    return { ok: false, message: 'Unlock the API key to download.' };
  }
  const key = secretKey || getAvailableSecretKey();
  if (!key) return { ok: false, message: 'Set an API key to download.' };
  if (checkedKey && checkedKey.key === key) return checkedKey.result;

  const identity = await readIdentity(key);
  if (!identity) {
    checkedKey = { key, result: { ok: true } };
    return checkedKey.result;
  }
  const applied = await applyAccountIdentity(identity);
  rememberAccountKey(key, applied);
  return checkedKey.result;
}
