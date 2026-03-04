# civitai-sync

[civitai-sync](https://civitai.com/models/526058) is a tool to download and explore your Civitai creations.

---

* Download generations from the Civitai generator
* Download posts from your public profile
* Browse your creations offline, with the mini-website Explorer
* Data and media is saved in date-ordered folders.
* Auto-updates for new versions

---

Model page:
https://civitai.com/models/526058

Discussion page for ideas, issues:
https://civitai.com/articles/5676


The program comes in 2 parts:

- *Command Line Interface* (CLI). It runs in your computer terminal or command prompt
- *Explorer*, a mini-website to browse your creations.

_Civitai_ saves your generations for 30 days, so use the tool regularly.


## Installation

Install [Node.js](https://nodejs.org)  
If you already have Node, it needs version 18 or above.

Download the zip archive of the program from the tool page.  
Or download/clone the repository.

On Windows, you can double-click the `install_win` file to install, or continue...

In the terminal/command prompt (not the Node.js console),  
`cd` change directory to the program folder:

```
  ## Linux, Mac
  cd Downloads/civitai-sync

  ## Windows – use backslashes, not forward slashes
  cd C:\Downloads\civitai-sync
```

Install the software dependencies by typing:

```
  npm run setup
```

Create a Civitai API key in your account:  
https://civitai.com/user/account


## Run it

```
  npm run cli
```
A configuration file for user settings will be saved in the program folder at "/config/default.json".

Start Downloading
If your API key is saved, you can choose "Download generations" and "Download posts".

See “Options” to change what is download and where it is saved.
Download Location: inside the program folder in "data" and "media"; you can change to another location.
Choose: to make folders for your ❤️ favorited and 👍 liked gens, or to download only data.

Latest: download your most recent creations.
Or download just “Favorite / Liked” gens.

Open the Explorer
☞ Click "Start Explorer"

Data
Data is saved directly from Civitai's API, as text files (in “JSON” format). Prompts and metadata are already embedded in the media metadata (e.g. "EXIF" format).

You can explore the generation parameters and details for images and videos, in the civitai-sync Explorer.


## Multiple accounts

To download from more than one account, specify a unique name:

```
  npm run cli bob
```

You can give a full path to anywhere on the file system, and the config file will be loaded from or created there.

Change the download directory to be different for each account, unless you want the data and media for the accounts to be merged.


## Manual software update

Software updates are automatically handled by the program. You can trigger a manual check from the main menu ("Check for updates").

To manually update from an older version:

- Download the latest program file [from the model page](https://civitai.com/models/526058) and unzip it
- Copy the unzipped files into your existing civitai-sync program folder, overwriting older files
- In the terminal, `cd` to the program folder and run `npm run setup`, or on Windows double-click on `install_win`
