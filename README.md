# civitai-sync

civitai-sync is a tool to download your Civitai creations.

It downloads images from the onsite generator, and saves the generation data so that prompts can be searched as text. Everything is saved in date-ordered folders. Images are named to be in chronological order.

`Favorited` (or `liked` or `disliked`) generations can be saved into media folders for quick access, and data can be filtered to only download those types of generations.

Model page:
https://civitai.com/models/526058

Discussion page for ideas, issues, newest comments:
https://civitai.com/articles/5676


The program is a Command Line Interface (CLI).  
It runs in your computer terminal, or command prompt.


## Install it

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
  npm install
```

Create a Civitai API key in your account:  
https://civitai.com/user/account


## Run it

```
  npm run cli
```
A configuration file for user settings will be saved in the program folder at "/config/default.json".


## Multiple accounts

To download from more than one account, specify a unique name:

```
  npm run cli bob
```

You can give a full path to anywhere on the file system, and the config file will be loaded from or created there.

Then change the download directory to be different for the new account.


## Download directory

You can set the directory to be anywhere on the file system, e.g. an external drive:

"Download generations" > "Options" > "Change download directory"


## Manual software update

Software updates are now automatically handled by the program.

To manually update from an older version:

- Download the latest program file [from the model page](https://civitai.com/models/526058) and unzip it
- Copy the unzipped files into your existing civitai-sync program folder, overwriting older files.
- As in the "Install" step above, `cd` change directory to the program folder and run `npm install`, or on Windows double-click on `install_win`.
