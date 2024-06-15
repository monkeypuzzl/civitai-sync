# civitai-sync

Download and save your Civitai on-site generations to your computer.  
Unofficial, third-party software.

Download a zip of the app:  
https://github.com/premasagar/civitai-sync/archive/refs/heads/main.zip

## About
Using your secret key from the Civitai website, this performs the
equivalent of scrolling through your on-site generations and downloading
each image individually. It downloads the generation data and media into
date-ordered subdirectories.

![cli-01](https://github.com/premasagar/civitai-sync/assets/116809/6fef785b-746f-4a95-9cbd-205ebf736777)

## Install

Install node.js v18+, and download civitai-sync

```
  cd civitai-sync
  npm install
```

## Usage

```
  cd civitai-sync
  npm run cli
```

By default, a config file is saved at "`config/default.json`".

Specify a custom config location, with optional "`.json`":

```
  npm run cli config/bob
```

The config location can be anywhere on the filesystem: 

```
npm run cli /bob/civitai/alice.json
```

## Find your secret key

- In your browser, go to the [Civitai website](https://civitai.com) (you must be logged in)
- Open **"Developer Tools"** (press "Ctrl+Shift+I" / "F12", or choose
"More tools" in the browser menu).
- Open the "**Storage**" tab (Firefox) or "**Application**" tab (Chrome/Brave)
- Open the "**Cookies**" list, and click on "**`https://civitai.com`**".
- Click the cookie named "**`__Secure-civitai-token`**" and copy the value.


https://github.com/premasagar/civitai-sync/assets/116809/eb516635-a766-43a2-8e53-7c43d497a8be


## Set your secret key

- Back here, in the menu, choose "**Set secret key**".
- Paste your secret key (right-click, or use "Ctrl+Shift+V" or equivalent).
- Optionally, you can encrypt your key with a password.

![cli_05](https://github.com/premasagar/civitai-sync/assets/116809/119a324c-df2d-49f6-88c3-cbbfd3d315f6)

The key will expire within a month.
The expiry date is shown in the browser Cookies list.

When it expires, go to "**Key options**" > "**Update secret key**".

In future, this process could be automated via a browser extension.
Or an official API.

## Download generations

Once your key is saved, you'll have the option "**Download generations**".
Wait until any current on-site generations are complete, to ensure
those images are saved.

Change download location and other options in "**Download options**".

Once you've downloaded your back catalogue, you can do so again at any
time, and only your latest will be downloaded.

If your first download was stopped early or interrupted, to resume downloading older items,
choose "**Download options**" > "**Download oldest**".

If you need to fill any gaps in your download record, e.g. because of deleted files, or you download only data and then want images,
choose "**Download options**" > "**Download missing**".

By [Prem](https://premasagar.com)
