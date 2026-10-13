/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import chalk from 'chalk';
import input from '@inquirer/input';
import password from '@inquirer/password';
import { CONFIG, CONFIG_PATH } from './cli.mjs';
import { encryptAES, decryptAES } from './crypto.mjs';
import { setConfig } from './config.mjs';
import { CIVITAI_DOMAINS } from './civitaiDomain.mjs';

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

export async function requestKey () {
  const newKey = await input({ message: 'Enter API key (or press Enter to cancel):' });

  if (!newKey) {
    return null;
  }

  const { fillIfMissing, resetUserDataSession } = await import('./userData.mjs');

  SECRET_KEY = newKey;
  // A new API key may belong to a different user, or the same user with
  // different content permissions. Clear identity-derived fields so the next
  // refresh repopulates them cleanly. Reset domain to civitai.com as well,
  // to avoid being stuck on civitai.red without eligibility confirmation; the
  // next first-write of allowAltDomain will seed .red if the SessionUser
  // flag is true.
  await setConfig({
    username: '',
    allowAltDomain: undefined,
    domain: CIVITAI_DOMAINS[0]
  });
  resetUserDataSession();

  const encryptedKey = await encryptKey(newKey);

  if (!encryptedKey) {
    await setConfig({
      keyEncrypt: false,
      secretKey: newKey
    });
  }

  console.log(chalk.green(`Key saved ${encryptedKey ? '(encrypted) ' : ''}in config at ${CONFIG_PATH}`));

  // Do not await: a failing or slow auth.getUser must not hold the menu.
  fillIfMissing({ secretKey: newKey }).catch(() => {});

  return newKey;
}

export async function removeKey () {
  SECRET_KEY = null;

  await setConfig({
    keyEncrypt: false,
    secretKey: null,
    username: '',
    allowAltDomain: undefined,
    domain: CIVITAI_DOMAINS[0]
  });
  const { resetUserDataSession } = await import('./userData.mjs');
  resetUserDataSession();
}
