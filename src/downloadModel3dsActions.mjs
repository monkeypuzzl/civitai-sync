import chalk from 'chalk';
import { getModel3ds, getModel3d, getModel3dFiles, readTrpcJson, formatApiError } from './civitaiApi.mjs';
import { saveModel3d, model3dFilepath } from './model3ds.mjs';
import { setConfigParam } from './config.mjs';
import { upsertIndexEntries, ensureIndexLoaded, downloadOpenIds } from './serverIndex.mjs';
import { listenForEscKeyPress, plural, formatElapsed, formatActivity } from './downloadActions.mjs';
import { readFile, writeFile, fileExists } from './utils.mjs';
import { withinLatestWindow } from './latestWindow.mjs';
import { CONFIG } from './cli.mjs';
import { fillIfMissing } from './userData.mjs';
import { WIRE } from './civitaiWire.mjs';

export { listenForEscKeyPress };

const FEED_CLOSED = '3D is not available on this account.';

function isAborted (signal) {
  return signal ? signal.aborted : false;
}

function feedClosed (error) {
  if (!error || typeof error !== 'object') return false;
  const code = error.code || error.json?.data?.code || '';
  const message = `${error.message || ''} ${error.json?.message || ''}`;
  return code === 'FORBIDDEN' || /model3dFeed/i.test(String(code)) || /model3dFeed/i.test(message);
}

function closedError () {
  return { code: 'FORBIDDEN', message: FEED_CLOSED, retryable: false };
}

async function resolveUsername (secretKey) {
  if (CONFIG.username) return CONFIG.username;
  try {
    await fillIfMissing({ secretKey });
  } catch (err) {
    return { error: err?.message || 'Civitai service unavailable' };
  }
  return CONFIG.username || null;
}

async function saveListedId ({ id, report, withImages, secretKey, signal, progress, index, total }) {
  if (isAborted(signal)) {
    report.aborted = true;
    return 'stop';
  }
  if (isAborted(signal)) {
    report.aborted = true;
    return 'stop';
  }

  progress({ phase: 'saving', index, total });
  const detail = await getModel3d({ id, secretKey, signal });
  if (detail?.error) {
    if (feedClosed(detail.error)) {
      report.feedUnavailable = true;
      report.errors.push(closedError());
      return 'stop';
    }
    report.errors.push(detail.error);
    return 'next';
  }

  if (!detail || detail.status === 'Deleted') {
    report.skipped.push({ id, reason: 'deleted' });
    return 'next';
  }

  if (!detail.createdAt) {
    report.skipped.push({ id, reason: 'missing-createdAt' });
    return 'next';
  }

  const signed = await getModel3dFiles({ id, secretKey, signal });
  if (signed?.error) {
    if (feedClosed(signed.error)) {
      report.feedUnavailable = true;
      report.errors.push(closedError());
      return 'stop';
    }
    report.errors.push(signed.error);
  }

  const merged = {
    ...detail,
    files: mergeFiles(detail.files, signed && !signed.error ? signed.files : [])
  };
  report.model3dsDownloaded += 1;

  const saveReport = await saveModel3d(merged, { withImages, signal, secretKey });
  report.model3dsNew += saveReport.model3dNew || 0;
  report.model3dsSaved += saveReport.model3dSaved || 0;
  report.filesSaved += saveReport.filesSaved || 0;
  if (!(saveReport.model3dNew > 0) && ((saveReport.model3dSaved || 0) > 0 || (saveReport.filesSaved || 0) > 0)) {
    report.model3dsUpdated += 1;
  }

  if (saveReport.skipped && saveReport.skipReason) {
    report.skipped.push({ id, reason: saveReport.skipReason });
  }
  if (saveReport.fault) report.fault = saveReport.fault;
  if (saveReport.aborted) {
    report.aborted = true;
    return 'stop';
  }
  if (saveReport.error) report.errors.push(saveReport.error);
  if (saveReport.savedItem) report.savedItems.push(saveReport.savedItem);
  return 'next';
}

const LIST_OVERLAY_KEYS = ['name', 'status', 'availability', 'publishedAt', WIRE.browsingLevel, 'unlisted'];

async function overlayListCard (filepath, item, report) {
  let saved;
  try {
    saved = JSON.parse(await readFile(filepath));
  } catch {
    return;
  }
  let changed = false;
  for (const key of LIST_OVERLAY_KEYS) {
    if (item[key] === undefined || item[key] === saved[key]) continue;
    saved[key] = item[key];
    changed = true;
  }
  if (!changed) return;
  try {
    await writeFile(filepath, JSON.stringify(saved, null, 2));
  } catch {
    report.errors.push({ message: 'Could not save 3D data' });
    return;
  }
  report.model3dsSaved += 1;
  report.model3dsUpdated += 1;
  report.savedItems.push(saved);
}

async function refreshOpenModel3ds ({ secretKey, signal, withImages, report, progress }) {
  try {
    await ensureIndexLoaded();
  } catch {
    return;
  }
  const open = downloadOpenIds().model3ds;
  for (const row of open) {
    const outcome = await saveListedId({
      id: row.id,
      report,
      withImages,
      secretKey,
      signal,
      progress,
      index: 1,
      total: open.length
    });
    if (outcome === 'stop') return;
  }
}

async function walkPass ({ username, secretKey, signal, pass, stopWhenQuiet, report, withImages, progress }) {
  let cursor;
  let guard = 0;
  let coveredNewest = false;
  while (guard < 10000) {
    guard += 1;
    if (isAborted(signal)) {
      report.aborted = true;
      return 'stop';
    }
    const page = await getModel3ds({ username, cursor, secretKey, signal, ...pass });
    if (page?.error) {
      if (feedClosed(page.error)) {
        report.feedUnavailable = true;
        report.errors.push(closedError());
        return 'stop';
      }
      report.errors.push(page.error);
      return 'done';
    }
    const parsed = readTrpcJson(page);
    if (!parsed) {
      report.errors.push({ message: 'Unexpected model3d.getInfinite shape' });
      return 'done';
    }
    const beforeNew = report.model3dsNew;
    const beforeSaved = report.model3dsSaved;
    const beforeFiles = report.filesSaved;
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    let crossed = false;
    let dated = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = item && item.id;
      if (id == null) continue;
      if (item.publishedAt) {
        dated = true;
        if (!withinLatestWindow(item.publishedAt)) crossed = true;
      }
      const savedPath = item.createdAt ? model3dFilepath({ id, createdAt: item.createdAt }) : '';
      const exists = !!(savedPath && await fileExists(savedPath));
      const outside = !!(item.publishedAt && !withinLatestWindow(item.publishedAt));
      const newestSaved = exists && !coveredNewest;
      if (exists) coveredNewest = true;
      const detail = !stopWhenQuiet || !exists || !outside || newestSaved;
      if (!detail) {
        await overlayListCard(savedPath, item, report);
        continue;
      }
      const outcome = await saveListedId({
        id,
        report,
        withImages,
        secretKey,
        signal,
        progress,
        index: i + 1,
        total: items.length
      });
      if (outcome === 'stop') return 'stop';
    }
    const quiet = report.model3dsNew === beforeNew
      && report.model3dsSaved === beforeSaved
      && report.filesSaved === beforeFiles;
    if (stopWhenQuiet && dated && crossed) return 'done';
    if (stopWhenQuiet && !dated && quiet) return 'done';
    if (parsed.nextCursor == null || parsed.nextCursor === cursor) break;
    cursor = parsed.nextCursor;
  }
  return 'done';
}

function mergeFiles (detailFiles, signedFiles) {
  const signed = new Map();
  for (const file of (Array.isArray(signedFiles) ? signedFiles : [])) {
    if (file && file.id != null) signed.set(file.id, file);
  }
  const base = Array.isArray(detailFiles) ? detailFiles : [];
  if (!base.length) return Array.isArray(signedFiles) ? signedFiles : [];
  return base.map(file => {
    const extra = file && file.id != null ? signed.get(file.id) : null;
    return extra ? { ...file, ...extra } : file;
  });
}

export async function fetchModel3ds (options = {}) {
  const {
    withImages = CONFIG.downloadMedia !== false,
    secretKey = '',
    username: usernameOption,
    log = console.log,
    onProgress,
    signal,
    latest = false
  } = options;

  const report = {
    time: (new Date()).toISOString(),
    model3dsDownloaded: 0,
    model3dsNew: 0,
    model3dsUpdated: 0,
    model3dsSaved: 0,
    filesSaved: 0,
    activity: null,
    errors: [],
    skipped: [],
    aborted: false,
    complete: false,
    feedUnavailable: false,
    savedItems: []
  };

  function progress (activity) {
    report.activity = activity;
    log(reportText());
    if (onProgress) onProgress({ ...report });
  }

  function reportText ({ esc = true } = {}) {
    const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
    const activityText = formatActivity(report.activity);
    const title = chalk.hex('#a5d8ff')('Downloading 3D');
    const line1 = `${title} ${chalk.dim('·')} ${chalk.dim(activityText)}`;
    const newText = report.model3dsNew > 0 ? chalk.green(`${report.model3dsNew} new`) : '';
    const updatedText = report.model3dsUpdated > 0 ? chalk.green(`${report.model3dsUpdated} updated`) : '';
    const filesText = report.filesSaved > 0 ? plural(report.filesSaved, 'file') : '';
    const resultParts = [newText, updatedText, filesText, `elapsed ${elapsed}`].filter(Boolean);
    const line2 = chalk.dim(`  ${resultParts.join(' · ')}`);
    let line3;
    if (isAborted(signal)) {
      line3 = chalk.dim('  Stopping... finishing current download');
    } else if (esc) {
      line3 = chalk.dim('  Press Esc to stop');
    }
    return [line1, line2, line3].filter(Boolean).join('\n');
  }

  const tick = setInterval(() => log(reportText()), 1000);

  try {
    let username = usernameOption;
    if (username && typeof username === 'object') username = null;
    if (!username) {
      const resolved = await resolveUsername(secretKey);
      if (resolved && typeof resolved === 'object' && resolved.error) {
        report.errors.push({ message: resolved.error });
        return report;
      }
      username = resolved;
    }
    if (!username) {
      report.errors.push({ message: 'Could not resolve username. Check your API key.' });
      return report;
    }

    progress({ phase: 'listing' });
    if (latest === true) {
      await refreshOpenModel3ds({ secretKey, signal, withImages, report, progress });
      if (report.aborted || report.feedUnavailable) {
        if (onProgress) onProgress({ ...report });
        return report;
      }
    }
    const publishedPass = await walkPass({
      username,
      secretKey,
      signal,
      pass: { status: 'Published', sort: 'Newest' },
      stopWhenQuiet: latest === true,
      report,
      withImages,
      progress
    });
    if (publishedPass === 'stop') {
      if (onProgress) onProgress({ ...report });
      return report;
    }

    if (!report.aborted && !report.feedUnavailable) {
      const draftPass = await walkPass({
        username,
        secretKey,
        signal,
        pass: { includeDrafts: true, sort: 'Newest' },
        stopWhenQuiet: false,
        report,
        withImages,
        progress
      });
      if (draftPass === 'stop') {
        if (onProgress) onProgress({ ...report });
        return report;
      }
    }

    if (isAborted(signal) && !report.aborted) report.aborted = true;
    if (!report.aborted && !report.feedUnavailable) report.complete = true;

    if (report.savedItems.length) {
      await upsertIndexEntries({ model3ds: report.savedItems }).catch(() => {});
    }

    const hasData = (report.model3dsNew || 0) > 0 || (report.model3dsUpdated || 0) > 0 || (report.filesSaved || 0) > 0;
    if (!report.feedUnavailable && (hasData || report.complete)) {
      await setConfigParam('lastDownloadModel3ds', new Date().toISOString()).catch(() => {});
    }

    if (onProgress) onProgress({ ...report });
    return report;
  } finally {
    clearInterval(tick);
  }
}

export function formatModel3dCompletion (report) {
  if (!report || typeof report !== 'object') return '';

  const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
  const hasNewData = (report.model3dsNew || 0) > 0 || (report.model3dsUpdated || 0) > 0 || (report.filesSaved || 0) > 0;

  if (report.feedUnavailable) {
    return `${chalk.red(FEED_CLOSED)}\n`;
  }

  if (!hasNewData && !report.aborted && !(report.errors?.length)) {
    return `${chalk.hex('#a5d8ff')('Up to date')} ${chalk.dim('·')} no new 3D found.\n`;
  }

  let label;
  if (report.aborted) {
    label = chalk.yellowBright('Download stopped');
  } else if (report.errors?.length) {
    label = `${chalk.green('Download complete')} ${chalk.dim('·')} ${chalk.red(plural(report.errors.length, 'error'))}`;
  } else {
    label = chalk.green('Download complete');
  }

  if (!hasNewData && report.aborted) {
    return `${label} ${chalk.dim('·')} no data was saved.\n`;
  }

  const filesText = (report.filesSaved || 0) > 0 ? plural(report.filesSaved, 'file') : '';
  const newText = (report.model3dsNew || 0) > 0 ? chalk.green(`${report.model3dsNew} new`) : '';
  const updatedText = (report.model3dsUpdated || 0) > 0 ? chalk.green(`${report.model3dsUpdated} updated`) : '';
  const contentParts = [newText, updatedText, filesText].filter(Boolean);
  const line1 = contentParts.length
    ? `${label} ${chalk.dim('·')} ${contentParts.join(` ${chalk.dim('·')} `)}`
    : label;
  const lines = [line1, chalk.dim(`  elapsed ${elapsed}`)];

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
