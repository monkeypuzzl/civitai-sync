import path from 'node:path';
import process from 'node:process';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import { fileExists } from './utils.mjs';
import { APP_DIRECTORY, CONFIG, OS } from './cli.mjs';
import { forEachGeneration, mediaFilepath, getFirstGenerationId, saveGenerations, getGenerationImages, DOWNLOAD_TYPES_MOD } from './generations.mjs';
import { requestKey } from './keyActions.mjs';
import { getAllRequests } from './civitaiApi.mjs';

const MAX_FETCH_ATTEMPTS = 10;

let listeningForKeyPress = false;

function listenForKeyPress (fn) {
  if (listeningForKeyPress) {
    return;
  }

  process.stdin.on('keypress', fn);
  listeningForKeyPress = true;
}

function stopListeningForKeyPress (fn) {
  process.stdin.off('keypress', fn);
  listeningForKeyPress = false;
}


let aborted = false;

export async function fetchGenerations (args = {}, log = console.log) {
  const {
    withImages = true,   // download images
    latest = false,      // check latest generations
    oldest = false,      // check oldest generations
    resume = false,      // keep checking for gaps in generations
    overwrite = false,   // overwrite existing generations
    overwriteIfModified = true,
    tags = [],           // "favorite", "liked", "disliked"
    secretKey = '',      // authentication key
    listeningForKeyPress = true
  } = args;

  let { cursor, attempts = 0 } = args;
  let shouldContinue = true;
  let nextCursor;
  let report = { fromDate: '', toDate: '', generationsDownloaded: 0, generationsSaved: 0, generationsNew: 0, imagesSaved: 0, currentTag: tags.length ? DOWNLOAD_TYPES_MOD[tags[0]] || tags[0] : '' };

  if (tags.length > 1) {
    for (let tag of tags) {
      await fetchGenerations({...args, tags: [ tag ]}, log);
    }

    return !aborted && shouldContinue;
  }

  function onKeyPress (char, key) {
    if (key.name === 'escape') {
      console.log('Stopping. Please wait...');
      aborted = true;
    }
  }

  if (listeningForKeyPress) {
    aborted = false;
    listenForKeyPress(onKeyPress);
  }

  if (latest) {
    cursor = undefined;
  }

  else if (oldest) {
    cursor = await getFirstGenerationId();
  }

  // TODO: Check if generation matching cursor already exists
  // Fetch only missing generation data
  // Store API response request ids and nextCursor, to better
  // navigate the feed and minimise data downloads
        
  function reportText ({ esc = true } = {}) {
    const daysAgo = Math.round((Date.now() - new Date(report.fromDate).getTime()) / (1000 * 60 * 60 * 24));
    const fromDateDisplay = `${niceDate(report.fromDate)}${daysAgo ? ` (${daysAgo} day${daysAgo === 1 ? '' : 's'} ago)` : ''}`;

    return `Downloading ${report.currentTag || 'all'}:\n${report.generationsDownloaded} generations downloaded (${report.generationsNew} saved), ${report.imagesSaved} images downloaded\nCurrent: ${fromDateDisplay}\n${esc ? '\nPress Esc to stop\n' : ''}`;
  }

  function niceDate (dateString = '1970-01-01T00:00:00.000000Z') {
    const posTime = dateString.indexOf('T');
    const posSeconds = dateString.lastIndexOf(':');
    
    return `${dateString.slice(0, posTime)} ${dateString.slice(posTime + 1, posSeconds)}`;
  }

  function logProgress () {
    log(reportText());
  }

  function progressFn ({ generationsSaved = 0, generationsNew = 0, imagesSaved = 0 }) {
    report.generationsSaved += generationsSaved;
    report.generationsNew += generationsNew;
    report.imagesSaved += imagesSaved;
    logProgress();
  }

  try {
    shouldContinue = await getAllRequests(
      async data => {
        if (aborted) {
          return false;
        }

        if (data.error) {
          if (data.error.json.data.code === 'UNAUTHORIZED') {
            const answer = await confirm({ message: chalk.red('\nFetch failed. Your API key needs updating. Update now?'), default: true });

            if (answer) {
              await requestKey();
            }
          
            return false;
          }

          try {
            log(chalk.red(data.error.json.message));
          }

          catch (error) {
            console.error(error.message, JSON.stringify(data, null, 2));
            log('Download error');
          }

          return false;
        }

        const generations = data.result.data.json.items;

        generations.forEach(({ createdAt }) => {
          if (!report.fromDate) {
            report.fromDate = createdAt; 
            report.toDate = createdAt;
          }
      
          else {
            if (createdAt < report.fromDate) {
              report.fromDate = createdAt;
            }

            if (createdAt > report.toDate) {
              report.toDate = createdAt;
            }
          }
        });

        nextCursor = data.result.data.json.nextCursor;

        report.generationsDownloaded += generations.length;
        attempts = 0;
        logProgress();

        // Save data
        const result = await saveGenerations(data, { overwrite, overwriteIfModified, withImages }, progressFn);

        if (aborted) {
          log(`Download aborted. ${reportText({ esc: true })}`);
          return false;
        }

        if (result.error) {
          log(`Error. ${result.error}`);
          return false;
        }

        if (report.generationsDownloaded && (result.generationsNew > 0 || result.imagesSaved > 0 || resume || oldest)) {
          return true;
        }

        const alreadyUpToDate = report.generationsSaved === 0;
        
        log(`${alreadyUpToDate ? 'You are up-to-date.' : reportText({ esc: false })}`);
        return false; // Returning `false` from getAllRequests progress callback exits loop
      },
      { secretKey },
      cursor || undefined,
      tags
    );
  }

  catch (error) {
    if (attempts < MAX_FETCH_ATTEMPTS) {
      attempts ++;
      log(chalk.yellowBright(`\nCould not connect to the web service. Retrying...`));

      if (listeningForKeyPress) {
        stopListeningForKeyPress(onKeyPress);
      }
      
      return !aborted && await fetchGenerations({...args, cursor: nextCursor || cursor }, log);
    }

    const code = error.code || (error.cause && error.cause.code);

    if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_SOCKET' || code ==='ECONNRESET') {
      log(chalk.red(`\nDownload failed. Could not connect to the web service. Please try again.`));
    }

    else {
      log(chalk.red(`\nDownload failed. Please try again. "${error.message} ${code}"`));
    }

    if (report.generationsSaved) {
      log(chalk.red('Download "All" to make sure nothing is missed.'));
    }
  }

  if (listeningForKeyPress) {
    stopListeningForKeyPress(onKeyPress);
  }

  return !aborted && shouldContinue;
}

export async function openDataDirectory () {
  const OPEN_COMMAND = OS === 'win32' ? 'explorer' : 'open';
  let dir = CONFIG.generationsDataPath;
  
  if (!CONFIG.generationsDataPath.startsWith('/')) {
    dir = path.join(APP_DIRECTORY, CONFIG.generationsDataPath);
  }

  exec(`${OPEN_COMMAND} ${dir}`, (error, stdout, stderr) => {
    if (error || stderr) {
      console.log('The directory does not exist. It will be created when you start downloading.');
    }
  });
}

export async function openMediaDirectory () {
  const OPEN_COMMAND = OS === 'win32' ? 'explorer' : 'open';
  let dir = CONFIG.generationsMediaPath;
  
  if (!CONFIG.generationsDataPath.startsWith('/')) {
    dir = path.join(APP_DIRECTORY, CONFIG.generationsMediaPath);
  }

  exec(`${OPEN_COMMAND} ${dir}`, (error, stdout, stderr) => {
    if (error || stderr) {
      console.log('The directory does not exist. It will be created when you start downloading.');
    }
  });
}

export async function countGenerations ({ withImages = true, withMissingImages = false, includeLegacy = true } = {}) {
  const startAt = Date.now();
  let generations = 0;
  let fromDate = '';
  let toDate = '';
  let imagesCreated = 0;
  let imagesSaved = 0;
  const imagesMissing = [];

  await forEachGeneration(async (generation, { date }) => {
    generations ++;

    if (!fromDate) {
      fromDate = date; 
      toDate = date;
    }

    if (date > toDate) {
      toDate = date;
    }

    if (withImages) {
      const images = getGenerationImages(generation);

      for (let image of images) {
        const { id, seed } = image;
        const mediaInfo = { date, generationId: generation.id, mediaId: id, seed };
        const filepath = mediaFilepath(mediaInfo);
        
        if (await fileExists(filepath)) {
          imagesSaved ++;
          imagesCreated ++;
        }
        
        else {
          if (image.available) {
            imagesCreated ++;
          }

          else if (withMissingImages) {
            imagesMissing.push({ generationId: generation.id, date, url: image.url });
          }
        }
      }
    }
  }, includeLegacy);

  const elapsed = Date.now() - startAt;

  const report = { generations, fromDate, toDate, reportGenerationTime: elapsed };

  if (withImages) {
    report.imagesCreated = imagesCreated;
    report.imagesSaved = imagesSaved;
    
    if (withMissingImages) {
      report.imagesMissing = imagesMissing;
    }
  }

  return report;
}

