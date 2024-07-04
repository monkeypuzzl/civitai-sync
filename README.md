# civitai-sync

A tool to download your onsite Civitai generations in one go. It downloads every image in your generation feed, and also saves the generation data so that prompts can be searched as text.

Everything is saved in date-ordered folders. You can re-run it after you have generated more, and it will only download your latest.

Tool page, for full details:
https://civitai.com/models/526058

The original article on the downloader, with discussion:
https://civitai.com/articles/5676


The program is a Command Line Interface (CLI).  
It runs in your computer terminal / command prompt.


## Install

Install [Node.js](https://nodejs.org)  
If you already have Node, it needs version 18 or above.

Download the zip archive of the program from the tool page.  
Or download/checkout the repository.

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
