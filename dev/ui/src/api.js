async function fetchJson (url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJson (url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function putJson (url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export function getStats () {
  return fetchJson('/api/stats');
}

export function getGenerations ({ page = 1, limit = 50, sort = 'newest', tags = '', search = '' } = {}) {
  const params = new URLSearchParams({ page, limit, sort });
  if (tags) params.set('tags', tags);
  if (search) params.set('search', search);
  return fetchJson(`/api/generations?${params}`);
}

export function getGeneration (id) {
  return fetchJson(`/api/generations/${encodeURIComponent(id)}`);
}

export function getPosts ({ page = 1, limit = 50, sort = 'newest', tags = '', search = '' } = {}) {
  const params = new URLSearchParams({ page, limit, sort });
  if (tags) params.set('tags', tags);
  if (search) params.set('search', search);
  return fetchJson(`/api/posts?${params}`);
}

export function getPost (id) {
  return fetchJson(`/api/posts/${id}`);
}

export function getConfig () {
  return fetchJson('/api/config');
}

export function updateConfig (updates) {
  return putJson('/api/config', updates);
}

export function getDownloadStatus () {
  return fetchJson('/api/download/status');
}

export function startDownload (type, mode) {
  return postJson(`/api/download/${type}`, { mode });
}

export function abortDownload () {
  return postJson('/api/download/abort', {});
}

export function rebuildIndex () {
  return postJson('/api/index/rebuild', {});
}

export function getTimelineMonths () {
  return fetchJson('/api/timeline/months');
}

export function getTimelineMonth (monthKey) {
  return fetchJson(`/api/timeline/${monthKey}`);
}

export function unlockKey (password) {
  return postJson('/api/unlock', { password });
}

export function refreshUser () {
  return postJson('/api/user/refresh', {});
}

export function openFolder (mediaPath) {
  return postJson('/api/open-folder', { path: mediaPath });
}

export function connectProgress (onEvent) {
  let es = null;
  let timer = null;
  let closed = false;
  let retries = 0;

  function connect () {
    if (closed) return;
    es = new EventSource('/api/download/progress');
    es.onmessage = (e) => {
      retries = 0;
      try { onEvent(JSON.parse(e.data)); } catch {}
    };
    es.onerror = () => {
      es.close();
      es = null;
      if (closed) return;
      retries++;
      const delay = Math.min(30000, 3000 * Math.pow(2, retries - 1));
      timer = setTimeout(connect, delay);
    };
  }

  connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    if (es) es.close();
  };
}
