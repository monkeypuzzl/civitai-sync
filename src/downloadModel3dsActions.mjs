import chalk from 'chalk';
import { getModel3ds, getModel3d, getModel3dFiles, readTrpcJson, formatApiError } from './civitaiApi.mjs';
import { saveModel3d } from './model3ds.mjs';
import { setConfigParam } from './config.mjs';
import { upsertIndexEntries } from './serverIndex.mjs';
import { listenForEscKeyPress, plural, formatElapsed, formatActivity } from './downloadActions.mjs';
import { wait } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { fillIfMissing } from './userData.mjs';

export { listenForEscKeyPress };

const DATA_RATE_LIMIT = 100;
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

async function listIds ({ username, secretKey, signal, pass }) {
  const ids = [];
  let cursor;
  let guard = 0;
  while (guard < 10000) {
    guard += 1;
    if (isAborted(signal)) return { ids, aborted: true };
    const page = await getModel3ds({ username, cursor, secretKey, signal, ...pass });
    if (page?.error) {
      if (feedClosed(page.error)) return { ids, forbidden: true, error: closedError() };
      return { ids, error: page.error };
    }
    const parsed = readTrpcJson(page);
    if (!parsed) return { ids, error: { message: 'Unexpected model3d.getInfinite shape' } };
    for (const item of parsed.items) {
      if (item && item.id != null) ids.push(item.id);
    }
    if (parsed.nextCursor == null || parsed.nextCursor === cursor) break;
    cursor = parsed.nextCursor;
    await wait(DATA_RATE_LIMIT);
  }
  return { ids };
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
    signal
  } = options;

  const report = {
    time: (new Date()).toISOString(),
    model3dsDownloaded: 0,
    model3dsNew: 0,
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
    const activityText = formatActivity(report.activity, { itemNoun: '3D' });
    const title = chalk.hex('#a5d8ff')('Downloading 3D');
    const line1 = activityText
      ? `${title} ${chalk.dim('·')} ${chalk.dim(activityText)}`
      : title;
    const newText = report.model3dsNew > 0 ? chalk.green(`${report.model3dsNew} new 3D`) : '';
    const filesText = report.filesSaved > 0 ? plural(report.filesSaved, 'file') : '';
    const resultParts = [filesText, newText, `elapsed ${elapsed}`].filter(Boolean);
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
    const published = await listIds({
      username,
      secretKey,
      signal,
      pass: { status: 'Published' }
    });
    if (published.forbidden) {
      report.feedUnavailable = true;
      report.errors.push(published.error);
      if (onProgress) onProgress({ ...report });
      return report;
    }
    if (published.error) report.errors.push(published.error);
    if (published.aborted || isAborted(signal)) {
      report.aborted = true;
      return report;
    }

    await wait(DATA_RATE_LIMIT);
    const drafts = await listIds({
      username,
      secretKey,
      signal,
      pass: { includeDrafts: true }
    });
    if (drafts.forbidden) {
      report.feedUnavailable = true;
      report.errors.push(drafts.error);
      if (onProgress) onProgress({ ...report });
      return report;
    }
    if (drafts.error) report.errors.push(drafts.error);
    if (drafts.aborted || isAborted(signal)) {
      report.aborted = true;
      return report;
    }

    const seen = new Set();
    const ids = [];
    for (const id of [...published.ids, ...drafts.ids]) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }

    if (!ids.length) {
      report.complete = true;
      await setConfigParam('lastDownloadModel3ds', new Date().toISOString()).catch(() => {});
      if (onProgress) onProgress({ ...report });
      return report;
    }

    for (let i = 0; i < ids.length; i++) {
      if (isAborted(signal)) {
        report.aborted = true;
        break;
      }

      await wait(DATA_RATE_LIMIT);
      if (isAborted(signal)) {
        report.aborted = true;
        break;
      }

      const id = ids[i];
      progress({ phase: 'saving', index: i + 1, total: ids.length });
      const detail = await getModel3d({ id, secretKey, signal });
      if (detail?.error) {
        if (feedClosed(detail.error)) {
          report.feedUnavailable = true;
          report.errors.push(closedError());
          break;
        }
        report.errors.push(detail.error);
        continue;
      }

      if (!detail || detail.status === 'Deleted') {
        report.skipped.push({ id, reason: 'deleted' });
        continue;
      }

      if (!detail.createdAt) {
        report.skipped.push({ id, reason: 'missing-createdAt' });
        continue;
      }

      await wait(DATA_RATE_LIMIT);
      const signed = await getModel3dFiles({ id, secretKey, signal });
      if (signed?.error) {
        if (feedClosed(signed.error)) {
          report.feedUnavailable = true;
          report.errors.push(closedError());
          break;
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

      if (saveReport.skipped && saveReport.skipReason) {
        report.skipped.push({ id, reason: saveReport.skipReason });
      }
      if (saveReport.aborted) {
        report.aborted = true;
        break;
      }
      if (saveReport.error) report.errors.push(saveReport.error);
      if (saveReport.savedItem) report.savedItems.push(saveReport.savedItem);
    }

    if (isAborted(signal) && !report.aborted) report.aborted = true;
    if (!report.aborted && !report.feedUnavailable) report.complete = true;

    if (report.savedItems.length) {
      await upsertIndexEntries({ model3ds: report.savedItems }).catch(() => {});
    }

    const hasData = (report.model3dsNew || 0) > 0 || (report.filesSaved || 0) > 0;
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
  const hasNewData = (report.model3dsNew || 0) > 0 || (report.filesSaved || 0) > 0;

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
  const newText = (report.model3dsNew || 0) > 0 ? chalk.green(`${report.model3dsNew} new 3D`) : '';
  const contentParts = [filesText, newText].filter(Boolean);
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
