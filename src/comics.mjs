/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

import { writeFile, readFile, fileExists, toDateString } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { getCivitaiImageBase } from './civitaiApi.mjs';
import { downloadMediaFile } from './mediaDownload.mjs';
import { mapPool, MEDIA_POOL_WIDTH } from './requestScheduler.mjs';
import { applyStorageFault } from './downloadFault.mjs';
import { flushFetchMiss } from './fetchMiss.mjs';
import { byteMissKeepsOpen, markContainerOpen, commitOpenContainer } from './downloadOpen.mjs';
import { comparableDownloadJson, sameResourceUrl, resourceIdentity } from './signedUrl.mjs';
import { extractInputDescriptors, saveInputMedia } from './inputMedia.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import { joinPostedFileIfHashed } from './contentHashBackfill.mjs';
import { collectGenerationSourceUpdates } from './posts.mjs';
import { WIRE, browsingLevelOf } from './civitaiWire.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function comicsDataDir () { return `${CONFIG.dataPath}/comics`; }
export function comicsMediaDir () { return `${CONFIG.mediaPath}/comics`; }

function pad2 (n) {
  return String(n).padStart(2, '0');
}

export function comicFilepath ({ id, createdAt }) {
  if (!createdAt) return '';
  return `${comicsDataDir()}/${toDateString(createdAt)}/${id}.json`;
}

export function panelMediaId (panel) {
  return panel.imageId != null ? normalizeMediaId(panel.imageId) : `comic-panel:${panel.id}`;
}

export function comicPanelFilepath ({ comicId, createdAt, chapterPosition, chapterId, panelPosition, panelMediaId: mediaId }) {
  const chapterFolder = `${pad2(chapterPosition)}_${chapterId}`;
  const filename = `${pad2(panelPosition)}_${mediaId}.jpeg`;
  return `${comicsMediaDir()}/${toDateString(createdAt)}/${comicId}/${chapterFolder}/${filename}`;
}

export function comicCoverFilepath ({ comicId, createdAt, imageId }) {
  return `${comicsMediaDir()}/${toDateString(createdAt)}/${comicId}/cover_${imageId}.jpeg`;
}

export function comicHeroFilepath ({ comicId, createdAt, imageId }) {
  return `${comicsMediaDir()}/${toDateString(createdAt)}/${comicId}/hero_${imageId}.jpeg`;
}

function isAbsoluteHttpUrl (value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isCloudflareUuid (value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

// Clone of posts `buildPostImageUrl` for a UUID with no filename: original=true.
function buildComicCdnUrl (cdnBase, uuidOrUrl) {
  if (isAbsoluteHttpUrl(uuidOrUrl)) return uuidOrUrl;
  if (isCloudflareUuid(uuidOrUrl)) {
    const uuid = uuidOrUrl.trim();
    return `${cdnBase}/${uuid}/original=true/${uuid}.jpeg`;
  }
  return null;
}

function usableImageUrl (imageUrl) {
  return isAbsoluteHttpUrl(imageUrl) || isCloudflareUuid(imageUrl);
}

export function comicMediaTargets (comic, cdnBase) {
  if (!comic?.createdAt || comic.id == null) return [];
  const out = [];
  const { id: comicId, createdAt } = comic;

  const cover = comic.coverImage;
  const coverId = cover?.id ?? comic.coverImageId;
  if (coverId != null && usableImageUrl(cover?.url)) {
    const url = buildComicCdnUrl(cdnBase, cover.url);
    if (url) out.push({ url, filepath: comicCoverFilepath({ comicId, createdAt, imageId: coverId }) });
  }

  const hero = comic.heroImage;
  const heroId = hero?.id ?? comic.heroImageId;
  if (heroId != null && usableImageUrl(hero?.url)) {
    const url = buildComicCdnUrl(cdnBase, hero.url);
    if (url) out.push({ url, filepath: comicHeroFilepath({ comicId, createdAt, imageId: heroId }) });
  }

  for (const chapter of (Array.isArray(comic.chapters) ? comic.chapters : [])) {
    if (!chapter) continue;
    for (const panel of (Array.isArray(chapter.panels) ? chapter.panels : [])) {
      if (!isReadyPanel(panel)) continue;
      const url = buildComicCdnUrl(cdnBase, panel.imageUrl);
      if (!url) continue;
      out.push({
        url,
        filepath: comicPanelFilepath({
          comicId,
          createdAt,
          chapterPosition: chapter.position,
          chapterId: chapter.id,
          panelPosition: panel.position,
          panelMediaId: panelMediaId(panel)
        })
      });
    }
  }
  return out;
}

function isReadyPanel (panel) {
  return Boolean(panel && panel.status === 'Ready' && usableImageUrl(panel.imageUrl));
}

function chapterSummary (chapters) {
  const list = Array.isArray(chapters) ? chapters : [];
  return list
    .filter(ch => ch && ch.position != null)
    .map(ch => ({
      id: ch.id,
      position: ch.position,
      status: ch.status,
      panelCount: ch.panelCount
    }))
    .sort((a, b) => a.position - b.position);
}

// True when the shell's chapter list is not the saved summary. A missing
// panelCount cannot prove the chapters are current.
export function comicNeedsChapters (shell, saved) {
  if (!saved) return true;
  const savedChapters = Array.isArray(saved.chapters) ? saved.chapters : [];
  if (savedChapters.some(ch => ch && ch.panelCount == null)) return true;
  const shellChapters = Array.isArray(shell && shell.chapters) ? shell.chapters : [];
  return JSON.stringify(chapterSummary(savedChapters)) !== JSON.stringify(chapterSummary(shellChapters));
}

// Project fields the list shell can show without opening chapters.
export function applyComicShell (saved, shell) {
  const next = { ...(saved || {}) };
  const source = shell && typeof shell === 'object' ? shell : {};
  if ('name' in source) next.name = source.name;
  if ('description' in source) next.description = source.description;
  if ('genre' in source) next.genre = source.genre;
  if ('coverImage' in source) next.coverImage = source.coverImage;
  if ('coverImageId' in source) next.coverImageId = source.coverImageId;
  if ('heroImage' in source) next.heroImage = source.heroImage;
  if ('heroImageId' in source) next.heroImageId = source.heroImageId;
  if ('references' in source) next.references = source.references;
  const level = browsingLevelOf(source);
  if (level !== undefined) next[WIRE.browsingLevel] = level;
  if (saved && 'chapters' in saved) next.chapters = saved.chapters;
  if (saved && 'deletedPanels' in saved) next.deletedPanels = saved.deletedPanels;
  if (saved && 'deletedChapters' in saved) next.deletedChapters = saved.deletedChapters;
  return next;
}

function chromeKey (image, id) {
  const raw = image && image.url != null ? image.url : null;
  return JSON.stringify({
    id: image && image.id != null ? image.id : (id ?? null),
    url: typeof raw === 'string' ? resourceIdentity(raw) : raw
  });
}

function referenceIds (comic) {
  const refs = Array.isArray(comic && comic.references) ? comic.references : [];
  return refs.map(ref => ref && ref.id).filter(id => id != null).sort();
}

export function mergeComic (shell, chapters) {
  const rest = { ...shell };
  delete rest.chapters;
  const byPos = new Map();
  for (const ch of (Array.isArray(shell?.chapters) ? shell.chapters : [])) {
    if (ch && ch.position != null) byPos.set(ch.position, ch);
  }
  const stamped = (Array.isArray(chapters) ? chapters : []).map(ch => {
    if (!ch || typeof ch !== 'object') return ch;
    const fromShell = byPos.get(ch.position);
    let panelCount = fromShell && typeof fromShell.panelCount === 'number'
      ? fromShell.panelCount
      : ch.panelCount;
    if (typeof panelCount !== 'number' && Array.isArray(ch.panels)) panelCount = ch.panels.length;
    if (typeof panelCount !== 'number') return ch;
    return { ...ch, panelCount };
  });
  return { ...rest, chapters: stamped };
}

// Latest-state merge: chapters[] is the fresh walk. Deleted chapters/panels
// are recorded; files are never unlinked. Idempotent on id.
export function reconcileComic (savedJson, freshComic) {
  const next = { ...savedJson, ...freshComic };
  next.chapters = Array.isArray(freshComic.chapters) ? freshComic.chapters : [];

  const deletedChaptersById = new Map();
  for (const entry of (Array.isArray(savedJson.deletedChapters) ? savedJson.deletedChapters : [])) {
    if (entry && entry.id != null) deletedChaptersById.set(entry.id, entry);
  }

  const deletedPanelsById = new Map();
  for (const entry of (Array.isArray(savedJson.deletedPanels) ? savedJson.deletedPanels : [])) {
    if (entry && entry.id != null) deletedPanelsById.set(entry.id, entry);
  }

  const freshChapterIds = new Set(next.chapters.map(ch => ch && ch.id).filter(id => id != null));
  const freshPanelsByChapter = new Map();
  for (const ch of next.chapters) {
    if (!ch || ch.id == null) continue;
    const ids = new Set((Array.isArray(ch.panels) ? ch.panels : []).map(p => p && p.id).filter(id => id != null));
    freshPanelsByChapter.set(ch.id, ids);
  }

  const removedAt = new Date().toISOString();
  const savedChapters = Array.isArray(savedJson.chapters) ? savedJson.chapters : [];

  for (const ch of savedChapters) {
    if (!ch || ch.id == null) continue;
    const chapterGone = !freshChapterIds.has(ch.id);

    if (chapterGone && !deletedChaptersById.has(ch.id)) {
      deletedChaptersById.set(ch.id, { id: ch.id, removedAt });
    }

    const freshPanelIds = chapterGone ? new Set() : (freshPanelsByChapter.get(ch.id) || new Set());
    for (const panel of (Array.isArray(ch.panels) ? ch.panels : [])) {
      const id = panel && panel.id;
      if (id == null) continue;
      if (!freshPanelIds.has(id) && !deletedPanelsById.has(id)) {
        deletedPanelsById.set(id, { id, chapterId: ch.id, removedAt });
      }
    }
  }

  if (deletedChaptersById.size) next.deletedChapters = [...deletedChaptersById.values()];
  if (deletedPanelsById.size) next.deletedPanels = [...deletedPanelsById.values()];

  next.chapters = preserveComicPanelSources(
    Array.isArray(freshComic.chapters) ? freshComic.chapters : [],
    Array.isArray(savedJson.chapters) ? savedJson.chapters : []
  );

  return next;
}

function preserveComicPanelSources (freshChapters, savedChapters) {
  const savedById = new Map();
  for (const ch of savedChapters) {
    for (const panel of (Array.isArray(ch?.panels) ? ch.panels : [])) {
      if (panel && panel.id != null) savedById.set(panel.id, panel);
    }
  }
  let any = false;
  const chapters = freshChapters.map(ch => {
    if (!ch || !Array.isArray(ch.panels)) return ch;
    let panelChanged = false;
    const panels = ch.panels.map(panel => {
      const merged = mergePanelSources(panel, savedById.get(panel?.id));
      if (merged !== panel) panelChanged = true;
      return merged;
    });
    if (!panelChanged) return ch;
    any = true;
    return { ...ch, panels };
  });
  return any ? chapters : freshChapters;
}

function mergePanelSources (fresh, saved) {
  if (!fresh || !saved) return fresh;
  const savedImage = saved.image && typeof saved.image === 'object' ? saved.image : null;
  if (!savedImage) return fresh;
  const freshImage = fresh.image && typeof fresh.image === 'object' ? fresh.image : null;
  const patch = {};
  if (savedImage.workflowSourcesCaptured === true && freshImage?.workflowSourcesCaptured !== true) {
    patch.workflowSourcesCaptured = true;
  }
  if (savedImage.imageResourcesCaptured === true && freshImage?.imageResourcesCaptured !== true) {
    patch.imageResourcesCaptured = true;
  }
  if (savedImage.process != null && freshImage?.process == null) patch.process = savedImage.process;
  if (savedImage.techniques != null && freshImage?.techniques == null) patch.techniques = savedImage.techniques;
  if (savedImage.imageResources != null && freshImage?.imageResources == null) {
    patch.imageResources = savedImage.imageResources;
  }
  if (savedImage.generationDataCaptured === true && freshImage?.generationDataCaptured !== true) {
    patch.generationDataCaptured = true;
  }
  if (savedImage.generationData != null && freshImage?.generationData == null) {
    patch.generationData = savedImage.generationData;
  }
  if (savedImage.meta && !(freshImage && freshImage.meta)) patch.meta = savedImage.meta;
  if (('hasMeta' in savedImage) && !(freshImage && ('hasMeta' in freshImage))) patch.hasMeta = savedImage.hasMeta;
  if (!Object.keys(patch).length) return fresh;
  return { ...fresh, image: { ...(freshImage || {}), ...patch } };
}

export async function saveComicData (comic) {
  const { id, createdAt } = comic;
  if (!createdAt) return '';
  const filepath = comicFilepath({ id, createdAt });

  try {
    await writeFile(filepath, JSON.stringify(comic, null, 2));
    return filepath;
  } catch (error) {
    console.error(error);
    return '';
  }
}

function referenceImagesForExtractor (reference, cdnBase) {
  const images = Array.isArray(reference?.images) ? reference.images : [];
  return images.map((img) => {
    const raw = img?.image?.url ?? img?.url;
    const url = buildComicCdnUrl(cdnBase, raw);
    if (!url) return null;
    return {
      url,
      width: img?.image?.width ?? img?.width ?? 0,
      height: img?.image?.height ?? img?.height ?? 0
    };
  }).filter(Boolean);
}

async function saveComicReferences (comic, cdnBase, { signal, onProgress, recall = 'download' } = {}) {
  const descriptors = [];
  for (const reference of (Array.isArray(comic.references) ? comic.references : [])) {
    const images = referenceImagesForExtractor(reference, cdnBase);
    if (!images.length) continue;
    // extractInputDescriptors only walks `images[].url` (http). Nested
    // `image.url` UUIDs on the comics wire are rewritten to CDN URLs first.
    descriptors.push(...extractInputDescriptors({ images }, 'comic-reference'));
  }
  if (!descriptors.length) return null;
  return saveInputMedia(descriptors, { signal, onProgress, recall });
}

function panelImageUrls (comic) {
  const map = new Map();
  for (const chapter of (Array.isArray(comic?.chapters) ? comic.chapters : [])) {
    for (const panel of (Array.isArray(chapter?.panels) ? chapter.panels : [])) {
      if (panel && panel.id != null && typeof panel.imageUrl === 'string') {
        map.set(panel.id, panel.imageUrl);
      }
    }
  }
  return map;
}

export async function saveComicMedia (comic, { signal, secretKey, onProgress, previousPanelUrls } = {}) {
  const report = { imagesSaved: 0, error: undefined, aborted: false };
  try {
  const { id: comicId, createdAt } = comic;

  if (!createdAt) return report;

  const cdnBase = await getCivitaiImageBase({ secretKey });

  // 'stop' ends the comic walk (user abort). 'ready' means the final file is
  // present (just published, or already there). 'next' is a miss: no file,
  // and the rest of the comic still downloads.
  let opening = null;
  const ensureOpen = () => {
    if (CONFIG.downloadMedia === false) return Promise.resolve();
    if (!opening) {
      opening = markContainerOpen(comic, (doc) => commitOpenContainer(doc, 'comics', saveComicData));
    }
    return opening;
  };

  async function saveOne (imageUrl, filepath, { replace = false, live = signal, kind, panelId } = {}) {
    if (live && live.aborted) {
      report.aborted = true;
      return 'stop';
    }
    const needsFetch = replace || !(await fileExists(filepath));
    if (needsFetch) {
      if (onProgress) onProgress({ phase: 'media', kind, panelId });
      await ensureOpen();
    }
    const result = await downloadMediaFile(imageUrl, filepath, { signal: live, replace });
    if (applyStorageFault(report, result) || result.status === 'aborted') {
      report.aborted = true;
      return 'stop';
    }
    if (result.status === 'published') report.imagesSaved++;
    if (byteMissKeepsOpen(result)) report.incomplete = true;
    if (result.status === 'published' || result.status === 'skipped') return 'ready';
    return 'next';
  }

  const jobs = [];
  const cover = comic.coverImage;
  const coverId = cover?.id ?? comic.coverImageId;
  if (coverId != null && usableImageUrl(cover?.url)) {
    jobs.push({
      imageUrl: buildComicCdnUrl(cdnBase, cover.url),
      filepath: comicCoverFilepath({ comicId, createdAt, imageId: coverId }),
      kind: 'cover'
    });
  }

  const hero = comic.heroImage;
  const heroId = hero?.id ?? comic.heroImageId;
  if (heroId != null && usableImageUrl(hero?.url)) {
    jobs.push({
      imageUrl: buildComicCdnUrl(cdnBase, hero.url),
      filepath: comicHeroFilepath({ comicId, createdAt, imageId: heroId }),
      kind: 'hero'
    });
  }

  for (const chapter of (Array.isArray(comic.chapters) ? comic.chapters : [])) {
    if (!chapter) continue;
    for (const panel of (Array.isArray(chapter.panels) ? chapter.panels : [])) {
      if (!isReadyPanel(panel)) continue;
      const imageUrl = buildComicCdnUrl(cdnBase, panel.imageUrl);
      if (!imageUrl) continue;
      const previousUrl = previousPanelUrls && panel.id != null ? previousPanelUrls.get(panel.id) : undefined;
      jobs.push({
        imageUrl,
        filepath: comicPanelFilepath({
          comicId,
          createdAt,
          chapterPosition: chapter.position,
          chapterId: chapter.id,
          panelPosition: panel.position,
          panelMediaId: panelMediaId(panel)
        }),
        replace: typeof previousUrl === 'string' && !sameResourceUrl(previousUrl, panel.imageUrl),
        imageId: panel.imageId,
        kind: 'panel',
        panelId: panel.id
      });
    }
  }

  await mapPool(jobs, MEDIA_POOL_WIDTH, async (job, _index, poolSignal) => {
    const live = poolSignal || signal;
    const outcome = await saveOne(job.imageUrl, job.filepath, {
      replace: job.replace === true,
      live,
      kind: job.kind,
      panelId: job.panelId
    });
    if (outcome === 'stop') return { stop: true };
    if (outcome === 'ready' && job.imageId != null && job.imageId !== '') {
      try {
        await joinPostedFileIfHashed(job.filepath, job.imageId);
      } catch (ignoreErr) {
        // Fail-soft: hash/join must not fail the download.
      }
    }
    return null;
  }, { signal });

  if (signal?.aborted) report.aborted = true;
  if (report.aborted) return report;

  if (!(signal && signal.aborted) && CONFIG.downloadMedia !== false) {
    try {
      const inputs = await saveComicReferences(comic, cdnBase, { signal, onProgress, recall: 'download' });
      if (inputs && inputs.fault === 'storage') {
        report.fault = 'storage';
        report.aborted = true;
        return report;
      }
    } catch (ignoreErr) {
      // Reference capture is best-effort; panel/cover files already landed.
    }
  }

  if (signal?.aborted) report.aborted = true;
  return report;
  } finally {
    await flushFetchMiss();
  }
}

async function enrichComicPanelSources (comic, { secretKey, signal, force = false } = {}) {
  const records = [];
  const panels = [];
  for (const chapter of (Array.isArray(comic.chapters) ? comic.chapters : [])) {
    for (const panel of (Array.isArray(chapter?.panels) ? chapter.panels : [])) {
      if (!isReadyPanel(panel)) continue;
      if (panel.imageId == null || panel.imageId === '') continue;
      const image = panel.image && typeof panel.image === 'object' ? panel.image : {};
      records.push({ ...image, id: panel.imageId });
      panels.push(panel);
    }
  }
  if (!records.length) return { changed: false, incomplete: false };

  const updates = await collectGenerationSourceUpdates(records, { secretKey, signal, force });
  const incomplete = force === true && updates.size < records.length;
  if (!updates.size) return { changed: false, incomplete };

  let changed = false;
  for (let i = 0; i < panels.length; i++) {
    const updated = updates.get(records[i].id);
    if (!updated) continue;
    const image = panels[i].image && typeof panels[i].image === 'object' ? panels[i].image : {};
    const hadId = Object.prototype.hasOwnProperty.call(image, 'id');
    const next = { ...image };
    if (updated.generationDataCaptured === true) {
      next.generationDataCaptured = true;
      next.hasMeta = updated.hasMeta;
      if (updated.generationData) next.generationData = updated.generationData;
      else delete next.generationData;
      delete next.meta;
      delete next.process;
      delete next.techniques;
      delete next.imageResources;
    }
    if (!hadId) delete next.id;
    panels[i].image = next;
    changed = true;
  }
  return { changed, incomplete };
}

// Cover, hero, and references only, and only when that identity changed.
// Panel files stay for the chapter walk.
export async function saveChangedComicChrome (next, previous, { signal, secretKey, onProgress } = {}) {
  const report = { imagesSaved: 0, aborted: false };
  if (!next || !next.createdAt) return report;
  const cdnBase = await getCivitaiImageBase({ secretKey });

  async function saveOne (imageUrl, filepath, replace) {
    if (signal && signal.aborted) {
      report.aborted = true;
      return;
    }
    const result = await downloadMediaFile(imageUrl, filepath, { signal, replace });
    if (result.status === 'aborted') report.aborted = true;
    if (result.status === 'published') report.imagesSaved += 1;
  }

  const pairs = [
    ['cover', next.coverImage, next.coverImageId, previous && previous.coverImage, previous && previous.coverImageId, comicCoverFilepath],
    ['hero', next.heroImage, next.heroImageId, previous && previous.heroImage, previous && previous.heroImageId, comicHeroFilepath]
  ];
  for (const [kind, image, id, prevImage, prevId, filepathOf] of pairs) {
    if (chromeKey(image, id) === chromeKey(prevImage, prevId)) continue;
    const imageId = image && image.id != null ? image.id : id;
    if (imageId == null || !usableImageUrl(image && image.url)) continue;
    if (onProgress) onProgress({ phase: 'media', kind });
    const urlChanged = typeof (prevImage && prevImage.url) === 'string' && !sameResourceUrl(prevImage.url, image.url);
    await saveOne(
      buildComicCdnUrl(cdnBase, image.url),
      filepathOf({ comicId: next.id, createdAt: next.createdAt, imageId }),
      urlChanged
    );
    if (report.aborted) return report;
  }

  if (JSON.stringify(referenceIds(next)) !== JSON.stringify(referenceIds(previous))) {
    try {
      const inputs = await saveComicReferences(next, cdnBase, { signal, onProgress, recall: 'download' });
      if (inputs && inputs.fault === 'storage') {
        report.fault = 'storage';
        report.aborted = true;
        return report;
      }
    } catch (ignoreErr) {
      // Reference capture is best-effort.
    }
  }
  return report;
}

export async function saveComic (comic, {
  overwriteIfModified = true,
  withImages = true,
  checkAllMedia = false,
  signal,
  secretKey,
  onProgress
} = {}) {
  const report = {
    comicNew: 0,
    comicSaved: 0,
    imagesSaved: 0,
    error: undefined,
    aborted: false,
    skipped: false,
    skipReason: undefined,
    savedItem: null
  };

  if (!comic || comic.status === 'Deleted') {
    report.skipped = true;
    report.skipReason = 'deleted';
    return report;
  }

  const { id, createdAt } = comic;
  if (!createdAt) {
    report.skipped = true;
    report.skipReason = 'missing-createdAt';
    return report;
  }

  const filepath = comicFilepath({ id, createdAt });
  const exists = await fileExists(filepath);
  let toWrite = comic;
  let dataChanged = !exists;
  let previousPanelUrls = new Map();

  if (exists) {
    try {
      const savedJson = JSON.parse(await readFile(filepath));
      previousPanelUrls = panelImageUrls(savedJson);
      if (overwriteIfModified) {
        const reconciled = reconcileComic(savedJson, comic);
        if (comparableDownloadJson(reconciled) !== comparableDownloadJson(savedJson)) {
          toWrite = reconciled;
          dataChanged = true;
        } else {
          toWrite = savedJson;
        }
      } else {
        toWrite = savedJson;
      }
    } catch (ignoreErr) {
      toWrite = comic;
      dataChanged = true;
    }
  }

  if (dataChanged) {
    if (onProgress) onProgress({ phase: 'saving', id });
    const savedFilepath = await saveComicData(toWrite);
    if (!savedFilepath) {
      report.error = { message: 'Could not save comic data' };
      return report;
    }
    report.comicSaved = 1;
    if (!exists) report.comicNew = 1;
  }

  if (secretKey && !(signal && signal.aborted)) {
    try {
      const stamped = await enrichComicPanelSources(toWrite, {
        secretKey,
        signal,
        force: checkAllMedia === true
      });
      if (stamped.incomplete) {
        report.error = { message: 'Could not refresh every comic panel' };
      }
      if (stamped.changed) {
        if (onProgress) onProgress({ phase: 'saving', id });
        const savedFilepath = await saveComicData(toWrite);
        if (!savedFilepath) {
          report.error = { message: 'Could not save comic data' };
          return report;
        }
        report.comicSaved = 1;
        if (!exists) report.comicNew = 1;
      }
    } catch (ignoreErr) {
      // Transport failure leaves the panel unstamped for a later walk.
    }
  }

  if (withImages && CONFIG.downloadMedia !== false) {
    const mediaReport = await saveComicMedia(toWrite, {
      signal,
      secretKey,
      onProgress,
      previousPanelUrls
    });
    report.imagesSaved = mediaReport.imagesSaved;
    report.aborted = mediaReport.aborted;
    if (mediaReport.error) report.error = mediaReport.error;
    if (mediaReport.imagesSaved > 0 && !report.comicSaved) {
      report.comicSaved = 1;
    }
    const hadOpen = toWrite.downloadOpen === true;
    const shouldOpen = mediaReport.incomplete === true;
    const mediaStopped = mediaReport.aborted === true || mediaReport.fault === 'storage';
    if (!mediaStopped && shouldOpen !== hadOpen) {
      if (shouldOpen) toWrite.downloadOpen = true;
      else delete toWrite.downloadOpen;
      const savedFilepath = await saveComicData(toWrite);
      if (savedFilepath) report.comicSaved = 1;
    }
  }

  try {
    report.savedItem = JSON.parse(await readFile(filepath));
  } catch (ignoreErr) {
    report.savedItem = toWrite;
  }

  return report;
}
