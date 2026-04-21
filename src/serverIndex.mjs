import fs from 'node:fs';
import { readFile, listDirectory, isDate, writeFile } from './utils.mjs';
import {
  generationsDataDir,
  getGeneratedMediaInfo,
  MEDIA_DIRECTORIES
} from './generations.mjs';
import { postsDataDir } from './posts.mjs';
import { CONFIG } from './cli.mjs';
import { civitaiUrl } from './civitaiDomain.mjs';

const INDEX_VERSION = 3;

let index = { generations: [], posts: [], stats: {} };

export function getIndex () { return index; }

function indexDir () { return `${CONFIG.dataPath}/index`; }
function genNdjsonPath () { return `${indexDir()}/generations.ndjson`; }
function postsNdjsonPath () { return `${indexDir()}/posts.ndjson`; }
function statsPath () { return `${indexDir()}/stats.json`; }

// --- NDJSON I/O ---

function parseNdjson (text) {
  const items = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line) continue;
    try { items.push(JSON.parse(line)); } catch { /* skip malformed line */ }
  }
  return items;
}

function toNdjson (items) {
  return items.map(item => JSON.stringify(item)).join('\n') + '\n';
}

async function readNdjsonFile (filepath) {
  try {
    const text = await readFile(filepath);
    return parseNdjson(text);
  } catch {
    return null;
  }
}

async function writeNdjsonFile (filepath, items) {
  await writeFile(filepath, toNdjson(items));
}

async function appendNdjsonFile (filepath, items) {
  if (!items.length) return;
  const text = items.map(item => JSON.stringify(item)).join('\n') + '\n';
  await fs.promises.appendFile(filepath, text, 'utf-8');
}

// --- Stats ---

function computeStats (generations, posts) {
  let genImages = 0;
  let genVideos = 0;
  let postImages = 0;
  let postVideos = 0;
  let totalFavorites = 0;
  let totalLiked = 0;
  let totalDisliked = 0;
  let genFrom = '';
  let genTo = '';
  let postFrom = '';
  let postTo = '';

  for (const g of generations) {
    for (const m of g.media) {
      if (m.type === 'video') genVideos++;
      else genImages++;
    }
    if (g.tags.includes('favorite')) totalFavorites++;
    if (g.tags.includes('feedback:liked')) totalLiked++;
    if (g.tags.includes('feedback:disliked')) totalDisliked++;
    if (g.date && (!genFrom || g.date < genFrom)) genFrom = g.date;
    if (g.date && (!genTo || g.date > genTo)) genTo = g.date;
  }

  for (const p of posts) {
    for (const m of p.media) {
      if (m.type === 'video') postVideos++;
      else postImages++;
    }
    if (p.date && (!postFrom || p.date < postFrom)) postFrom = p.date;
    if (p.date && (!postTo || p.date > postTo)) postTo = p.date;
  }

  return {
    _version: INDEX_VERSION,
    totalGenerations: generations.length,
    totalPosts: posts.length,
    totalImages: genImages + postImages,
    totalVideos: genVideos + postVideos,
    genImages,
    genVideos,
    postImages,
    postVideos,
    totalFavorites,
    totalLiked,
    totalDisliked,
    generationDateRange: { from: genFrom, to: genTo },
    postDateRange: { from: postFrom, to: postTo },
    dateRange: {
      from: earliest(genFrom, postFrom),
      to: latest(genTo, postTo)
    }
  };
}

async function writeStats (stats) {
  await writeFile(statsPath(), JSON.stringify(stats, null, 2));
}

// --- Load from NDJSON cache ---

async function loadFromCache () {
  const statsText = await readFile(statsPath()).catch(() => null);
  if (!statsText) return null;

  let stats;
  try { stats = JSON.parse(statsText); } catch { return null; }
  if (stats._version !== INDEX_VERSION) return null;

  const generations = await readNdjsonFile(genNdjsonPath());
  if (!generations) return null;

  const posts = await readNdjsonFile(postsNdjsonPath());
  if (!posts) return null;

  return { generations, posts, stats };
}

// --- Full rebuild from data files ---

async function fullRebuild () {
  const [generations] = await scanGenerations();
  const [posts] = await scanPosts();
  const stats = computeStats(generations, posts);

  await writeNdjsonFile(genNdjsonPath(), generations);
  await writeNdjsonFile(postsNdjsonPath(), posts);
  await writeStats(stats);

  return { generations, posts, stats };
}

// --- Public API ---

export async function buildIndex () {
  const cached = await loadFromCache();
  if (cached) {
    index = cached;
    return index;
  }

  index = await fullRebuild();
  return index;
}

export async function rebuildIndex () {
  index = await fullRebuild();
  return index;
}

export async function appendGenerations (newItems) {
  if (!newItems.length) return;
  await appendNdjsonFile(genNdjsonPath(), newItems);
  index.generations = [...newItems, ...index.generations];
  index.generations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  index.stats = computeStats(index.generations, index.posts);
  await writeStats(index.stats);
}

export async function appendPosts (newItems) {
  if (!newItems.length) return;
  await appendNdjsonFile(postsNdjsonPath(), newItems);
  index.posts = [...newItems, ...index.posts];
  index.posts.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  index.stats = computeStats(index.generations, index.posts);
  await writeStats(index.stats);
}

export function buildGenerationEntry (gen, date) {
  const mediaInfo = getGeneratedMediaInfo(gen);
  if (!mediaInfo.length) return null;

  const step = gen.steps?.[0];
  // Civitai's generation payload changed around mid-February 2026: newer
  // entries carry `params` and `resources` under `gen.metadata`, while
  // older entries place them on `gen.steps[0]`. Read from the new location
  // first and fall back to the step so both shapes work. Newer payloads
  // also nest image size under `params.aspectRatio`; older payloads expose
  // flat `width` / `height` fields on `params`.
  const params = gen.metadata?.params || step?.params || {};
  const resource = gen.metadata?.resources?.[0] || step?.resources?.[0];
  const width = params.width || params.aspectRatio?.width || 0;
  const height = params.height || params.aspectRatio?.height || 0;

  const allTags = new Set();
  const media = mediaInfo.map(m => {
    m.tags.forEach(t => allTags.add(t));
    const isVideo = m.type === 'video' || m.mediaId.endsWith('.mp4') || m.mediaId.endsWith('.webm');
    const hasExt = m.mediaId.includes('.');
    return {
      mediaId: m.mediaId,
      seed: m.seed,
      type: isVideo ? 'video' : 'image',
      thumbnailPath: `/media/generations/${MEDIA_DIRECTORIES['all']}/${date}/${gen.id}_${m.seed}_${m.mediaId}${hasExt ? '' : '.jpeg'}`,
      tags: m.tags
    };
  });

  return {
    type: 'generation',
    id: gen.id,
    date,
    createdAt: gen.createdAt,
    tags: [...allTags],
    mediaCount: media.length,
    media,
    prompt: params.prompt || '',
    negativePrompt: params.negativePrompt || '',
    model: resource?.model?.name || '',
    params: {
      sampler: params.sampler || '',
      steps: params.steps || 0,
      cfgScale: params.cfgScale || 0,
      width,
      height
    }
  };
}

export function buildPostEntry (post, date) {
  const images = Array.isArray(post.images) ? post.images : [];

  const media = images.map((img, i) => {
    const isVideo = img.type === 'video';
    const ext = isVideo ? '.mp4' : '.jpeg';
    const paddedIndex = String(i + 1).padStart(2, '0');
    return {
      index: i + 1,
      imageId: img.id,
      type: isVideo ? 'video' : 'image',
      width: img.width || 0,
      height: img.height || 0,
      duration: img.metadata?.duration || undefined,
      meta: img.meta || null,
      thumbnailPath: `/media/posts/${date}/${post.id}/${paddedIndex}_${img.id}${ext}`
    };
  });

  return {
    type: 'post',
    id: post.id,
    date,
    publishedAt: post.publishedAt,
    title: post.title || '',
    detail: post.detail ?? null,
    tags: post.tags || [],
    url: civitaiUrl(`/posts/${post.id}`),
    stats: post.stats || {},
    imageCount: media.filter(m => m.type === 'image').length,
    videoCount: media.filter(m => m.type === 'video').length,
    media
  };
}

// --- Full scan helpers (used by fullRebuild) ---

async function scanGenerations () {
  const items = [];
  const dataDir = generationsDataDir();
  const dates = (await listDirectory(dataDir)).filter(isDate);

  for (const date of dates) {
    const files = await listDirectory(`${dataDir}/${date}`);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readFile(`${dataDir}/${date}/${file}`);
        const gen = JSON.parse(raw);
        const entry = buildGenerationEntry(gen, date);
        if (entry) items.push(entry);
      } catch { /* skip unparseable */ }
    }
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [items, null];
}

async function scanPosts () {
  const items = [];
  const dataDir = postsDataDir();
  const dates = (await listDirectory(dataDir)).filter(isDate);

  for (const date of dates) {
    const files = await listDirectory(`${dataDir}/${date}`);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readFile(`${dataDir}/${date}/${file}`);
        const post = JSON.parse(raw);
        const entry = buildPostEntry(post, date);
        if (entry) items.push(entry);
      } catch { /* skip unparseable */ }
    }
  }

  items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  return [items, null];
}

// --- Helpers ---

function earliest (a, b) {
  if (!a) return b || '';
  if (!b) return a;
  return a < b ? a : b;
}

function latest (a, b) {
  if (!a) return b || '';
  if (!b) return a;
  return a > b ? a : b;
}
