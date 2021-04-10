# Discord Player
Complete framework to facilitate music commands using **[discord.js](https://discord.js.org)**.

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)

> WIP

## Installation

### Install **[discord-player](https://npmjs.com/package/discord-player)**

```sh
$ npm install --save discord-player
```

### Install **[@discordjs/opus](https://npmjs.com/package/@discordjs/opus)**

```sh
$ npm install --save @discordjs/opus
```

### Install FFmpeg or Avconv
- Official FFMPEG Website: **[https://www.ffmpeg.org/download.html](https://www.ffmpeg.org/download.html)**

- Node Module (FFMPEG): **[https://npmjs.com/package/ffmpeg-static](https://npmjs.com/package/ffmpeg-static)**

- Avconv: **[https://libav.org/download](https://libav.org/download)**

# Features
- Simple & easy to use 🤘
- Beginner friendly 😱
- Audio filters 🎸
- Lightweight 🛬
- Custom extractors support 🌌
- Lyrics 📃

# Sources supported
> By default, **discord-player** supports `youtube`, `spotify`, `soundcloud`, `vimeo`, `reverbnation`, `facebook` and `attachment links` only.

**Discord Player** provides **extractor API** that enables you to use your custom stream extractor with it. For example, you can use **youtube-dl** with **discord-player** like this:

```js
const { Downloader } = require("@discord-player/downloader"); // YouTubeDL instance

player.use("EXAMPLE", Downloader); // now discord-player supports 700+ sites :poggies:
```

or you can build your own :D

# License
MIT License

Copyright (c) 2020-present Androz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.