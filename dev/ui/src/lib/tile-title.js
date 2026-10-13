// Gallery tile tooltip. Same lead as the page the tile opens, with the
// slot date in the date's place. dateLabel is already formatted.

import { documentLead } from './page-title.js';

const MEDIA_TYPES = new Set(['image', 'video', 'audio']);

export function tileSlotIso (item, grain) {
  if (!item) return '';
  if (grain === 'post') {
    return item.status === 'draft' ? (item.createdAt || '') : (item.publishedAt || '');
  }
  if (grain === 'comic') {
    if (item.date) return item.date;
    return item.status === 'draft' ? (item.createdAt || '') : (item.publishedAt || '');
  }
  return item.createdAt || '';
}

export function tileLead (item, grain, dateLabel) {
  const date = dateLabel || '';
  if (grain === 'post') {
    return documentLead({
      place: 'post',
      status: item && item.status,
      title: item && item.title,
      date
    });
  }
  if (grain === 'comic') {
    return documentLead({
      place: 'comic',
      status: item && item.status,
      name: item && item.name,
      date
    });
  }
  const media = item && Array.isArray(item.media) ? item.media : [];
  if (grain === 'batch' && media.length > 1) {
    return documentLead({
      place: 'generation',
      date,
      members: media.map(m => ({ type: m && m.type }))
    });
  }
  const only = media[0] || {};
  const ownType = item && MEDIA_TYPES.has(item.type) ? item.type : '';
  return documentLead({
    place: 'media',
    type: only.type || ownType,
    title: (item && item.audioTitle) || '',
    date
  });
}
