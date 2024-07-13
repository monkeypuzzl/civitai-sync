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


let aborted = false;

export async function fetchGenerations ({
  withImages = true,   // download images
  checkImages = false, // refresh broken downloaded images
  latest = false,      // check latest generations
  oldest = false,      // check oldest generations
  resume = false,      // keep checking for gaps in generations
  overwrite = false,   // overwrite existing generations
  cursor = 0,          // fetch generations earlier than this generation id 
  secretKey = '',      // authentication key
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

  if (latest) {
    cursor = undefined;
  }

  else if (oldest) {
    cursor = await getFirstGenerationId();
  }

  // if (!cursor) {
  //   latest = true;
  // }

  // if (latest && resume) {
    // First fetch latest
    // return await fetchGenerations({ withImages, checkImages, resume: true, latest, secretKey, listeningForKeyPress: false }, log);

    // if (aborted) {
    //   return false;
    // }

    // // Then resume
    // return await fetchGenerations({ withImages, checkImages, resume, latest: false, cursor, secretKey, listeningForKeyPress: false }, log);
  // }

  // if (resume && !cursor) {
    // cursor = await getFirstGenerationId();
  // }

  // TODO: Check if generation matching cursor already exists
  // Fetch only missing generation data
  // Store API response request ids and nextCursor, to better
  // navigate the feed and minimise data downloads

  let shouldContinue = true;
  let report = { fromDate: '', toDate: '', generationsDownloaded: 0, generationsSaved: 0, imagesSaved: 0 };
        
  function reportText ({ esc = true } = {}) {
    return `\n${report.generationsDownloaded} generations downloaded, ${report.generationsSaved} saved, ${report.imagesSaved} images saved${esc ? '\nPress Esc to stop\n' : ''}`;
  }

  function logProgress () {
    if (report.fromDate === report.toDate) {
      log(`${report.fromDate}. ${reportText()}`);
    }

    else {
      log(`${report.fromDate.slice(0, report.fromDate.indexOf('.'))} to ${report.toDate.slice(0, report.toDate.indexOf('.'))} ${reportText()}`);
    }
  }

  function progressFn ({ generationsSaved = 0, imagesSaved = 0 }) {
    report.generationsSaved += generationsSaved;
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
            const answer = await confirm({ message: chalk.red('Fetch failed. Your API key needs updating. Update now?'), default: true });

            if (answer) {
              await requestKey();
            }
          
            mainMenu();
            return false;
          }

          console.error(data.error.json.data);
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

        report.generationsDownloaded += generations.length;
        logProgress();

        // Save data
        await saveGenerations(data, { overwrite, withImages, checkImages }, progressFn);

        if (aborted) {
          log(`Download aborted. ${reportText({ esc: true })}`);
          return false;
        }

        // No new items
        if (!report.generationsSaved && !report.imagesDownloadedSaved && !resume) {
          const alreadyUpToDate = report.generationsSaved === 0;
          log(`Download complete. ${alreadyUpToDate ? 'You are up-to-date. \n' : reportText({ esc: true })}`);
          return false;
          // Returning `false` from getAllRequests progress callback exits process
        }

        return true;
      },
      { secretKey },
      cursor || undefined
    );
  }

  catch (error) {
    console.log(chalk.red(`Download error, ${error.message}`));
    console.error(error);
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

export async function countGenerations ({ withImages = true, withMissingImages = false } = {}) {
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
      const { steps } = generation;

      for (let step of steps) {
        for (let image of step.images) {
          const { seed, url } = image;
          const filepath = imageFilepath({ date, generationId: generation.id, seed });
          const legacyFilepath = imageFilepathLegacy({ date, url });

          if (await fileExists(filepath) || await fileExists(legacyFilepath)) {
            imagesSaved ++;
            imagesCreated ++;
          }

          else if (image.available) {
            imagesCreated ++;
          }

          else if (withMissingImages) {
            imagesMissing.push({ generationId: generation.id, date, url: image.url });
          }
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

export async function renameImages () {
  await forEachGeneration(async (generation, { date }) => {
    for (let step of generation.steps) {
      for (let image of step.images) {
        const { seed, url } = image;
        const filepath = imageFilepath({ date, generationId: generation.id, seed });
        const legacyFilepath = imageFilepathLegacy({ date, url });

        if (await fileExists(legacyFilepath)) {
          if (await fileExists(filepath)) {
            await fs.promises.unlink(legacyFilepath);
          }

          else {
            await fs.promises.rename(legacyFilepath, filepath);
          }
        }
      }
    }
  });
}
