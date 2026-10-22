// One repair for meshes v5 saved as <stem>.jpeg. PolyGen could create a
// generation from 2026-05-27; a later download still files it under that
// createdAt. Nothing earlier is 3D. The flag is CONFIG.model3dRepairOnce,
// same store as mediaHealOnce: set only after the pass finishes.

import path from 'node:path';
import { Buffer } from 'node:buffer';
import { open } from 'node:fs/promises';
import { CONFIG } from './cli.mjs';
import { setConfigParam } from './config.mjs';
import { waitForExplorerIdle } from './explorerIdle.mjs';
import {
  generationFilepath,
  generationMediaFilename,
  generationsMediaDir
} from './generations.mjs';
import { fileExists, rename, unlink, writeFile } from './utils.mjs';

export const MODEL3D_FIRST_DATE = '2026-05-27';

const GLTF = Buffer.from('glTF');

function diskFromPublic (publicPath) {
  const marker = '/media/generations/';
  if (typeof publicPath !== 'string') return '';
  const at = publicPath.indexOf(marker);
  if (at === -1) return '';
  const rel = publicPath.slice(at + marker.length);
  if (!rel || rel.split('/').some(part => !part || part === '.' || part === '..')) return '';
  return path.resolve(generationsMediaDir(), rel);
}

function jpegSibling (meshDisk) {
  const ext = path.extname(meshDisk);
  if (!ext || ext.toLowerCase() === '.jpeg') return '';
  return meshDisk.slice(0, -ext.length) + '.jpeg';
}

async function header4 (filepath) {
  let fh;
  try {
    fh = await open(filepath, 'r');
    const buf = Buffer.alloc(4);
    const { bytesRead } = await fh.read(buf, 0, 4, 0);
    return bytesRead >= 2 ? buf.subarray(0, bytesRead) : null;
  } catch {
    return null;
  } finally {
    if (fh) await fh.close().catch(() => {});
  }
}

function isGltf (buf) {
  return !!buf && buf.length >= 4 && buf.subarray(0, 4).equals(GLTF);
}

function jpegPublicPath (row) {
  const candidate = row?.type === 'model3d' ? '' : (row?.thumbnailPath || '');
  return typeof candidate === 'string' && candidate.toLowerCase().endsWith('.jpeg')
    ? candidate
    : '';
}

function stampModel3d (generation, mediaId) {
  const want = String(mediaId);
  let stamped = false;
  for (const step of generation?.steps || []) {
    for (const key of ['output', 'images']) {
      const items = step?.[key];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || String(item.id) !== want) continue;
        if (item.type !== 'model3d') {
          item.type = 'model3d';
          stamped = true;
        }
        if (!item.format) item.format = 'glb';
      }
    }
  }
  return stamped;
}

async function fixClassifiedMesh (row, report) {
  const mesh = diskFromPublic(row.mediaPath);
  const jpeg = jpegSibling(mesh);
  if (!mesh || !jpeg || !(await fileExists(jpeg))) return;
  const head = await header4(jpeg);
  if (!isGltf(head)) return;
  if (await fileExists(mesh)) {
    await unlink(jpeg);
    report.removed++;
    return;
  }
  await rename(jpeg, mesh);
  report.renamed++;
}

export async function repairModel3dOnce ({
  generations = [],
  readGeneration,
  upsert,
  signal
} = {}) {
  if (CONFIG.model3dRepairOnce === true) return { skipped: true };

  const report = { renamed: 0, removed: 0, reclassified: 0, aborted: false };

  for (const entry of generations) {
    if (signal?.aborted) {
      report.aborted = true;
      return report;
    }
    if (!entry?.date || entry.date < MODEL3D_FIRST_DATE) continue;
    await waitForExplorerIdle();
    if (signal?.aborted) {
      report.aborted = true;
      return report;
    }

    let loaded = null;
    let dirty = false;
    for (const row of entry.media || []) {
      if (row?.type === 'model3d' && row.mediaPath) {
        await fixClassifiedMesh(row, report);
        continue;
      }
      const jpeg = diskFromPublic(jpegPublicPath(row));
      if (!jpeg || !(await fileExists(jpeg))) continue;
      const head = await header4(jpeg);
      if (!isGltf(head)) continue;
      if (!loaded && typeof readGeneration === 'function') {
        loaded = await readGeneration(entry);
      }
      if (!loaded || !stampModel3d(loaded, row.mediaId)) continue;
      dirty = true;
      const meshName = generationMediaFilename({
        generationId: entry.id,
        mediaId: row.mediaId,
        seed: row.seed,
        type: 'model3d',
        format: 'glb'
      });
      const dest = path.join(generationsMediaDir(), entry.date, meshName);
      if (!(await fileExists(dest))) await rename(jpeg, dest);
      else await unlink(jpeg);
      report.reclassified++;
    }

    if (dirty && loaded) {
      const createdAt = entry.createdAt || `${entry.date}T00:00:00.000Z`;
      await writeFile(
        generationFilepath({ id: entry.id, createdAt }),
        JSON.stringify(loaded, null, 2)
      );
      if (typeof upsert === 'function') await upsert(loaded);
    }
  }

  if (signal?.aborted) {
    report.aborted = true;
    return report;
  }
  await setConfigParam('model3dRepairOnce', true);
  return report;
}
