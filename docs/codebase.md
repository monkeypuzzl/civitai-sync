# civitai-sync — Codebase Reference

## Purpose

`civitai-sync` is a Node.js CLI tool that downloads and manages AI-generated images from Civitai. Users authenticate with an API key, then download their generation history (JSON metadata + image files) organised into date-based folders with tag-based sub-directories. The tool supports multiple accounts, encrypted key storage, and self-updating from the Civitai model page.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js ≥ 18, ES Modules (`.mjs`) |
| CLI prompts | `@inquirer/*` (select, checkbox, confirm, input, password, rawlist) |
| Terminal styling | `chalk` |
| File system | `node:fs/promises`, `mkdirp` |
| Encryption | `node:crypto` (AES-256-CBC) |
| Streaming | `node:stream` + `node:stream/promises` (`pipeline`) for downloads |
| Self-update | `extract-zip`, `node:child_process` |
| Explorer UI | Preact (dev dependency — bundled by esbuild at build time into `src/ui/`) |
| Linting | ESLint 9 (flat config) |
| Tests | **None** — no test framework, no test files |

---

## Module Map

All source lives in `src/`. Modules fall into four layers; dependencies flow strictly downward.

### Entry & Bootstrap

| Module | Role |
|---|---|
| `cli.mjs` | Application entry. Parses CLI args, resolves config path, loads config, runs migrations, kicks off update check, launches main menu. Exports shared constants (`APP_DIRECTORY`, `CONFIG`, `CONFIG_PATH`, `CURRENT_VERSION`, `OS`, `customTheme`, `appHeader`). |
| `commands.mjs` | Non-interactive CLI commands (`auto-fetch`, `remove-deleted`). Runs at module level via top-level `await` — not exported. Duplicates config-path resolution from `cli.mjs`. |

### UI (Menus)

| Module | Role |
|---|---|
| `mainMenu.mjs` | Top-level menu. Routes to download, settings, about, update. Shows "Install software update" when available, or "Check for updates" with last-checked timestamp. Remembers last selection via `previousMenuItem`. |
| `downloadGenerationsMenu.mjs` | Download mode selection (latest / oldest / by-tag / all). Builds tag list and options contextually. |
| `downloadOptionsMenu.mjs` | Settings for downloads: media types, data types, directory paths, counts, delete-deleted. |
| `keyOptionsMenu.mjs` | API key management: test, encrypt, decrypt, update, delete. |
| `showInfo.mjs` | About screen with links and help. |

### Core Logic

| Module | Role |
|---|---|
| `downloadActions.mjs` | Download orchestration for generations. Paginates the API, delegates saving to `generations.mjs`, tracks progress in a `report` object, handles retries (up to 10), abort signals, and UNAUTHORIZED recovery. Also contains `countDownloads()` for stats. |
| `downloadPostsActions.mjs` | Download orchestration for posts. Similar pattern to generations: paginates via `getAllPostRequests()`, delegates saving to `posts.mjs`, supports abort and progress reporting. |
| `generations.mjs` | Generation data and media management. Filepath conventions, tag-to-directory mapping, save/load generation JSON, download + organise images by tag, detect modifications, remove untagged media, iterate all generations, count/rename/migrate files. |
| `posts.mjs` | Post data and media management. Filepath conventions, save post JSON, download post media, enrich posts with detail (tags, availability) via `post.get` tRPC endpoint, and enrich image generation metadata via `GET /api/v1/images?postId=`. |
| `civitaiApi.mjs` | HTTP client. See [`api-contract.md`](./api-contract.md). Includes `getPostImageMeta()` for fetching image generation parameters for posts. |
| `keyActions.mjs` | API key lifecycle: prompt, validate (via test API call), encrypt, decrypt, cache in module-scoped `SECRET_KEY`. |

### Server & UI

| Module | Role |
|---|---|
| `server.mjs` | HTTP server for the browser UI. Serves static files from `src/ui/`, media files from the configured paths, and a REST API. Handles download execution (generations + posts) with SSE progress streaming. Saves download completion timestamps to config for "last downloaded X days ago" display. |
| `serverIndex.mjs` | In-memory index builder. Scans data directories on startup (and after downloads) to build paginated, searchable indexes of generations and posts. Includes `meta` from enriched post images for offline display of generation parameters. |

### UI (`dev/ui/src/` → built to `src/ui/`)

| Component | Role |
|---|---|
| `app.jsx` | Root component. Path-based router (History API) for Generations / Posts / Timeline / Settings views. Fetches config on mount for username. |
| `Nav.jsx` | Navigation bar with tabs and username display. |
| `GenerationsView.jsx` | Gallery view for generations with filtering, sorting, search, infinite scroll. |
| `PostsView.jsx` | Gallery view for posts with tag filtering, sorting, search, infinite scroll. |
| `SettingsView.jsx` | Download controls (generations + posts), media options, last-download timestamps with 30-day expiry warnings, offline indicator. SSE progress streaming for active downloads. |
| `Lightbox.jsx` | Full-screen media viewer for generations. Shows prompt, negative prompt, model, sampler, CFG scale, seed, tags. Keyboard navigation. |
| `PostLightbox.jsx` | Full-screen media viewer for posts. Shows title, reactions, description, tags, and generation parameters (prompt, model, etc.) when `meta` is available on images. |
| `TimelineView.jsx` | Monthly timeline view. Fetches all generations and posts, groups by month (YYYY-MM), renders a chronological grid of thumbnails with "P" badges for posts. Opens Lightbox or PostLightbox on click. |
| `GalleryItem.jsx` / `PostCard.jsx` | Grid items for generation and post galleries. Renders `<video>` for video items (with `preload="metadata"`) and `<img>` for images. Shows date overlay on hover and highlighted search snippets. |

### Infrastructure

| Module | Role |
|---|---|
| `config.mjs` | Config persistence. Singleton loader (`getCurrentConfig`), JSON read/write, auto-migration of old root-level configs to `config/` folder. |
| `crypto.mjs` | AES-256-CBC encrypt/decrypt. Key buffer zero-padded to 32 bytes. Output format: `{iv_hex}:{ciphertext_hex}`. |
| `headers.mjs` | Centralised HTTP headers. Three sets: `sharedHeaders`, `imageHeaders`, `jsonHeaders`. The `Referer` header is **required** by the Civitai API. |
| `utils.mjs` | File system helpers (`fileExists`, `readFile`, `writeFile` with auto-`mkdirp`), date helpers (`toDateString`, `dateIsOlderThanDays`, `isDate`), `wait()`, directory listing/cleanup. |
| `childProcess.mjs` | `spawnChild()` wrapper with stdout/stderr capture and progress callback. |
| `softwareUpdate.mjs` | Self-update system. Checks Civitai model page (ID `526058`) every 12 hours, downloads ZIP, extracts, backs up current files, installs, handles dependency changes via `npm ci`, rolls back on failure. |
| `migrate.mjs` | Version-gated data migrations. Runs on startup if `CONFIG.version !== CURRENT_VERSION`. Migrations are idempotent. |

### Dependency Graph

```
index.mjs
└── cli.mjs
    ├── config.mjs ← utils.mjs
    ├── migrate.mjs ← generations.mjs, config.mjs
    ├── softwareUpdate.mjs ← civitaiApi.mjs, childProcess.mjs
    └── mainMenu.mjs
        ├── downloadGenerationsMenu.mjs
        │   ├── downloadActions.mjs ← civitaiApi.mjs, generations.mjs, keyActions.mjs
        │   └── downloadOptionsMenu.mjs ← generations.mjs, config.mjs
        ├── keyOptionsMenu.mjs ← keyActions.mjs ← crypto.mjs, civitaiApi.mjs
        ├── showInfo.mjs
        └── softwareUpdate.mjs

commands.mjs (standalone entry for auto-fetch / remove-deleted)
├── keyActions.mjs
├── downloadActions.mjs
└── generations.mjs
```

---

## Data Model

### Configuration

JSON files in `config/`. Default path: `config/default.json`. Multiple accounts use separate files (`config/<name>.json`).

```
DEFAULT_CONFIG = {
  dataPath:             "data",
  mediaPath:            "media",
  username:             "",
  generationMediaTypes: ["all", "favorite"],   // which tag directories to populate
  generationDataTypes:  ["all"],
  keyEncrypt:           false,
  excludeImages:        false,                  // data-only mode
  secretKey:            ""                      // plain or encrypted API key
}
```

Additional runtime fields written by the app: `version`, `pendingDownloads`, `lastDownloadGenerations` (ISO timestamp), `lastDownloadPosts` (ISO timestamp).

Config path resolution: a bare name like `myaccount` becomes `config/myaccount.json`. Old root-level configs auto-migrate to `config/`.

### File Structure on Disk

```
data/
  generations/
    2025-01-15/
      <generationId>.json      # full API response for one generation
    2025-01-16/
      ...
  posts/
    2025-01-15/
      <postId>.json            # post data with images[].meta (generation params when enriched)
    ...

media/
  generations/
    all/                       # every downloaded image/video goes here
      2025-01-15/
        <generationId>_<seed>_<mediaId>.jpeg
    favorite/                  # hard copy if tagged "favorite"
      2025-01-15/
        <generationId>_<seed>_<mediaId>.jpeg
    liked/                     # hard copy if tagged "feedback:liked"
    disliked/                  # hard copy if tagged "feedback:disliked"
  posts/
    2025-01-15/
      <postId>/
        01_<imageId>.jpeg      # zero-padded index + image ID
        02_<imageId>.mp4       # .mp4 for videos
```

**Naming convention**: `{generationId}_{seed}_{mediaId}.jpeg`. If `mediaId` already contains an extension (e.g. video files), `.jpeg` is not appended.

**Legacy naming**: Older versions used `{mediaId}.jpeg` or `{generationId}_{seed}.jpeg`, and stored media directly in `generations/media/{date}/` without the `all/` subdirectory. The migration system and `legacyMediaFilepaths()` handle these.

### Workflow Tags

| API Tag | Directory Name | Display Name |
|---|---|---|
| `favorite` | `favorite` | favorited |
| `feedback:liked` | `liked` | liked |
| `feedback:disliked` | `disliked` | disliked |

The `all` directory always receives a copy. Tag directories receive additional copies (via `fs.copyFile`, not hard links despite the conceptual intent). When a tag is removed server-side, the file is deleted from the tag directory but kept in `all/`.

### Tag Metadata in Generation JSON

Tags live inside `steps[].metadata.images[mediaId]`. Each key is a tag name; value is `true` (boolean tag like `favorite`) or a string (compound tag like `feedback: "liked"` → assembled into `feedback:liked`). The `hidden` flag marks on-site deleted images.

---

## Key Invariants

These are the things most likely to cause regressions if violated.

### Singleton Config

`getCurrentConfig()` in `config.mjs` uses a cached `configPromise` to ensure config loads exactly once. The returned object is mutated in place by `setConfig()` (via `merge()`), so all modules sharing the `CONFIG` import see updates immediately. **Never replace the `CONFIG` object reference**; only mutate its properties through `setConfig()`.

### Module-Scoped Secret Key Cache

`SECRET_KEY` in `keyActions.mjs` caches the decrypted API key to avoid repeated password prompts. It's set on first successful `getSecretKey()` call and cleared only by `removeKey()`.

### Abort Signal Threading

`AbortController` signals are created at the menu level and passed through `downloadActions.fetchGenerations()` → `civitaiApi.getAllRequests()` → `civitaiApi.getGenerations()` → `fetch()`. Any new async path in the download chain must accept and respect the `signal` parameter. On abort, partial image downloads are cleaned up (unlinked).

### Overwrite Detection

`saveGenerations()` compares `JSON.stringify(generation, null, 2)` of the saved file against the new API response to detect modifications. This means generation data is safe to re-download — unchanged data is skipped, modified data triggers an overwrite plus tag reconciliation.

### Tag Reconciliation on Modification

When a generation's data changes and `overwriteIfModified` is true, the code compares previous and current media tags. If a tag was removed, the corresponding file in the tag directory is deleted. This only runs when both `all` and at least one other tag directory are configured.

### Platform-Specific Behaviour

`OS` from `node:os.platform()` gates behaviour in several places:
- `openDataDirectory` / `openMediaDirectory`: `explorer` on Windows, `open` elsewhere
- `removeEmptyMediaDirectories` migration: Windows only (v4.0.0–4.1.2)
- Directory cleanup in `removeDirectoryIfEmpty`: handles dot-files (OS metadata)

### Migration System

`migrate()` runs once per version change on startup. It compares `CONFIG.version` to `CURRENT_VERSION` (from `package.json`). After running applicable migrations, it stamps the new version into config. Migrations must be **idempotent** — they may re-run if the version stamp write fails. New migrations go into `migrate.mjs` with a version guard.

### Rate Limiting

Enforced client-side in `civitaiApi.mjs`:
- Data requests: 100ms between calls (`DATA_RATE_LIMIT`)
- Image requests: 100ms between calls (`IMAGE_RATE_LIMIT`), tracked via module-scoped `previousFetch` timestamp

### File Write Patterns

- `writeFile()` in `utils.mjs` auto-creates parent directories via `mkdirp` (default `mkdir: true`).
- Image downloads use `fs.createWriteStream` with flag `wx` (exclusive create — fails if file exists). This prevents overwrites and race conditions.
- `writeFile()` auto-serialises non-string content as pretty JSON.

---

## Control Flow: Download Operation

The primary operation. Understanding this end-to-end is necessary for most bug fixes.

1. **User selects mode** in `downloadGenerationsMenu.mjs`: `latest` (no cursor), `oldest` (starts from first known generation ID), or tag-specific (filters by tag in last 30 days).

2. **`fetchGenerations(options)`** in `downloadActions.mjs` is called. If multiple tags are requested, it calls itself recursively for each tag.

3. **`getAllRequests()`** in `civitaiApi.mjs` paginates the API using cursor-based iteration. Each batch calls the `batchIterator` callback.

4. **`batchIterator()`** (closure in `fetchGenerations`) processes each batch:
   - Checks abort signal
   - Handles API errors (UNAUTHORIZED triggers key update prompt)
   - Updates the `report` object (date range, counts)
   - Calls `saveGenerations()` for the batch

5. **`saveGenerations()`** in `generations.mjs` iterates each generation in the batch:
   - Checks if data file exists
   - If `overwriteIfModified`: loads existing file, compares JSON strings, reconciles tags
   - Saves generation JSON via `saveGenerationData()`
   - If images enabled: calls `saveGenerationMedia()`

6. **`saveGenerationMedia()`** for each media item:
   - Determines which tag directories need the file (`all` + matching tags)
   - Checks which files exist, which are missing
   - Downloads once (to first missing path) via `fetchCivitaiImage()` + stream pipe
   - Copies to remaining tag directories via `fs.copyFile()`
   - On abort: cleans up partial downloads

7. **Pagination continues** until `cursor === previousCursor` (end reached), iterator returns `false` (up-to-date), or abort signal fires.

8. **Progress** is reported via the `log` callback, which by default is `console.log`. The `reportText()` closure formats the current state.

---

## Control Flow: Post Download & Enrichment

1. **`fetchPosts()`** in `downloadPostsActions.mjs` paginates posts via `getAllPostRequests()`.
2. **`savePosts()`** in `posts.mjs` iterates each post:
   - Saves raw post JSON via `savePostData()`
   - **Enrichment 1 — `enrichPostDetail()`**: Calls `post.get` tRPC endpoint for tags, description, availability
   - **Enrichment 2 — `enrichPostImageMeta()`**: Calls `GET /api/v1/images?postId=` REST endpoint. If any image has `hasMeta: true`, fetches generation metadata (prompt, model, seed, etc.) and merges `meta` into each image in the saved JSON.
   - Downloads media via `savePostMedia()` (skips already-existing files)
3. **Backfill**: When a post already exists, the download process still checks for missing enrichments (tags, image metadata) and applies them.

---

## Design: Offline-First UI

**All data must be downloaded ahead of time.** The browser UI works completely offline — it reads only from local files served by the Node.js HTTP server. No network requests are made by the UI except for the download actions in the Settings view.

This means:
- **Every piece of data the UI needs must be included in the download process** — including image generation metadata for posts (prompt, model, sampler, etc.)
- The server index (`serverIndex.mjs`) builds all display data from the local data files at startup and after downloads
- The UI shows an **Offline** badge in download sections when `navigator.onLine` is false
- Download buttons are disabled when offline

---

## Control Flow: Software Update

The self-update system checks the Civitai model page (ID `526058`) in the background on startup, compares versions, and offers an "Install update" menu option when a newer version is found. Installation downloads a ZIP, extracts it, backs up current files, replaces them, and handles dependency changes — with rollback on failure.

For the full process, state management, file layout, known issues, and function reference, see [`software-update.md`](./software-update.md).

---

## Error Handling Patterns

The codebase uses consistent patterns:

- **try/catch + return sentinel**: Most functions return `null`, `false`, or `''` on error rather than throwing. Callers check return values.
- **Error accumulation**: `fetchGenerations` accumulates errors in `report.errors[]` rather than failing on first error.
- **Retry with backoff**: API calls retry up to `MAX_ATTEMPTS = 10` with 1-second delays. Download orchestration retries up to `MAX_FETCH_ATTEMPTS = 10`.
- **Structured error responses**: `errorResponse()` in `civitaiApi.mjs` wraps errors in the same shape as Civitai API errors, so callers don't need to distinguish.
- **Console output**: All error reporting uses `console.log` / `console.error` — there is no logging framework.

---

## NPM Scripts

| Script | Command | Purpose |
|---|---|---|
| `setup` | `npm ci --omit-dev && npm link` | Install deps, link CLI globally |
| `cli` | `node .` | Run interactive CLI |
| `auto-fetch` | `node src/commands.mjs auto-fetch` | Continuous download loop |
| `remove-deleted` | `node src/commands.mjs remove-deleted` | Clean up on-site deleted media |
| `lint` | `eslint index.mjs && eslint src` | Lint all source |

