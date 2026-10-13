/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// After-listen ACE consumed-text hole-fill + live-window cover recapture.
// ID3 on .mp3, then getWorkflow for remaining hollow simple ACE (cover .mp4)
// while the job is still live. Must not top-level-import serverIndex (DAG).
// Never blocks Explorer listen: startServer queues this after bind;
// rebuildIndex awaits it.

import path from 'node:path';
import { Buffer } from 'node:buffer';
import { open, stat } from 'node:fs/promises';
import { CONFIG } from './cli.mjs';
import { writeFile } from './utils.mjs';
import { normalizeMediaId } from './mediaId.mjs';
import {
  sidecarFilePath,
  readSidecarSync,
  id3TagByteLength,
  readAceAudioFromMp3
} from './aceAudioId3.mjs';
import { fetchAceSongIntoSidecar } from './aceAudioWorkflow.mjs';
import { waitForExplorerIdle } from './explorerIdle.mjs';

function diskPathFromThumbnail (thumbnailPath, mediaPath) {
  if (!mediaPath) return null;
  const rel = String(thumbnailPath || '').replace(/^\/media\/?/, '');
  if (!rel) return null;
  return path.join(mediaPath, rel);
}

async function mediaItemsFromIndex () {
  try {
    const { ensureIndexLoaded, getIndex } = await import('./serverIndex.mjs');
    await ensureIndexLoaded();
    return getIndex().mediaItems || [];
  } catch (ignoreErr) {
    return [];
  }
}

async function readMp3TagBuffer (filepath) {
  let fh;
  try {
    fh = await open(filepath, 'r');
    const header = Buffer.alloc(10);
    const { bytesRead } = await fh.read(header, 0, 10, 0);
    if (bytesRead < 10) return null;
    const total = id3TagByteLength(header);
    if (!total) return null;
    const buf = Buffer.alloc(total);
    header.copy(buf, 0, 0, 10);
    const rest = total - 10;
    const second = await fh.read(buf, 10, rest, 10);
    if (second.bytesRead !== rest) return buf.subarray(0, 10 + second.bytesRead);
    return buf;
  } catch (ignoreErr) {
    return null;
  } finally {
    if (fh) await fh.close().catch(() => {});
  }
}

export async function backfillAceAudio ({
  mediaItems,
  dataPath = CONFIG?.dataPath,
  mediaPath = CONFIG?.mediaPath,
  secretKey
} = {}) {
  await waitForExplorerIdle();
  if (!dataPath || !mediaPath) return;

  const items = mediaItems == null ? await mediaItemsFromIndex() : mediaItems;
  const sidecar = readSidecarSync(dataPath);
  let dirty = false;

  for (const item of items || []) {
    await waitForExplorerIdle();
    try {
      if (item?.type !== 'audio') continue;
      if (item.audio?.musicDescription) continue;
      const id = normalizeMediaId(item?.id);
      if (!id) continue;
      const filepath = diskPathFromThumbnail(item.thumbnailPath, mediaPath);
      if (!filepath || path.extname(filepath).toLowerCase() !== '.mp3') continue;

      let st;
      try {
        st = await stat(filepath);
      } catch (ignoreErr) {
        continue;
      }
      if (!st.isFile()) continue;

      const prev = sidecar[id];
      if (prev && prev.mtimeMs === st.mtimeMs) continue;

      const buf = await readMp3TagBuffer(filepath);
      const parsed = buf ? readAceAudioFromMp3(buf) : null;
      if (!parsed) continue;
      sidecar[id] = {
        musicDescription: parsed.musicDescription || '',
        lyrics: parsed.lyrics || '',
        bpm: parsed.bpm,
        key: parsed.key || '',
        path: filepath,
        mtimeMs: st.mtimeMs,
        source: 'id3'
      };
      dirty = true;
    } catch (ignoreErr) {
      // Fail-soft per file.
    }
  }

  if (dirty) await writeFile(sidecarFilePath(dataPath), sidecar);

  if (secretKey) {
    const afterId3 = dirty ? readSidecarSync(dataPath) : sidecar;
    for (const item of items || []) {
      await waitForExplorerIdle();
      try {
        if (item?.type !== 'audio') continue;
        if (item.audio?.mode !== 'simple') continue;
        if (item.audio?.musicDescription) continue;
        const id = normalizeMediaId(item?.id);
        if (!id) continue;
        const prev = afterId3[id];
        if (prev?.musicDescription) continue;
        if (prev?.workflowMiss && !prev.musicDescription) continue;
        const workflowId = item.containers?.generation?.id;
        if (!workflowId) continue;
        const result = await fetchAceSongIntoSidecar({
          workflowId,
          audioIds: [id],
          secretKey,
          dataPath
        });
        if (result?.ok || result?.miss) {
          afterId3[id] = {
            ...(afterId3[id] || {}),
            ...(readSidecarSync(dataPath)[id] || {})
          };
        }
      } catch (ignoreErr) {
        // Fail-soft per item.
      }
    }
  }

  await waitForExplorerIdle();
  const { migrateCaptureLiveInputs } = await import('./migrate.mjs');
  await migrateCaptureLiveInputs();
}
