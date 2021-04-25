# Discord Player
Complete framework to facilitate music commands using **[discord.js](https://discord.js.org)**.

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![discordBadge](https://img.shields.io/discord/558328638911545423?style=for-the-badge&color=7289da)](https://androz2091.fr/discord)

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

## Supported websites

By default, discord-player supports **YouTube**, **Spotify** and **SoundCloud** streams only.

### Optional dependencies

Discord Player provides an **Extractor API** that enables you to use your custom stream extractor with it. Some packages have been made by the community to add new features using this API.

#### [@discord-player/extractor](https://github.com/Snowflake107/discord-player-extractors) (optional)

Optional package that adds support for `vimeo`, `reverbnation`, `facebook`, `attachment links` and `lyrics`.
You just need to install it using `npm i --save @discord-player/extractor` (discord-player will automatically detect and use it).

#### [@discord-player/downloader](https://github.com/DevSnowflake/discord-player-downloader) (optional)

`@discord-player/downloader` is an optional package that brings support for +700 websites. The documentation is available [here](https://github.com/DevSnowflake/discord-player-downloader).

## Examples of bots made with Discord Player

These bots are made by the community, they can help you build your own!

* [AtlantaBot](https://github.com/Androz2091/AtlantaBot) by [Androz2091](https://github.com/Androz2091)
* [Discord-Music](https://github.com/inhydrox/discord-music) by [inhydrox](https://github.com/inhydrox)
* [Music-bot](https://github.com/ZerioDev/Music-bot) by [ZerioDev](https://github.com/ZerioDev)

## Advanced

### Use cookies

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

### Use custom proxies

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
