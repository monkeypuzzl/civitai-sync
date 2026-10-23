import chalk from 'chalk';
import { getMyProjects, getProjectShell, getChapter, formatApiError } from './civitaiApi.mjs';
import { readFile, fileExists } from './utils.mjs';
import {
  mergeComic,
  saveComic,
  saveComicData,
  comicFilepath,
  comicNeedsChapters,
  applyComicShell,
  saveChangedComicChrome
} from './comics.mjs';
import { setConfigParam } from './config.mjs';
import { upsertIndexEntries } from './serverIndex.mjs';
import { listenForEscKeyPress, plural, formatElapsed, formatActivity } from './downloadActions.mjs';
import { CONFIG } from './cli.mjs';
import { comparableDownloadJson } from './signedUrl.mjs';

export { listenForEscKeyPress };

function isAborted (signal) {
  return signal ? signal.aborted : false;
}

export async function fetchComics (options = {}) {
  const {
    withImages = CONFIG.downloadMedia !== false,
    overwriteIfModified = true,
    checkAllMedia = false,
    latest = false,
    secretKey = '',
    log = console.log,
    onProgress,
    signal
  } = options;

  const report = {
    time: (new Date()).toISOString(),
    comicsDownloaded: 0,
    comicsNew: 0,
    comicsUpdated: 0,
    comicsSaved: 0,
    imagesSaved: 0,
    activity: null,
    errors: [],
    aborted: false,
    complete: false,
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
    const title = chalk.hex('#a5d8ff')('Downloading comics');
    const line1 = `${title} ${chalk.dim('·')} ${chalk.dim(activityText)}`;
    const newText = report.comicsNew > 0 ? chalk.green(`${report.comicsNew} new`) : '';
    const updatedText = report.comicsUpdated > 0 ? chalk.green(`${report.comicsUpdated} updated`) : '';
    const imagesText = report.imagesSaved > 0 ? plural(report.imagesSaved, 'image') : '';
    const resultParts = [newText, updatedText, imagesText, `elapsed ${elapsed}`].filter(Boolean);
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
    progress({ phase: 'listing' });
    const list = await getMyProjects({ secretKey, signal });

    if (list?.error) {
      report.errors.push(list.error);
      log(`${reportText()}\n${chalk.red(`  Error: ${formatApiError(list.error)}`)}`);
      return report;
    }

    const projects = Array.isArray(list) ? list : [];

    if (!projects.length) {
      report.complete = true;
      const hasData = false;
      if (hasData || report.complete) {
        await setConfigParam('lastDownloadComics', new Date().toISOString()).catch(() => {});
      }
      if (onProgress) onProgress({ ...report });
      return report;
    }

    for (let i = 0; i < projects.length; i++) {
      if (isAborted(signal)) {
        report.aborted = true;
        break;
      }

      const listed = projects[i];
      const projectId = listed?.id;
      if (projectId == null) continue;

      if (isAborted(signal)) {
        report.aborted = true;
        break;
      }

      progress({ phase: 'saving', index: i + 1, total: projects.length });
      const shell = await getProjectShell({ id: projectId, secretKey, signal });

      if (shell?.error) {
        report.errors.push(shell.error);
        continue;
      }

      if (!shell || shell.status === 'Deleted') {
        continue;
      }

      if (!shell.createdAt) {
        continue;
      }

      let saved = null;
      const existingPath = comicFilepath({ id: shell.id, createdAt: shell.createdAt });
      if (existingPath && await fileExists(existingPath)) {
        try {
          saved = JSON.parse(await readFile(existingPath));
        } catch {
          saved = null;
        }
      }

      if (latest === true && !comicNeedsChapters(shell, saved) && saved?.downloadOpen !== true) {
        const next = applyComicShell(saved, shell);
        if (comparableDownloadJson(next) !== comparableDownloadJson(saved)) {
          const written = await saveComicData(next);
          if (!written) {
            report.errors.push({ message: 'Could not save comic data' });
            continue;
          }
          report.comicsSaved += 1;
          report.comicsUpdated += 1;
          if (withImages && CONFIG.downloadMedia !== false) {
            const chrome = await saveChangedComicChrome(next, saved, { signal, secretKey, onProgress: progress });
            report.imagesSaved += chrome.imagesSaved || 0;
            if (chrome.aborted) {
              report.aborted = true;
              break;
            }
          }
          report.savedItems.push(next);
        }
        continue;
      }

      const chapterSummaries = Array.isArray(shell.chapters) ? shell.chapters : [];
      const chapters = [];

      for (const summary of chapterSummaries) {
        if (isAborted(signal)) {
          report.aborted = true;
          break;
        }
        const chapterPosition = summary?.position;
        if (chapterPosition == null) continue;

        if (isAborted(signal)) {
          report.aborted = true;
          break;
        }

        const chapter = await getChapter({ projectId: shell.id, chapterPosition, secretKey, signal });
        if (chapter?.error) {
          report.errors.push(chapter.error);
          continue;
        }
        if (chapter && typeof chapter === 'object') chapters.push(chapter);
      }

      if (report.aborted) break;

      const merged = mergeComic(shell, chapters);
      report.comicsDownloaded++;

      const saveReport = await saveComic(merged, {
        overwriteIfModified,
        withImages,
        checkAllMedia: checkAllMedia === true,
        signal,
        secretKey,
        onProgress: (activity) => progress(activity)
      });

      report.comicsNew += saveReport.comicNew || 0;
      report.comicsSaved += saveReport.comicSaved || 0;
      report.imagesSaved += saveReport.imagesSaved || 0;
      if (!(saveReport.comicNew > 0) && ((saveReport.comicSaved || 0) > 0 || (saveReport.imagesSaved || 0) > 0)) {
        report.comicsUpdated += 1;
      }

      if (saveReport.fault) report.fault = saveReport.fault;
      if (saveReport.aborted) {
        report.aborted = true;
        break;
      }

      if (saveReport.error) {
        report.errors.push(saveReport.error);
      }

      if (saveReport.savedItem) {
        report.savedItems.push(saveReport.savedItem);
      }
    }

    if (isAborted(signal) && !report.aborted) {
      report.aborted = true;
    }

    if (!report.aborted) report.complete = true;

    if (report.savedItems.length) {
      await upsertIndexEntries({ comics: report.savedItems }).catch(() => {});
    }

    const hasData = (report.comicsNew || 0) > 0 || (report.comicsUpdated || 0) > 0 || (report.imagesSaved || 0) > 0;
    if (hasData || report.complete) {
      await setConfigParam('lastDownloadComics', new Date().toISOString()).catch(() => {});
    }

    if (onProgress) onProgress({ ...report });
    return report;
  } finally {
    clearInterval(tick);
  }
}

export function formatComicCompletion (report) {
  if (!report || typeof report !== 'object') return '';

  const elapsed = formatElapsed(Date.now() - new Date(report.time).getTime());
  const hasNewData = (report.comicsNew || 0) > 0 || (report.comicsUpdated || 0) > 0 || (report.imagesSaved || 0) > 0;

  if (!hasNewData && !report.aborted && !(report.errors?.length)) {
    return `${chalk.hex('#a5d8ff')('Up to date')} ${chalk.dim('·')} no new comics found.\n`;
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

  const imagesText = (report.imagesSaved || 0) > 0 ? plural(report.imagesSaved, 'image') : '';
  const newComicsText = (report.comicsNew || 0) > 0 ? chalk.green(`${report.comicsNew} new`) : '';
  const updatedText = (report.comicsUpdated || 0) > 0 ? chalk.green(`${report.comicsUpdated} updated`) : '';
  const contentParts = [newComicsText, updatedText, imagesText].filter(Boolean);
  const line1 = contentParts.length
    ? `${label} ${chalk.dim('·')} ${contentParts.join(` ${chalk.dim('·')} `)}`
    : label;
  const line2 = chalk.dim(`  elapsed ${elapsed}`);
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
