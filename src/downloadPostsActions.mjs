import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import { requestKey } from './keyActions.mjs';
import { getAllPostRequests } from './civitaiApi.mjs';
import { savePosts } from './posts.mjs';
import { setConfigParam } from './config.mjs';
import { rebuildIndex } from './serverIndex.mjs';
import { listenForEscKeyPress, plural, formatElapsed, formatMediaCounts, formatMonthYear, formatMonthYearRange, formatActivity } from './downloadActions.mjs';

export { listenForEscKeyPress };

const MAX_FETCH_ATTEMPTS = 10;

export async function fetchPosts (options = {}) {
  const {
    latest = false,
    withImages = true,
    secretKey = '',
    username = '',
    log = console.log,
    onProgress,
    signal
  } = options;

  let { cursor, attempts = 0 } = options;

  const report = {
    time: (new Date()).toISOString(),
    count: 0,
    postsDownloaded: 0,
    postsNew: 0,
    postsSaved: 0,
    imagesSaved: 0,
    videosSaved: 0,
    fromDate: '',
    toDate: '',
    batchDate: '',
    paginating: false,
    activity: null,
    errors: [],
    aborted: false,
    complete: false
  };

  function isAborted () {
    return signal ? signal.aborted : false;
  }

  function reportText ({ esc = true } = {}) {
    const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
    const activityText = formatActivity(report.activity, { itemNoun: 'post' });

    const title = chalk.hex('#a5d8ff')('Downloading posts');
    const line1 = activityText
      ? `${title} ${chalk.dim('·')} ${chalk.dim(activityText)}`
      : title;

    const mediaText = formatMediaCounts(report.imagesSaved, report.videosSaved);
    const newPostsText = report.postsNew > 0 ? chalk.green(plural(report.postsNew, 'new post')) : '';
    const batchDateStr = report.batchDate ? formatMonthYear(report.batchDate) : '';
    const arrow = report.paginating && !isAborted() ? ' →' : '';
    const resultParts = [
      batchDateStr ? `${batchDateStr}${arrow}` : '',
      mediaText,
      newPostsText,
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

  async function batchIterator (data, { nextCursor } = {}) {
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

    const posts = data.result.data.json.items;

    posts.forEach(({ publishedAt }) => {
      if (!report.fromDate) {
        report.fromDate = publishedAt;
        report.toDate = publishedAt;
      } else {
        if (publishedAt < report.fromDate) report.fromDate = publishedAt;
        if (publishedAt > report.toDate) report.toDate = publishedAt;
      }
    });

    report.batchDate = posts.length ? posts[0].publishedAt : report.batchDate;
    report.paginating = !!nextCursor;
    report.postsDownloaded += posts.length;
    report.count++;
    attempts = 0;

    log(reportText());
    if (onProgress) onProgress({ ...report });

    const prevImagesSaved = report.imagesSaved;
    const prevVideosSaved = report.videosSaved;
    const prevPostsNew = report.postsNew;

    const result = await savePosts(data, {
      withImages,
      signal,
      secretKey,
      onProgress: (saveReport) => {
        report.imagesSaved = prevImagesSaved + saveReport.imagesSaved;
        report.videosSaved = prevVideosSaved + saveReport.videosSaved;
        report.postsNew = prevPostsNew + saveReport.postsNew;
        report.activity = saveReport.activity;
        log(reportText());
        if (onProgress) onProgress({ ...report });
      }
    });

    report.postsNew = prevPostsNew + result.postsNew;
    report.postsSaved += result.postsSaved;
    report.imagesSaved = prevImagesSaved + result.imagesSaved;
    report.videosSaved = prevVideosSaved + result.videosSaved;
    report.activity = null;

    if (result.error) {
      report.errors.push(result.error);
      const errMsg = result.error.message || 'Unknown error';
      log(`${reportText()}\n${chalk.red(`  Error: ${errMsg}`)}`);
      report.aborted = true;
      if (onProgress) onProgress({ ...report });
      return report;
    }

    report.complete = true;
    log(reportText());
    if (onProgress) onProgress({ ...report });

    if (isAborted()) {
      return false;
    }

    // In latest mode, stop when a full page has nothing new (posts or media).
    // In "all" mode, always follow nextCursor — otherwise a restart whose
    // newest page is already fully saved would exit before reaching any
    // older unsaved posts.
    if (latest && result.postsNew === 0 && result.imagesSaved === 0 && result.videosSaved === 0) {
      return false;
    }

    return report;
  }

  const tick = setInterval(() => log(reportText()), 1000);

  try {
    let result;

    try {
      result = await getAllPostRequests({ secretKey, username, cursor, log, signal }, batchIterator);

      if (result && result.error) {
        report.errors.push(result.error);
      }

      if (result && result.aborted) {
        report.aborted = true;
      }

      if (result && result.complete) {
        report.complete = true;
      }
    }

    catch (error) {
      if (isAborted()) {
        report.aborted = true;
        report.errors.push(error);
        return report;
      }

      if (attempts < MAX_FETCH_ATTEMPTS) {
        attempts++;
        log(chalk.red(`Error: ${error}\n${formatPostCompletion(report)}`));
        return await fetchPosts({ ...options, cursor, attempts });
      }

      const code = error.code || (error.cause && error.cause.code);

      if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_SOCKET' || code === 'ECONNRESET') {
        log(chalk.red('\nDownload failed. Could not connect to the web service. Please try again.'));
      } else {
        log(chalk.red(`\nDownload failed. Please try again. "${error.message} ${code}"`));
      }
    }

    if (isAborted() && !report.aborted) {
      report.aborted = true;
    }

    const hasData = (report.postsNew || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0;
    if (hasData || report.complete) {
      await setConfigParam('lastDownloadPosts', new Date().toISOString()).catch(() => {});
      await rebuildIndex().catch(() => {});
    }

    if (onProgress) onProgress({ ...report });
    return report;
  }

  finally {
    clearInterval(tick);
  }
}

export function formatPostCompletion (report) {
  if (!report || typeof report !== 'object') return '';

  const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
  const hasNewData = (report.postsNew || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0;

  if (!hasNewData && !report.aborted && !(report.errors?.length)) {
    return `${chalk.hex('#a5d8ff')('Up to date')} ${chalk.dim('·')} no new posts found.\n`;
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

  const mediaText = formatMediaCounts(report.imagesSaved || 0, report.videosSaved || 0);
  const newPostsText = (report.postsNew || 0) > 0 ? chalk.green(plural(report.postsNew, 'new post')) : '';
  const contentParts = [mediaText, newPostsText].filter(Boolean);
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
