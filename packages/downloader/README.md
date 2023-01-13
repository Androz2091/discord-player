# Downloader
Extractor for **[discord-player](https://npmjs.com/package/discord-player)** using **[youtube-dl](https://npmjs.com/package/youtube-dl)**.

# Installing

```sh
npm i @discord-player/downloader
```

# Example
## General
```js
const downloader = require("@discord-player/downloader").Downloader;
const fs = require("fs");
const url = "https://soundcloud.com/dogesounds/alan-walker-feat-k-391-ignite";

const stream = downloader.download(url);
stream.pipe(fs.createWriteStream("./song.mp3"));
```

## With Discord Player
```js
const downloader = require("@discord-player/downloader").Downloader;

player.use("YOUTUBE_DL", downloader); // enables youtube-dl extractor for discord-player
```