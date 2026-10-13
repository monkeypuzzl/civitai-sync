import chalk from 'chalk';
import select, { Separator } from '@inquirer/select';
import { CONFIG, customTheme, clearTerminal } from './cli.mjs';
import { mainMenu } from './mainMenu.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_AFTER_DAYS = 25;
const EXPIRE_AFTER_DAYS = 30;
const WARN_COLOR = '#d29922';
const EXPIRED_COLOR = '#f85149';

const DOWNLOAD_LEADS = {
  generations: 'Download your Generations',
  posts: 'Download your Posts',
  comics: 'Download your Comics',
  model3ds: 'Download 3D'
};

function daysSinceDownload (isoDate, now) {
  if (!isoDate) return null;
  const then = new Date(isoDate).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((now - then) / DAY_MS);
  if (!Number.isFinite(days)) return null;
  return days;
}

function relativeDayText (days) {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function lastDownloadClause (isoDate, now, warn) {
  const days = daysSinceDownload(isoDate, now);
  if (days === null) return 'Never downloaded';

  let text = `Last downloaded ${relativeDayText(days)}`;
  if (!warn) return text;

  if (days >= EXPIRE_AFTER_DAYS) {
    text += ' — generations may have expired!';
    return chalk.hex(EXPIRED_COLOR)(text);
  }

  if (days >= WARN_AFTER_DAYS) {
    text += ' — download soon to avoid expiry';
    return chalk.hex(WARN_COLOR)(text);
  }

  return text;
}

// Highlighted Download-row description. Matches Settings' last-download line.
// `now` is injectable so a test does not depend on the clock.
export function downloadTypeDescription ({ kind, isoDate, downloadMedia = true, now = Date.now() } = {}) {
  let lead = DOWNLOAD_LEADS[kind] || '';
  if (downloadMedia === false && DOWNLOAD_LEADS[kind]) lead += ' (data only)';
  return `${lead} · ${lastDownloadClause(isoDate, now, kind === 'generations')}`;
}

let previousMenuItem;

export async function downloadMenu ({ clear = true } = {}) {
  const choices = [
    {
      name: 'Generations',
      value: 'generations',
      description: downloadTypeDescription({
        kind: 'generations',
        isoDate: CONFIG.lastDownloadGenerations,
        downloadMedia: CONFIG.downloadMedia
      })
    },
    {
      name: 'Posts',
      value: 'posts',
      description: downloadTypeDescription({
        kind: 'posts',
        isoDate: CONFIG.lastDownloadPosts,
        downloadMedia: CONFIG.downloadMedia
      })
    },
    {
      name: 'Comics',
      value: 'comics',
      description: downloadTypeDescription({
        kind: 'comics',
        isoDate: CONFIG.lastDownloadComics,
        downloadMedia: CONFIG.downloadMedia
      })
    },
    {
      name: '3D',
      value: 'model3ds',
      description: downloadTypeDescription({
        kind: 'model3ds',
        isoDate: CONFIG.lastDownloadModel3ds,
        downloadMedia: CONFIG.downloadMedia
      })
    },
    new Separator(),
    {
      name: 'Back',
      value: 'back',
      description: 'Back to main menu'
    }
  ];

  if (clear) {
    clearTerminal();
  } else {
    console.log();
  }

  const answer = await select({
    message: 'Download:',
    choices,
    theme: customTheme,
    pageSize: choices.length,
    loop: false,
    default: previousMenuItem !== 'back' ? previousMenuItem : undefined
  });

  previousMenuItem = answer;

  switch (answer) {
    case 'generations': {
      const { downloadGenerationsMenu } = await import('./downloadGenerationsMenu.mjs');
      return downloadGenerationsMenu();
    }

    case 'posts': {
      const { downloadPostsMenu } = await import('./downloadPostsMenu.mjs');
      return downloadPostsMenu();
    }

    case 'comics': {
      const { downloadComics } = await import('./downloadComicsMenu.mjs');
      await downloadComics();
      return downloadMenu({ clear: false });
    }

    case 'model3ds': {
      const { downloadModel3ds } = await import('./downloadModel3dsMenu.mjs');
      await downloadModel3ds();
      return downloadMenu({ clear: false });
    }

    case 'back':
    return mainMenu();
  }
}
