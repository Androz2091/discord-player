# Discord Player
Complete framework to facilitate music commands using **[discord.js](https://discord.js.org)**.

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![discordBadge](https://img.shields.io/discord/558328638911545423?style=for-the-badge&color=7289da)](https://androz2091.fr/discord)
[![wakatime](https://wakatime.com/badge/github/Androz2091/discord-player.svg)](https://wakatime.com/badge/github/Androz2091/discord-player)
[![CodeFactor](https://www.codefactor.io/repository/github/androz2091/discord-player/badge/v5)](https://www.codefactor.io/repository/github/androz2091/discord-player/overview/v5)

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
- Lightweight ☁️
- Custom extractors support 🌌
- Multiple sources support ✌
- Play in multiple servers at the same time 🚗
- Does not inject anything to discord.js or your discord.js client 💉
- Allows you to have full control over what is going to be streamed 👑

## [Documentation](https://discord-player.js.org)

## Getting Started

First of all, you will need to register slash commands:

```js
const { REST } = require("@discordjs/rest");
const { Routes, ApplicationCommandOptionType } = require("discord.js");

const commands = [
  {
    name: "play",
    description: "Plays a song!",
    options: [
        {
            name: "query",
            type: ApplicationCommandOptionType.String,
            description: "The song you want to play",
            required: true
        }
    ]
  }
];

const rest = new REST({ version: "10" }).setToken("BOT_TOKEN");

(async () => {
  try {
    console.log("Started refreshing application [/] commands.");

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });

    console.log("Successfully reloaded application [/] commands.");
  } catch(error) {
    console.error(error);
  }
})();
```

Now you can implement your bot's logic:

```js
const { Client } = require("discord.js");
const client = new Discord.Client({
    intents: [
        "Guilds",
        "GuildVoiceStates"
    ]
});
const { Player } = require("discord-player");

// Create a new Player (you don't need any API Key)
const player = new Player(client);

// add the trackStart event so when a song will be played this message will be sent
player.on("trackStart", (queue, track) => queue.metadata.channel.send(`🎶 | Now playing **${track.title}**!`))

client.once("ready", () => {
    console.log("I'm ready !");
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // /play track:Despacito
    // will play "Despacito" in the voice channel
    if (interaction.commandName === "play") {
        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "You are not in my voice channel!", ephemeral: true });
        const query = interaction.options.getString("query");
        const queue = player.createQueue(interaction.guild, {
            metadata: {
                channel: interaction.channel
            }
        });
        
        // verify vc connection
        try {
            if (!queue.connection) await queue.connect(interaction.member.voice.channel);
        } catch {
            queue.destroy();
            return await interaction.reply({ content: "Could not join your voice channel!", ephemeral: true });
        }

        await interaction.deferReply();
        const track = await player.search(query, {
            requestedBy: interaction.user
        }).then(x => x.tracks[0]);
        if (!track) return await interaction.followUp({ content: `❌ | Track **${query}** not found!` });

        queue.play(track);

        return await interaction.followUp({ content: `⏱️ | Loading track **${track.title}**!` });
    }
});

client.login("BOT_TOKEN");
```

## Supported websites

By default, discord-player supports **YouTube**, **Spotify** and **SoundCloud** streams only.

### Optional dependencies

Discord Player provides an **Extractor API** that enables you to use your custom stream extractor with it. Some packages have been made by the community to add new features using this API.

#### [@discord-player/extractor](https://github.com/DevAndromeda/discord-player-extractors) (optional)

Optional package that adds support for `vimeo`, `reverbnation`, `facebook`, `attachment links` and `lyrics`.
You just need to install it using `npm i --save @discord-player/extractor` (discord-player will automatically detect and use it).

#### [@discord-player/downloader](https://github.com/DevAndromeda/discord-player-downloader) (optional)

`@discord-player/downloader` is an optional package that brings support for +700 websites. The documentation is available [here](https://github.com/DevAndromeda/discord-player-downloader).

## Examples of bots made with Discord Player

These bots are made by the community, they can help you build your own!

* **[Discord Music Bot](https://github.com/Androz2091/discord-music-bot)** by [Androz2091](https://github.com/Androz2091)
* [Dodong](https://github.com/nizeic/Dodong) by [nizeic](https://github.com/nizeic)
* [Musico](https://github.com/Whirl21/Musico) by [Whirl21](https://github.com/Whirl21)
* [Eyesense-Music-Bot](https://github.com/naseif/Eyesense-Music-Bot) by [naseif](https://github.com/naseif)
* [Music-bot](https://github.com/ZerioDev/Music-bot) by [ZerioDev](https://github.com/ZerioDev)
* [AtlantaBot](https://github.com/Androz2091/AtlantaBot) by [Androz2091](https://github.com/Androz2091) (**outdated**)
* [Discord-Music](https://github.com/inhydrox/discord-music) by [inhydrox](https://github.com/inhydrox) (**outdated**)

## Advanced

### Smooth Volume

Discord Player will by default try to implement this. If smooth volume does not work, you need to add this line at the top of your main file:

```js
// CJS
require("discord-player/smoothVolume");

// ESM
import "discord-player/smoothVolume"
```

> ⚠️ Make sure that line is situated at the **TOP** of your **main** file.

### Use cookies

```js
const player = new Player(client, {
    ytdlOptions: {
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
    ytdlOptions: {
        requestOptions: { agent }
    }
});
```

> You may also create a simple proxy server and forward requests through it.
> See **[https://github.com/http-party/node-http-proxy](https://github.com/http-party/node-http-proxy)** for more info.

### Custom stream Engine

Discord Player by default uses **[node-ytdl-core](https://github.com/fent/node-ytdl-core)** for youtube and some other extractors for other sources.
If you need to modify this behavior without touching extractors, you need to use `createStream` functionality of discord player.
Here's an example on how you can use **[play-dl](https://npmjs.com/package/play-dl)** to download youtube streams instead of using ytdl-core.

```js
const playdl = require("play-dl");

// other code
const queue = player.createQueue(..., {
    ...,
    async onBeforeCreateStream(track, source, _queue) {
        // only trap youtube source
        if (source === "youtube") {
            // track here would be youtube track
            return (await playdl.stream(track.url, { discordPlayerCompatibility : true })).stream;
            // we must return readable stream or void (returning void means telling discord-player to look for default extractor)
        }
    }
});
```

`<Queue>.onBeforeCreateStream` is called before actually downloading the stream. It is a different concept from extractors, where you are **just** downloading
streams. `source` here will be a video source. Streams from `onBeforeCreateStream` are then piped to `FFmpeg` and finally sent to Discord voice servers.
