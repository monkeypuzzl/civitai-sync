/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/
import fs from 'node:fs';
// import confirm from '@inquirer/confirm';
import extractZip from 'extract-zip';
import { mkdirp } from 'mkdirp';
import { getModel, fetchFile } from './civitaiApi.mjs';
import { fileExists, readFile, writeFile, listFiles, listDirectories } from './utils.mjs';
import { APP_DIRECTORY } from './cli.mjs';
import { spawnChild } from './childProcess.mjs';


export const APP_MODEL_ID = 526058;
const REGEX_VERSION_NUMBER = /^v(\d+(?:\.\d+){0,2})/;
const PROGRAM_FILES = [
  { prefix: 'package', suffix: '.json' },
  { prefix: 'README' },
  { prefix: 'LICENSE' },
  { suffix: '.cmd' },
  { suffix: '.mjs' },
  { suffix: '.js' }
];
const PROGRAM_DIRECTORIES = [
  'src'
];
const HTML_INITIAL_TEXT_CONTENT = /<p>([^<]*)<\/p>/;
export const SOFTWARE = {
  current: {},
  latest: {},
  hasUpdate: false,
  checkedAt: 0
};
const SOFTWARE_UPDATE_CHECK_EVERY = 12; // hours

export async function getModelLatestVersion (modelId) {
  const model = await getModel(modelId);

  if (model.error) {
    return null;
  }

  const modelVersions = model.modelVersions
  .filter(({ status, availability }) => status === 'Published' && (availability === 'Public' || availability === 'EarlyAccess'))
  .sort((a, b) => a.publishedAt > b.publishedAt ? -1 : 1);
  const latestVersion = modelVersions[0];

  if (!latestVersion) {
    return null;
  }

  const { id, name, availability, downloadUrl, description } = latestVersion;
  const summaryMatch = description.match(HTML_INITIAL_TEXT_CONTENT);
  const summary = summaryMatch ? summaryMatch[1] : '';

  return { id, name, availability, downloadUrl, summary };
}

export async function getCivitaiSyncLatestInfo () {
  const latestVersion = await getModelLatestVersion(APP_MODEL_ID);

  if (!latestVersion) {
    return null;
  }

  const matchVersion = latestVersion.name.match(REGEX_VERSION_NUMBER);

  if (!matchVersion) {
    console.error(`Unexpected version number, ${latestVersion.name}`);
    return null;
  }

  const version = matchVersion[1];
  return { ...latestVersion, version };
}

export async function getPackage (filepath) {
  try {
    const contents = await readFile(filepath);
    return JSON.parse(contents);
  }

  catch (error) {
    console.error(`Could not get package version`, error);
    return null;
  }
}

export function hasSamePackageDependencies (package1, package2) {
  const dependencies1 = Object.keys(package1.dependencies).sort();
  const dependencies2 = Object.keys(package2.dependencies).sort();

  if (dependencies1.join(',') !== dependencies2.join(',')) {
    return false;
  }
  
  return dependencies1.every(name => package1.dependencies[name] === package2.dependencies[name]);
}

export async function getCurrentVersion () {
  const currentPackage = await getPackage(`${APP_DIRECTORY}/package.json`);
  return currentPackage && currentPackage.version || '';
}

function semanticVersion (versionString) {
  const semver = versionString.split('.').map(s => Number(s));

  while (semver.length < 3) {
    semver.push(0);
  }

  return semver;
}

function isLaterVersionThan (a, b) {
  const aVersion = semanticVersion(a);
  const bVersion = semanticVersion(b);

  if (aVersion[0] === bVersion[0]) {
    if (aVersion[1] === bVersion[1]) {
      return aVersion[2] > bVersion[2];
    }

    return aVersion[1] > bVersion[1];
  }

  return aVersion[0] > bVersion[0];
}

function datetimeString (date) {
  const dateObj = date ? new Date(date) : new Date();
  return dateObj.toISOString().replace(/[^\d]/g, '');
}

export async function isGit () {
  const GIT_DIRECTORY = `${APP_DIRECTORY}/.git`;
  return await fileExists(GIT_DIRECTORY);
}

export async function loadSoftwareUpdateInfo () {
  const SOFTWARE_UPDATE_DIRECTORY = `${APP_DIRECTORY}/software-updates`;
  const softwareInfoPath = `${SOFTWARE_UPDATE_DIRECTORY}/versions.json`;
  
  try {
    const contents = await readFile(softwareInfoPath);
    return JSON.parse(contents);
  }

  catch (ignoreErr) {
    return null;
  }
}

export async function saveSoftwareUpdateInfo (data) {
  const SOFTWARE_UPDATE_DIRECTORY = `${APP_DIRECTORY}/software-updates`;
  const softwareInfoPath = `${SOFTWARE_UPDATE_DIRECTORY}/versions.json`;
  
  try {
    await writeFile(softwareInfoPath, data);
    return true;
  }

  catch (err) {
    console.error(err);
    return false;
  }
}

export async function checkForSoftwareUpdate ({ force = false } = {}) {
  if (!SOFTWARE.checkedAt && !force) {
    const cached = await loadSoftwareUpdateInfo();
    
    if (cached) {
      Object.keys(cached)
      .forEach(key => SOFTWARE[key] = cached[key]);
    }
  }

  if (force || !SOFTWARE.checkedAt || Date.now() - SOFTWARE.checkedAt > SOFTWARE_UPDATE_CHECK_EVERY * 1000 * 60 * 60) {
    const latest = await getCivitaiSyncLatestInfo();

    if (!latest) {
      return SOFTWARE;
    }
    
    SOFTWARE.latest = latest;
    SOFTWARE.checkedAt = Date.now();
    SOFTWARE.currentVersion = await getCurrentVersion();
    SOFTWARE.hasUpdate = isLaterVersionThan(SOFTWARE.latest.version, SOFTWARE.currentVersion);

    await saveSoftwareUpdateInfo(SOFTWARE);
  }

  return SOFTWARE;
}

export async function downloadSoftwareUpdate (url, version, { secretKey } = {}) {
  const SOFTWARE_UPDATE_DIRECTORY = `${APP_DIRECTORY}/software-updates`;
  const zipFilepath = `${SOFTWARE_UPDATE_DIRECTORY}/civitai-sync-v${version}.zip`;

  if (await fileExists(zipFilepath)) {
    return true;
  }
  
  try {
    console.log('Downloading software');
    await fetchFile(url, zipFilepath, { secretKey });
  }

  catch (error) {
    console.error('Download software error', error);
    return false;
  }

  return true;
}

export async function unzipSoftwareUpdate (version) {
  const SOFTWARE_UPDATE_DIRECTORY = `${APP_DIRECTORY}/software-updates`;
  const zipFilepath = `${SOFTWARE_UPDATE_DIRECTORY}/civitai-sync-v${version}.zip`;
  const unzipDirectory = `${SOFTWARE_UPDATE_DIRECTORY}/${version}`;

  if (await fileExists(unzipDirectory)) {
    return true;
  }
  
  await mkdirp(unzipDirectory);

  try {
    console.log('Extracting software');
    await extractZip(zipFilepath, { dir: unzipDirectory });
  }

  catch (error) {
    console.error('download software error', error);
    return false;
  }

  return true;
}

export async function installSoftwareUpdate (version) {
  const SOFTWARE_UPDATE_DIRECTORY = `${APP_DIRECTORY}/software-updates`;
  const backupDirectory = `${SOFTWARE_UPDATE_DIRECTORY}/backup-${datetimeString()}`;
  const unzipDirectory = `${SOFTWARE_UPDATE_DIRECTORY}/${version}`;

  // Confirm that package is later version
  const currentPackage = await getPackage(`${APP_DIRECTORY}/package.json`);
  const newPackage = await getPackage(`${unzipDirectory}/package.json`);

    if (!isLaterVersionThan(newPackage.version, currentPackage.version)) {
    return false;
  }

  const rootFiles = (await listFiles(APP_DIRECTORY))
  .filter(file => PROGRAM_FILES.some(({ prefix, suffix }) => {
    if (
      (prefix && !file.startsWith(prefix)) ||
      (suffix && !file.endsWith(suffix))
    ) {
      return false;
    }

    return true;
  }));

  await mkdirp(backupDirectory);

  const undo = [];

  if (!hasSamePackageDependencies(newPackage, currentPackage)) {
    let npmLog = '';

    console.log('Installing dependencies...');

    try {
      await fs.promises.cp(`${APP_DIRECTORY}/node_modules`, unzipDirectory, { recursive: true });
      await spawnChild('npm', ['install'], { cwd: unzipDirectory }, txt => npmLog += txt);

      // Move node_modules
      undo.push(async () => {
        fs.promises.rename(`${backupDirectory}/node_modules`, `${APP_DIRECTORY}/node_modules`);
      });

      await fs.promises.rename(`${APP_DIRECTORY}/node_modules`, `${backupDirectory}/node_modules`);

      undo.push(async () => {
        fs.promises.rename(`${APP_DIRECTORY}/node_modules`, `${unzipDirectory}/node_modules`);
      });

      await fs.promises.rename(`${unzipDirectory}/node_modules`, `${APP_DIRECTORY}/node_modules`);
    }

    catch (error) {
      for (let undoStep of undo.reverse()) {
        await undoStep();
      }

      await writeFile(`${backupDirectory}/npm-log.txt`, npmLog);

      console.error(`Unable to install software dependencies. ${JSON.stringify(error, null, 2)}\nLog:\n${npmLog}`);
      return false;
    }
  }

  try {
    console.log('Copying files....');

    undo.push(async () => {
      for (let file of await listFiles(backupDirectory)) {
        // console.log('rename', `${backupDirectory}/${file}`, `${APP_DIRECTORY}/${file}`);
        await fs.promises.rename(`${backupDirectory}/${file}`, `${APP_DIRECTORY}/${file}`);
      }
    });

    for (let file of rootFiles) {
      // console.log('rename', `${APP_DIRECTORY}/${file}`, `${backupDirectory}/${file}`);
      await fs.promises.rename(`${APP_DIRECTORY}/${file}`, `${backupDirectory}/${file}`);
    }

    undo.push(async () => {
      for (let file of await listFiles(unzipDirectory)) {
        // console.log('unlink', `${APP_DIRECTORY}/${file}`);
        await fs.promises.unlink(`${APP_DIRECTORY}/${file}`);
      }
    });

    for (let file of await listFiles(unzipDirectory)) {
      // console.log('cp', `${unzipDirectory}/${file}`, `${APP_DIRECTORY}/${file}`);
      await fs.promises.cp(`${unzipDirectory}/${file}`, `${APP_DIRECTORY}/${file}`);
    }

    undo.push(async () => {
      for (let dir of backupDirectory) {
        // console.log('rename', `${backupDirectory}/${dir}`, `${APP_DIRECTORY}/${dir}`);
        await fs.promises.rename(`${backupDirectory}/${dir}`, `${APP_DIRECTORY}/${dir}`);
      }
    });

    for (let dir of PROGRAM_DIRECTORIES) {
      if (await fileExists(`${APP_DIRECTORY}/${dir}`)) {
        // console.log('rename', `${APP_DIRECTORY}/${dir}`, `${backupDirectory}/${dir}`);
        await fs.promises.rename(`${APP_DIRECTORY}/${dir}`, `${backupDirectory}/${dir}`);
      }
    }

    undo.push(async () => {
      for (let dir of await listDirectories(unzipDirectory)) {
        // console.log('rm', `${APP_DIRECTORY}/${dir}`);
        await fs.promises.rm(`${APP_DIRECTORY}/${dir}`, { recursive: true });
      }
    });

    for (let dir of await listDirectories(unzipDirectory)) {
      // console.log('cp', `${unzipDirectory}/${dir}`, `${APP_DIRECTORY}/${dir}`);
      await fs.promises.cp(`${unzipDirectory}/${dir}`, `${APP_DIRECTORY}/${dir}`, { recursive: true });
    }

    console.log('Installation complete');
    return true;
  }

  catch (error) {
    console.error(`Error in software update, reverting`, error);

    for (let undoStep of undo.reverse()) {
      await undoStep();
    }
  }

  return false;
}

export async function updateSoftware ({ secretKey } = {}) {
  console.log(`Updating software. Please wait...`);

  let success;

  try {
    const { latest } = await checkForSoftwareUpdate({ force: true });
    
    if (!latest.version) {
      return false;
    }

    // if (await isGit()) {
    //   console.log('A software update is available. Try `git pull`.');

    //   const answer = await confirm({ message: `Proceed with software update?`, default: false });
    //   if (!answer) {
    //     return false;
    //   }
    // }
    
    success = await downloadSoftwareUpdate(latest.downloadUrl, latest.version);

    if (!success) {
      success = await downloadSoftwareUpdate(latest.downloadUrl, latest.version, { secretKey });
    }
    
    if (!success) {
      if (latest.availability === 'EarlyAccess') {
        console.log(`There is a software update available for Early Access.\nUnlock it at https://civitai.com/models/${APP_MODEL_ID}.\nIt will be available for all soon.`);
      }

      else {
        console.log(`There is a software update available, but it could not be downloaded.\nPlease try again. Or download from https://civitai.com/models/${APP_MODEL_ID} and install manually.`);
      }
      
      return false;
    }

    success = await unzipSoftwareUpdate(latest.version);
    
    if (success) {
      console.log('installing...')
      success = await installSoftwareUpdate(latest.version);
    }

    else {
      console.error('Could not unzip');
    }
  }

  catch (error) {
    console.error('Software install error', error);
  }

  if (success) {
    // await spawnChild('npm', ['run', 'cli', CONFIG_PATH], { cwd: APP_DIRECTORY }, console.log);
    console.log(`Software updated. Please restart.`);
  }

  else {
    console.error('Could not install software update');
  }

  return success;
}
