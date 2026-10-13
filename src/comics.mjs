/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

import { writeFile, readFile, fileExists, toDateString } from './utils.mjs';
import { CONFIG } from './cli.mjs';
import { getCivitaiImageBase } from './civitaiApi.mjs';
import { downloadMediaFile } from './mediaDownload.mjs';
import { extractInputDescriptors, saveInputMedia } from './inputMedia.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import { joinPostedFileIfHashed } from './contentHashBackfill.mjs';
import { collectGenerationSourceUpdates, imageNeedsGenerationData } from './posts.mjs';

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

export function mergeComic (shell, chapters) {
  const rest = { ...shell };
  delete rest.chapters;
  return { ...rest, chapters: Array.isArray(chapters) ? chapters : [] };
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
  if (savedImage.process != null && freshImage?.process == null) patch.process = savedImage.process;
  if (savedImage.techniques != null && freshImage?.techniques == null) patch.techniques = savedImage.techniques;
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

async function saveComicReferences (comic, cdnBase, { signal, onProgress } = {}) {
  const descriptors = [];
  for (const reference of (Array.isArray(comic.references) ? comic.references : [])) {
    const images = referenceImagesForExtractor(reference, cdnBase);
    if (!images.length) continue;
    // extractInputDescriptors only walks `images[].url` (http). Nested
    // `image.url` UUIDs on the comics wire are rewritten to CDN URLs first.
    descriptors.push(...extractInputDescriptors({ images }, 'comic-reference'));
  }
  if (!descriptors.length) return;
  await saveInputMedia(descriptors, { signal, onProgress });
}

export async function saveComicMedia (comic, { signal, secretKey, onProgress } = {}) {
  const report = { imagesSaved: 0, error: undefined, aborted: false };
  const { id: comicId, createdAt } = comic;

  if (!createdAt) return report;

  const cdnBase = await getCivitaiImageBase({ secretKey });

  // 'stop' ends the comic walk (user abort). 'ready' means the final file is
  // present (just published, or already there). 'next' is a miss: no file,
  // and the rest of the comic still downloads.
  async function saveOne (imageUrl, filepath) {
    if (signal && signal.aborted) {
      report.aborted = true;
      return 'stop';
    }
    const result = await downloadMediaFile(imageUrl, filepath, { signal });
    if (result.status === 'aborted') {
      report.aborted = true;
      return 'stop';
    }
    if (result.status === 'published') report.imagesSaved++;
    if (result.status === 'published' || result.status === 'skipped') return 'ready';
    return 'next';
  }

  const cover = comic.coverImage;
  const coverId = cover?.id ?? comic.coverImageId;
  if (coverId != null && usableImageUrl(cover?.url)) {
    if (onProgress) onProgress({ phase: 'media', kind: 'cover' });
    const outcome = await saveOne(
      buildComicCdnUrl(cdnBase, cover.url),
      comicCoverFilepath({ comicId, createdAt, imageId: coverId })
    );
    if (outcome === 'stop') return report;
  }

  const hero = comic.heroImage;
  const heroId = hero?.id ?? comic.heroImageId;
  if (heroId != null && usableImageUrl(hero?.url)) {
    if (onProgress) onProgress({ phase: 'media', kind: 'hero' });
    const outcome = await saveOne(
      buildComicCdnUrl(cdnBase, hero.url),
      comicHeroFilepath({ comicId, createdAt, imageId: heroId })
    );
    if (outcome === 'stop') return report;
  }

  for (const chapter of (Array.isArray(comic.chapters) ? comic.chapters : [])) {
    if (!chapter) continue;
    for (const panel of (Array.isArray(chapter.panels) ? chapter.panels : [])) {
      if (!isReadyPanel(panel)) continue;
      // Ready files use panel.imageUrl only. Nested image.url is not selected
      // on getChapter and must not be read.
      const imageUrl = buildComicCdnUrl(cdnBase, panel.imageUrl);
      if (!imageUrl) continue;
      if (onProgress) onProgress({ phase: 'media', kind: 'panel', panelId: panel.id });
      const filepath = comicPanelFilepath({
        comicId,
        createdAt,
        chapterPosition: chapter.position,
        chapterId: chapter.id,
        panelPosition: panel.position,
        panelMediaId: panelMediaId(panel)
      });
      const outcome = await saveOne(imageUrl, filepath);
      if (outcome === 'stop') return report;
      if (outcome === 'ready' && panel.imageId != null && panel.imageId !== '') {
        try {
          await joinPostedFileIfHashed(filepath, panel.imageId);
        } catch (ignoreErr) {
          // Fail-soft: hash/join must not fail the download.
        }
      }
    }
  }

  if (!(signal && signal.aborted) && CONFIG.downloadMedia !== false) {
    try {
      await saveComicReferences(comic, cdnBase, { signal, onProgress });
    } catch (ignoreErr) {
      // Reference capture is best-effort; panel/cover files already landed.
    }
  }

  return report;
}

async function enrichComicPanelSources (comic, { secretKey, signal } = {}) {
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
  if (!records.length) return false;

  const updates = await collectGenerationSourceUpdates(records, { secretKey, signal });
  if (!updates.size) return false;

  let changed = false;
  for (let i = 0; i < panels.length; i++) {
    const before = records[i];
    const updated = updates.get(before.id);
    if (!updated) continue;
    const image = panels[i].image && typeof panels[i].image === 'object' ? panels[i].image : {};
    const hadId = Object.prototype.hasOwnProperty.call(image, 'id');
    const next = { ...image };
    if (imageNeedsGenerationData(before)) {
      if (updated.meta) next.meta = updated.meta;
      next.hasMeta = updated.hasMeta;
    }
    if (updated.process !== undefined) next.process = updated.process;
    if (updated.techniques !== undefined) next.techniques = updated.techniques;
    next.workflowSourcesCaptured = true;
    if (!hadId) delete next.id;
    panels[i].image = next;
    changed = true;
  }
  return changed;
}

export async function saveComic (comic, {
  overwriteIfModified = true,
  withImages = true,
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

  if (exists) {
    try {
      const savedJson = JSON.parse(await readFile(filepath));
      if (overwriteIfModified) {
        const reconciled = reconcileComic(savedJson, comic);
        if (JSON.stringify(reconciled, null, 2) !== JSON.stringify(savedJson, null, 2)) {
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
      const stamped = await enrichComicPanelSources(toWrite, { secretKey, signal });
      if (stamped) {
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
    const mediaReport = await saveComicMedia(toWrite, { signal, secretKey, onProgress });
    report.imagesSaved = mediaReport.imagesSaved;
    report.aborted = mediaReport.aborted;
    report.error = mediaReport.error;
    if (mediaReport.imagesSaved > 0 && !report.comicSaved) {
      report.comicSaved = 1;
    }
  }

  try {
    report.savedItem = JSON.parse(await readFile(filepath));
  } catch (ignoreErr) {
    report.savedItem = toWrite;
  }

  return report;
}
