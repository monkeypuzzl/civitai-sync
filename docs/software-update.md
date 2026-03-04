# Software Update Process

The self-update system allows `civitai-sync` to update itself from the Civitai model page without Git. All logic lives in `src/softwareUpdate.mjs` with supporting roles from `src/cli.mjs` (startup trigger), `src/mainMenu.mjs` (user-facing option), `src/childProcess.mjs` (npm commands), and `src/civitaiApi.mjs` (HTTP client).

---

## Overview

```
Startup
  │
  ├─ checkForSoftwareUpdate()        ← background, not awaited
  │    ├─ load file cache             ← software-updates/versions.json
  │    ├─ if stale (>12h) or forced:
  │    │    ├─ fetch model metadata   ← Civitai API /models/526058
  │    │    ├─ extract version        ← regex on version name
  │    │    ├─ compare versions       ← isLaterVersionThan()
  │    │    └─ save to file cache
  │    └─ set SOFTWARE.hasUpdate
  │
  ├─ abort signal fires              ← causes menu to re-render
  │
  └─ mainMenu shows "Install update" if SOFTWARE.hasUpdate
       │
       └─ updateSoftware()
            ├─ downloadSoftwareUpdate()
            ├─ unzipSoftwareUpdate()
            ├─ installSoftwareUpdate()
            │    ├─ version guard
            │    ├─ dependency update (if changed)
            │    ├─ file backup + copy
            │    ├─ directory backup + copy
            │    └─ rollback on failure
            ├─ verify installed version
            └─ cleanupSoftwareUpdateArtifacts()
                 ├─ delete ZIP
                 ├─ delete extracted dir
                 └─ prune old backups (keep newest)
```

---

## State: The `SOFTWARE` Singleton

Module-scoped mutable object in `softwareUpdate.mjs`:

```javascript
export const SOFTWARE = {
  current: {},       // unused in current code
  latest: {},        // { id, name, availability, downloadUrl, summary, version }
  hasUpdate: false,  // true if latest.version > CURRENT_VERSION
  checkedAt: 0       // Date.now() timestamp of last check
};
```

Additional field written during check:
- `currentVersion` — the running version (from `package.json`), used to validate the file cache.

This object is imported directly by `mainMenu.mjs` to read `SOFTWARE.hasUpdate` and `SOFTWARE.latest`.

---

## File Cache

**Path**: `software-updates/versions.json`

Contains a serialised copy of the `SOFTWARE` object. Purpose: avoid re-checking the API on every startup within the 12-hour window.

**Cache validity**: The cache is only trusted if `cached.currentVersion === CURRENT_VERSION`. After an update changes the version, the cache is invalidated and a fresh check occurs.

**Cache lifetime**: 12 hours (`SOFTWARE_UPDATE_CHECK_EVERY = 12`), compared as `Date.now() - SOFTWARE.checkedAt > 12 * 1000 * 60 * 60`.

---

## Step 1: Startup Trigger (`cli.mjs`)

In `launchCLI()`:

```javascript
const abortController = new AbortController();

checkForSoftwareUpdate()
.then(() => {
  abortController.abort();
})
.catch(console.error);

mainMenu({ abortSignal: abortController.signal });
```

The check runs concurrently with the menu. When the check resolves, `abortController.abort()` fires, which causes the `@inquirer/select` prompt in `mainMenu` to throw (caught by the `catch (ignoreErr)` block). The menu then re-renders via `return mainMenu()` at the bottom of the function, now with `SOFTWARE.hasUpdate` potentially `true`, adding the "Install update" option.

This means:
- The update check never blocks the user from interacting with the menu.
- If the check completes while the user is already in a sub-menu, the abort signal is consumed but has no visible effect until they return to the main menu.
- The abort signal is only passed to the first `mainMenu()` call; recursive calls do not receive it.

---

## Step 2: Check for Updates (`checkForSoftwareUpdate`)

Called at startup (background) and again with `{ force: true }` when the user triggers an install.

### Logic

1. **Load file cache** (first call only, when `SOFTWARE.checkedAt` is `0`):
   - Read `software-updates/versions.json`.
   - If it exists and `cached.currentVersion === CURRENT_VERSION`, copy all fields into the `SOFTWARE` singleton.

2. **Decide whether to fetch**:
   - Fetch if `force === true`, or `SOFTWARE.checkedAt` is `0` (no cache loaded), or more than 12 hours have elapsed.

3. **Fetch latest version info**:
   - `getCivitaiSyncLatestInfo()` → `fetchModelLatestVersion(APP_MODEL_ID)` → `fetchModel(526058)`.
   - Filters model versions to `Published` + (`Public` or `EarlyAccess`).
   - Sorts by `publishedAt` descending, takes the first.
   - Extracts version string from `name` via regex `/^v(\d+(?:\.\d+){0,2})/`.
   - Extracts release summary from `description` via regex `/<p>([^<]*)<\/p>/` (first paragraph).

4. **Compare versions**:
   - `isLaterVersionThan(latest.version, CURRENT_VERSION)` — manual semver comparison (major → minor → patch). Pads to 3 components. Returns `true` only if strictly later (not equal).

5. **Persist**: Write `SOFTWARE` to `software-updates/versions.json`.

### Return value

Returns the `SOFTWARE` object. If the API call fails, returns `SOFTWARE` with whatever state it had (possibly from cache).

---

## Step 3: User Triggers Install (`mainMenu.mjs`)

When the user selects "Install software update":

```javascript
case 'software-update':
  secretKey = keySaved ? await getSecretKey() : undefined;
  if (await updateSoftware({ secretKey }) === true) {
    return;  // exits the menu loop
  }
  break;     // falls through to re-render menu
```

The secret key is passed because Early Access downloads may require authentication.

---

## Step 4: `updateSoftware()`

Orchestrator function. Calls the three stages in sequence.

1. **Re-check** with `force: true` to get fresh download URL.
2. **Download**: `downloadSoftwareUpdate(latest.downloadUrl, latest.version, { secretKey })`.
3. **Extract**: `unzipSoftwareUpdate(latest.version)`.
4. **Install**: `installSoftwareUpdate(latest.version)`.
5. **Verify**: Read installed `package.json` and confirm version matches expected.
6. **Cleanup**: `cleanupSoftwareUpdateArtifacts(latest.version)` (only on verified success).

### Early Access handling

If download fails and `latest.availability === 'EarlyAccess'`, a specific message directs the user to unlock the version on the model page. Otherwise a generic "could not download" message is shown.

### On success

Verifies the installed `package.json` version matches the expected version. If verification passes, calls `cleanupSoftwareUpdateArtifacts()` to remove the ZIP, extracted directory, and all but the most recent backup. Prints `"Software updated. Please restart."` and returns `true`. The menu loop exits. There is a commented-out `spawnChild` call that would have auto-restarted the CLI.

If verification fails (version mismatch), the update is treated as a failure — cleanup is skipped so backup files remain available for manual recovery.

### On failure

Prints `"Could not install software update"` and returns `false`. The menu re-renders.

---

## Step 5: Download (`downloadSoftwareUpdate`)

**ZIP path**: `software-updates/civitai-sync-v{version}.zip`

- If the ZIP already exists, returns `true` immediately (idempotent).
- Otherwise calls `fetchFile(url, zipFilepath, { secretKey })` from `civitaiApi.mjs`.
- `fetchFile` streams the response body to disk via `fs.createWriteStream` with flag `wx` (exclusive create).
- `fetchFile` rejects `text/plain` responses (error pages masquerading as downloads).

---

## Step 6: Extract (`unzipSoftwareUpdate`)

**Extract path**: `software-updates/{version}/`

- If the extract directory already exists, returns `true` immediately (idempotent).
- Creates the directory via `mkdirp`.
- Extracts using `extract-zip` library.

---

## Step 7: Install (`installSoftwareUpdate`)

The install stage replaces program files with the new version, with full rollback on failure:

1. **Version guard** — aborts if the new version is not later than the current one
2. **Dependency update** (conditional) — if `dependencies` in `package.json` have changed, runs `npm ci --omit-dev` to update `node_modules/`
3. **Backup** — moves current root files and `src/` directory to a timestamped backup directory in `software-updates/`
4. **Copy** — copies new files from the extracted ZIP into the app directory
5. **Rollback** — on any failure, undo operations execute in reverse order, restoring the previous state

---

## Files on Disk After Update

After a successful, verified update, `cleanupSoftwareUpdateArtifacts()` removes the ZIP, the extracted version directory, and all but the most recent backup directory:

```
software-updates/
  versions.json                          # cache (SOFTWARE singleton)
  backup-20250215143022123/              # most recent backup (kept)
    package.json
    index.mjs
    src/
    node_modules/                        # only if dependencies changed
    npm-log.txt                          # only if dependencies changed
```

If the update fails or verification fails, cleanup is skipped and all artifacts remain:

```
software-updates/
  versions.json
  civitai-sync-v4.2.0.zip               # downloaded ZIP
  4.2.0/                                 # extracted ZIP
    ...
  backup-20250215143022123/              # backup of previous version
    ...
  backup-20250114120000000/              # older backups
    ...
```

---

## Known Issues and Limitations

### v4.1.3 auto-update fails when dependencies change

Versions up to v4.1.3 had a bug where `childProcess.mjs` rejected the promise on any stderr output, including warnings. Since `npm ci` routinely writes to stderr, auto-updates that trigger dependency installation would fail and roll back. This is fixed in v5.0.0+ where `childProcess.mjs` only rejects on a non-zero exit code.

### Git Repository Detection Unused

`isGit()` exists and there is a commented-out block in `updateSoftware()` that would have warned Git users to use `git pull` instead. Currently, the self-update runs the same way regardless of whether `.git` exists.

### No Concurrent Update Protection

Nothing prevents two instances of civitai-sync from attempting the same update simultaneously. File moves and copies could conflict.

---

## Dependency Management

Understanding the distinction between `dependencies` and `devDependencies` is important for the auto-update system and for end-user installations.

### Runtime vs build-time

| Category | `package.json` field | Installed by `npm run setup`? | Purpose |
|---|---|---|---|
| Runtime | `dependencies` | Yes (`npm ci --omit-dev`) | Packages imported by `src/*.mjs` at runtime (CLI, server, API client) |
| Build-time | `devDependencies` | No | Packages used only during development: linting, bundling, UI framework |

The `npm run setup` command (`npm ci --omit-dev && npm link`) is run by end users. It installs only `dependencies`. Any package not needed at runtime must be in `devDependencies` to keep installations lean and avoid unnecessary `npm ci` triggers during auto-updates.

### Current classification

| Package | Field | Reason |
|---|---|---|
| `@inquirer/*`, `inquirer` | `dependencies` | CLI prompt rendering at runtime |
| `chalk` | `dependencies` | Terminal styling at runtime |
| `extract-zip` | `dependencies` | ZIP extraction during self-update |
| `mkdirp` | `dependencies` | Directory creation at runtime |
| `preact` | `devDependencies` | UI framework — only used at build time by esbuild; the built bundle (`src/ui/app.js`) ships instead |
| `esbuild` | `devDependencies` | UI bundler — build time only |
| `eslint`, `@eslint/js`, `globals` | `devDependencies` | Linting — development only |

