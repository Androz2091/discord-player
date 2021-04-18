# Discord Player
Complete framework to facilitate music commands using **[discord.js](https://discord.js.org)**.

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)

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
- Multiple sources support ✌
- Play in multiple servers at the same time 🚗

## [Documentation](https://discord-player.js.org)

## Getting Started

Here is the code you will need to get started with discord-player. Then, you will be able to use `client.player` everywhere in your code!

```js
const Discord = require("discord.js"),
client = new Discord.Client,
settings = {
    prefix: "!",
    token: "Your Discord Token"
};

const { Player } = require("discord-player");

// Create a new Player (you don't need any API Key)
const player = new Player(client);

// To easily access the player
client.player = player;

// add the trackStart event so when a song will be played this message will be sent
client.player.on("trackStart", (message, track) => message.channel.send(`Now playing ${track.title}...`))

client.once("ready", () => {
    console.log("I'm ready !");
});

client.on("message", async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // !play Despacito
    // will play "Despacito" in the voice channel
    if(command === "play"){
        client.player.play(message, args[0]);
        // as we registered the event above, no need to send a success message here
    }

});

client.login(settings.token);
```

# Other Examples
## Using Cookies

```js
const player = new Player(client, {
    ytdlDownloadOptions: {
        requestOptions: {
            headers: {
                cookie: "YOUR_YOUTUBE_COOKIE"
            }
        }
    }
});
```

## Using Proxy

```js
const HttpsProxyAgent = require("https-proxy-agent");

// Remove "user:pass@" if you don't need to authenticate to your proxy.
const proxy = "http://user:pass@111.111.111.111:8080";
const agent = HttpsProxyAgent(proxy);

const player = new Player(client, {
    ytdlDownloadOptions: {
        requestOptions: { agent }
    }
});
```

# Sources supported
> By default, **discord-player** supports `youtube`, `spotify`, `soundcloud`, `vimeo`, `reverbnation`, `facebook` and `attachment links` only.

**Discord Player** provides **extractor API** that enables you to use your custom stream extractor with it. For example, you can use **youtube-dl** with **discord-player** like this:

```js
const { Downloader } = require("@discord-player/downloader"); // YouTubeDL instance

player.use("EXAMPLE", Downloader); // now discord-player supports 700+ sites :poggies:
```

or you can build your own :D

## Examples of bots made with Discord Player

These bots are made by the community, they can help you build your own!

* [AtlantaBot](https://github.com/Androz2091/AtlantaBot) by [Androz2091](https://github.com/Androz2091)
* [Discord-Music](https://github.com/inhydrox/discord-music) by [inhydrox](https://github.com/inhydrox)
* [Music-bot](https://github.com/ZerioDev/Music-bot) by [ZerioDev](https://github.com/ZerioDev)

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
