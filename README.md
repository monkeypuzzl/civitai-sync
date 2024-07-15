# civitai-sync

civitai-sync is a computer-based tool to download your Civitai onsite generations, and to keep downloading in future when you create more.

It downloads each image in your generation feed, and saves the generation data so that prompts can be searched as text. Everything is saved in date-ordered folders. Images are named to be in chronological order.

Tool page, for full details:
https://civitai.com/models/526058

Check the newest discussion on the article about the tool:
https://civitai.com/articles/5676


The program is a Command Line Interface (CLI).  
It runs in your computer terminal / command prompt.


## Install

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

Install the software dependencies (npm = Node Package Manager):

```
  npm install
```

You'll need to create a Civitai API key in your account:  
https://civitai.com/user/account


## Run

```
  npm run cli
```
A configuration file for user settings will be saved in the program folder, at  
"/config/default.json"


## Multiple accounts
To download more than one account, specify a unique name and path for the config file:

npm run cli config/bob

This will save a config file "bob.json" inside the program folder within the "config" folder.  
You can give a full path to anywhere on the file system, and the config file will be loaded from there.


## Download location
You can set the location to be anywhere on the file system.

It is recommended to change the download location to a folder outside of the program - because if you later update or re-install the program, you may accidentally copy over the whole folder, including your downloads.

Select "Download options" > "Data download location"  
And "Download options" > "Media download location"

## Migrate from v2
If you have already downloaded your generations with v2:

- Rename your existing "generations/data" folder to something like "generations/data.old"
- Download the latest program file and unzip it
- Move your existing "config" and "generations" folder into the new version program folder

When you next use "Download generations", all the data files will be downloaded again. Already downloaded images will not need to be re-downloaded; they will be renamed to be in chronological order.
