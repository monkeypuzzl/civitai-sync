/*eslint no-unused-vars: ["error", { "caughtErrors": "all", "caughtErrorsIgnorePattern": "^ignore" }]*/

// ACE consumed-song fill from orchestrator.getWorkflow.
// queryGeneratedImages formatStep leaves chatCompletion.output as [] — this
// reads the raw workflow (output.parsed, else aceStepAudio.input strings).
// I/O: fetchAceSongIntoSidecar. Extractors are pure.

import { wait } from './utils.mjs';
import { getWorkflow, normalizeCivitaiError } from './civitaiApi.mjs';
import { upsertAceAudioSidecar } from './aceAudioId3.mjs';

const WORKFLOW_WAIT_MS = 100;

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
  dataPath
} = {}) {
  if (!secretKey || !workflowId || !dataPath) return { ok: false };
  const ids = [...new Set((audioIds || []).filter(Boolean))];
  if (!ids.length) return { ok: false };

  try {
    await wait(WORKFLOW_WAIT_MS);
    if (signal?.aborted) return { ok: false, aborted: true };

    const wf = await getWorkflow({ workflowId, secretKey, signal });
    if (signal?.aborted) return { ok: false, aborted: true };

    if (wf?.error) {
      const err = normalizeCivitaiError(wf.error);
      if (err.httpStatus === 404) {
        const updates = {};
        for (const id of ids) {
          updates[id] = { workflowMiss: true, workflowId };
        }
        await upsertAceAudioSidecar(dataPath, updates);
        return { ok: false, miss: true };
      }
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
        workflowId,
        workflowMiss: false
      };
    }
    await upsertAceAudioSidecar(dataPath, updates);
    return { ok: true };
  } catch (ignoreErr) {
    return { ok: false };
  }
}
