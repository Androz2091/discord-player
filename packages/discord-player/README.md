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
$ npm install --save @discordjs/opus # Native bindings via napi

# or
$ npm install --save opusscript # WASM bindings
```

### Install streaming library (if you want to play from youtube)

```sh
$ npm install --save play-dl # discord-player prefers play-dl over ytdl-core if both of them are installed

# or
$ npm install --save ytdl-core
```

### Install FFmpeg or Avconv

-   Official FFMPEG Website: **[https://www.ffmpeg.org/download.html](https://www.ffmpeg.org/download.html)**
-   Node Module (FFMPEG): **[https://npmjs.com/package/ffmpeg-static](https://npmjs.com/package/ffmpeg-static)**
-   Avconv: **[https://libav.org/download](https://libav.org/download)**

# Features

-   Simple & easy to use 🤘
-   Beginner friendly 😱
-   Audio filters 🎸
-   Lavalink compatible 15 band equalizer 🎚️
-   Digital biquad filters support
-   Lightweight ☁️
-   Custom extractors support 🌌
-   Multiple sources support ✌
-   Play in multiple servers at the same time 🚗
-   Does not inject anything to discord.js or your discord.js client 💉
-   Allows you to have full control over what is going to be streamed 👑

## [Documentation](https://discord-player.js.org)

## Getting Started

First of all, you will need to register slash commands:

```js
const { REST } = require('@discordjs/rest');
const { Routes, ApplicationCommandOptionType } = require('discord.js');

const commands = [
    {
        name: 'play',
        description: 'Plays a song!',
        options: [
            {
                name: 'query',
                type: ApplicationCommandOptionType.String,
                description: 'The song you want to play',
                required: true
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken('BOT_TOKEN');

(async () => {
    try {
        console.log('Started refreshing application [/] commands.');

        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });

        console.log('Successfully reloaded application [/] commands.');
    } catch (error) {
        console.error(error);
    }
})();
```

Now you can implement your bot's logic:

```js
const { Client } = require('discord.js');
const client = new Discord.Client({
    intents: ['Guilds', 'GuildVoiceStates']
});
const { Player } = require('discord-player');

// Create a new Player (you don't need any API Key)
const player = new Player(client);

// add the start and finish event so when a song will be played this message will be sent
player.events.on('playerStart', (queue, track) => queue.metadata.channel.send(`🎶 | Now playing **${track.title}**!`));
player.events.on('playerFinish', (queue, track) => queue.metadata.channel.send(`🎶 | Now playing **${track.title}**!`));

client.once('ready', () => {
    console.log("I'm ready !");
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // /play track:Despacito
    // will play "Despacito" in the voice channel
    if (interaction.commandName === 'play') {
        const voiceChannel = interaction.member.voice.channelId;
        if (!voiceChannel) return await interaction.reply({ content: 'You are not in a voice channel!', ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && voiceChannel !== interaction.guild.members.me.voice.channelId)
            return await interaction.reply({ content: 'You are not in my voice channel!', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        const query = interaction.options.getString('query');
        const queue = player.nodes.create(interaction.guild, {
            metadata: {
                channel: interaction.channel
            }
        });

        try {
            const res = await player.play(voiceChannel, query, {
                nodeOptions: {
                    metadata: {
                        channel: interaction.channel
                    }
                }
            });

            return await interaction.followUp({ content: `⏱️ | Loading track **${res.track.title}**!` });
        } catch(e) {
            return await interaction.followUp({ content: `Could not play: ${e.message}`, ephemeral: true });
        }
    }
});

client.login('BOT_TOKEN');
```

## Supported sources

By default, discord-player supports the following sources:

-   Local file (You must set the search engine to `QueryType.FILE` in order to play local files)
-   Raw attachments
-   Spotify (Streamed from youtube)
-   Apple Music (Streamed from youtube)
-   Vimeo
-   Reverbnation
-   SoundCloud

You can also force a specific extractor to resolve your search query. This is useful in some cases where you don't want to use other sources.
You can do so by using `ext:<EXTRACTOR_IDENTIFIER>` in `searchEngine` value. Example:

```js
const result = await player.search(query, {
    // always use soundcloud extractor
    searchEngine: 'ext:com.discord-player.soundcloudextractor'
});
```

### Adding more sources

Discord Player provides an **Extractor API** that enables you to use your custom stream extractor with it. Some packages have been made by the community to add new features using this API.

## Audio Filters

Discord Player supports various audio filters. There are 4 types of audio filters in discord-player.

##### FFmpeg

The most common and powerful method is FFmpeg. It supports a lot of audio filters. To set ffmpeg filter, you can do:

```js
await queue.filters.ffmpeg.setFilters(['bassboost', 'nightcore']);
```

Note that there can be a delay between filters transition in this method.

##### Equalizer

This equalizer is very similar to Lavalink's 15 Band Equalizer. To use this, you can do:

```js
queue.filters.equalizer.setEQ([
    { band: 0, gain: 0.25 },
    { band: 1, gain: 0.25 },
    { band: 2, gain: 0.25 }
]);
```

There is no delay between filter transition when using equalizer.

##### Biquad

This filter provides digital biquad filterer to the player. To use this, you can do:

```js
import { BiquadFilterType } from 'discord-player';

queue.filters.biquad.setFilter(BiquadFilterType.LowPass);
// similarly, you can use other filters such as HighPass, BandPass, Notch, PeakEQ, LowShelf, HighShelf, etc.
```

There is no delay between filter transition when using biquad filters.

#### Mini Audio Filters

This is another type of audio filters provider. It currently supports `Tremolo` and `8D` filters only. To use this, you can do:

```js
queue.filters.filters.setFilters(['8D']);
```

There is no delay between filters transition using this filter.

## Example bots made with Discord Player

These bots are made by the community, they can help you build your own!

-   **[Discord Music Bot](https://github.com/Androz2091/discord-music-bot)** by [Androz2091](https://github.com/Androz2091)
-   [Dodong](https://github.com/nizeic/Dodong) by [nizeic](https://github.com/nizeic)
-   [Musico](https://github.com/Whirl21/Musico) by [Whirl21](https://github.com/Whirl21)
-   [Melody](https://github.com/NerdyTechy/Melody) by [NerdyTechy](https://github.com/NerdyTechy)
-   [Eyesense-Music-Bot](https://github.com/naseif/Eyesense-Music-Bot) by [naseif](https://github.com/naseif)
-   [Music-bot](https://github.com/ZerioDev/Music-bot) by [ZerioDev](https://github.com/ZerioDev)
-   [AtlantaBot](https://github.com/Androz2091/AtlantaBot) by [Androz2091](https://github.com/Androz2091) (**outdated**)
-   [Discord-Music](https://github.com/inhydrox/discord-music) by [inhydrox](https://github.com/inhydrox) (**outdated**)

### Use cookies with ytdl-core

```js
const player = new Player(client, {
    ytdlOptions: {
        requestOptions: {
            headers: {
                cookie: 'YOUR_YOUTUBE_COOKIE'
            }
        }
    }
});
```

> Note: the above option is only used when ytdl-core is being used.

### Use custom proxies

```js
const HttpsProxyAgent = require('https-proxy-agent');

// Remove "user:pass@" if you don't need to authenticate to your proxy.
const proxy = 'http://user:pass@111.111.111.111:8080';
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

Discord Player by default uses registered extractors to stream audio. If you need to override what needs to be streamed, you can use this hook.

```js
const fs = require('fs');

// other code
const queue = player.nodes.create(..., {
    ...,
    async onBeforeCreateStream(track, source, _queue) {
        if (track.title === 'some title') {
            return fs.createReadStream('./playThisInstead.mp3');
        }
    }
});
```

`\<GuildQueue>.onBeforeCreateStream` is called before actually downloading the stream. It is a different concept from extractors, where you are **just** downloading
streams. `source` here will be a track source. Streams from `onBeforeCreateStream` are then piped to `FFmpeg` and finally sent to Discord voice servers.
