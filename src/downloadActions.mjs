import path from 'node:path';
import process from 'node:process';
import chalk from 'chalk';
import { fileExists, listDirectory, readFile, wait } from './utils.mjs';
import { APP_DIRECTORY, CONFIG, clearTerminal } from './cli.mjs';
import { forEachGeneration, getGeneratedMediaInfo, mediaFilepath, saveGenerations, saveGenerationMedia, saveGenerationData, generationFilepath, getGenerationImages, DOWNLOAD_TYPES_MOD } from './generations.mjs';
import { getPostDates, postsDataDir, postImageFilepath } from './posts.mjs';
import { getAllRequests, formatApiError } from './civitaiApi.mjs';
import { setConfigParam } from './config.mjs';
import { upsertIndexEntries, ensureIndexLoaded, downloadOpenIds } from './serverIndex.mjs';
import { markThrownFault } from './downloadFault.mjs';

export { openDataDirectory, openMediaDirectory } from './openDirectory.mjs';

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

export function formatMediaCounts (imagesSaved, videosSaved, audioSaved = 0, model3dSaved = 0) {
  const parts = [];

  if (imagesSaved > 0) parts.push(plural(imagesSaved, 'image'));
  if (videosSaved > 0) parts.push(plural(videosSaved, 'video'));
  if (audioSaved > 0) parts.push(plural(audioSaved, 'audio file'));
  if (model3dSaved > 0) parts.push(`${model3dSaved} 3D`);
  if (!parts.length) return '';

  return `${parts.join(', ')} saved`;
}

export function formatActivity (activity) {
  const phase = activity && activity.phase;
  if (phase === 'media' || phase === 'input-media') return 'saving';
  return 'checking';
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

async function retryOpenGenerations ({ signal, withImages, report, onProgress }) {
  try {
    await ensureIndexLoaded();
  } catch {
    return;
  }
  const open = downloadOpenIds().generations;
  const saved = [];
  for (const row of open) {
    if (signal && signal.aborted) return;
    if (!row.createdAt) continue;
    const filepath = generationFilepath({ id: row.id, createdAt: row.createdAt });
    let doc;
    try {
      doc = JSON.parse(await readFile(filepath));
    } catch {
      continue;
    }
    if (withImages && CONFIG.downloadMedia !== false && report) {
      const mediaReport = await saveGenerationMedia(doc, { signal, reactions: [] });
      const wroteMedia = (mediaReport.imagesSaved || 0) + (mediaReport.videosSaved || 0)
        + (mediaReport.audioSaved || 0) + (mediaReport.model3dSaved || 0) > 0;
      report.imagesSaved += mediaReport.imagesSaved || 0;
      report.videosSaved += mediaReport.videosSaved || 0;
      report.audioSaved += mediaReport.audioSaved || 0;
      report.model3dSaved += mediaReport.model3dSaved || 0;
      const stillOpen = mediaReport.incomplete === true;
      const mediaStopped = mediaReport.aborted === true || mediaReport.fault === 'storage';
      let wroteJson = false;
      // Stop and a full disk leave the mark from the file walk.
      if (!mediaStopped && stillOpen !== (doc.downloadOpen === true)) {
        if (stillOpen) doc.downloadOpen = true;
        else delete doc.downloadOpen;
        if (await saveGenerationData(doc)) {
          saved.push(doc);
          wroteJson = true;
        }
      } else if (!mediaStopped && !stillOpen && doc.downloadOpen === true) {
        delete doc.downloadOpen;
        if (await saveGenerationData(doc)) {
          saved.push(doc);
          wroteJson = true;
        }
      }
      if (wroteMedia || wroteJson) report.generationsUpdated += 1;
      if (onProgress) onProgress({ ...report });
    }
  }
  if (saved.length) await upsertIndexEntries({ generations: saved }).catch(() => {});
}

export async function fetchGenerations (options = {}) {
  const {
    withImages = true,
    latest = false,
    resume = false,
    overwrite = false,
    overwriteIfModified = true,
    tags = [],
    secretKey = '',
    log = console.log,
    onProgress,
    signal,
    carry = null
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
    generationsSaved: carry?.generationsSaved || 0,
    generationsNew: carry?.generationsNew || 0,
    generationsUpdated: carry?.generationsUpdated || 0,
    imagesSaved: carry?.imagesSaved || 0,
    videosSaved: carry?.videosSaved || 0,
    audioSaved: carry?.audioSaved || 0,
    model3dSaved: carry?.model3dSaved || 0,
    activity: null,
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
      generationsDownloaded: 0, generationsSaved: 0, generationsNew: 0, generationsUpdated: 0,
      imagesSaved: 0, videosSaved: 0, audioSaved: 0, model3dSaved: 0, errors: [],
      aborted: false, complete: false
    };

    let reactionCarry = null;
    for (const tag of tags) {
      const tagReport = await fetchGenerations({ ...options, tags: [ tag ], carry: reactionCarry });

      if (tagReport && typeof tagReport === 'object') {
        aggregateReport.count += tagReport.count || 0;
        aggregateReport.generationsDownloaded += tagReport.generationsDownloaded || 0;
        aggregateReport.generationsSaved = tagReport.generationsSaved || 0;
        aggregateReport.generationsNew = tagReport.generationsNew || 0;
        aggregateReport.generationsUpdated = tagReport.generationsUpdated || 0;
        aggregateReport.imagesSaved = tagReport.imagesSaved || 0;
        aggregateReport.videosSaved = tagReport.videosSaved || 0;
        aggregateReport.audioSaved = tagReport.audioSaved || 0;
        aggregateReport.model3dSaved = tagReport.model3dSaved || 0;
        reactionCarry = {
          generationsSaved: aggregateReport.generationsSaved,
          generationsNew: aggregateReport.generationsNew,
          generationsUpdated: aggregateReport.generationsUpdated,
          imagesSaved: aggregateReport.imagesSaved,
          videosSaved: aggregateReport.videosSaved,
          audioSaved: aggregateReport.audioSaved,
          model3dSaved: aggregateReport.model3dSaved
        };
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
    await retryOpenGenerations({ signal, withImages, report, onProgress });
  }

  function reportText ({ esc = true } = {}) {
    const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
    const mode = report.currentTag || (latest ? 'latest' : 'all');
    const activityText = formatActivity(report.activity);

    const title = chalk.hex('#a5d8ff')(`Downloading ${mode}`);
    const line1 = `${title} ${chalk.dim('·')} ${chalk.dim(activityText)}`;

    const newText = report.generationsNew > 0 ? chalk.green(`${report.generationsNew} new`) : '';
    const updatedText = report.generationsUpdated > 0 ? chalk.green(`${report.generationsUpdated} updated`) : '';
    const mediaText = formatMediaCounts(report.imagesSaved, report.videosSaved, report.audioSaved, report.model3dSaved);
    const batchDateStr = report.batchDate ? formatDate(report.batchDate) : '';
    const arrow = report.paginating && !isAborted() ? ' →' : '';
    const resultParts = [
      batchDateStr ? `${batchDateStr}${arrow}` : '',
      newText,
      updatedText,
      mediaText,
      `elapsed ${elapsed}`
    ].filter(Boolean);
    const line2 = chalk.dim(`  ${resultParts.join(' · ')}`);

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
      generationsUpdated: report.generationsUpdated,
      generationsSaved: report.generationsSaved,
      imagesSaved: report.imagesSaved,
      videosSaved: report.videosSaved,
      audioSaved: report.audioSaved,
      model3dSaved: report.model3dSaved
    };

    function updateReport (currentReport) {
      report.generationsNew = reportBefore.generationsNew + currentReport.generationsNew;
      report.generationsUpdated = reportBefore.generationsUpdated + (currentReport.generationsUpdated || 0);
      report.generationsSaved = reportBefore.generationsSaved + currentReport.generationsSaved;
      report.imagesSaved = reportBefore.imagesSaved + currentReport.imagesSaved;
      report.videosSaved = reportBefore.videosSaved + currentReport.videosSaved;
      report.audioSaved = reportBefore.audioSaved + currentReport.audioSaved;
      report.model3dSaved = reportBefore.model3dSaved + currentReport.model3dSaved;
      report.activity = currentReport.activity;
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

    const result = await saveGenerations(data, { overwrite, overwriteIfModified, withImages, reactions: tags, log: logSaveProgress, signal, secretKey });

    if (result.fault === 'storage' || result.aborted) {
      report.aborted = true;
      if (result.fault) report.fault = result.fault;
      return report;
    }

    if (result.error) {
      report.aborted = true;
      const errMsg = result.error.message || 'Unknown error';
      log(`${reportText()}\n${chalk.red(`  Error: ${errMsg}`)}`);
      return report;
    }

    updateReport(result);
    report.complete = true;

    // Per-batch incremental index update. The Explorer can reflect the new
    // generations immediately and we avoid the end-of-download full rescan.
    // Failures here must not interrupt the download — the manual
    // "Rebuild Index" button is the user-visible self-heal.
    if (result.savedItems && result.savedItems.length) {
      await upsertIndexEntries({ generations: result.savedItems }).catch(() => {});
    }

    if (report.generationsDownloaded && (result.generationsSaved > 0 || result.imagesSaved > 0 || result.videosSaved > 0 || result.audioSaved > 0 || result.model3dSaved > 0 || resume)) {
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
    
      return await fetchGenerations({
        ...options,
        cursor: nextCursor || cursor,
        attempts,
        carry: {
          generationsSaved: report.generationsSaved,
          generationsNew: report.generationsNew,
          generationsUpdated: report.generationsUpdated,
          imagesSaved: report.imagesSaved,
          videosSaved: report.videosSaved,
          audioSaved: report.audioSaved,
          model3dSaved: report.model3dSaved
        }
      });
    }

    const code = error.code || (error.cause && error.cause.code);
    markThrownFault(report, error);

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

  const hasData = (report.generationsNew || 0) > 0 || (report.generationsUpdated || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0 || (report.audioSaved || 0) > 0 || (report.model3dSaved || 0) > 0;
  if (hasData || report.complete) {
    await setConfigParam('lastDownloadGenerations', new Date().toISOString()).catch(() => {});
  }

  if (onProgress) onProgress({ ...report });
  return report;
}

export function formatCompletion (report) {
  if (!report || typeof report !== 'object') return '';

  const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
  const hasNewData = (report.generationsNew || 0) > 0 || (report.generationsUpdated || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0 || (report.audioSaved || 0) > 0 || (report.model3dSaved || 0) > 0;

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

  const newText = (report.generationsNew || 0) > 0 ? chalk.green(`${report.generationsNew} new`) : '';
  const updatedText = (report.generationsUpdated || 0) > 0 ? chalk.green(`${report.generationsUpdated} updated`) : '';
  const mediaText = formatMediaCounts(report.imagesSaved || 0, report.videosSaved || 0, report.audioSaved || 0, report.model3dSaved || 0);
  const contentParts = [newText, updatedText, mediaText].filter(Boolean);
  const line1 = `${label} ${chalk.dim('·')} ${contentParts.join(` ${chalk.dim('·')} `)}`;

  const dateRange = formatDateRange(report.fromDate, report.toDate);
  const timeParts = [dateRange, `elapsed ${elapsed}`].filter(Boolean);
  const line2 = chalk.dim(`  ${timeParts.join(' · ')}`);

  const lines = [line1, line2];

  if (report.errors?.length) {
    const errorMessages = {};

    for (const err of report.errors) {
      const msg = formatApiError(err);
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
    genAudio: 0,
    genModel3d: 0,
    genFromDate: '',
    genToDate: '',
    posts: 0,
    postImages: 0,
    postVideos: 0,
    postAudio: 0,
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
        // Phase 5a: classify by the logical `type` from getGeneratedMediaInfo
        // (audio includes cover-mode `.mp4`). The `.mp4` extension fallback is
        // retained only for older video records whose wire item carried no
        // `type`, mirroring buildGenerationEntry's back-compat path.
        if (item.type === 'model3d') {
          report.genModel3d++;
        } else if (item.type === 'audio') {
          report.genAudio++;
        } else if (item.type === 'video' || item.mediaId.endsWith('.mp4')) {
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
            createdAt: post.createdAt,
            index: i + 1,
            imageId: image.id,
            type: image.type
          });

          if (await fileExists(filepath)) {
            if (image.type === 'video') {
              report.postVideos++;
            } else if (image.type === 'audio') {
              report.postAudio++;
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
    if (report.genAudio > 0) genMediaParts.push(`${report.genAudio.toLocaleString()} audio`);
    if (report.genModel3d > 0) genMediaParts.push(`${report.genModel3d.toLocaleString()} 3D`);
    const mediaSuffix = genMediaParts.length ? ` ${chalk.dim('·')} ${genMediaParts.join(', ')}` : '';

    lines.push(`  ${chalk.bold('Generations')} ${chalk.dim('·')} ${report.generations.toLocaleString()}${mediaSuffix}`);

    const dateRange = formatMonthYearRange(report.genFromDate, report.genToDate);
    if (dateRange) lines.push(chalk.dim(`  ${dateRange}`));
    lines.push('');
  }

  if (report.posts > 0) {
    const postMediaParts = [];
    if (report.postImages > 0) postMediaParts.push(`${report.postImages.toLocaleString()} images`);
    if (report.postVideos > 0) postMediaParts.push(`${report.postVideos.toLocaleString()} videos`);
    if (report.postAudio > 0) postMediaParts.push(`${report.postAudio.toLocaleString()} audio`);
    const mediaSuffix = postMediaParts.length ? ` ${chalk.dim('·')} ${postMediaParts.join(', ')}` : '';

    lines.push(`  ${chalk.bold('Posts')} ${chalk.dim('·')} ${report.posts.toLocaleString()}${mediaSuffix}`);

    const dateRange = formatMonthYearRange(report.postFromDate, report.postToDate);
    if (dateRange) lines.push(chalk.dim(`  ${dateRange}`));
    lines.push('');
  }

  return lines.join('\n');
}
