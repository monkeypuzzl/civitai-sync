/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

import path from 'node:path';
import { writeFile, readFile, fileExists, toDateString } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { downloadMediaFile } from './mediaDownload.mjs';
import { mapPool, MEDIA_POOL_WIDTH } from './requestScheduler.mjs';
import { applyStorageFault } from './downloadFault.mjs';
import { flushFetchMiss } from './fetchMiss.mjs';
import { getCivitaiImageBase } from './civitaiApi.mjs';
import { byteMissKeepsOpen, markContainerOpen, commitOpenContainer } from './downloadOpen.mjs';
import { comparableDownloadJson } from './signedUrl.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function model3dsDataDir () { return `${CONFIG.dataPath}/model3ds`; }
export function model3dsMediaDir () { return `${CONFIG.mediaPath}/model3ds`; }

function dateFolder (createdAt) {
  const date = toDateString(createdAt);
  return DATE_RE.test(date) ? date : '';
}

function numericId (id) {
  if (typeof id === 'number' && Number.isInteger(id) && id > 0) return String(id);
  if (typeof id === 'string' && /^[1-9]\d*$/.test(id)) return id;
  return '';
}

export function model3dFilepath ({ id, createdAt }) {
  const date = dateFolder(createdAt);
  const idStr = numericId(id);
  if (!date || !idStr) return '';
  return `${model3dsDataDir()}/${date}/${idStr}.json`;
}

function safeToken (value, fallback) {
  const cleaned = String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return cleaned || fallback;
}

function insideDir (dir, candidate) {
  if (!dir || !candidate) return false;
  const root = path.resolve(dir);
  const full = path.resolve(candidate);
  return full === root || full.startsWith(root + path.sep);
}

function allocateName (used, stem, ext) {
  let name = `${stem}.${ext}`;
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let n = 2;
  while (used.has(`${stem}-${n}.${ext}`)) n += 1;
  name = `${stem}-${n}.${ext}`;
  used.add(name);
  return name;
}

function fileStem (file) {
  if (file && file.isPrimary === true) return 'primary';
  return safeToken(file && file.variant, 'file');
}

function fileExt (file) {
  return safeToken(file && file.format, 'bin');
}

function thumbExtension (url) {
  const pathOnly = String(url || '').split('?')[0].toLowerCase();
  if (pathOnly.endsWith('.jpeg') || pathOnly.endsWith('.jpg')) return 'jpeg';
  if (pathOnly.endsWith('.png')) return 'png';
  return 'png';
}

function httpUrl (value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '';
}

function fileDownloadUrl (file) {
  return httpUrl(file && file.downloadUrl) || httpUrl(file && file.url);
}

function containerDir (model) {
  const date = dateFolder(model && model.createdAt);
  const idStr = numericId(model && model.id);
  if (!date || !idStr) return null;
  const dir = path.join(model3dsMediaDir(), date, idStr);
  const root = path.resolve(model3dsMediaDir());
  if (!insideDir(root, dir)) return null;
  return { date, idStr, dir };
}

function mediaUrl (date, idStr, filename) {
  return `/media/model3ds/${date}/${idStr}/${filename}`;
}

function planFiles (model, place) {
  const used = new Set();
  const planned = [];
  const files = Array.isArray(model && model.files) ? model.files : [];
  for (const file of files) {
    if (!file || typeof file !== 'object') continue;
    const filename = allocateName(used, fileStem(file), fileExt(file));
    const full = path.join(place.dir, filename);
    if (!insideDir(place.dir, full)) continue;
    planned.push({
      file,
      filename,
      full,
      localPath: mediaUrl(place.date, place.idStr, filename),
      url: fileDownloadUrl(file)
    });
  }
  return planned;
}

function persistedFile (file, localPath) {
  const out = { ...file };
  delete out.url;
  delete out.downloadUrl;
  if (localPath) out.localPath = localPath;
  else delete out.localPath;
  return out;
}

function thumbSourceUrl (image, cdnBase) {
  const raw = image && typeof image === 'object' ? image.url : '';
  if (typeof raw !== 'string' || !raw.trim()) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (UUID_RE.test(raw.trim()) && cdnBase) {
    const uuid = raw.trim();
    return `${cdnBase}/${uuid}/original=true/${uuid}.jpeg`;
  }
  return '';
}

async function downloadOne (url, full, signal, report) {
  if (!url) return false;
  if (signal && signal.aborted) return false;
  const result = await downloadMediaFile(url, full, { signal });
  if (report && applyStorageFault(report, result)) return false;
  if (result.status === 'aborted') return false;
  if (report && byteMissKeepsOpen(result)) report.incomplete = true;
  return result.status === 'published' || result.status === 'skipped' || await fileExists(full);
}

export async function saveModel3dMedia (model, { signal, secretKey } = {}) {
  const report = { filesSaved: 0, aborted: false, thumbPath: '', planned: [] };
  try {
  const place = containerDir(model);
  if (!place) return report;

  const planned = planFiles(model, place);
  let opening = null;
  const ensureOpen = () => {
    if (CONFIG.downloadMedia === false) return Promise.resolve();
    if (!opening) {
      opening = markContainerOpen(model, (doc) => commitOpenContainer(doc, 'model3ds', async (body) => {
        const filepath = model3dFilepath({ id: body.id, createdAt: body.createdAt });
        if (!filepath) return '';
        await writeFile(filepath, JSON.stringify(body, null, 2));
        return filepath;
      }));
    }
    return opening;
  };

  await mapPool(planned, MEDIA_POOL_WIDTH, async (row, _index, poolSignal) => {
    const live = poolSignal || signal;
    if (live && live.aborted) {
      report.aborted = true;
      return { stop: true };
    }
    const existed = await fileExists(row.full);
    if (!existed && row.url) {
      await ensureOpen();
      const ok = await downloadOne(row.url, row.full, live, report);
      if (report.fault === 'storage' || (live && live.aborted)) {
        report.aborted = true;
        return { stop: true };
      }
      if (ok && await fileExists(row.full)) report.filesSaved += 1;
    }
    if (await fileExists(row.full)) report.planned.push(row);
    return null;
  }, { signal });
  if (signal?.aborted) report.aborted = true;
  if (report.aborted) return report;

  const source = thumbSourceUrl(model && model.thumbnailImage, '');
  let thumbUrl = source;
  if (model && model.thumbnailImage && !/^https?:\/\//i.test(String(model.thumbnailImage.url || '')) && secretKey) {
    const cdnBase = await getCivitaiImageBase({ secretKey }).catch(() => '');
    thumbUrl = thumbSourceUrl(model.thumbnailImage, cdnBase);
  }
  if (thumbUrl && !(signal && signal.aborted)) {
    const ext = thumbExtension(thumbUrl);
    const filename = `thumb.${ext}`;
    const full = path.join(place.dir, filename);
    if (insideDir(place.dir, full)) {
      const existed = await fileExists(full);
      if (!existed) {
        await ensureOpen();
        const ok = await downloadOne(thumbUrl, full, signal, report);
        if (report.fault === 'storage') return report;
        if (ok && !existed && await fileExists(full)) report.filesSaved += 1;
      }
      if (await fileExists(full)) report.thumbPath = mediaUrl(place.date, place.idStr, filename);
    }
  }

  if (signal?.aborted) report.aborted = true;

  if (!report.thumbPath) {
    for (const ext of ['png', 'jpeg']) {
      const full = path.join(place.dir, `thumb.${ext}`);
      if (insideDir(place.dir, full) && await fileExists(full)) {
        report.thumbPath = mediaUrl(place.date, place.idStr, `thumb.${ext}`);
        break;
      }
    }
  }

  return report;
  } finally {
    await flushFetchMiss();
  }
}

function persistable (model, mediaReport) {
  const doc = { ...model };
  const byName = new Map();
  for (const row of mediaReport.planned || []) byName.set(row.filename, row.localPath);
  const place = containerDir(model);
  const planned = place ? planFiles(model, place) : [];
  doc.files = planned.map(row => persistedFile(row.file, byName.get(row.filename) || ''));
  if (mediaReport.thumbPath) doc.thumbPath = mediaReport.thumbPath;
  else delete doc.thumbPath;
  return doc;
}

export async function saveModel3d (model, {
  withImages = true,
  signal,
  secretKey
} = {}) {
  const report = {
    model3dNew: 0,
    model3dSaved: 0,
    filesSaved: 0,
    aborted: false,
    skipped: false,
    skipReason: undefined,
    error: undefined,
    savedItem: null
  };

  if (!model || model.status === 'Deleted') {
    report.skipped = true;
    report.skipReason = 'deleted';
    return report;
  }

  if (!model.createdAt) {
    report.skipped = true;
    report.skipReason = 'missing-createdAt';
    return report;
  }

  const filepath = model3dFilepath({ id: model.id, createdAt: model.createdAt });
  if (!filepath) {
    report.skipped = true;
    report.skipReason = 'missing-createdAt';
    return report;
  }

  let mediaReport = { filesSaved: 0, aborted: false, thumbPath: '', planned: [] };
  if (withImages && CONFIG.downloadMedia !== false) {
    mediaReport = await saveModel3dMedia(model, { signal, secretKey });
    report.filesSaved = mediaReport.filesSaved || 0;
    report.aborted = mediaReport.aborted === true;
    if (mediaReport.fault) report.fault = mediaReport.fault;
    if (report.fault === 'storage') return report;
  } else {
    const place = containerDir(model);
    if (place) {
      const planned = planFiles(model, place);
      const kept = [];
      for (const row of planned) {
        if (await fileExists(row.full)) kept.push(row);
      }
      mediaReport.planned = kept;
      const extCandidates = ['png', 'jpeg'];
      for (const ext of extCandidates) {
        const full = path.join(place.dir, `thumb.${ext}`);
        if (insideDir(place.dir, full) && await fileExists(full)) {
          mediaReport.thumbPath = mediaUrl(place.date, place.idStr, `thumb.${ext}`);
          break;
        }
      }
    }
  }

  let doc = model;
  if (withImages && CONFIG.downloadMedia !== false) {
    doc = { ...model };
    const stopped = mediaReport.aborted === true || mediaReport.fault === 'storage';
    if (mediaReport.incomplete === true || (stopped && model.downloadOpen === true)) doc.downloadOpen = true;
    else delete doc.downloadOpen;
  } else if (await fileExists(filepath)) {
    try {
      const prev = JSON.parse(await readFile(filepath));
      if (prev.downloadOpen === true) doc = { ...model, downloadOpen: true };
    } catch (ignoreErr) {
      doc = model;
    }
  }
  const next = persistable(doc, mediaReport);
  const text = JSON.stringify(next, null, 2);
  const exists = await fileExists(filepath);
  let changed = !exists;
  if (exists) {
    try {
      const prev = JSON.parse(await readFile(filepath));
      const contentChanged = comparableDownloadJson(prev) !== comparableDownloadJson(next);
      const markChanged = (prev.downloadOpen === true) !== (next.downloadOpen === true);
      changed = contentChanged || markChanged;
    } catch (ignoreErr) {
      changed = true;
    }
  }

  if (changed) {
    try {
      await writeFile(filepath, text);
    } catch (ignoreErr) {
      report.error = { message: 'Could not save 3D data' };
      return report;
    }
    report.model3dSaved = 1;
    if (!exists) report.model3dNew = 1;
  }

  try {
    report.savedItem = JSON.parse(await readFile(filepath));
  } catch (ignoreErr) {
    report.savedItem = next;
  }

  return report;
}
