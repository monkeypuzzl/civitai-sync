/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// ACE consumed-song fill from orchestrator.getWorkflow.
// queryGeneratedImages formatStep leaves chatCompletion.output as [] — this
// reads the raw workflow (output.parsed, else aceStepAudio.input strings).
// I/O: fetchAceSongIntoSidecar. Extractors are pure.

import { getWorkflow, normalizeCivitaiError, workflowFetchUrl } from './civitaiApi.mjs';
import { upsertAceAudioSidecar } from './aceAudioId3.mjs';
import {
  recallFetchMiss,
  recordFetchMiss,
  clearFetchMiss,
  failureCause,
  reportTransientFetch,
  flushFetchMiss
} from './fetchMiss.mjs';

export function needsAceWorkflowFill (params) {
  if (!params || typeof params !== 'object') return false;
  if (params.aceAudioMode !== 'simple') return false;
  return !String(params.musicDescription || '').trim();
}

function workflowSteps (workflow) {
  if (!workflow || typeof workflow !== 'object') return [];
  if (Array.isArray(workflow.steps)) return workflow.steps;
  const unwrapped = workflow.result?.data?.json;
  if (unwrapped && Array.isArray(unwrapped.steps)) return unwrapped.steps;
  if (workflow.data && Array.isArray(workflow.data.steps)) return workflow.data.steps;
  return [];
}

function songFromFields (musicDescription, lyrics, bpm, key) {
  const desc = String(musicDescription || '').trim();
  const ly = String(lyrics || '').trim();
  if (!desc && !ly) return null;
  const bpmN = Number(bpm);
  return {
    musicDescription: desc,
    lyrics: ly,
    bpm: Number.isFinite(bpmN) ? bpmN : '',
    key: key == null ? '' : String(key)
  };
}

function songFromParsed (parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return songFromFields(parsed.musicDescription, parsed.lyrics, parsed.bpm, parsed.key);
}

function songFromAceInput (input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const desc = input.musicDescription;
  const lyrics = input.lyrics;
  if (typeof desc !== 'string' && typeof lyrics !== 'string') return null;
  return songFromFields(
    typeof desc === 'string' ? desc : '',
    typeof lyrics === 'string' ? lyrics : '',
    input.bpm,
    input.key
  );
}

export function extractAceSongFromWorkflow (workflow) {
  const steps = workflowSteps(workflow);
  for (const step of steps) {
    if (step?.$type !== 'chatCompletion') continue;
    const output = step.output;
    if (Array.isArray(output)) continue;
    const song = songFromParsed(output?.parsed);
    if (song) return song;
  }
  for (const step of steps) {
    if (step?.$type !== 'aceStepAudio') continue;
    const song = songFromAceInput(step.input);
    if (song) return song;
  }
  return null;
}

export async function fetchAceSongIntoSidecar ({
  workflowId,
  audioIds,
  secretKey,
  signal,
  dataPath,
  recall = 'download'
} = {}) {
  if (!secretKey || !workflowId || !dataPath) return { ok: false };
  const ids = [...new Set((audioIds || []).filter(Boolean))];
  if (!ids.length) return { ok: false };
  const url = workflowFetchUrl(workflowId);

  try {
    if (recall !== 'recheck') {
      const prior = await recallFetchMiss(url);
      if (prior?.outcome === 'terminal') return { ok: false, miss: true };
    }

    if (signal?.aborted) return { ok: false, aborted: true };

    const wf = await getWorkflow({ workflowId, secretKey, signal });
    if (signal?.aborted) return { ok: false, aborted: true };

    if (wf?.error) {
      const err = normalizeCivitaiError(wf.error);
      if (err.httpStatus === 404 || err.httpStatus === 410) {
        await recordFetchMiss(url, {
          outcome: 'terminal',
          httpStatus: err.httpStatus,
          message: '',
          cause: ''
        });
        return { ok: false, miss: true };
      }
      await reportTransientFetch(url, {
        message: err.message || 'fetch failed',
        cause: '',
        recall,
        prefix: 'Warning: workflow fetch failed for'
      });
      return { ok: false };
    }

    const song = extractAceSongFromWorkflow(wf);
    if (!song) return { ok: false };

    const updates = {};
    for (const id of ids) {
      updates[id] = {
        musicDescription: song.musicDescription,
        lyrics: song.lyrics,
        bpm: song.bpm,
        key: song.key,
        source: 'workflow',
        workflowId
      };
    }
    await upsertAceAudioSidecar(dataPath, updates);
    await clearFetchMiss(url);
    return { ok: true };
  } catch (error) {
    await reportTransientFetch(url, {
      message: error?.message || 'fetch failed',
      cause: failureCause(error),
      recall,
      prefix: 'Warning: workflow fetch failed for'
    });
    return { ok: false };
  } finally {
    await flushFetchMiss();
  }
}
