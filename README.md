# civitai-sync

[civitai-sync](https://civitai.com/models/526058) is a tool to download and explore your Civitai creations.

---

* Download generations, posts, comics, and 3D
* Auto download, on a delay from 5 minutes to 1 day
* Explore your library in an offline website
* Filter by rating, post tags, and content tags
* Media and data saved to the file system, sorted by date
* Export media for re-use
* Auto-updates for new versions

---

Talk about civitai-sync, on Civitai:

*Model page*:
https://civitai.com/models/526058

*Discussion page* for issues, ideas and comments:
https://civitai.com/articles/5676

---

The software is:
1. A *Command Line Interface* (CLI). It runs in a terminal or command prompt, with interactive options and settings.
2. An *Explorer*, a website for browsing, searching and re-using your media.


## Installation

Install [Node.js](https://nodejs.org).
This build runs on Node 18 and newer. It is tested on Node 20 and newer. Below Node 18, civitai-sync stops before it moves any files.

To upgrade Node that you installed from nodejs.org, close civitai-sync. Download the current long-term support installer: the Windows Installer (`.msi`) on Windows, or the macOS Installer (`.pkg`) on a Mac. Run it and accept the defaults. It replaces the Node that installer put there before. Open a terminal, run `node -v`, and open civitai-sync again. If `node -v` is still the old version, Node is also installed another way. This installer did not replace that copy.

Download the zip archive of the program from the model page.  
Or download/clone the repository.

1. On Windows, double-click the `install_win` file to install. This will open a command prompt, install the software dependencies and then close. Or, install manually with the steps below.

2. On Linux, Mac, open your Terminal app (not the Node.js console).
On Windows, your “[Command Prompt](https://www.lifewire.com/how-to-open-command-prompt-2618089)”.

3. Inside the terminal, _change directory_ (`cd`) to the unzipped "*civitai-sync*" folder. Ensure this matches the name and location on your system. For example:
```
cd Downloads/civitai-sync
```

On Windows, use backslashes, not forward-slashes, e.g:
```
cd C:\Downloads\civitai-sync
```

4. Install the software dependencies by typing:
```
npm run setup
```


*Create a Civitai API key* in your account:  
https://civitai.com/user/account/security

Save it in the CLI, or on the Explorer's Download page.


## Open the civitai-sync CLI

On Windows, you can double-click the `Civitai-Sync` file to open the CLI.

To open the CLI from the terminal, type:
```
civitai-sync
```

This is an alias for:
```
npm run cli
```

A configuration file for the user is saved in the civitai-sync folder at `/config/default.json`.

*Start Downloading*
If your API key is saved, you can choose *Download*.  
Check the *Settings*, to change download folder, civitai domain, etc.

_Civitai_ keeps generations for 30 days, so download regularly.


*Start the Explorer*
Start the Explorer from the CLI.

Or, without the CLI:
```
civitai-sync explorer [optional: account, e.g. "bob"]
```

This is an alias for:
```
npm run explorer [account]
```

On Windows, double-click `Civitai-Sync-Explorer` in the program folder; this uses the default config.

*Data*
Data from Civitai's API is saved as JSON text files. Prompts and metadata are already embedded in the downloaded media's metadata (e.g. "EXIF" format).


## Multiple accounts

To download from more than one account, give a unique name:
```
civitai-sync bob
```

This is an alias for:

```
npm run cli -- bob
```

A new name starts with its own folders, `data-bob` and `media-bob`. The default config stays on `data` and `media`. An existing named config keeps its folders.

Or give a full path to anywhere on the file system, and the config file will be loaded from or created there.


**Network access**

By default the Explorer is only reachable from the machine it runs on (it binds to `127.0.0.1`). To access it from other devices on your trusted local network — a phone, tablet, or another computer — add the `--host` flag:

```
civitai-sync explorer [account] --host
```

This is an alias for:
```
npm run explorer -- [account] --host
```

This binds the server to all network interfaces (`0.0.0.0`). The terminal will print both the local address and the LAN address to share with other devices.

> **Security note:** Anyone on your local network who can reach the port will have read access to your library, through the Explorer.


## Manual software update

Software updates are automatically handled by the program. You can trigger a manual check from the main menu ("Check for updates").

To manually update from an older version:

- Download the latest program file [from the model page](https://civitai.com/models/526058) and unzip it
- Copy the unzipped files into your existing civitai-sync program folder, overwriting older files
- In the terminal, `cd` to the program folder and run `npm run setup`, or on Windows double-click on `install_win`
