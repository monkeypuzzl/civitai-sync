// Settings action. Re-reads generation-data cards on saved posts and comics.
// Does not page the container feeds and does not download media files.

import { readFile, listDirectory, isDate } from './utils.mjs';
import { postsDataDir, POST_DRAFTS_DIR, hasSavedPosts } from './postsPresence.mjs';
import { savePosts } from './posts.mjs';
import { comicsDataDir, saveComic } from './comics.mjs';
import { upsertIndexEntries } from './serverIndex.mjs';

async function readJsonFiles (dir, { includeDrafts = false } = {}) {
  const out = [];
  let names = [];
  try {
    names = await listDirectory(dir);
  } catch {
    return out;
  }
  const dirs = names.filter(name => isDate(name) || (includeDrafts && name === POST_DRAFTS_DIR));
  for (const date of dirs) {
    let files = [];
    try {
      files = await listDirectory(`${dir}/${date}`);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        out.push(JSON.parse(await readFile(`${dir}/${date}/${file}`)));
      } catch {
        // Skip a file that is not JSON.
      }
    }
  }
  return out;
}

export async function hasSavedComics () {
  const comics = await readJsonFiles(comicsDataDir());
  return comics.length > 0;
}

export async function recheckMetadataAvailable () {
  if (await hasSavedPosts()) return true;
  return hasSavedComics();
}

function postPage (post) {
  return { result: { data: { json: { items: [post] } } } };
}

export async function recheckSavedMetadata ({ secretKey, signal, log = console.log } = {}) {
  const report = {
    postsUpdated: 0,
    comicsUpdated: 0,
    aborted: false,
    errors: []
  };
  if (!secretKey) {
    log('An API key is required.');
    return report;
  }

  log('Rechecking metadata…');
  const posts = await readJsonFiles(postsDataDir(), { includeDrafts: true });
  const savedPosts = [];
  for (let i = 0; i < posts.length; i++) {
    if (signal && signal.aborted) {
      report.aborted = true;
      break;
    }
    log(`Posts ${i + 1}/${posts.length}`);
    const result = await savePosts(postPage(posts[i]), {
      withImages: false,
      overwriteIfModified: true,
      refreshSaved: true,
      checkAllMedia: true,
      secretKey,
      signal,
      log: () => {}
    });
    if (result && result.savedItems && result.savedItems.length) {
      savedPosts.push(...result.savedItems);
      report.postsUpdated += result.savedItems.length;
    }
    if (result && result.error) report.errors.push(result.error);
    if (signal && signal.aborted) {
      report.aborted = true;
      break;
    }
  }

  const savedComics = [];
  if (!report.aborted) {
    const comics = await readJsonFiles(comicsDataDir());
    for (let i = 0; i < comics.length; i++) {
      if (signal && signal.aborted) {
        report.aborted = true;
        break;
      }
      log(`Comics ${i + 1}/${comics.length}`);
      const result = await saveComic(comics[i], {
        withImages: false,
        overwriteIfModified: true,
        checkAllMedia: true,
        secretKey,
        signal
      });
      if (result && result.comicSaved && result.savedItem) {
        savedComics.push(result.savedItem);
        report.comicsUpdated += 1;
      }
      if (result && result.error) report.errors.push(result.error);
      if (result && result.aborted) {
        report.aborted = true;
        break;
      }
    }
  }

  if (savedPosts.length || savedComics.length) {
    await upsertIndexEntries({
      posts: savedPosts,
      comics: savedComics
    }).catch(() => {});
  }

  if (report.aborted) log('Stopped.');
  else log(`Updated ${report.postsUpdated} posts and ${report.comicsUpdated} comics.`);
  return report;
}
