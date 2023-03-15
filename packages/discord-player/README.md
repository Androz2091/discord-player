# Discord Player

Discord Player is a powerful framework for JavaScript and TypeScript, built on top of **[@discord.js/voice](https://npm.im/@discordjs/voice)** library.
It provides easy set of customizable tools to develop Discord Music bots.

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![discordBadge](https://img.shields.io/discord/558328638911545423?style=for-the-badge&color=7289da)](https://androz2091.fr/discord)

# Why Discord Player?

-   Beginner friendly, easy to understand
-   TypeScript support
-   Quick and easy to set up
-   Wide range of player management features
-   64+ built-in audio filter presets
-   Highly customizable
-   Automatic queue management
-   Query caching support
-   Wide range of extendable sources via Extractors API
-   Object oriented
-   Built in stats tracker

## Installation

## Before you start

Discord Player requires Discord.js 14.0 or higher. PLease make sure you have a compatible version using `npm list discord.js` in your terminal. If you're using an earlier version please update it. The [Discord.JS Guide](https://discordjs.guide/) has resources to help with that.

#### Main Library

```bash
$ npm install discord-player # main library
$ npm install @discord-player/extractor # extractors provider
```

> Discord Player recognizes `@discord-player/extractor` and loads it automatically by default.

#### Opus Library

Discord Player is a high level framework for Discord VoIP. Discord only accepts opus packets, thus you need to install opus library. You can install any of these:

```bash
$ npm install @discordjs/opus
$ npm install opusscript
```

#### FFmpeg or Avconv

FFmpeg or Avconv is required for media transcoding. You can get it from [https://ffmpeg.org](https://www.ffmpeg.org/download.html) or by installing it from npm:

```bash
$ npm install ffmpeg-static
```

You can get avconv from [https://libav.org/download](https://libav.org/download).

#### Streaming Library

You also need to install streaming library if you want to add support for youtube playback. You can install one of these libraries:

```bash
$ npm install ytdl-core
$ npm install play-dl
$ npm install @distube/ytdl-core
```

Done with all these? Let's write a simple music bot then.

### Setup

Let's create a master player instance.

```js
const { Player } = require('discord-player');
const client = new Discord.Client({
    // Make sure you have 'GuildVoiceStates' intent enabled
    intents: ['GuildVoiceStates' /* Other intents */]
});

// this is the entrypoint for discord-player based application
const player = new Player(client);
```

> **Did You Know?** _Discord Player is by default a singleton._

Now, let's add some event listeners:

```js
// this event is emitted whenever discord-player starts to play a track
player.events.on('playerStart', (queue, track) => {
    // we will later define queue.metadata object while creating the queue
    queue.metadata.channel.send(`Started playing **${track.title}**!`);
});
```

Let's write the command part. You can define the command as you desire. We will only check the command handler part:

```js
async function execute(interaction) {
    const channel = interaction.message.member.voice.channel;
    if (!channel) return interaction.reply('You are not connected to a voice channel!'); // make sure we have a voice channel
    const query = interaction.options.getString('query', true); // we need input/query to play

    // let's defer the interaction as things can take time to process
    await interaction.deferReply();

    try {
        const { track } = await player.play(channel, query, {
            nodeOptions: {
                // nodeOptions are the options for guild node (aka your queue in simple word)
                metadata: interaction // we can access this metadata object using queue.metadata later on
            }
        });

        return interaction.followUp(`**${track.title}** enqueued!`);
    } catch (e) {
        // let's return error if something failed
        return interaction.followUp(`Something went wrong: ${e}`);
    }
}
```

That's all it takes to build your own music bot.

#### Check out the [Documentation](https://discord-player.js.org) for more info.

## Community Resources

A curated list of resources (such as open source music bots, extractors, etc.) built by Discord Player community.
[https://discord-player.js.org/docs/guides/community-resources](https://discord-player.js.org/docs/guides/community-resources)