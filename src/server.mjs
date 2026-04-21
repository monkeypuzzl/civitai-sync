import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG, CURRENT_VERSION } from './cli.mjs';
import { getIndex, buildIndex, rebuildIndex } from './serverIndex.mjs';
import { generationsDataDir, generationsMediaDir } from './generations.mjs';
import { postsMediaDir, postsDataDir } from './posts.mjs';
import { readFile } from './utils.mjs';
import { setConfig, setConfigParam } from './config.mjs';
import { fetchGenerations } from './downloadActions.mjs';
import { fetchPosts } from './downloadPostsActions.mjs';
import { exec } from 'node:child_process';
import os from 'node:os';
import { decryptAES } from './crypto.mjs';
import { fillIfMissing, refreshOnce } from './userData.mjs';
import { getAvailableSecretKey, setMemoizedSecretKey } from './keyActions.mjs';
import { CIVITAI_DOMAINS, getCivitaiDomain } from './civitaiDomain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.resolve(__dirname, 'ui');
const DEFAULT_PORT = 3456;

// --- Download Manager ---

const downloadState = {
  active: false,
  type: null,
  mode: null,
  abortController: null,
  progress: null,
  startedAt: null
};

const sseClients = new Set();

export function closeSSEClients () {
  for (const res of sseClients) {
    try { res.end(); } catch { /* already closed */ }
  }
  sseClients.clear();
}

function broadcastSSE (data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

const NETWORK_ERROR_CODES = ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'FETCH_ERROR'];

function friendlyErrorMessage (errors) {
  if (!errors || !errors.length) return 'Unknown error';
  const first = errors[0];
  const msg = first?.message || first?.json?.message || first?.error || String(first);
  const code = first?.code || first?.cause?.code || '';
  if (NETWORK_ERROR_CODES.includes(code) || /fetch failed|network|ECONNR|ETIMEDOUT/i.test(msg)) {
    return 'Civitai service is unavailable. Try again shortly.';
  }
  if (/UNAUTHORIZED/i.test(msg) || /UNAUTHORIZED/i.test(code)) {
    return 'API key is invalid or expired. Update your API key.';
  }
  return msg || 'Unknown error';
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

async function startDownloadGenerations (mode) {
  if (downloadState.active) return { error: 'A download is already in progress' };

  const secretKey = getAvailableSecretKey();
  if (!secretKey) return { error: 'API key not available. If encrypted, unlock via CLI first.' };

  const tags = [];
  if (CONFIG.excludeImages && !CONFIG.generationDataTypes.includes('all')) {
    tags.push(...CONFIG.generationDataTypes);
  } else if (!CONFIG.excludeImages && (mode === 'missing-tags' || !CONFIG.generationMediaTypes.includes('all'))) {
    tags.push(...CONFIG.generationMediaTypes.filter(t => t !== 'all'));
  }

  downloadState.active = true;
  downloadState.type = 'generations';
  downloadState.mode = mode;
  downloadState.abortController = new AbortController();
  downloadState.startedAt = Date.now();
  downloadState.progress = null;

  broadcastSSE({ type: 'generations', status: 'downloading', mode });

  fetchGenerations({
    secretKey,
    overwriteIfModified: true,
    withImages: !CONFIG.excludeImages,
    tags,
    latest: mode === 'latest',
    oldest: mode === 'oldest',
    resume: mode === 'missing-tags' || mode === 'missing-all',
    log: () => {},
    onProgress: (report) => {
      downloadState.progress = report;
      broadcastSSE({
        type: 'generations',
        status: report.aborted ? 'aborted' : report.complete ? 'complete' : 'downloading',
        generationsNew: report.generationsNew || 0,
        imagesSaved: report.imagesSaved || 0,
        videosSaved: report.videosSaved || 0,
        batchDate: report.batchDate || '',
        activity: report.activity || null,
        elapsed: Date.now() - downloadState.startedAt,
        errors: (report.errors || []).length
      });
    },
    signal: downloadState.abortController.signal
  }).then(async (report) => {
    const status = report?.aborted ? 'aborted' : (report?.errors?.length && !report?.generationsNew) ? 'error' : 'complete';
    broadcastSSE({
      type: 'generations',
      status,
      message: status === 'error' ? friendlyErrorMessage(report?.errors) : undefined,
      generationsNew: report?.generationsNew || 0,
      imagesSaved: report?.imagesSaved || 0,
      videosSaved: report?.videosSaved || 0,
      elapsed: Date.now() - downloadState.startedAt,
      errors: (report?.errors || []).length,
      final: true
    });
    downloadState.active = false;
    if (status === 'complete' || status === 'aborted') {
      rebuildIndex().catch(() => {});
    }
  }).catch((err) => {
    broadcastSSE({ type: 'generations', status: 'error', message: friendlyErrorMessage([err]), final: true });
    downloadState.active = false;
  });

  return { ok: true, type: 'generations', mode };
}

async function startDownloadPosts (mode) {
  if (downloadState.active) return { error: 'A download is already in progress' };

  const secretKey = getAvailableSecretKey();
  if (!secretKey) return { error: 'API key not available. If encrypted, unlock via CLI first.' };

  const username = await resolveUsername(secretKey);
  if (username && typeof username === 'object' && username.error) {
    return { error: `Civitai service unavailable. Try again shortly. (${username.error})` };
  }
  if (!username) return { error: 'Could not resolve username. Check your API key.' };

  downloadState.active = true;
  downloadState.type = 'posts';
  downloadState.mode = mode;
  downloadState.abortController = new AbortController();
  downloadState.startedAt = Date.now();
  downloadState.progress = null;

  broadcastSSE({ type: 'posts', status: 'downloading', mode });

  fetchPosts({
    secretKey,
    username,
    latest: mode === 'latest',
    withImages: !CONFIG.excludeImages,
    log: () => {},
    onProgress: (report) => {
      downloadState.progress = report;
      broadcastSSE({
        type: 'posts',
        status: report.aborted ? 'aborted' : report.complete ? 'complete' : 'downloading',
        postsNew: report.postsNew || 0,
        imagesSaved: report.imagesSaved || 0,
        videosSaved: report.videosSaved || 0,
        batchDate: report.batchDate || '',
        activity: report.activity || null,
        elapsed: Date.now() - downloadState.startedAt,
        errors: (report.errors || []).length
      });
    },
    signal: downloadState.abortController.signal
  }).then(async (report) => {
    const status = report?.aborted ? 'aborted' : (report?.errors?.length && !report?.postsNew) ? 'error' : 'complete';
    broadcastSSE({
      type: 'posts',
      status,
      message: status === 'error' ? friendlyErrorMessage(report?.errors) : undefined,
      postsNew: report?.postsNew || 0,
      imagesSaved: report?.imagesSaved || 0,
      videosSaved: report?.videosSaved || 0,
      elapsed: Date.now() - downloadState.startedAt,
      errors: (report?.errors || []).length,
      final: true
    });
    downloadState.active = false;
    if (status === 'complete' || status === 'aborted') {
      rebuildIndex().catch(() => {});
    }
  }).catch((err) => {
    broadcastSSE({ type: 'posts', status: 'error', message: friendlyErrorMessage([err]), final: true });
    downloadState.active = false;
  });

  return { ok: true, type: 'posts', mode };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function backfillDownloadTimestamps () {
  const index = getIndex();
  if (!CONFIG.lastDownloadGenerations && index.generations.length > 0) {
    try {
      const dir = generationsDataDir();
      const stat = fs.statSync(dir);
      await setConfigParam('lastDownloadGenerations', stat.mtime.toISOString());
    } catch { /* ignore missing dir */ }
  }
  if (!CONFIG.lastDownloadPosts && index.posts.length > 0) {
    try {
      const dir = postsDataDir();
      const stat = fs.statSync(dir);
      await setConfigParam('lastDownloadPosts', stat.mtime.toISOString());
    } catch { /* ignore missing dir */ }
  }
}

export async function startServer ({ port = DEFAULT_PORT, host = '127.0.0.1' } = {}) {
  await buildIndex();
  await backfillDownloadTimestamps();

  return new Promise((resolve, reject) => {
    const server = http.createServer(handleRequest);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < DEFAULT_PORT + 10) {
        resolve(startServer({ port: port + 1, host }));
      } else {
        reject(err);
      }
    });

    server.listen(port, host, () => {
      resolve({ server, port, host });
    });
  });
}

async function handleRequest (req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname, url);
    }

    if (pathname.startsWith('/media/')) {
      return await serveMedia(res, pathname);
    }

    return await serveStatic(res, pathname);
  } catch (err) {
    sendError(res, 500, err.message);
  }
}

// --- API ---

async function handleApi (req, res, pathname, url) {
  const index = getIndex();

  if (pathname === '/api/stats' && req.method === 'GET') {
    return sendJson(res, index.stats);
  }

  if (pathname === '/api/generations' && req.method === 'GET') {
    return handlePaginated(res, url, index.generations, 'prompt');
  }

  if (pathname === '/api/posts' && req.method === 'GET') {
    return handlePaginated(res, url, index.posts, 'title');
  }

  const genMatch = pathname.match(/^\/api\/generations\/(.+)$/);
  if (genMatch && req.method === 'GET') {
    return await handleGenerationDetail(res, genMatch[1]);
  }

  const postMatch = pathname.match(/^\/api\/posts\/(\d+)$/);
  if (postMatch && req.method === 'GET') {
    return await handlePostDetail(res, postMatch[1]);
  }

  if (pathname === '/api/timeline/months' && req.method === 'GET') {
    return handleTimelineMonths(res, index);
  }

  const timelineMonthMatch = pathname.match(/^\/api\/timeline\/(\d{4}-\d{2})$/);
  if (timelineMonthMatch && req.method === 'GET') {
    return handleTimelineMonth(res, index, timelineMonthMatch[1]);
  }

  if (pathname === '/api/index/rebuild' && req.method === 'POST') {
    await rebuildIndex();
    return sendJson(res, { ok: true });
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    return sendJson(res, {
      hasKey: !!CONFIG.secretKey,
      keyEncrypted: !!CONFIG.keyEncrypt,
      keyUnlocked: CONFIG.keyEncrypt ? !!getAvailableSecretKey() : true,
      username: CONFIG.username || '',
      dataPath: CONFIG.dataPath,
      mediaPath: CONFIG.mediaPath,
      generationMediaTypes: CONFIG.generationMediaTypes,
      generationDataTypes: CONFIG.generationDataTypes,
      excludeImages: CONFIG.excludeImages,
      version: CURRENT_VERSION || '',
      lastDownloadGenerations: CONFIG.lastDownloadGenerations || null,
      lastDownloadPosts: CONFIG.lastDownloadPosts || null,
      domain: getCivitaiDomain(),
      allowAltDomain: CONFIG.allowAltDomain === true,
      availableDomains: CIVITAI_DOMAINS
    });
  }

  if (pathname === '/api/config' && req.method === 'PUT') {
    return await handleConfigUpdate(req, res);
  }

  if (pathname === '/api/user/refresh' && req.method === 'POST') {
    const secretKey = getAvailableSecretKey();
    if (!secretKey) {
      return sendJson(res, { ok: false, error: 'API key not available' }, 400);
    }
    // refreshOnce dedups concurrent callers and enforces once-per-process.
    await refreshOnce({ secretKey }).catch(() => {});
    return sendJson(res, {
      ok: true,
      username: CONFIG.username || '',
      allowAltDomain: CONFIG.allowAltDomain === true,
      domain: getCivitaiDomain()
    });
  }

  if (pathname === '/api/unlock' && req.method === 'POST') {
    if (!CONFIG.keyEncrypt) {
      return sendJson(res, { ok: true, message: 'Key is not encrypted' });
    }
    const body = await readBody(req);
    const password = body.password;
    if (!password) {
      return sendJson(res, { ok: false, error: 'Password required' }, 400);
    }
    try {
      const decrypted = decryptAES(CONFIG.secretKey, password);
      if (!decrypted) {
        return sendJson(res, { ok: false, error: 'Wrong password' }, 401);
      }
      // Store in the shared in-memory memo so CLI and Explorer share the
      // unlocked state for the remainder of the process.
      setMemoizedSecretKey(decrypted);
      return sendJson(res, { ok: true });
    } catch {
      return sendJson(res, { ok: false, error: 'Wrong password' }, 401);
    }
  }

  if (pathname === '/api/download/generations' && req.method === 'POST') {
    const body = await readBody(req);
    const mode = body.mode || 'latest';
    const result = await startDownloadGenerations(mode);
    return sendJson(res, result, result.error ? 400 : 202);
  }

  if (pathname === '/api/download/posts' && req.method === 'POST') {
    const body = await readBody(req);
    const mode = body.mode || 'latest';
    const result = await startDownloadPosts(mode);
    return sendJson(res, result, result.error ? 400 : 202);
  }

  if (pathname === '/api/download/abort' && req.method === 'POST') {
    if (downloadState.active && downloadState.abortController) {
      downloadState.abortController.abort();
      return sendJson(res, { ok: true });
    }
    return sendJson(res, { ok: false, message: 'No active download' });
  }

  if (pathname === '/api/download/status' && req.method === 'GET') {
    return sendJson(res, {
      active: downloadState.active,
      type: downloadState.type,
      mode: downloadState.mode,
      elapsed: downloadState.startedAt ? Date.now() - downloadState.startedAt : 0,
      progress: downloadState.progress
    });
  }

  if (pathname === '/api/download/progress' && req.method === 'GET') {
    return handleSSE(req, res);
  }

  if (pathname === '/api/open-folder' && req.method === 'POST') {
    const body = await readBody(req);
    const mediaPath = body.path;
    if (!mediaPath || typeof mediaPath !== 'string') {
      return sendJson(res, { ok: false, error: 'Path required' }, 400);
    }
    let folderPath;
    if (mediaPath.startsWith('/media/generations/')) {
      const rel = mediaPath.slice('/media/generations/'.length);
      folderPath = path.dirname(path.join(generationsMediaDir(), rel));
    } else if (mediaPath.startsWith('/media/posts/')) {
      const rel = mediaPath.slice('/media/posts/'.length);
      folderPath = path.dirname(path.join(postsMediaDir(), rel));
    } else {
      return sendJson(res, { ok: false, error: 'Invalid path' }, 400);
    }
    const plat = os.platform();
    const openCmd = plat === 'win32' ? 'explorer' : plat === 'darwin' ? 'open' : 'xdg-open';
    exec(`${openCmd} "${folderPath}"`, () => {});
    return sendJson(res, { ok: true });
  }

  sendError(res, 404, 'Not found');
}

function handlePaginated (res, url, items, searchField) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const sort = url.searchParams.get('sort') || 'newest';
  const tagsParam = url.searchParams.get('tags') || '';
  const search = (url.searchParams.get('search') || '').toLowerCase();

  let filtered = items;

  if (tagsParam) {
    const requiredTags = tagsParam.split(',').map(t => t.trim()).filter(Boolean);
    filtered = filtered.filter(item => {
      const itemTags = Array.isArray(item.tags)
        ? item.tags.map(t => typeof t === 'string' ? t : t.name)
        : [];
      return requiredTags.some(rt => itemTags.includes(rt));
    });
  }

  if (search) {
    filtered = filtered.filter(item => {
      const text = (item[searchField] || '').toLowerCase();
      if (text.includes(search)) return true;
      if (Array.isArray(item.tags)) {
        return item.tags.some(t => {
          const name = typeof t === 'string' ? t : t.name || '';
          return name.toLowerCase().includes(search);
        });
      }
      return false;
    });
  }

  if (sort === 'oldest') {
    filtered = [...filtered].reverse();
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const pageItems = filtered.slice(start, start + limit);

  sendJson(res, { items: pageItems, total, page, limit, totalPages });
}

async function handleGenerationDetail (res, id) {
  const index = getIndex();
  const item = index.generations.find(g => g.id === id);

  if (!item) {
    return sendError(res, 404, 'Generation not found');
  }

  try {
    const filepath = `${generationsDataDir()}/${item.date}/${id}.json`;
    const raw = await readFile(filepath);
    const full = JSON.parse(raw);
    sendJson(res, { index: item, raw: full });
  } catch {
    sendJson(res, { index: item, raw: null });
  }
}

async function handlePostDetail (res, idStr) {
  const id = parseInt(idStr, 10);
  const index = getIndex();
  const item = index.posts.find(p => p.id === id);

  if (!item) {
    return sendError(res, 404, 'Post not found');
  }

  try {
    const filepath = `${CONFIG.dataPath}/posts/${item.date}/${id}.json`;
    const raw = await readFile(filepath);
    const full = JSON.parse(raw);
    sendJson(res, { index: item, raw: full });
  } catch {
    sendJson(res, { index: item, raw: null });
  }
}

// --- Timeline ---

function handleTimelineMonths (res, index) {
  const map = new Map();

  for (const g of index.generations) {
    const mk = (g.createdAt || '').slice(0, 7);
    if (!mk) continue;
    if (!map.has(mk)) map.set(mk, { month: mk, genCount: 0, postCount: 0 });
    map.get(mk).genCount++;
  }

  for (const p of index.posts) {
    const mk = (p.publishedAt || '').slice(0, 7);
    if (!mk) continue;
    if (!map.has(mk)) map.set(mk, { month: mk, genCount: 0, postCount: 0 });
    map.get(mk).postCount++;
  }

  const months = [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  sendJson(res, { months });
}

function handleTimelineMonth (res, index, monthKey) {
  const items = [];

  for (const g of index.generations) {
    if ((g.createdAt || '').startsWith(monthKey)) {
      items.push({ ...g, _source: 'generation', _sortDate: g.createdAt });
    }
  }

  for (const p of index.posts) {
    if ((p.publishedAt || '').startsWith(monthKey)) {
      items.push({ ...p, _source: 'post', _sortDate: p.publishedAt });
    }
  }

  items.sort((a, b) => b._sortDate.localeCompare(a._sortDate));
  sendJson(res, { month: monthKey, items });
}

// --- Media ---

async function serveMedia (res, pathname) {
  let filepath;

  if (pathname.startsWith('/media/generations/')) {
    const rel = pathname.slice('/media/generations/'.length);
    filepath = path.join(generationsMediaDir(), rel);
  } else if (pathname.startsWith('/media/posts/')) {
    const rel = pathname.slice('/media/posts/'.length);
    filepath = path.join(postsMediaDir(), rel);
  } else {
    return sendError(res, 404, 'Not found');
  }

  return serveFile(res, filepath);
}

// --- Static ---

async function serveStatic (res, pathname) {
  let filepath;

  if (pathname === '/' || pathname === '/index.html') {
    filepath = path.join(UI_DIR, 'index.html');
  } else {
    filepath = path.join(UI_DIR, pathname);
  }

  const resolved = path.resolve(filepath);
  if (!resolved.startsWith(path.resolve(UI_DIR))) {
    return sendError(res, 403, 'Forbidden');
  }

  // SPA fallback: if file doesn't exist and it's not a file extension request,
  // serve index.html for client-side routing
  try {
    await fs.promises.access(resolved, fs.constants.R_OK);
  } catch {
    if (!path.extname(pathname)) {
      return serveFile(res, path.join(UI_DIR, 'index.html'));
    }
    return sendError(res, 404, 'Not found');
  }

  return serveFile(res, resolved);
}

function serveFile (res, filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  return new Promise((resolve) => {
    const stream = fs.createReadStream(filepath);

    stream.on('error', (err) => {
      if (err.code === 'ENOENT') {
        sendError(res, 404, 'Not found');
      } else {
        sendError(res, 500, err.message);
      }
      resolve();
    });

    stream.on('open', () => {
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache'
      });
      stream.pipe(res);
    });

    stream.on('end', resolve);
  });
}

// --- Config Update ---

const CONFIG_WHITELIST = ['generationMediaTypes', 'generationDataTypes', 'excludeImages', 'dataPath', 'mediaPath', 'domain'];

async function handleConfigUpdate (req, res) {
  const body = await readBody(req);
  const updates = {};

  for (const key of CONFIG_WHITELIST) {
    if (key in body) updates[key] = body[key];
  }

  // Validate domain against the allow-list. Reject rather than silently
  // correct so clients notice misconfiguration.
  if ('domain' in updates && !CIVITAI_DOMAINS.includes(updates.domain)) {
    return sendError(res, 400, `Invalid domain. Allowed: ${CIVITAI_DOMAINS.join(', ')}`);
  }

  if (!Object.keys(updates).length) {
    return sendError(res, 400, 'No valid fields to update');
  }

  await setConfig(updates);
  return sendJson(res, { ok: true, updated: Object.keys(updates) });
}

// --- SSE ---

function handleSSE (req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', active: downloadState.active, downloadType: downloadState.type })}\n\n`);
  sseClients.add(res);

  req.on('close', () => { sseClients.delete(res); });
}

// --- Helpers ---

function readBody (req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

function sendJson (res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(body);
}

function sendError (res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: message }));
}
