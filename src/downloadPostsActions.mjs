import chalk from 'chalk';
import { getAllPostRequests, getImageFeed, getPost, formatApiError } from './civitaiApi.mjs';
import { savePosts, postFilepath } from './posts.mjs';
import { setConfigParam } from './config.mjs';
import { CONFIG } from './cli.mjs';
import { upsertIndexEntries, ensureIndexLoaded, downloadOpenIds, getMediaItemById, getIndex } from './serverIndex.mjs';
import { readFile, fileExists } from './utils.mjs';
import { markThrownFault } from './downloadFault.mjs';
import { listenForEscKeyPress, plural, formatElapsed, formatMediaCounts, formatDate, formatDateRange, formatActivity } from './downloadActions.mjs';

export { listenForEscKeyPress };

const MAX_FETCH_ATTEMPTS = 10;
const IMAGE_FEED_PAGE_CAP = 20;

function postPage (post) {
  return { result: { data: { json: { items: [post] } } } };
}

async function loadSavedPost (row) {
  const filepath = postFilepath({ id: row.id, publishedAt: row.publishedAt });
  if (!(await fileExists(filepath))) return null;
  try {
    return JSON.parse(await readFile(filepath));
  } catch {
    return null;
  }
}

function addPostSave (report, result) {
  if (!result) return;
  report.postsNew += result.postsNew || 0;
  report.postsUpdated += result.postsUpdated || 0;
  report.postsSaved += result.postsSaved || 0;
  report.imagesSaved += result.imagesSaved || 0;
  report.videosSaved += result.videosSaved || 0;
  report.audioSaved += result.audioSaved || 0;
}

async function refreshOpenPosts ({ secretKey, signal, withImages, report, onProgress }) {
  try {
    await ensureIndexLoaded();
  } catch {
    return;
  }
  const open = downloadOpenIds().posts;
  for (const row of open) {
    if (signal && signal.aborted) return;
    const saved = await loadSavedPost(row);
    if (!saved) continue;
    const result = await savePosts(postPage(saved), {
      overwriteIfModified: true,
      latestFrontier: true,
      forceIds: new Set([saved.id]),
      withImages,
      secretKey,
      signal
    });
    addPostSave(report, result);
    if (onProgress) onProgress({ ...report });
    if (result.savedItems && result.savedItems.length) {
      await upsertIndexEntries({ posts: result.savedItems }).catch(() => {});
    }
  }
}

async function followNewImages ({ username, secretKey, signal, withImages, seenIds, report, onProgress }) {
  let cursor;
  const seen = seenIds || new Set();
  for (let guard = 0; guard < IMAGE_FEED_PAGE_CAP; guard++) {
    if (signal && signal.aborted) return;
    const page = await getImageFeed({ username, cursor, secretKey, signal });
    if (!page || page.error) return;
    const body = page.result?.data?.json;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return;
    let novel = 0;
    const postIds = new Set();
    for (const img of items) {
      if (!img || img.id == null) continue;
      if (getMediaItemById(img.id)) continue;
      novel += 1;
      if (img.postId != null && !seen.has(img.postId)) postIds.add(img.postId);
    }
    for (const postId of postIds) {
      if (signal && signal.aborted) return;
      let base = null;
      const entry = (getIndex().posts || []).find(row => String(row.id) === String(postId));
      if (entry) base = await loadSavedPost(entry);
      if (!base) {
        const detail = await getPost({ id: postId, secretKey, signal });
        const meta = detail?.result?.data?.json;
        if (!meta || meta.id == null) continue;
        base = { ...meta, id: meta.id, images: Array.isArray(meta.images) ? meta.images : [] };
      }
      seen.add(postId);
      const result = await savePosts(postPage(base), {
        overwriteIfModified: true,
        latestFrontier: true,
        forceIds: new Set([base.id]),
        withImages,
        secretKey,
        signal
      });
      addPostSave(report, result);
      if (onProgress) onProgress({ ...report });
      if (result.savedItems && result.savedItems.length) {
        await upsertIndexEntries({ posts: result.savedItems }).catch(() => {});
      }
    }
    if (novel === 0) return;
    const next = body.nextCursor;
    if (next == null || next === cursor) return;
    cursor = next;
  }
}

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
    // Latest and All both re-read detail for posts this page already fetched.
    // Latest still stops once a page shows nothing newer.
    refreshSaved = true,
    // Item pass. Ignored when latest is true, even if the caller sent it.
    checkAllMedia = false,
    // Phase 5c: when true, post.getInfinite returns the user's drafts only.
    // The end-to-end draft download is a maintainer real-corpus step (no draft
    // fixture exists); the param threading and the re-save are fixture-tested.
    draftOnly = false,
    // Phase 5c2: when paired with draftOnly, widens the owner-request filter to
    // `publishedAt IS NULL OR publishedAt > NOW()` — drafts AND scheduled posts.
    scheduled = false,
    log = console.log,
    onProgress,
    signal,
    carry = null
  } = options;

  let { cursor, attempts = 0 } = options;
  let coveredNewestSaved = false;
  const editorIds = new Set();
  const frontier = latest === true && draftOnly !== true;

  const report = {
    time: (new Date()).toISOString(),
    count: 0,
    postsDownloaded: 0,
    postsNew: carry?.postsNew || 0,
    postsUpdated: carry?.postsUpdated || 0,
    postsSaved: carry?.postsSaved || 0,
    imagesSaved: carry?.imagesSaved || 0,
    videosSaved: carry?.videosSaved || 0,
    audioSaved: carry?.audioSaved || 0,
    cumulative: !!carry,
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
    const activityText = formatActivity(report.activity);

    const title = chalk.hex('#a5d8ff')('Downloading posts');
    const line1 = `${title} ${chalk.dim('·')} ${chalk.dim(activityText)}`;

    const mediaText = formatMediaCounts(report.imagesSaved, report.videosSaved, report.audioSaved);
    const newPostsText = report.postsNew > 0 ? chalk.green(`${report.postsNew} new`) : '';
    const updatedText = report.postsUpdated > 0 ? chalk.green(`${report.postsUpdated} updated`) : '';
    const batchDateStr = report.batchDate ? formatDate(report.batchDate) : '';
    const arrow = report.paginating && !isAborted() ? ' →' : '';
    const resultParts = [
      batchDateStr ? `${batchDateStr}${arrow}` : '',
      newPostsText,
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
    const prevPostsUpdated = report.postsUpdated;

    const result = await savePosts(data, {
      withImages,
      overwriteIfModified,
      refreshSaved,
      checkAllMedia: latest !== true && checkAllMedia === true,
      latestFrontier: frontier,
      coveredNewestSaved,
      signal,
      secretKey,
      onProgress: (saveReport) => {
        report.imagesSaved = prevImagesSaved + saveReport.imagesSaved;
        report.videosSaved = prevVideosSaved + saveReport.videosSaved;
        report.audioSaved = prevAudioSaved + saveReport.audioSaved;
        report.postsNew = prevPostsNew + saveReport.postsNew;
        report.postsUpdated = prevPostsUpdated + (saveReport.postsUpdated || 0);
        report.activity = saveReport.activity;
        log(reportText());
        if (onProgress) onProgress({ ...report });
      }
    });

    report.postsNew = prevPostsNew + result.postsNew;
    report.postsUpdated = prevPostsUpdated + (result.postsUpdated || 0);
    report.postsSaved += result.postsSaved;
    report.imagesSaved = prevImagesSaved + result.imagesSaved;
    report.videosSaved = prevVideosSaved + result.videosSaved;
    report.audioSaved = prevAudioSaved + result.audioSaved;
    report.activity = null;

    if (Array.isArray(result.refreshErrors) && result.refreshErrors.length) {
      report.errors.push(...result.refreshErrors);
    }

    if (result.fault) report.fault = result.fault;
    if (result.aborted || result.fault === 'storage') {
      report.aborted = true;
      if (onProgress) onProgress({ ...report });
      return report;
    }

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

    if (result.coveredNewestSaved) coveredNewestSaved = true;
    if (Array.isArray(result.editorIds)) {
      for (const id of result.editorIds) editorIds.add(id);
    }
    // Latest stops once a page has gone past 30 days. A write inside the
    // window does not, by itself, request another page, and it does not
    // extend the walk past the window. All always follows nextCursor.
    if (frontier && result.frontierCrossed) {
      return false;
    }
    const pageChanged = (result.savedItems && result.savedItems.length > 0)
      || (result.imagesSaved || 0) > 0
      || (result.videosSaved || 0) > 0
      || (result.audioSaved || 0) > 0;
    if (latest && !frontier && !pageChanged) {
      return false;
    }

    return report;
  }

  const tick = setInterval(() => log(reportText()), 1000);

  try {
    if (frontier) {
      await refreshOpenPosts({ secretKey, signal, withImages, report, onProgress });
    }
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
        return await fetchPosts({
          ...options,
          cursor,
          attempts,
          carry: {
            postsNew: report.postsNew,
            postsUpdated: report.postsUpdated,
            postsSaved: report.postsSaved,
            imagesSaved: report.imagesSaved,
            videosSaved: report.videosSaved,
            audioSaved: report.audioSaved
          }
        });
      }

      const code = error.code || (error.cause && error.cause.code);
      markThrownFault(report, error);

      if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_SOCKET' || code === 'ECONNRESET') {
        log(chalk.red('\nDownload failed. Could not connect to the web service. Please try again.'));
      } else {
        log(chalk.red(`\nDownload failed. Please try again. "${error.message} ${code}"`));
      }
    }

    if (isAborted() && !report.aborted) {
      report.aborted = true;
    }

    if (frontier && !report.aborted && !(signal && signal.aborted)) {
      try {
        await ensureIndexLoaded();
        await followNewImages({ username, secretKey, signal, withImages, seenIds: editorIds, report, onProgress });
      } catch {
        // The image feed is a backstop. A failure here leaves the post walk's result.
      }
    }

    const hasData = (report.postsNew || 0) > 0 || (report.postsUpdated || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0 || (report.audioSaved || 0) > 0;
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
    postsNew: b.cumulative ? (b.postsNew || 0) : (a.postsNew || 0) + (b.postsNew || 0),
    postsUpdated: b.cumulative ? (b.postsUpdated || 0) : (a.postsUpdated || 0) + (b.postsUpdated || 0),
    postsSaved: b.cumulative ? (b.postsSaved || 0) : (a.postsSaved || 0) + (b.postsSaved || 0),
    imagesSaved: b.cumulative ? (b.imagesSaved || 0) : (a.imagesSaved || 0) + (b.imagesSaved || 0),
    videosSaved: b.cumulative ? (b.videosSaved || 0) : (a.videosSaved || 0) + (b.videosSaved || 0),
    audioSaved: b.cumulative ? (b.audioSaved || 0) : (a.audioSaved || 0) + (b.audioSaved || 0),
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
// does not double-prompt. Pass 2 starts from pass 1's totals, so the live
// line does not drop. The merged report keeps those cumulative counts.
export async function fetchPostsAllKinds (options = {}) {
  const published = await fetchPosts(options);

  const isUnauthorized = (e) => e?.code === 'UNAUTHORIZED' || e?.error === 'UNAUTHORIZED' || e?.json?.data?.code === 'UNAUTHORIZED';
  if (options.signal?.aborted || (published.errors || []).some(isUnauthorized)) {
    return published;
  }

  const extra = await fetchPosts({
    ...options,
    draftOnly: true,
    scheduled: true,
    latest: false,
    refreshSaved: true,
    checkAllMedia: options.checkAllMedia === true,
    carry: {
      postsNew: published.postsNew,
      postsUpdated: published.postsUpdated,
      postsSaved: published.postsSaved,
      imagesSaved: published.imagesSaved,
      videosSaved: published.videosSaved,
      audioSaved: published.audioSaved
    }
  });

  const merged = mergePostReports(published, extra);
  // Latest must not dismiss the Settings / CLI All prompt. Only a completed
  // All walk fills older posts (and stamps hasMeta on current listings).
  if (options.latest !== true && !merged.aborted && merged.complete) {
    await setConfigParam('postsGenerationDataFilled', true).catch(() => {});
    await setConfigParam('postsImageResourcesFilled', true).catch(() => {});
    await setConfigParam('postsGenerationResponseFilled', true).catch(() => {});
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
  const hasNewData = (report.postsNew || 0) > 0 || (report.postsUpdated || 0) > 0 || (report.imagesSaved || 0) > 0 || (report.videosSaved || 0) > 0 || (report.audioSaved || 0) > 0;

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
  const newPostsText = (report.postsNew || 0) > 0 ? chalk.green(`${report.postsNew} new`) : '';
  const updatedText = (report.postsUpdated || 0) > 0 ? chalk.green(`${report.postsUpdated} updated`) : '';
  const contentParts = [newPostsText, updatedText, mediaText].filter(Boolean);
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
