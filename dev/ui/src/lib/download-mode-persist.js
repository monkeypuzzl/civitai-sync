// Remembered download choices for the next Auto run.
// The posts-need notice is not an input: All on screen for that reason
// stays out of the snapshot until the user chooses All.

import { selectionFromConfig } from './generation-download-modes.js';

const REACTION_ORDER = ['favorite', 'feedback:liked'];

function canonicalReactions (source) {
  const list = Array.isArray(source) ? source : [];
  return REACTION_ORDER.filter(id => list.includes(id));
}

function rowMode (override, stored) {
  if (override === 'all' || override === 'latest') return override;
  return stored === 'all' ? 'all' : 'latest';
}

export function rememberedModes ({
  genOverride = null,
  config = null,
  postModeOverride = null,
  comicsModeOverride = null,
  model3dsModeOverride = null
} = {}) {
  const generation = genOverride ?? selectionFromConfig({
    generationDownload: config && config.generationDownload,
    generationReactions: config && config.generationReactions
  });
  const generationDownload = generation.run === 'all'
    ? 'all'
    : generation.run === 'reactions'
      ? 'reactions'
      : 'latest';
  const generationReactions = generation.run === 'reactions'
    ? canonicalReactions(generation.reactions)
    : [];
  const postDownload = rowMode(postModeOverride, config && config.postDownload);
  const comicDownload = rowMode(comicsModeOverride, config && config.comicDownload);
  const model3dDownload = rowMode(model3dsModeOverride, config && config.model3dDownload);
  const body = {
    generationDownload,
    generationReactions,
    postDownload,
    comicDownload,
    model3dDownload
  };
  const stamp = [
    generationDownload,
    generationReactions.join(','),
    postDownload,
    comicDownload,
    model3dDownload
  ].join('|');
  return { stamp, body };
}

// One save at a time. A newer stamp replaces one that has not started.
// A failure is not sent again until the stamp changes. A stamp already
// acknowledged is not sent again.
export function createModePersist ({ save }) {
  let acked = null;
  let failed = null;
  let pending = null;
  let inflight = false;
  let inflightStamp = null;

  async function pump () {
    if (inflight) return;
    inflight = true;
    try {
      while (pending) {
        const job = pending;
        pending = null;
        if (job.stamp === acked || job.stamp === failed) continue;
        inflightStamp = job.stamp;
        try {
          await save(job.body);
          acked = job.stamp;
          if (failed === job.stamp) failed = null;
        } catch {
          if (!pending || pending.stamp === job.stamp) failed = job.stamp;
        } finally {
          inflightStamp = null;
        }
      }
    } finally {
      inflight = false;
    }
  }

  return {
    submit (snapshot) {
      if (!snapshot || typeof snapshot.stamp !== 'string') return;
      if (snapshot.stamp === acked || snapshot.stamp === failed) return;
      if (inflightStamp === snapshot.stamp && (!pending || pending.stamp === snapshot.stamp)) return;
      if (pending && pending.stamp === snapshot.stamp) return;
      pending = snapshot;
      pump();
    }
  };
}
