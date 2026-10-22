# What is in this repository

This repository is the program. `index.mjs` starts it. `src/` is the command-line interface, the downloads, and the Explorer server. `src/ui/` is the Explorer that server serves. `dev/ui/src` is the Explorer source. `dev/ui/build.mjs` writes that source into `src/ui/`.

Screens live under `dev/ui/src/components`. The address bar is read and written by `dev/ui/src/lib/router.js` and `dev/ui/src/lib/url-state.js`.

A clone contains:

- `index.mjs`
- `src/`
- `dev/ui/`
- `package.json` and `package-lock.json`
- `README.md` and `LICENSE`
- `install_win.cmd`, `Civitai-Sync.cmd`, and `Civitai-Sync-Explorer.cmd`
- `eslint.config.mjs`
- `docs/codebase.md` and `docs/api.md`

After a run, your own files sit beside that tree and are not part of the git history. `config/` holds the account settings. `data/` holds the saved JSON. `media/` holds the files. Generations, posts, and comics are grouped by date. The Explorer's list is built from that JSON. A media item is one image, video, audio file, or mesh. A generation, a post, or a comic is a container that holds media items.

A download from the command line, or from the Explorer Download page, writes those files. The Explorer then reads them on this computer. The Civitai calls are listed in `docs/api.md`.

`npm run setup` installs the packages the program needs to run, and skips the packages used only to build the Explorer. The Explorer already built into `src/ui/` runs without a build step. Changing `dev/ui/src` takes `npm install`, so the build tools are present, and then `npm run build:ui`.
