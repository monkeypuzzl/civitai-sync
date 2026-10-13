import { useEffect } from 'preact/hooks';

const APP = 'civitai-sync';
const EM = ' \u2014 ';
const DOT = ' \u00B7 ';

const MEDIA_TYPE = {
  image: { one: 'Image', many: 'Images' },
  video: { one: 'Video', many: 'Videos' },
  audio: { one: 'Audio', many: 'Audio' }
};

function joinFacts (facts) {
  return facts.filter(f => f != null && f !== '').join(DOT);
}

function trimmedLead (value) {
  if (value == null) return '';
  return String(value).trim();
}

function withApp (lead) {
  if (!lead) return APP;
  return `${lead}${EM}${APP}`;
}

function batchClause (members) {
  if (!Array.isArray(members) || members.length === 0) return '';
  const types = members.map(m => m && m.type);
  const shared = types[0];
  const words = MEDIA_TYPE[shared];
  if (!words) return '';
  if (!types.every(t => t === shared)) return '';
  if (members.length === 1) return words.one;
  return `${members.length} ${words.many}`;
}

function mediaTypeWord (type) {
  const words = MEDIA_TYPE[type];
  return words ? words.one : '';
}

function publicationStatusWord (status) {
  if (status === 'draft') return 'Draft';
  if (status === 'scheduled') return 'Scheduled';
  return '';
}

function mediaTitleOf (spec) {
  return trimmedLead(spec.title || spec.audioTitle);
}

/**
 * Lead only (no " — civitai-sync"). Callers pass dates already formatted.
 * A `model` field on a generation spec is ignored. Empty when the spec
 * has no place.
 */
export function documentLead (spec) {
  if (!spec || !spec.place) return '';

  switch (spec.place) {
    case 'overview':
      return 'Overview';
    case 'exports':
      return 'Exports';
    case 'download':
      return 'Download';
    case 'models':
      return 'Models';

    case 'generations': {
      const grain = spec.grain === 'batch' ? 'Batches' : 'Media';
      return joinFacts(['Generations', grain]);
    }
    case 'posts':
      return spec.grain === 'media' ? joinFacts(['Posts', 'Media']) : 'Posts';
    case 'comics':
      return spec.grain === 'media' ? joinFacts(['Comics', 'Media']) : 'Comics';
    case 'model3ds':
      return '3D';

    case 'post': {
      if (!('title' in spec) && !('date' in spec) && !('status' in spec)) return 'Post';
      return joinFacts([
        'Post',
        publicationStatusWord(spec.status),
        trimmedLead(spec.title),
        spec.date || ''
      ]);
    }
    case 'comic': {
      if (!('name' in spec) && !('date' in spec) && !('status' in spec)) return 'Comic';
      return joinFacts([
        'Comic',
        publicationStatusWord(spec.status),
        trimmedLead(spec.name),
        spec.date || ''
      ]);
    }
    case 'model3d': {
      if (!('name' in spec) && !('date' in spec) && !('status' in spec)) return '3D';
      const statusWord = spec.status === 'draft'
        ? 'Draft'
        : spec.status === 'unpublished'
          ? 'Unpublished'
          : '';
      return joinFacts(['3D', statusWord, trimmedLead(spec.name), spec.date || '']);
    }
    case 'model': {
      if (!spec.name) return 'Model';
      return joinFacts(['Model', spec.name, spec.version || '']);
    }
    case 'media': {
      if (!('type' in spec) && !('date' in spec) && !('title' in spec) && !('audioTitle' in spec)) {
        return 'Media';
      }
      return joinFacts([
        mediaTypeWord(spec.type),
        mediaTitleOf(spec),
        spec.date || ''
      ]);
    }
    case 'generation': {
      if (!('date' in spec) && !('members' in spec)) return 'Generation';
      const clause = batchClause(spec.members);
      const date = spec.date || '';
      if (!date && !clause) return 'Generation';
      return joinFacts([clause, date]);
    }

    default:
      return '';
  }
}

/** Full document.title. Same spec as documentLead. */
export function documentTitle (spec) {
  return withApp(documentLead(spec));
}

/**
 * Provisional place/node spec from a route while prefs load (no view mounted).
 * Gallery grain uses params only; unknown / resources-redirect → overview.
 */
export function routeTitleSpec (route) {
  const view = route?.view;
  const entityId = route?.entityId;
  const params = route?.params || {};

  if (entityId) {
    switch (view) {
      case 'generations': return { place: 'generation' };
      case 'posts': return { place: 'post' };
      case 'comics': return { place: 'comic' };
      case 'model3ds': return { place: 'model3d' };
      case 'models': return { place: 'model' };
      case 'media': return { place: 'media' };
      default: return { place: 'overview' };
    }
  }

  switch (view) {
    case 'overview': return { place: 'overview' };
    case 'exports': return { place: 'exports' };
    case 'download': return { place: 'download' };
    case 'models': return { place: 'models' };
    case 'generations':
      return {
        place: 'generations',
        grain: params.granularity === 'batch' ? 'batch' : 'media'
      };
    case 'posts':
      return {
        place: 'posts',
        grain: params.granularity === 'media' ? 'media' : 'post'
      };
    case 'comics':
      return {
        place: 'comics',
        grain: params.granularity === 'media' ? 'media' : 'comic'
      };
    case 'model3ds':
      return { place: 'model3ds' };
    case 'resources-redirect':
    default:
      return { place: 'overview' };
  }
}

/**
 * Assign document.title from documentTitle(spec). null spec does not assign
 * (a child may already own the title).
 */
export function useDocumentTitle (spec) {
  const title = spec == null ? null : documentTitle(spec);
  useEffect(() => {
    if (title == null) return;
    document.title = title;
  }, [title]);
}
