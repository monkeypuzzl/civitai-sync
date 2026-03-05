# Civitai API Contract

This documents the external Civitai APIs used by `civitai-sync`, as understood from the codebase. This is not official Civitai documentation — it reflects observed behaviour and the assumptions encoded in `src/civitaiApi.mjs` and `src/headers.mjs`.

---

## Critical: Generation Expiry

**Civitai deletes all generation data 30 days after creation.** After 30 days, the generation JSON and associated media URLs become permanently unavailable via the API. This means:

- Users **must** download their generations at least every 30 days to avoid permanent data loss.
- The `orchestrator.queryGeneratedImages` endpoint only returns generations created within the last ~30 days.
- There is no API to recover expired generations.

This is the single most important constraint in the system. The UI prominently displays "last downloaded X days ago" for generations and warns at 25+ days.

---

## Authentication

All authenticated endpoints require a Bearer token:

```
Authorization: Bearer <API_KEY>
```

Users obtain their API key from https://civitai.com/user/account.

Image CDN requests do **not** require authentication.

---

## API Type Reliability

**The Civitai API's documented types are aspirational, not contractual.** Fields documented as `string` may arrive as `null` or be absent entirely. This is a systemic pattern, not a one-off for any particular field. Observed examples:

- `images[].name` in `post.getInfinite` — documented as `string`, observed as `null` for images stored without a separate filename (the CDN serves them using their UUID as the path stem instead).

**Defensive coding rule**: Any code that calls string methods (`.split()`, `.includes()`, `.startsWith()`, etc.) on a value received from the API must guard against `null` and `undefined`. A bare `value.split('?')` will crash with `TypeError: Cannot read properties of null (reading 'split')` if the API returns `null`. Prefer an early guard (`if (!value) { /* fallback */ }`) or optional chaining where appropriate.

This applies to all endpoints, not just posts. When adding new code that processes API responses, assume any non-primitive field may be null regardless of what the type table says.

---

## Required Headers

The `Referer` header is **mandatory** for all requests (data and images). Without it, requests may be silently rejected or return unexpected results.

```
Referer: https://civitai.com/generate
```

The full header sets are defined in `src/headers.mjs`:

### Shared Headers (all requests)

```json
{
  "accept-language": "",
  "sec-ch-ua": "",
  "sec-ch-ua-mobile": "",
  "sec-ch-ua-platform": "",
  "sec-gpc": "1",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Referer": "https://civitai.com/generate"
}
```

### JSON Request Headers (data endpoints)

Merged with shared headers. Also requires `Authorization`.

```json
{
  "accept": "*/*",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "upgrade-insecure-requests": "1"
}
```

### Image Request Headers (CDN downloads)

Merged with shared headers. No `Authorization` needed.

```json
{
  "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "sec-fetch-dest": "image",
  "sec-fetch-mode": "no-cors",
  "sec-fetch-site": "same-site"
}
```

---

## Endpoints

### Query Generated Images

Fetches a paginated list of the authenticated user's AI-generated images.

**URL**: `https://civitai.com/api/trpc/orchestrator.queryGeneratedImages`

**Method**: GET

**Authentication**: Required

**Query Parameters**:

The entire query is encoded as a single `input` parameter containing URL-encoded JSON:

```
?input=<URL-encoded JSON>
```

The JSON structure:

```json
{
  "json": {
    "authed": true,
    "tags": ["gen", ...additionalTags],
    "cursor": "<generationId or undefined>"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `json.authed` | `boolean` | Always `true`. |
| `json.tags` | `string[]` | Always includes `"gen"`. Additional filters: `"favorite"`, `"feedback:liked"`, `"feedback:disliked"`. |
| `json.cursor` | `string \| undefined` | Generation ID for pagination. Omit for latest. |

**Success Response** (200):

```json
{
  "result": {
    "data": {
      "json": {
        "items": [
          {
            "id": "<generationId>",
            "createdAt": "2025-01-15T14:30:00.000000Z",
            "steps": [
              {
                "images": [
                  {
                    "id": "<mediaId>",
                    "status": "succeeded",
                    "seed": 12345,
                    "url": "https://..."
                  }
                ],
                "metadata": {
                  "images": {
                    "<mediaId>": {
                      "favorite": true,
                      "feedback": "liked",
                      "hidden": false
                    }
                  }
                }
              }
            ]
          }
        ],
        "nextCursor": "<generationId>"
      }
    }
  }
}
```

**Key response fields**:

| Path | Description |
|---|---|
| `result.data.json.items[]` | Array of generation objects. |
| `result.data.json.items[].id` | Unique generation ID (used as cursor and filename). |
| `result.data.json.items[].createdAt` | ISO 8601 timestamp with microsecond precision. |
| `result.data.json.items[].steps[]` | Generation steps containing images. |
| `result.data.json.items[].steps[].images[]` | Array of generated images. |
| `result.data.json.items[].steps[].images[].id` | Media ID. May contain a file extension (e.g. `.mp4` for videos). |
| `result.data.json.items[].steps[].images[].status` | `"succeeded"`, `"failed"`, or `"expired"`. Failed/expired images are skipped. |
| `result.data.json.items[].steps[].images[].seed` | Generation seed (integer). |
| `result.data.json.items[].steps[].images[].url` | CDN URL for the image/video. |
| `result.data.json.items[].steps[].metadata.images` | Per-image tag metadata. Keys are media IDs. |
| `result.data.json.items[].steps[].metadata.images.<id>.favorite` | `true` if favourited. |
| `result.data.json.items[].steps[].metadata.images.<id>.feedback` | `"liked"` or `"disliked"` (string, not boolean). |
| `result.data.json.items[].steps[].metadata.images.<id>.hidden` | `true` if deleted from on-site generator. |
| `result.data.json.nextCursor` | Cursor for next page. Absent when no more pages. |

**Error Response**:

```json
{
  "error": {
    "json": {
      "message": "...",
      "code": 11401,
      "data": {
        "code": "UNAUTHORIZED",
        "httpStatus": 401,
        "path": "orchestrator.queryGeneratedImages"
      }
    }
  }
}
```

Known error codes:
- `UNAUTHORIZED` (401): Invalid or expired API key.
- Server errors (500): Transient; the client retries up to 10 times.

### Fetch Model

Fetches metadata for a Civitai model (used by the self-update system).

**URL**: `https://civitai.com/api/v1/models/{modelId}`

**Method**: GET

**Authentication**: Not required

**Response** (relevant fields):

```json
{
  "modelVersions": [
    {
      "id": 12345,
      "name": "v4.1.3",
      "status": "Published",
      "availability": "Public",
      "publishedAt": "2025-01-15T00:00:00Z",
      "downloadUrl": "https://...",
      "description": "<p>Release notes here</p>"
    }
  ]
}
```

The app filters to `Published` + (`Public` or `EarlyAccess`) versions, sorts by `publishedAt` descending, and takes the first. Version number is extracted from `name` via regex `/^v(\d+(?:\.\d+){0,2})/`.

The app-specific model ID is `526058`.

### Fetch File (Download)

Downloads a file (ZIP for software updates) from a Civitai URL.

**URL**: Any Civitai download URL (from `modelVersions[].downloadUrl`)

**Method**: GET

**Authentication**: Optional (Bearer token). Required for Early Access downloads.

**Response**: Binary stream. The client checks:
- Status must be 200.
- `Content-Type` must not be `text/plain` (indicates an error page rather than the file).

The response body is piped to a file stream with `wx` flag (exclusive create).

### Image CDN

Downloads generated images/videos.

**URL**: Varies per image (from `steps[].images[].url`)

**Method**: GET

**Authentication**: Not required (CDN is public for generated content)

**Response**: Binary stream (image or video). Status 200 means success; any other status or network error returns `null` (treated as "probably deleted from on-site generator").

### Get User

Fetches the authenticated user's profile, used to resolve and cache their `username`.

**URL**: `https://civitai.com/api/v1/me`

**Method**: GET

**Authentication**: Required

**Response** (relevant fields):

```json
{
  "username": "monkeypuzzle",
  "id": 4356713,
  "email": "...",
  "image": "..."
}
```

The `username` field is written to `CONFIG.username` on first use and cleared whenever the API key is changed (see `src/keyActions.mjs`).

---

### Get Images (REST)

Fetches a paginated list of the authenticated user's published images. Used internally by `getCivitaiImageBase()` to resolve the Cloudflare Images account hash at session start.

**URL**: `https://civitai.com/api/v1/images`

**Method**: GET

**Authentication**: Required

**Query Parameters**: `limit`, `username`, `postId`, `sort`, `period` (see Civitai REST API docs)

**Response** (relevant fields):

```json
{
  "items": [
    {
      "url": "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/<uuid>/original=true/<filename>.jpeg",
      "type": "image",
      "id": 89328095
    }
  ],
  "metadata": {
    "nextCursor": "...",
    "nextPage": "..."
  }
}
```

> **Note**: Unlike the tRPC `post.getInfinite` response, the REST API returns **fully-constructed CDN URLs** in the `url` field. This is how the Cloudflare Images account hash (`xG1nkqKTMzGDvpLrqFT7WA`) is discovered — it is the third path segment in this URL. See [Post Image CDN](#post-image-cdn) below.

#### REST vs tRPC image field shapes

The same image appears differently depending on which endpoint returns it:

| Field | REST API (`/api/v1/images`) | tRPC (`post.getInfinite`) |
|---|---|---|
| `url` | Fully-constructed CDN URL (e.g. `https://image.civitai.com/…/<uuid>/original=true/<filename>.jpeg`) | Cloudflare Images UUID only (e.g. `12daaff8-d19c-4688-a718-332b6aa47a9c`) |
| `name` | **Not present** — the filename is embedded in the `url` path | Separate field: the filename stem (e.g. `TH8CX36WMGF3DQ3604QEXX26Z0.jpg`), or `null` if no filename was assigned |

When `name` is `null` in tRPC, the REST API's URL confirms the CDN uses the UUID itself as the filename (e.g. `…/fdefc078-…/original=true/fdefc078-….jpeg`). This is the basis for the fallback in `buildPostImageUrl`.

---

### Posts — `post.getInfinite`

Fetches a paginated list of a user's published posts, each containing their images and videos. This is an internal tRPC endpoint with no equivalent in the public REST API.

**URL**: `https://civitai.com/api/trpc/post.getInfinite`

**Method**: GET

**Authentication**: Required

**Query Parameters**:

The entire query is encoded as a single `input` parameter containing URL-encoded JSON:

```
?input=<URL-encoded JSON>
```

The JSON structure:

```json
{
  "json": {
    "username": "monkeypuzzle",
    "limit": 100,
    "sort": "Newest",
    "period": "AllTime",
    "cursor": "<cursorId or undefined>"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `json.username` | `string` | The target user's username (from `/api/v1/me`). Required. |
| `json.limit` | `number` | Items per page. Min 0, max 200. Defaults to 100. |
| `json.sort` | `string` | Sort order. Valid values: `"Newest"`, `"Oldest"`, `"MostReactions"`, `"MostComments"`. |
| `json.period` | `string` | Time filter. Valid values: `"AllTime"`, `"Year"`, `"Month"`, `"Week"`, `"Day"`. |
| `json.cursor` | `string \| number \| undefined` | Pagination cursor. Omit for first page. |

The full accepted input schema is defined in `civitai-src/src/server/schema/post.schema.ts` as `postsQuerySchema`.

**Success Response** (200):

```json
{
  "result": {
    "data": {
      "json": {
        "items": [
          {
            "id": 19789896,
            "nsfwLevel": 2,
            "title": null,
            "publishedAt": "2025-07-19T20:30:00.000Z",
            "modelVersionId": null,
            "collectionId": null,
            "cursorId": "2025-07-19T20:30:00.000Z",
            "imageCount": 7,
            "user": {
              "id": 4356713,
              "username": "monkeypuzzle",
              "image": null,
              "deletedAt": null,
              "cosmetics": [],
              "profilePicture": null
            },
            "stats": {
              "postId": 19789896,
              "commentCount": 0,
              "likeCount": 21,
              "dislikeCount": 0,
              "heartCount": 11,
              "laughCount": 0,
              "cryCount": 0,
              "collectedCount": 0
            },
            "images": [
              {
                "id": 89328095,
                "userId": 4356713,
                "name": "TH8CX36WMGF3DQ3604QEXX26Z0.jpg",
                "url": "12daaff8-d19c-4688-a718-332b6aa47a9c",
                "nsfwLevel": 2,
                "width": 832,
                "height": 1216,
                "hash": "UADll^%MW@%M~9oLW?of00M{9aNGIpaySgRj",
                "type": "image",
                "metadata": {
                  "hash": "UADll^%MW@%M~9oLW?of00M{9aNGIpaySgRj",
                  "size": 325586,
                  "width": 832,
                  "height": 1216
                },
                "createdAt": "2025-07-20T05:36:42.630Z",
                "postId": 19789896,
                "hasMeta": true,
                "hasPositivePrompt": true,
                "onSite": true,
                "remixOfId": null,
                "minor": false,
                "poi": false,
                "tagIds": [529, 1896, 3642]
              },
              {
                "id": 27024502,
                "userId": 4356713,
                "name": null,
                "url": "fdefc078-9335-446f-a3fe-daf0bd5d477c",
                "nsfwLevel": 1,
                "width": 896,
                "height": 1152,
                "hash": "U59ZJ^t7}9w^OqsoaeR*|@WCWGsVaxoLxafl",
                "type": "image",
                "metadata": { "...": "..." },
                "createdAt": "2024-08-31T09:26:06.606Z",
                "postId": 6045023,
                "hasMeta": true,
                "hasPositivePrompt": true,
                "onSite": true,
                "remixOfId": null,
                "minor": false,
                "poi": false,
                "tagIds": [1234, 5678]
              }
            ],
            "cosmetic": null
          }
        ],
        "nextCursor": "2024-05-14T00:00:00.000Z"
      }
    }
  }
}
```

**Key response fields**:

| Path | Type | Description |
|---|---|---|
| `result.data.json.items[]` | `object[]` | Array of post objects. |
| `result.data.json.items[].id` | `number` | Unique post ID. Used as the data filename (`{id}.json`). |
| `result.data.json.items[].publishedAt` | `string` | ISO 8601 timestamp. Used to derive the date folder (`YYYY-MM-DD`). |
| `result.data.json.items[].cursorId` | `string` | **Pagination cursor** — pass as `cursor` in next request. This is an ISO timestamp string, not the post ID. |
| `result.data.json.items[].imageCount` | `number` | Count of images in the post (may differ from `images[].length` if some are filtered). |
| `result.data.json.items[].images[]` | `object[]` | Inline array of the post's images and videos. |
| `result.data.json.items[].images[].id` | `number` | Image ID. Used in the local media filename (`{paddedIndex}_{id}.{ext}`). |
| `result.data.json.items[].images[].url` | `string` | **Cloudflare Images UUID** — NOT a URL despite the field name. Insert into CDN URL construction (see below). |
| `result.data.json.items[].images[].name` | `string \| null` | Filename used as the CDN path stem. For videos, includes `?token=...` that must be stripped. **Can be `null`** — see [field semantics](#field-semantics-imageurl-vs-imagename) for handling. |
| `result.data.json.items[].images[].type` | `"image" \| "video"` | Determines CDN URL extension and local file extension. |
| `result.data.json.items[].images[].width` | `number` | Pixel width. |
| `result.data.json.items[].images[].height` | `number` | Pixel height. |
| `result.data.json.items[].images[].hasMeta` | `boolean` | Whether the image has generation prompt metadata. |
| `result.data.json.nextCursor` | `string \| null` | Cursor for next page. Absent/null when no more pages. |

**Fields present in `post.getInfinite` but NOT documented above** (available on each item):

| Path | Type | Description |
|---|---|---|
| `result.data.json.items[].title` | `string \| null` | Post title. Null for untitled posts. |
| `result.data.json.items[].nsfwLevel` | `number` | NSFW classification level (1 = SFW). |
| `result.data.json.items[].user` | `object` | Author info: `id`, `username`, `image`, `deletedAt`, `cosmetics`, `profilePicture`. |
| `result.data.json.items[].stats` | `object` | Reaction counts (see below). |
| `result.data.json.items[].stats.likeCount` | `number` | Thumbs-up reactions. |
| `result.data.json.items[].stats.heartCount` | `number` | Heart reactions. |
| `result.data.json.items[].stats.laughCount` | `number` | Laugh reactions. |
| `result.data.json.items[].stats.cryCount` | `number` | Cry reactions. |
| `result.data.json.items[].stats.dislikeCount` | `number` | Dislike reactions. |
| `result.data.json.items[].stats.commentCount` | `number` | Comment count. |
| `result.data.json.items[].stats.collectedCount` | `number` | Times collected. |
| `result.data.json.items[].images[].tagIds` | `number[]` | Numeric tag IDs for this image (not human-readable names; see note below). |
| `result.data.json.items[].images[].width` | `number` | Pixel width. |
| `result.data.json.items[].images[].height` | `number` | Pixel height. |
| `result.data.json.items[].images[].metadata.duration` | `number \| undefined` | Video duration in seconds (video type only). |
| `result.data.json.items[].cosmetic` | `object \| null` | Cosmetic overlay applied to the post. |

**Fields NOT in `post.getInfinite`** — require a separate `post.get` call per post:

| Field | Description |
|---|---|
| `detail` | Post description (HTML string, or null). |
| `tags` | Post-level tags as `[{id, name, isCategory}]` — human-readable names. |
| `availability` | `"Public"` or other access level. |

> **Note on tags**: Posts have **two separate tag systems**. Image-level `tagIds` (numeric arrays on each image in the `post.getInfinite` response) are auto-generated content tags. Post-level `tags` (string names like "emerald", "dragon") are user-curated labels visible on the post page. Only `post.get` returns the post-level tags with human-readable names.

**Error Response**: Same shape as `orchestrator.queryGeneratedImages`.

---

### Get Post Detail — `post.get`

Fetches a single post with full detail, including post-level tags and description. These fields are **not** returned by `post.getInfinite`.

**URL**: `https://civitai.com/api/trpc/post.get`

**Method**: GET

**Authentication**: Required

**Query Parameters**:

```
?input=<URL-encoded JSON>
```

```json
{
  "json": {
    "id": 9638646
  }
}
```

| Field | Type | Description |
|---|---|---|
| `json.id` | `number` | The post ID. |

**Success Response** (200):

```json
{
  "result": {
    "data": {
      "json": {
        "id": 9638646,
        "nsfwLevel": 1,
        "title": "Emerald Reptile",
        "detail": "<p>Reflections of <a href=\"...\">...</a></p>",
        "modelVersionId": null,
        "modelVersion": null,
        "user": {
          "id": 4356713,
          "username": "monkeypuzzle",
          "deletedAt": null,
          "image": null,
          "profilePicture": { "..." : "..." },
          "cosmetics": []
        },
        "publishedAt": "2024-11-27T14:27:19.950Z",
        "availability": "Public",
        "tags": [
          { "id": 5905, "name": "emerald", "isCategory": false },
          { "id": 115735, "name": "chameleon", "isCategory": false },
          { "id": 111990, "name": "reptile", "isCategory": false },
          { "id": 5499, "name": "dragon", "isCategory": false },
          { "id": 34, "name": "animals", "isCategory": true }
        ],
        "collectionId": null
      }
    }
  }
}
```

**Key response fields**:

| Path | Type | Description |
|---|---|---|
| `result.data.json.title` | `string \| null` | Post title. |
| `result.data.json.detail` | `string \| null` | Post description as HTML. Null if no description was set. |
| `result.data.json.tags[]` | `object[]` | Post-level tags (user-curated). |
| `result.data.json.tags[].id` | `number` | Tag ID. |
| `result.data.json.tags[].name` | `string` | Human-readable tag name (e.g. `"emerald"`, `"dragon"`). |
| `result.data.json.tags[].isCategory` | `boolean` | Whether the tag is a top-level category on Civitai. |
| `result.data.json.availability` | `string` | `"Public"` or other access level. |
| `result.data.json.publishedAt` | `string` | ISO 8601 timestamp. |
| `result.data.json.user` | `object` | Author info (more detailed than `post.getInfinite` — includes `profilePicture`). |

**Note**: This endpoint does **not** return `images[]`, `stats`, or `imageCount`. Those come only from `post.getInfinite`. The two endpoints are complementary: `post.getInfinite` provides the bulk listing with images and stats; `post.get` provides per-post detail (description, tags, availability).

**Constructing the post URL on Civitai**: `https://civitai.com/posts/{id}`

---

### Post Image CDN

Post images are served from Civitai's **Cloudflare Images** account. The URL construction is non-obvious and cannot be derived from the Civitai source code alone.

#### Account hash

The Cloudflare Images account hash (`xG1nkqKTMzGDvpLrqFT7WA`) is stored server-side in Civitai's `NEXT_PUBLIC_IMAGE_LOCATION` environment variable. It is **absent from the open-source repository**.

In `civitai-sync`, it is resolved at runtime via `getCivitaiImageBase({ secretKey })` in `src/civitaiApi.mjs`:

1. Calls `GET /api/v1/images?limit=1` with the user's API key.
2. Extracts the third path segment from the first image's fully-constructed `url` field.
3. Caches the result in a module-level variable for the lifetime of the process.
4. Falls back to the hardcoded constant `https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA` if the API call fails.

#### URL construction

Given an image object from `post.getInfinite`, the download URL is:

| `image.type` | CDN URL format |
|---|---|
| `image` | `{cdnBase}/{image.url}/original=true/{stem}.jpeg` |
| `video` | `{cdnBase}/{image.url}/original=true/{stem}.mp4` |

Where:
- `{cdnBase}` = `https://image.civitai.com/{accountHash}` (resolved above)
- `{image.url}` = the Cloudflare UUID from the API response
- `{stem}` = `image.name`, with the `?token=...` query string stripped and the file extension removed. **If `image.name` is `null`**, the UUID (`image.url`) is used as the stem instead — the CDN resolves by UUID regardless of the stem value.
- The extension is **always** `.jpeg` for images and `.mp4` for videos, regardless of the original extension in `image.name`

**Implementation**: `buildPostImageUrl(cdnBase, image)` in `src/posts.mjs`.

#### Field semantics: `image.url` vs `image.name`

These fields are frequently confused because their names are misleading:

| Field | Actual meaning |
|---|---|
| `url` | A **Cloudflare Images UUID** (e.g. `12daaff8-d19c-4688-a718-332b6aa47a9c`) — not a URL. |
| `name` | The filename component for the CDN path, e.g. `TH8CX36WMGF3DQ3604QEXX26Z0.jpg`. For videos: `QM4G1A4XV3955E3AKZHR9YZ1G0.mp4?token=<jwt>`. **Can be `null`** — see below. |

For videos, the `name` field includes a legacy auth token as a query string. This token is **not required** in the CDN URL — strip everything from `?` onwards before constructing the URL. The token was part of an earlier storage system; the Cloudflare Images CDN serves the content without it.

> **Nullable `name`**: The API returns `null` for `image.name` when an image was stored without a separate filename. In these cases, the CDN serves the image using its UUID as the path stem. Confirmed by querying `GET /api/v1/images?imageId=27024502` — the REST API returned a fully-constructed URL of `…/fdefc078-9335-446f-a3fe-daf0bd5d477c/original=true/fdefc078-9335-446f-a3fe-daf0bd5d477c.jpeg`, where the UUID is used as both the path component and the filename. In the tRPC `post.getInfinite` response for the same image, `url` is `"fdefc078-9335-446f-a3fe-daf0bd5d477c"` and `name` is `null`.
>
> The implementation (`buildPostImageUrl` in `src/posts.mjs`) falls back to `image.url` (the UUID) as the CDN path stem when `name` is null. See [API Type Reliability](#api-type-reliability) for the general principle.

#### Local file naming

Media files are saved as `{paddedIndex}_{imageId}.{ext}`:
- `paddedIndex`: 1-based position in the post's image array, zero-padded to 2 digits (e.g. `01`, `02`)
- `imageId`: `image.id` (numeric)
- `ext`: `.jpeg` for images, `.mp4` for videos

Example path: `media/posts/2025-07-19/19789896/01_89328095.jpeg`

**Implementation**: `postImageFilepath({ postId, publishedAt, index, imageId, type })` in `src/posts.mjs`.

---

## Image Generation Metadata — `GET /api/v1/images`

Post images may contain **generation metadata** (prompt, model, sampler, CFG scale, seed, etc.) when they were created using a generation tool. The `hasMeta` boolean on each image in `post.getInfinite` indicates whether this metadata exists, but the bulk listing does **not** include the metadata itself.

### Fetching metadata

The **REST API** `GET /api/v1/images` returns a `meta` object per image with full generation parameters. It supports a `postId` filter, making it possible to fetch all image metadata for a post in a single call.

**URL**: `https://civitai.com/api/v1/images`

**Method**: GET

**Authentication**: Optional (bearer token). Authentication grants access to the user's own private/NSFW images.

**Query Parameters** (relevant subset):

| Param | Type | Description |
|---|---|---|
| `postId` | `number` | Fetch images belonging to a specific post |
| `limit` | `number` | Results per page (0–200, default 100) |
| `username` | `string` | Filter to a specific user's images |

**Response** — Each image item includes:

| Field | Type | Description |
|---|---|---|
| `id` | `number` | Image ID (matches `images[].id` from `post.getInfinite`). |
| `meta` | `object \| null` | Generation parameters. Null if the image has no generation metadata. |
| `meta.prompt` | `string` | The positive prompt used to generate the image. |
| `meta.negativePrompt` | `string` | The negative prompt. |
| `meta.seed` | `number` | The generation seed. |
| `meta.Model` | `string` | The model name (note: capital M). |
| `meta.steps` | `number` | Number of sampling steps. |
| `meta.sampler` | `string` | Sampler name (e.g. "DPM++ SDE Karras"). |
| `meta.cfgScale` | `number` | CFG scale value. |
| `meta.Size` | `string` | Dimensions as a string (e.g. "512x768"). |
| `meta.Clip skip` | `string` | CLIP skip value (if present). |
| `meta.Hires upscale` | `string` | Hi-res upscale factor (if present). |
| `meta.Hires upscaler` | `string` | Hi-res upscaler name (if present). |
| `meta.Denoising strength` | `string` | Denoising strength (if present). |

> **Note**: The `meta` keys use inconsistent casing — some are camelCase (`cfgScale`, `negativePrompt`), some are Title Case (`Model`, `Size`), and some are sentence case (`Clip skip`). This reflects the freeform nature of generation metadata stored by Civitai. Code should handle missing or unexpected keys gracefully.

### Alternative: `image.getGenerationData` tRPC endpoint

There is also a tRPC endpoint `image.getGenerationData` that accepts `{ id: number }` (image ID) and returns generation metadata for a single image. It is a **public** procedure (no authentication required). However, for bulk enrichment, the REST API is preferred because it supports `postId` filtering and returns multiple images per call.

**URL**: `https://civitai.com/api/trpc/image.getGenerationData?input=<URL-encoded JSON>`

**Input**: `{ "json": { "id": <imageId> } }`

### Enrichment strategy for post downloads

When downloading posts, generation metadata is fetched after saving each post's data and media. For each post:

1. Call `GET /api/v1/images?postId={postId}&limit=200` with the user's bearer token
2. Match returned images to the post's `images[]` by `id`
3. Merge `meta` into each image object in the saved post JSON
4. Re-save the enriched post JSON to disk

This adds one API call per post (respecting `DATA_RATE_LIMIT`). For most posts with <200 images, a single call suffices.

The `hasMeta` field on each image indicates whether `meta` will be non-null. Posts where no images have `hasMeta: true` can skip the enrichment call.

---

## Pagination

Both paginated endpoints use cursor-based pagination, but the cursor type differs.

| Endpoint | Cursor type | Source field |
|---|---|---|
| `orchestrator.queryGeneratedImages` | Generation ID string | `result.data.json.nextCursor` |
| `post.getInfinite` | ISO timestamp string (`cursorId`) | `result.data.json.nextCursor` |

General rules:
- **First page**: Omit `cursor` from the request to get the most recent items.
- **Next page**: Pass the `nextCursor` from the response as `cursor` in the next request.
- **End detection**: When `cursor === previousCursor` (the same cursor is returned twice), all items have been traversed.
- **Empty page**: `nextCursor` absent or falsy — no more pages.

`getAllRequests()` handles generations; `getAllPostRequests()` handles posts. Both are in `civitaiApi.mjs` and follow the same loop structure, passing `{ cursor, previousCursor, nextCursor }` to the iterator callback.

> **Cursor gotcha for posts**: The pagination cursor is `cursorId` on each post item (an ISO timestamp), not `id`. The `nextCursor` in the response top-level is derived from this field. Do not confuse `post.id` (used for file naming) with the cursor value.

---

## Rate Limiting

Client-enforced to avoid overloading the API:

| Request Type | Minimum Interval | Constant |
|---|---|---|
| Data (JSON) | 100ms | `DATA_RATE_LIMIT` |
| Images (CDN) | 100ms | `IMAGE_RATE_LIMIT` |

Image rate limiting uses a module-scoped `previousFetch` timestamp. If the elapsed time since the last image request is less than `IMAGE_RATE_LIMIT`, the client waits for the remainder.

Data rate limiting is applied between paginated requests via `await wait(DATA_RATE_LIMIT)` after each successful page.

---

## Retry Logic

| Scope | Max Attempts | Delay | Constant |
|---|---|---|---|
| Single API page | 10 | 1 second | `MAX_ATTEMPTS` in `civitaiApi.mjs` |
| Download orchestration | 10 | Immediate | `MAX_FETCH_ATTEMPTS` in `downloadActions.mjs` |

The API-level retry (`getAllRequests`) retries when the response contains an `error` field. The orchestration-level retry (`fetchGenerations`) retries on thrown exceptions (network failures, timeouts).

Specific error codes handled at the orchestration level:
- `UNAUTHORIZED`: Prompts user to update API key (no retry).
- `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_SOCKET`, `ECONNRESET`: Connection failures; retried, then reported as "could not connect".

---

## Synthetic Error Responses

When the HTTP response cannot be parsed as JSON (e.g. server error returning HTML), `civitaiApi.mjs` constructs a synthetic error response matching the Civitai error shape:

```json
{
  "error": {
    "json": {
      "message": "<error.message>",
      "code": 11500,
      "data": {
        "code": "SERVER_ERROR",
        "httpStatus": 500,
        "path": "orchestrator.queryGeneratedImages"
      }
    },
    "url": "<request URL>"
  }
}
```

The synthetic `code` is `11000 + httpStatus`. This allows callers to handle real and synthetic errors with the same logic.

---

## Tag Encoding

Tags in API requests are plain strings in the `tags` array. The base tag `"gen"` is always included. Workflow tags are appended as-is:

| User Intent | Tags Array Sent |
|---|---|
| All generations | `["gen"]` |
| Favourites only | `["gen", "favorite"]` |
| Liked only | `["gen", "feedback:liked"]` |
| Disliked only | `["gen", "feedback:disliked"]` |

In response metadata, the tag structure is different — `feedback` is a key with a string value (`"liked"` or `"disliked"`), and `favorite` is a key with boolean value `true`. The code in `getGeneratedMediaInfo()` re-assembles these into the colon-separated format used elsewhere (e.g. `feedback:liked`).
