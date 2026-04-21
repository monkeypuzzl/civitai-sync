// Required header:
// "Referer": "https://<civitai-host>" or a path at the domain.
// API JSON requests, but not images, require authorization:
// "Authorization": Bearer {API_TOKEN}"
// Other headers optional.
//
// The Referer host mirrors the domain used in the API URL (see
// civitaiDomain.mjs). One exception: the host-pinned `auth.getUser` call
// passes `forceDomain: 'civitai.com'` so its Referer matches the URL host.
import { refererForApi } from './civitaiDomain.mjs';

export default function getHeaders ({ forceDomain } = {}) {
  const referer = forceDomain
    ? `https://${forceDomain}/generate`
    : refererForApi();

  return {
    sharedHeaders: {
      'accept-language': '',
      'sec-ch-ua': '',
      'sec-ch-ua-mobile': '',
      'sec-ch-ua-platform': '',
      'sec-gpc': '1',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Referer': referer
    },

    imageHeaders: {
      'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'sec-fetch-dest': 'image',
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-site': 'same-site'
    },

    jsonHeaders: {
      'accept': '*/*',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'upgrade-insecure-requests': '1'
    }
  };
}
