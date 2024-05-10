import path from 'node:path';
import process from 'node:process';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import { fileExists } from './utils.mjs';
import { APP_DIRECTORY, CONFIG, OS } from './cli.mjs';
import { forEachGeneration, imageFilepath, getFirstGenerationId, saveGenerations, saveGenerationImages } from './generations.mjs';
import { mainMenu } from './mainMenu.mjs';
import { requestKey } from './keyActions.mjs';
import { setDownloadOptions } from './downloadOptionsMenu.mjs';
import { getAllRequests } from './civitaiApi.mjs';

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


let aborted;

export async function fetchGenerations ({
  withImages = true,
  latest = false,
  resume = false,
  overwrite = false,
  cursor,
  secretKey,
  listeningForKeyPress = true
} = {}, log = console.log) {
  function onKeyPress (char, key) {
    if (key.name === 'escape') {
      console.log('Stopping');
      aborted = true;
    }
  }

  if (listeningForKeyPress) {
    aborted = false;
    listenForKeyPress(onKeyPress);
  }

  if (!cursor) {
    latest = true;
  }

  if (latest && resume) {
    const shouldContinue = await fetchGenerations({ withImages, resume: false, latest, secretKey, listeningForKeyPress: false }, log);

    if (aborted || !shouldContinue) {
      return false;
    }

    return await fetchGenerations({ withImages, resume, latest: false, cursor, secretKey, listeningForKeyPress: false }, log);
  }

  else if (resume && !cursor) {
    cursor = await getFirstGenerationId();
  }

  // TODO: Check if generation matching cursor already exists
  // Fetch only missing generation data
  // Store API response request ids / nextCursor to keep track

  let generationsCount = 0;
  let imagesCount = 0;
  let shouldContinue;

  try {
    shouldContinue = await getAllRequests(
      async data => {
        if (aborted) {
          return false;
        }

        if (data.error) {
          if (data.error.json.data.code === 'UNAUTHORIZED') {
            const answer = await confirm({ message: chalk.red('Fetch failed. Your secret key needs updating. Update now?'), default: true });

            if (answer) {
              await requestKey();
            }
          
            mainMenu();
            return false;
          }
        }

        // Save data
        const items = await saveGenerations(data, { overwrite });

        if (aborted) {
          return false;
        }
        
        function reportText () {
          return `\nDownloaded ${generationsCount} generations, ${imagesCount} images\nPress Esc to stop\n`;
        }

        // No new items
        if (!items.length) {
          // Returning `false` from getAllRequests progress callback exits process
          log(`Download complete. ${reportText()}`);
          return false;
        }

        generationsCount += items.length;
        
        const dates = items.reduce((dates, { createdAt }) => {
          if (!dates.fromDate) {
            dates.fromDate = createdAt; 
            dates.toDate = createdAt;
          }
      
          if (createdAt > dates.toDate) {
            dates.toDate = createdAt;
          }

          return dates;
        }, { fromDate: null, toDate: null });

        log(`${dates.fromDate.slice(0, dates.fromDate.indexOf('T'))} to ${dates.fromDate.slice(0, dates.toDate.indexOf('T'))}. ${reportText()}`);

        // Save images
        if (withImages) {
          for (let item of items) {
            log(`${item.createdAt.slice(0, item.createdAt.lastIndexOf(':')).replace('T', ' ')} ${reportText()}`);
            const filepaths = await saveGenerationImages(item, secretKey);

            if (filepaths.length) {
              imagesCount += filepaths.length;
            }
            
            if (aborted) {
              return false;
            }
          }
        }
      },
      { secretKey },
      cursor
    );
  }

  catch (err) {
    console.log(chalk.red(`Download error, ${err.message}`));
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

  return setDownloadOptions();
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

  return setDownloadOptions();
}

export async function countGenerations ({ withImages = false, withMissingImages = false } = {}) {
  const startAt = Date.now();
  let generations = 0;
  let fromDate;
  let toDate;
  let imagesCreated = 0;
  let imagesSaved = 0;
  const imagesMissing = [];

  await forEachGeneration(async (item, { date }) => {
    generations ++;

    if (!fromDate) {
      fromDate = date; 
      toDate = date;
    }

    if (date > toDate) {
      toDate = date;
    }

    if (withImages) {
      const { images } = item;

      for (let image of images) {
        const filepath = imageFilepath(date, image.url);

        if (await fileExists(filepath)) {
          imagesSaved ++;
          imagesCreated ++;
        }

        else if (image.available) {
          imagesCreated ++;
        }

        else if (withMissingImages) {
          imagesMissing.push({ generationId: item.id, date, url: image.url });
        }
      }
    }
  });

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
