// Overview marker destinations and tooltip leads.
//
// A batch with a mediaId opens that media page (tileHref, batch grain).
// Any other batch opens /generations/<id>. A post or comic opens its
// container page. No from= — Overview is not an origin gallery. A missing
// destination is '' so the thumb stays a non-link.
//
// The tooltip is the opened page's document.title lead. dateLabel is
// already formatted; this module does not call formatDate.

import { formatUrl } from './url-state.js';
import { tileHref } from './media-href.js';
import { documentLead } from './page-title.js';

function hasId (id) {
  return id != null && id !== '';
}

export function overviewMarkerHref (marker) {
  if (!marker || typeof marker !== 'object') return '';
  if (marker.kind === 'batch') {
    if (!hasId(marker.id)) return '';
    if (hasId(marker.mediaId)) {
      return tileHref(
        { id: marker.id, media: [{ mediaId: marker.mediaId }] },
        { grain: 'batch' }
      );
    }
    return formatUrl({
      view: 'generations',
      entityId: String(marker.id),
      modelTrail: null,
      params: {}
    });
  }
  const view = marker.kind === 'comic' ? 'comics' : marker.kind === 'post' ? 'posts' : '';
  if (!view) return '';
  if (!hasId(marker.id)) return '';
  return formatUrl({
    view,
    entityId: String(marker.id),
    modelTrail: null,
    params: {}
  });
}

export function overviewMarkerLead (marker) {
  if (!marker || typeof marker !== 'object') return '';
  const date = marker.dateLabel || '';
  if (marker.kind === 'batch') {
    if (hasId(marker.mediaId)) {
      const audioTitle = String(marker.audioTitle || '').trim();
      return documentLead({
        place: 'media',
        type: marker.mediaType,
        title: audioTitle,
        date
      });
    }
    return documentLead({
      place: 'generation',
      date,
      members: Array.isArray(marker.members) ? marker.members : []
    });
  }
  if (marker.kind === 'comic') {
    return documentLead({
      place: 'comic',
      name: marker.name,
      status: marker.status,
      date
    });
  }
  if (marker.kind === 'post') {
    return documentLead({
      place: 'post',
      title: marker.title,
      status: marker.status,
      date
    });
  }
  return '';
}
