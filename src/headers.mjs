// Required header:
// "Referer": "https://civitai.com" or a path at the domain.
// API JSON requests, but not images, require authorization:
// "Authorization": Bearer {API_TOKEN}"
// Other headers optional.
export default {
  "sharedHeaders": {
    "accept-language": "",
    "sec-ch-ua": "",
    "sec-ch-ua-mobile": "",
    "sec-ch-ua-platform": "",
    "sec-gpc": "1",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Referer": "https://civitai.com/generate"
  },

  "imageHeaders": {
    "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "sec-fetch-dest": "image",
    "sec-fetch-mode": "no-cors",
    "sec-fetch-site": "same-site"
  },

  "jsonHeaders": {
    "accept": "*/*",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "upgrade-insecure-requests": "1"
  }
}
