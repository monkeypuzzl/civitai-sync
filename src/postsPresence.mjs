import { fileExists, listDirectory, isDate } from './utils.mjs';
import { CONFIG } from './cli.mjs';

export function postsDataDir () { return `${CONFIG.dataPath}/posts`; }

// Drafts (publishedAt: null) live in this dateless bucket, keyed on the post id.
export const POST_DRAFTS_DIR = 'drafts';

export async function hasSavedPosts () {
  try {
    const dataDir = postsDataDir();
    if (!(await fileExists(dataDir))) return false;
    const names = await listDirectory(dataDir);
    const dirs = names.filter(d => isDate(d) || d === POST_DRAFTS_DIR);
    for (const dir of dirs) {
      const files = await listDirectory(`${dataDir}/${dir}`);
      if (files.some(f => f.endsWith('.json'))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Settings / CLI: show the All prompt when this account has posts and has not
// yet completed a posts All under the generation-data fill. Not a disk scan
// of hasMeta (the listing no longer sends it). Not memoized: callers observe
// a tree that changes in the same process.
export async function postsNeedGenerationData () {
  if (CONFIG.postsGenerationDataFilled === true) return false;
  return hasSavedPosts();
}

// Settings / CLI: show the resource All prompt when this account has posts
// and has not completed a posts All since imageResources capture shipped.
// Same one-shot as postsNeedGenerationData. Not a disk scan of the stamp.
export async function postsNeedImageResources () {
  if (CONFIG.postsImageResourcesFilled === true) return false;
  return hasSavedPosts();
}

// Settings / CLI: same one-shot for the untrimmed generation-data body.
// Another capture adds a flag, not a second warning line.
export async function postsNeedGenerationResponse () {
  if (CONFIG.postsGenerationResponseFilled === true) return false;
  return hasSavedPosts();
}
