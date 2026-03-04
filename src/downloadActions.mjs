import path from 'node:path';
import process from 'node:process';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import { fileExists, listDirectory, readFile, wait } from './utils.mjs';
import { APP_DIRECTORY, CONFIG, OS, clearTerminal } from './cli.mjs';
import { forEachGeneration, getGeneratedMediaInfo, mediaFilepath, getFirstGenerationId, saveGenerations, getGenerationImages, DOWNLOAD_TYPES_MOD } from './generations.mjs';
import { getPostDates, postsDataDir, postImageFilepath } from './posts.mjs';
import { requestKey } from './keyActions.mjs';
import { getAllRequests } from './civitaiApi.mjs';
import { setConfigParam } from './config.mjs';
import { rebuildIndex } from './serverIndex.mjs';

const MAX_FETCH_ATTEMPTS = 10;

let listeningForKeyPress = false;
let aborted = false;

export function plural (n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function formatElapsed (ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatRelativeDate (dateString) {
  if (!dateString) return '';
  const days = Math.round((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));

  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 30) return `${days} days ago`;

  return '';
}

export function formatDate (dateString) {
  if (!dateString) return '';
  const posTime = dateString.indexOf('T');
  const posSeconds = dateString.lastIndexOf(':');

  return `${dateString.slice(0, posTime)} ${dateString.slice(posTime + 1, posSeconds)}`;
}

export function formatDateRange (fromDate, toDate) {
  if (!fromDate) return '';
  const from = fromDate.slice(0, fromDate.indexOf('T'));
  const to = toDate ? toDate.slice(0, toDate.indexOf('T')) : from;

  return from === to ? from : `${from} – ${to}`;
}

export function formatMonthYear (dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatMonthYearRange (fromDate, toDate) {
  if (!fromDate) return '';
  const from = formatMonthYear(fromDate);
  const to = toDate ? formatMonthYear(toDate) : from;
  return from === to ? from : `${from} – ${to}`;
}

export function formatMediaCounts (imagesSaved, videosSaved) {
  const parts = [];

  if (imagesSaved > 0) parts.push(plural(imagesSaved, 'image'));
  if (videosSaved > 0) parts.push(plural(videosSaved, 'video'));
  if (!parts.length) return '';

  return `${parts.join(', ')} saved`;
}


export function listenForEscKeyPress ({ onAbort } = {}) {
  if (listeningForKeyPress) {
    return;
  }

  listeningForKeyPress = true;
  const abortController = new AbortController();

  function onKeyPress (char, key) {
    if (key.name === 'escape') {
      listeningForKeyPress = false;
      if (onAbort) onAbort();
      abortController.abort();
    }
  }

  function stop () {
    listeningForKeyPress = false;
    process.stdin.off('keypress', onKeyPress);
  }

  process.stdin.once('keypress', onKeyPress);

  return { signal: abortController.signal, stop };
}

export async function fetchGenerations (options = {}) {
  const {
    withImages = true,
    latest = false,
    oldest = false,
    resume = false,
    overwrite = false,
    overwriteIfModified = true,
    tags = [],
    secretKey = '',
    log = console.log,
    onProgress,
    signal
  } = options;

  function isAborted () {
    if (!signal) {
      return false;
    }

    return signal.aborted;
  }

  let { cursor, attempts = 0 } = options;
  let nextCursor;
  let report = {
    time: (new Date()).toISOString(),
    count: 0,
    fromDate: '',
    toDate: '',
    batchDate: '',
    paginating: false,
    generationsDownloaded: 0,
    generationsSaved: 0,
    generationsNew: 0,
    imagesSaved: 0,
    videosSaved: 0,
    currentTag: tags.length ? (DOWNLOAD_TYPES_MOD[tags[0]] || tags[0]) : '',
    cursor,
    nextCursor: undefined,
    previousCursor: undefined,
    errors: [],
    lastSavedGenerationId: undefined,
    aborted: false,
    complete: false
  };

  if (tags.length > 1) {
    const aggregateReport = {
      time: report.time, count: 0, fromDate: '', toDate: '',
      generationsDownloaded: 0, generationsSaved: 0, generationsNew: 0,
      imagesSaved: 0, videosSaved: 0, errors: [],
      aborted: false, complete: false
    };

    for (const tag of tags) {
      const tagReport = await fetchGenerations({...options, tags: [ tag ] });

      if (tagReport && typeof tagReport === 'object') {
        aggregateReport.count += tagReport.count || 0;
        aggregateReport.generationsDownloaded += tagReport.generationsDownloaded || 0;
        aggregateReport.generationsSaved += tagReport.generationsSaved || 0;
        aggregateReport.generationsNew += tagReport.generationsNew || 0;
        aggregateReport.imagesSaved += tagReport.imagesSaved || 0;
        aggregateReport.videosSaved += tagReport.videosSaved || 0;
        if (tagReport.errors?.length) aggregateReport.errors.push(...tagReport.errors);
        if (tagReport.fromDate && (!aggregateReport.fromDate || tagReport.fromDate < aggregateReport.fromDate)) {
          aggregateReport.fromDate = tagReport.fromDate;
        }
        if (tagReport.toDate && (!aggregateReport.toDate || tagReport.toDate > aggregateReport.toDate)) {
          aggregateReport.toDate = tagReport.toDate;
        }
        if (tagReport.aborted) aggregateReport.aborted = true;
      }

      if (onProgress) onProgress({ ...aggregateReport });
      if (isAborted()) break;
    }

    aggregateReport.complete = !aggregateReport.aborted;
    if (onProgress) onProgress({ ...aggregateReport });
    return aggregateReport;
  }

  if (latest) {
    cursor = undefined;
  }

  else if (oldest) {
    cursor = await getFirstGenerationId();
  }

  function reportText ({ esc = true } = {}) {
    const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
    const mode = report.currentTag || (latest ? 'latest' : oldest ? 'oldest' : 'all');

    const newText = report.generationsNew > 0 ? chalk.green(plural(report.generationsNew, 'new')) : '';
    const mediaText = formatMediaCounts(report.imagesSaved, report.videosSaved);
    const contentParts = [newText, mediaText].filter(Boolean);
    const content = contentParts.length
      ? contentParts.join(` ${chalk.dim('·')} `)
      : report.generationsDownloaded > 0 ? chalk.dim('checking…') : '';
    const line1 = `${chalk.hex('#a5d8ff')(`Downloading ${mode}`)}${content ? ` ${chalk.dim('·')} ${content}` : ''}`;

    const batchDateStr = report.batchDate ? formatMonthYear(report.batchDate) : '';
    const arrow = report.paginating && !isAborted() ? ' →' : '';
    const dateParts = [batchDateStr ? `${batchDateStr}${arrow}` : '', `elapsed ${elapsed}`].filter(Boolean);
    const line2 = chalk.dim(`  ${dateParts.join(' · ')}`);

    let line3;

    if (isAborted()) {
      line3 = chalk.dim('  Stopping... finishing current download');
    } else if (esc) {
      line3 = chalk.dim('  Press Esc to stop');
    }

    return [line1, line2, line3].filter(Boolean).join('\n');
  }
      
  async function batchIterator (data, { cursor, previousCursor, nextCursor }) {
    if (isAborted()) {
      report.aborted = true;
      return report;
    }

    if (data.error) {
      if (data.error.json.data.code === 'UNAUTHORIZED') {
        const answer = await confirm({ message: chalk.red('\nNot authorized. Your API key needs updating. Update now?'), default: true });

        if (answer) {
          await requestKey();
        }

        report.errors.push({ error: 'UNAUTHORIZED' });
        return report;
      }

      try {
        const { url, json: { message, code } } = data.error;
        log(chalk.red(`${message} (code ${code})\n  ${url}`));
      }

      catch (error) {
        log(chalk.red(`Download error: ${error.message}`));
      }

      report.errors.push(data.error);
      return report;
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

    report.cursor = cursor;
    report.previousCursor = previousCursor;
    report.nextCursor = nextCursor;
    report.batchDate = generations.reduce(
      (max, g) => (g.createdAt > max ? g.createdAt : max),
      generations[0]?.createdAt || ''
    );
    report.paginating = !!nextCursor;

    report.generationsDownloaded += generations.length;
    report.count ++;
    
    attempts = 0;
    
    log(reportText());
    if (onProgress) onProgress({ ...report });

    const reportBefore = {
      generationsNew: report.generationsNew,
      generationsSaved: report.generationsSaved,
      imagesSaved: report.imagesSaved,
      videosSaved: report.videosSaved
    };

    function updateReport (currentReport) {
      report.generationsNew = reportBefore.generationsNew + currentReport.generationsNew;
      report.generationsSaved = reportBefore.generationsSaved + currentReport.generationsSaved;
      report.imagesSaved = reportBefore.imagesSaved + currentReport.imagesSaved;
      report.videosSaved = reportBefore.videosSaved + currentReport.videosSaved;
      report.lastSavedGenerationId = currentReport.lastSavedGenerationId;
      report.currentGenerations = currentReport.currentGenerations;
      report.currentMedia = currentReport.currentMedia;

      if (currentReport.error) {
        report.errors = [...report.errors, currentReport.error];
      }
    }

    function logSaveProgress (downloadReport) {
      updateReport(downloadReport);

      if (downloadReport.error) {
        const errMsg = downloadReport.error.message || 'Unknown error';
        log(`${reportText()}\n${chalk.red(`  Error: ${errMsg}`)}`);
      }

      else {
        log(reportText());
      }

      if (onProgress) onProgress({ ...report });
    }

    const result = await saveGenerations(data, { overwrite, overwriteIfModified, withImages, log: logSaveProgress, signal });

    if (result.error) {
      report.aborted = true;
      const errMsg = result.error.message || 'Unknown error';
      log(`${reportText()}\n${chalk.red(`  Error: ${errMsg}`)}`);
      return report;
    }

    updateReport(result);
    report.complete = true;

    if (report.generationsDownloaded && (result.generationsNew > 0 || result.imagesSaved > 0 || result.videosSaved > 0 || resume || oldest)) {
      return report;
    }

    return false;
  }

  let result;

  try {
    result = await getAllRequests({ secretKey, cursor, tags, log, signal }, batchIterator);

    if (result.error) {
      report.errors.push(result.error);
    }
    
    if (result.aborted) {
      report.aborted = true;
    }

    if (result.complete) {
      report.complete = true;
    }
  }

  catch (error) {
    if (isAborted()) { // e.g. aborted during timeout loop
      report.aborted = true;
      report.errors.push(error);
      return report;
    }

    if (attempts < MAX_FETCH_ATTEMPTS) {
      attempts ++;

      log(chalk.red(`Error: ${error}\n${reportText()}`));
    
      return await fetchGenerations({...options, cursor: nextCursor || cursor, attempts  });
    }

    const code = error.code || (error.cause && error.cause.code);

    if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_SOCKET' || code ==='ECONNRESET') {
      log(chalk.red(`\nDownload failed. Could not connect to the web service. Please try again.`));
    }

    else {
      log(chalk.red(`\nDownload failed. Please try again. "${error.message} ${code}"`));
    }

  }

  if (isAborted() && !report.aborted) {
    report.aborted = true;
  }

  const hasData = (report.generationsNew || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0;
  if (hasData || report.complete) {
    await setConfigParam('lastDownloadGenerations', new Date().toISOString()).catch(() => {});
    await rebuildIndex().catch(() => {});
  }

  if (onProgress) onProgress({ ...report });
  return report;
}

export function formatCompletion (report) {
  if (!report || typeof report !== 'object') return '';

  const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
  const hasNewData = (report.generationsNew || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0;

  if (!hasNewData && !report.aborted && !(report.errors?.length)) {
    return `${chalk.hex('#a5d8ff')('Up to date')} ${chalk.dim('·')} no new generations found.\n`;
  }

  let label;

  if (report.aborted) {
    label = chalk.yellowBright('Download stopped');
  } else if (report.errors?.length) {
    const errCount = report.errors.length;
    label = `${chalk.green('Download complete')} ${chalk.dim('·')} ${chalk.red(plural(errCount, 'error'))}`;
  } else {
    label = chalk.green('Download complete');
  }

  if (!hasNewData && report.aborted) {
    return `${label} ${chalk.dim('·')} no data was saved.\n`;
  }

  const newText = (report.generationsNew || 0) > 0 ? chalk.green(plural(report.generationsNew, 'new generation')) : '';
  const mediaText = formatMediaCounts(report.imagesSaved || 0, report.videosSaved || 0);
  const contentParts = [newText, mediaText].filter(Boolean);
  const line1 = `${label} ${chalk.dim('·')} ${contentParts.join(` ${chalk.dim('·')} `)}`;

  const dateRange = formatMonthYearRange(report.fromDate, report.toDate);
  const timeParts = [dateRange, `elapsed ${elapsed}`].filter(Boolean);
  const line2 = chalk.dim(`  ${timeParts.join(' · ')}`);

  const lines = [line1, line2];

  if (report.errors?.length) {
    const errorMessages = {};

    for (const err of report.errors) {
      const msg = err?.json?.message || err?.message || err?.error || 'Unknown error';
      errorMessages[msg] = (errorMessages[msg] || 0) + 1;
    }

    const summary = Object.entries(errorMessages)
      .map(([msg, count]) => count > 1 ? `${msg} (x${count})` : msg)
      .join(', ');

    lines.push(chalk.red(`  ${summary}`));
  }

  lines.push('');
  return lines.join('\n');
}

export function getPendingDownloads () {
  return CONFIG.pendingDownloads || {
    generations: []
  };
}

export async function setPendingDownloads ({ downloadStartAt, fromCursor, toCursor, cursor, nextCursor, fromGenerationId, toGenerationId }) {
  const pendingDownloads = getPendingDownloads();
  const pendingGenerations = pendingDownloads.generations;

  pendingGenerations.push({ downloadStartAt, fromCursor, toCursor, cursor, nextCursor, fromGenerationId, toGenerationId });

  await setConfigParam('pendingDownloads', pendingDownloads);
}

// Fetch generations repeatedly, every `interval` seconds
export async function fetchGenerationsInterval ({ interval = 60, ...options } = {}) {
  if (aborted) {
    return;
  }

  if (isNaN(interval) || interval < 60) {
    interval = 60;
  }

  await fetchGenerations(options);

  if (aborted) {
    console.log('Done');
    process.exit();
  }

  await wait(interval * 1000);

  clearTerminal();
  fetchGenerationsInterval({ interval, ...options });
}

export function getDataPath () {
  const generationsDataPath = CONFIG.dataPath + '/generations';

  if (!CONFIG.dataPath.startsWith('/')) {
    return path.join(APP_DIRECTORY, generationsDataPath);
  }

  return generationsDataPath;
}

export function getMediaPath () {
  const generationsMediaPath = CONFIG.mediaPath + '/generations';

  if (!CONFIG.mediaPath.startsWith('/')) {
    return path.join(APP_DIRECTORY, generationsMediaPath);
  }

  return generationsMediaPath;
}

function getRootDataPath () {
  if (!CONFIG.dataPath.startsWith('/')) {
    return path.join(APP_DIRECTORY, CONFIG.dataPath);
  }
  return CONFIG.dataPath;
}

function getRootMediaPath () {
  if (!CONFIG.mediaPath.startsWith('/')) {
    return path.join(APP_DIRECTORY, CONFIG.mediaPath);
  }
  return CONFIG.mediaPath;
}

export async function openDataDirectory () {
  const OPEN_COMMAND = OS === 'win32' ? 'explorer' : 'open';
  const dir = getRootDataPath();

  exec(`${OPEN_COMMAND} ${dir}`, (error, stdout, stderr) => {
    if (error || stderr) {
      console.log('The directory does not exist. It will be created when you start downloading.');
    }
  });
}

export async function openMediaDirectory () {
  const OPEN_COMMAND = OS === 'win32' ? 'explorer' : 'open';
  const dir = getRootMediaPath();

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
  }, { includeLegacy });

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

export async function countDownloads ({ onProgress } = {}) {
  const report = {
    generations: 0,
    genImages: 0,
    genVideos: 0,
    genFromDate: '',
    genToDate: '',
    posts: 0,
    postImages: 0,
    postVideos: 0,
    postFromDate: '',
    postToDate: '',
  };

  // Count generations
  await forEachGeneration(async (generation, { date }) => {
    report.generations++;

    if (!report.genFromDate || date < report.genFromDate) report.genFromDate = date;
    if (!report.genToDate || date > report.genToDate) report.genToDate = date;

    const media = getGeneratedMediaInfo(generation);
    for (const item of media) {
      const filepath = mediaFilepath(item);
      if (await fileExists(filepath)) {
        if (item.mediaId.endsWith('.mp4')) {
          report.genVideos++;
        } else {
          report.genImages++;
        }
      }
    }

    if (onProgress) onProgress(report);
  }, { includeLegacy: true });

  // Count posts
  const postDates = await getPostDates();
  for (const date of postDates) {
    const files = await listDirectory(`${postsDataDir()}/${date}`);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const content = await readFile(`${postsDataDir()}/${date}/${file}`);
      let post;
      try { post = JSON.parse(content); } catch { continue; }

      report.posts++;

      if (!report.postFromDate || date < report.postFromDate) report.postFromDate = date;
      if (!report.postToDate || date > report.postToDate) report.postToDate = date;

      if (Array.isArray(post.images)) {
        for (let i = 0; i < post.images.length; i++) {
          const image = post.images[i];
          const filepath = postImageFilepath({
            postId: post.id,
            publishedAt: post.publishedAt,
            index: i + 1,
            imageId: image.id,
            type: image.type
          });

          if (await fileExists(filepath)) {
            if (image.type === 'video') {
              report.postVideos++;
            } else {
              report.postImages++;
            }
          }
        }
      }

      if (onProgress) onProgress(report);
    }
  }

  return report;
}

export function formatCountReport (report) {
  const hasAnything = report.generations > 0 || report.posts > 0;

  if (!hasAnything) {
    return `${chalk.hex('#a5d8ff')('Count downloads')} ${chalk.dim('·')} nothing downloaded yet\n`;
  }

  const lines = [chalk.hex('#a5d8ff')('Count downloads'), ''];

  if (report.generations > 0) {
    const genMediaParts = [];
    if (report.genImages > 0) genMediaParts.push(`${report.genImages.toLocaleString()} images`);
    if (report.genVideos > 0) genMediaParts.push(`${report.genVideos.toLocaleString()} videos`);
    const mediaSuffix = genMediaParts.length ? ` ${chalk.dim('·')} ${genMediaParts.join(', ')} saved` : '';

    lines.push(`  ${chalk.bold('Generations')} ${chalk.dim('·')} ${report.generations.toLocaleString()}${mediaSuffix}`);

    const dateRange = formatMonthYearRange(report.genFromDate, report.genToDate);
    if (dateRange) lines.push(chalk.dim(`  ${dateRange}`));
    lines.push('');
  }

  if (report.posts > 0) {
    const postMediaParts = [];
    if (report.postImages > 0) postMediaParts.push(`${report.postImages.toLocaleString()} images`);
    if (report.postVideos > 0) postMediaParts.push(`${report.postVideos.toLocaleString()} videos`);
    const mediaSuffix = postMediaParts.length ? ` ${chalk.dim('·')} ${postMediaParts.join(', ')} saved` : '';

    lines.push(`  ${chalk.bold('Posts')} ${chalk.dim('·')} ${report.posts.toLocaleString()}${mediaSuffix}`);

    const dateRange = formatMonthYearRange(report.postFromDate, report.postToDate);
    if (dateRange) lines.push(chalk.dim(`  ${dateRange}`));
    lines.push('');
  }

  return lines.join('\n');
}
