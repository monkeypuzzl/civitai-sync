import chalk from 'chalk';
import { getAllPostRequests, formatApiError } from './civitaiApi.mjs';
import { savePosts } from './posts.mjs';
import { setConfigParam } from './config.mjs';
import { CONFIG } from './cli.mjs';
import { upsertIndexEntries } from './serverIndex.mjs';
import { listenForEscKeyPress, plural, formatElapsed, formatMediaCounts, formatDate, formatDateRange, formatActivity } from './downloadActions.mjs';

export { listenForEscKeyPress };

const MAX_FETCH_ATTEMPTS = 10;

export async function fetchPosts (options = {}) {
  const {
    latest = false,
    withImages = true,
    secretKey = '',
    username = '',
    // Phase 5c/5d: re-check every previously-saved post on each pass and
    // overwrite it when its status / content changed or an image was removed.
    // Mirrors fetchGenerations' default (downloadActions.mjs). Per-post; does
    // not alter the v5.1.0 resumed-run cursor walk.
    overwriteIfModified = true,
    // Phase 5c: when true, post.getInfinite returns the user's drafts only.
    // The end-to-end draft download is a maintainer real-corpus step (no draft
    // fixture exists); the param threading and the re-save are fixture-tested.
    draftOnly = false,
    // Phase 5c2: when paired with draftOnly, widens the owner-request filter to
    // `publishedAt IS NULL OR publishedAt > NOW()` — drafts AND scheduled posts.
    scheduled = false,
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
    audioSaved: 0,
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

    const mediaText = formatMediaCounts(report.imagesSaved, report.videosSaved, report.audioSaved);
    const newPostsText = report.postsNew > 0 ? chalk.green(plural(report.postsNew, 'new post')) : '';
    const batchDateStr = report.batchDate ? formatDate(report.batchDate) : '';
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

    const posts = data.result.data.json.items;

    // Phase 5c2: drafts have `publishedAt: null` and scheduled posts have a
    // FUTURE `publishedAt`. A null `publishedAt` must not corrupt the date
    // range, so skip falsy values here; a future date is a valid date and may
    // legitimately extend `toDate`. `batchDate` keys off the first post that
    // actually has a `publishedAt`.
    posts.forEach(({ publishedAt }) => {
      if (!publishedAt) return;
      if (!report.fromDate) {
        report.fromDate = publishedAt;
        report.toDate = publishedAt;
      } else {
        if (publishedAt < report.fromDate) report.fromDate = publishedAt;
        if (publishedAt > report.toDate) report.toDate = publishedAt;
      }
    });

    report.batchDate = posts.find(p => p.publishedAt)?.publishedAt || report.batchDate;
    report.paginating = !!nextCursor;
    report.postsDownloaded += posts.length;
    report.count++;
    attempts = 0;

    log(reportText());
    if (onProgress) onProgress({ ...report });

    const prevImagesSaved = report.imagesSaved;
    const prevVideosSaved = report.videosSaved;
    const prevAudioSaved = report.audioSaved;
    const prevPostsNew = report.postsNew;

    const result = await savePosts(data, {
      withImages,
      overwriteIfModified,
      signal,
      secretKey,
      onProgress: (saveReport) => {
        report.imagesSaved = prevImagesSaved + saveReport.imagesSaved;
        report.videosSaved = prevVideosSaved + saveReport.videosSaved;
        report.audioSaved = prevAudioSaved + saveReport.audioSaved;
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
    report.audioSaved = prevAudioSaved + result.audioSaved;
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

    // Per-batch incremental index update. The Explorer can reflect the new
    // posts immediately and we avoid the end-of-download full rescan.
    // Failures here must not interrupt the download — the manual
    // "Rebuild Index" button is the user-visible self-heal.
    if (result.savedItems && result.savedItems.length) {
      await upsertIndexEntries({ posts: result.savedItems }).catch(() => {});
    }

    log(reportText());
    if (onProgress) onProgress({ ...report });

    if (isAborted()) {
      return false;
    }

    // In latest mode, stop when a full page has nothing new (posts or media).
    // In "all" mode, always follow nextCursor — otherwise a restart whose
    // newest page is already fully saved would exit before reaching any
    // older unsaved posts.
    if (latest && result.postsNew === 0 && result.imagesSaved === 0 && result.videosSaved === 0 && result.audioSaved === 0) {
      return false;
    }

    return report;
  }

  const tick = setInterval(() => log(reportText()), 1000);

  try {
    let result;

    try {
      result = await getAllPostRequests({ secretKey, username, cursor, log, signal, draftOnly, scheduled }, batchIterator);

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

    const hasData = (report.postsNew || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0 || (report.audioSaved || 0) > 0;
    if (hasData || report.complete) {
      await setConfigParam('lastDownloadPosts', new Date().toISOString()).catch(() => {});
    }

    if (onProgress) onProgress({ ...report });
    return report;
  }

  finally {
    clearInterval(tick);
  }
}

// Phase 5c2: merge the published pass and the drafts/scheduled pass into one
// report. Counts sum; errors concat; `complete` requires BOTH passes; the date
// range spans both passes' non-empty bounds. `time` is carried from the first
// pass so elapsed reflects the whole run.
function mergePostReports (a, b) {
  const minDate = (x, y) => (!x ? y : !y ? x : (x < y ? x : y));
  const maxDate = (x, y) => (!x ? y : !y ? x : (x > y ? x : y));

  return {
    time: a.time,
    count: (a.count || 0) + (b.count || 0),
    postsDownloaded: (a.postsDownloaded || 0) + (b.postsDownloaded || 0),
    postsNew: (a.postsNew || 0) + (b.postsNew || 0),
    postsSaved: (a.postsSaved || 0) + (b.postsSaved || 0),
    imagesSaved: (a.imagesSaved || 0) + (b.imagesSaved || 0),
    videosSaved: (a.videosSaved || 0) + (b.videosSaved || 0),
    audioSaved: (a.audioSaved || 0) + (b.audioSaved || 0),
    fromDate: minDate(a.fromDate, b.fromDate),
    toDate: maxDate(a.toDate, b.toDate),
    batchDate: b.batchDate || a.batchDate,
    paginating: false,
    activity: null,
    errors: [...(a.errors || []), ...(b.errors || [])],
    aborted: !!a.aborted || !!b.aborted,
    complete: !!a.complete && !!b.complete
  };
}

// Phase 5c2: the complete two-pass post download both download surfaces call.
//   Pass 1 — the existing published pass: honours the caller's `latest`/`all`
//     mode and the v5.1.0 resume walk, unchanged.
//   Pass 2 — drafts + scheduled together (owner-request branch widens to
//     `publishedAt IS NULL OR publishedAt > NOW()`). Always a full walk
//     (`latest:false`): drafts/scheduled are a small, frequently-changing set,
//     so re-walking each time catches reschedules and new drafts; the per-post
//     `overwriteIfModified` re-save handles in-place changes.
//
// Pass 2 is skipped when pass 1 aborted or hit an auth failure, so a bad key
// does not double-prompt. The merged report drives the completion line and the
// final SSE, so its totals are correct even though each pass keeps its own
// live running counter (which restarts at 0 for pass 2 — accepted, cosmetic).
export async function fetchPostsAllKinds (options = {}) {
  const published = await fetchPosts(options);

  const isUnauthorized = (e) => e?.code === 'UNAUTHORIZED' || e?.error === 'UNAUTHORIZED' || e?.json?.data?.code === 'UNAUTHORIZED';
  if (options.signal?.aborted || (published.errors || []).some(isUnauthorized)) {
    return published;
  }

  const extra = await fetchPosts({ ...options, draftOnly: true, scheduled: true, latest: false });

  const merged = mergePostReports(published, extra);
  // Latest must not dismiss the Settings / CLI All prompt. Only a completed
  // All walk fills older posts (and stamps hasMeta on current listings).
  if (options.latest !== true && !merged.aborted && merged.complete) {
    await setConfigParam('postsGenerationDataFilled', true).catch(() => {});
    if (CONFIG.mediaHealOnce !== true) {
      try {
        const { healMedia } = await import('./mediaHeal.mjs');
        const heal = await healMedia({
          secretKey: options.secretKey,
          signal: options.signal,
          includeComics: false
        });
        merged.mediaHeal = heal;
        if (!heal.aborted && !options.signal?.aborted) {
          await setConfigParam('mediaHealOnce', true).catch(() => {});
        }
      } catch {
        // Leave mediaHealOnce unset so the next All retries the check.
      }
    }
  }
  return merged;
}

export function formatPostCompletion (report) {
  if (!report || typeof report !== 'object') return '';

  const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
  const hasNewData = (report.postsNew || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0 || (report.audioSaved || 0) > 0;

  if (!hasNewData && !report.aborted && !(report.errors?.length)) {
    const head = `${chalk.hex('#a5d8ff')('Up to date')} ${chalk.dim('·')} no new posts found.`;
    if (!report.mediaHeal) return `${head}\n`;
    const heal = report.mediaHeal;
    return `${head}\n${chalk.dim(`  Media check: ${heal.healed} healed, ${heal.unrecoverable} unrecoverable, ${heal.failed} still broken`)}\n`;
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

  const mediaText = formatMediaCounts(report.imagesSaved || 0, report.videosSaved || 0, report.audioSaved || 0);
  const newPostsText = (report.postsNew || 0) > 0 ? chalk.green(plural(report.postsNew, 'new post')) : '';
  const contentParts = [mediaText, newPostsText].filter(Boolean);
  const line1 = `${label} ${chalk.dim('·')} ${contentParts.join(` ${chalk.dim('·')} `)}`;

  const dateRange = formatDateRange(report.fromDate, report.toDate);
  const timeParts = [dateRange, `elapsed ${elapsed}`].filter(Boolean);
  const line2 = chalk.dim(`  ${timeParts.join(' · ')}`);

  const lines = [line1, line2];

  if (report.mediaHeal) {
    const heal = report.mediaHeal;
    lines.push(chalk.dim(
      `  Media check: ${heal.healed} healed, ${heal.unrecoverable} unrecoverable, ${heal.failed} still broken`
    ));
  }

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
