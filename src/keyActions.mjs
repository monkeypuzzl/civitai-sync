/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import chalk from 'chalk';
import input from '@inquirer/input';
import password from '@inquirer/password';
import { CONFIG, CONFIG_PATH } from './cli.mjs';
import { encryptAES, decryptAES } from './crypto.mjs';
import { setConfig } from './config.mjs';

let SECRET_KEY;

export async function requestPassword () {
  const pass = await password({ message: 'Type password and press Enter (or just press Enter to cancel):' });

  if (!pass) {
    return null;
  }

  return pass;
}

export async function requestNewPassword () {
  const pass = await password({ message: 'Type password and press Enter (or just press Enter to cancel):' });

  if (!pass) {
    return null;
  }

  const pass2 = await password({ message: 'Repeat password:' });

  if (pass !== pass2) {
    console.log(chalk.red(`Passwords do not match`));
    return await requestNewPassword();
  }
  
  return pass;
}

export async function encryptKey (secretKey) {
  if (!secretKey) {
    return null;
  }

  const pass = await requestNewPassword();

  if (!pass) {
    return null;
  }

  try {
    const encryptedKey = encryptAES(secretKey, pass);

    await setConfig({
      keyEncrypt: true,
      secretKey: encryptedKey
    });

    console.log(chalk.green(`Key encrypted`));

    return encryptedKey;
  }

  catch (error) {
    console.log(chalk.red(`Could not encrypt key: ${error.message}`));
    return null;
  }
}

export async function decryptWithPassword (encrypted, pass) {
  if (!encrypted) {
    return null;
  }

  if (!pass) {
    pass = await requestPassword();
  }

  if (!pass) {
    return null;
  }
  
  try {
    const decrypted = decryptAES(encrypted, pass);
    return decrypted;
  }

  catch (ignoreErr) {
    return null;
  }
}

export async function unEncryptKey (encryptedKey) {
  const secretKey = await decryptWithPassword(encryptedKey);

  if (!secretKey) {
    console.log(chalk.red(`Could not decrypt key, wrong pasword`));
    return null;
  }

  await setConfig({
    keyEncrypt: false,
    secretKey
  });

  console.log(chalk.green(`Key decrypted`));
}

export async function testKey (secretKey) {
  try {
    const { getGenerations, normalizeCivitaiError } = await import('./civitaiApi.mjs');
    const data = await getGenerations({ secretKey });

    if (!data) {
      return { error: true, code: 'UNKNOWN', message: 'Empty response' };
    }

    if (data.error) {
      const err = normalizeCivitaiError(data.error);
      return {
        error: true,
        code: err.code,
        httpStatus: err.httpStatus,
        message: err.message,
        retryable: err.retryable
      };
    }

    return { success: true };
  } catch (error) {
    return { error: true, code: 'UNKNOWN', message: error.message };
  }
}

export async function getSecretKey () {
  if (SECRET_KEY) {
    return SECRET_KEY;
  }

  if (!CONFIG.secretKey) {
    return await requestKey();
  }

  if (!CONFIG.keyEncrypt) {
    SECRET_KEY = CONFIG.secretKey;
    return SECRET_KEY;
  }

  const secretKey = await decryptWithPassword(CONFIG.secretKey);

  if (!secretKey) {
    console.log(chalk.red(`Wrong password. Please type it again.`));
    return await getSecretKey();
  }
  
  SECRET_KEY = secretKey;
  return secretKey;
}

// Non-interactive equivalent of getSecretKey. Returns a usable plaintext key
// when one is already available (memoized after a prior interactive unlock,
// or stored unencrypted in config). Returns null otherwise — never prompts
// for a password. Used by CLI startup, Settings refresh, and the Explorer
// server so they do not hijack the terminal.
export function getAvailableSecretKey () {
  if (SECRET_KEY) return SECRET_KEY;
  if (!CONFIG?.secretKey) return null;
  if (CONFIG.keyEncrypt) return null;
  return CONFIG.secretKey;
}

// Store a plaintext key in the in-memory SECRET_KEY memo. Used by the Explorer
// server's /api/unlock endpoint so CLI and Explorer share the same unlocked
// state across the process lifetime.
export function setMemoizedSecretKey (key) {
  SECRET_KEY = key || null;
}

function keyTestMessage (result) {
  const is5xx = result.httpStatus >= 500 && result.httpStatus < 600;
  if (is5xx || (result.retryable && result.httpStatus >= 500)) {
    return 'The web service is down. Please check again shortly.';
  }
  return result.message || 'The API key was rejected.';
}

// Test, then save. `password` null stores the key in the clear. A password
// that fails to encrypt leaves the previous key on disk. `{ encrypt }` is
// the cipher; tests pass a function that throws.
export async function saveTestedKey ({ key, password, encrypt = encryptAES } = {}) {
  const trimmed = typeof key === 'string' ? key.trim() : '';
  if (!trimmed) return { ok: false, message: 'Enter an API key.' };

  const tested = await testKey(trimmed);
  if (!tested.success) {
    return { ok: false, message: keyTestMessage(tested) };
  }

  let stored = trimmed;
  let keyEncrypt = false;
  if (password) {
    try {
      stored = encrypt(trimmed, password);
      if (!stored) return { ok: false, message: 'Could not encrypt key' };
      keyEncrypt = true;
    } catch {
      return { ok: false, message: 'Could not encrypt key' };
    }
  }

  await setConfig({ secretKey: stored, keyEncrypt });
  setMemoizedSecretKey(trimmed);

  const { resetUserDataSession } = await import('./userData.mjs');
  resetUserDataSession();

  const { getCivitaiUser, getMe } = await import('./civitaiApi.mjs');
  const { applyAccountIdentity, rememberAccountKey } = await import('./accountIdentity.mjs');
  const { altDomainEligibleOf } = await import('./civitaiWire.mjs');

  const session = await getCivitaiUser({ secretKey: trimmed });
  let identity = null;
  const sessionId = Number(session && session.id);
  if (session && Number.isInteger(sessionId) && sessionId > 0 && session.username) {
    identity = { id: sessionId, username: session.username };
    const eligible = altDomainEligibleOf(session);
    if (typeof eligible === 'boolean') identity.eligible = eligible;
  } else {
    const me = await getMe({ secretKey: trimmed });
    const meId = Number(me && me.id);
    if (me && Number.isInteger(meId) && meId > 0 && me.username) {
      identity = { id: meId, username: me.username };
    }
  }

  if (!identity) {
    rememberAccountKey(trimmed, null);
    return { ok: true, kind: 'unresolved', username: CONFIG.username || '' };
  }

  const applied = await applyAccountIdentity(identity);
  rememberAccountKey(trimmed, applied);
  return {
    ok: true,
    kind: applied.kind,
    username: applied.username || CONFIG.username || '',
    libraryUsername: applied.libraryUsername,
    keyUsername: applied.keyUsername
  };
}

export async function requestKey () {
  const newKey = await input({ message: 'Enter API key (or press Enter to cancel):' });

  if (!newKey) {
    return null;
  }

  const pass = await requestNewPassword();
  const result = await saveTestedKey({ key: newKey, password: pass });

  if (!result.ok) {
    console.log(chalk.red(result.message));
    return null;
  }

  if (result.kind === 'blocked') {
    const { accountMismatchText } = await import('./accountIdentity.mjs');
    console.log(accountMismatchText(result.libraryUsername, result.keyUsername));
    return newKey;
  }

  console.log(chalk.green(`Key saved ${passwordWasSet(pass) ? '(encrypted) ' : ''}in config at ${CONFIG_PATH}`));
  return newKey;
}

function passwordWasSet (pass) {
  return typeof pass === 'string' && pass.length > 0;
}

export async function removeKey () {
  setMemoizedSecretKey(null);

  await setConfig({
    keyEncrypt: false,
    secretKey: ''
  });
  const { resetUserDataSession } = await import('./userData.mjs');
  resetUserDataSession();
}
