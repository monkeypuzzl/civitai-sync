// Lockstep copy of src/aceAudioParams.mjs. Preact cannot import src/*.mjs.

export function isAceAudioParams (params) {
  if (!params || typeof params !== 'object') return false;
  if (params.workflow === 'txt2music') return true;
  const mode = params.aceAudioMode;
  return mode === 'simple' || mode === 'custom';
}

function requestText (audio) {
  return String(audio.simplePrompt || audio.songConcept || '').trim();
}

export function searchPromptFromAudio (audio) {
  if (!audio) return '';
  const desc = String(audio.musicDescription || '').trim();
  const lyrics = String(audio.lyrics || '').trim();
  const request = requestText(audio);
  const parts = [];
  if (desc) parts.push(desc);
  if (lyrics) parts.push(lyrics);
  if (request && request !== desc) parts.push(request);
  return parts.join('\n');
}

function asString (value) {
  if (value == null) return '';
  return String(value);
}

function asNumber (value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

function coverKind (params) {
  if (params.generateCover === true) return 'generated';
  if (Array.isArray(params.images) && params.images.length > 0) return 'uploaded';
  return 'none';
}

function aceMode (params) {
  const mode = params.aceAudioMode;
  return mode === 'simple' || mode === 'custom' ? mode : '';
}

export function projectAudioParams (params) {
  if (!isAceAudioParams(params)) return null;
  const mode = aceMode(params);
  return {
    mode,
    cover: coverKind(params),
    simplePrompt: mode === 'simple' ? asString(params.prompt) : '',
    musicDescription: asString(params.musicDescription),
    lyrics: asString(params.lyrics),
    title: asString(params.title),
    bpm: asNumber(params.bpm),
    key: asString(params.key),
    duration: asNumber(params.duration),
    cfgScale: asNumber(params.cfgScale),
    steps: asNumber(params.steps),
    instrumentalWeight: asNumber(params.instrumentalWeight),
    vocalWeight: asNumber(params.vocalWeight),
    seed: asNumber(params.seed)
  };
}
