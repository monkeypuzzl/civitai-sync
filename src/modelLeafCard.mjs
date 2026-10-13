// Models version-leaf instrument card payload.
// Pure: no CONFIG, no civitaiUrl. The server passes `href` already built.

import { htmlToSafeTree, truncateTree } from './safeHtml.mjs';

export function isEmptyHtml (html) {
  if (html == null) return true;
  const text = String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|\u00a0/g, ' ')
    .trim();
  return text === '';
}

function emptyCard (hrefOut) {
  return {
    href: hrefOut,
    dateKind: null,
    dateIso: null,
    updatedIso: null,
    trainedWords: [],
    versionOverview: null
  };
}

export function composeModelLeafCard ({ modelId, versionId, data, href } = {}) {
  void modelId;
  void versionId;
  const hrefOut = typeof href === 'string' && href !== '' ? href : null;

  if (!data || typeof data !== 'object') {
    return emptyCard(hrefOut);
  }

  let dateKind = null;
  let dateIso = null;
  if (typeof data.publishedAt === 'string' && data.publishedAt !== '') {
    dateKind = 'published';
    dateIso = data.publishedAt;
  } else if (typeof data.createdAt === 'string' && data.createdAt !== '') {
    dateKind = 'uploaded';
    dateIso = data.createdAt;
  }

  let updatedIso = null;
  if (typeof data.updatedAt === 'string' && data.updatedAt !== '' && dateIso) {
    const updatedMs = Date.parse(data.updatedAt);
    const dateMs = Date.parse(dateIso);
    if (Number.isFinite(updatedMs) && Number.isFinite(dateMs) && (updatedMs - dateMs) > 86400000) {
      updatedIso = data.updatedAt;
    }
  }

  const trainedWords = Array.isArray(data.trainedWords)
    ? data.trainedWords.map(w => String(w).trim()).filter(s => s !== '')
    : [];

  const versionOverview = typeof data.description === 'string'
    ? truncateTree(htmlToSafeTree(data.description))
    : null;

  return {
    href: hrefOut,
    dateKind,
    dateIso,
    updatedIso,
    trainedWords,
    versionOverview
  };
}
