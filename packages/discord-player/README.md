# Discord Player

Discord Player is a robust framework for developing Discord Music bots using JavaScript and TypeScript. It is built on top of the [@discordjs/voice](https://npm.im/@discordjs/voice) library and offers a comprehensive set of customizable tools, making it one of the most feature enrich framework in town.

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![discordBadge](https://img.shields.io/discord/558328638911545423?style=for-the-badge&color=7289da)](https://androz2091.fr/discord)

# Why Choose Discord Player?

-   Beginner-friendly with easy-to-understand features
-   TypeScript support
-   Offers hackable APIs.
-   Supports audio player sharing
-   Quick and easy setup process
-   Wide range of player management features
-   Offers 64+ built-in audio filter presets
-   Highly customizable according to your needs
-   Automatic queue management
-   Query caching support
-   Extensible sources through the Extractors API
-   Object-oriented design
-   Built-in stats tracker
-   Offers easy debugging methods
-   Out-of-the-box voice states handling

## Installation

### Before you start

Discord Player requires Discord.js 14.0 or higher. Please ensure that you have a compatible version by running `npm list discord.js` in your terminal. If you're using an earlier version, please update it. The [discord.js Guide](https://discordjs.guide) provides resources to assist you with the update process.

#### Main Library

```bash
$ npm install --save discord-player # main library
$ npm install --save @discord-player/extractor # extractors provider
```

> Discord Player recognizes `@discord-player/extractor` and loads it automatically by default. Just invoke `await player.extractors.loadDefault()`.

#### Opus Library

Since Discord only accepts opus packets, you need to install the opus library. Choose one of the following options:

```bash
$ npm install --save @discordjs/opus
# or
$ npm install --save opusscript
```

#### FFmpeg or Avconv

FFmpeg or Avconv is required for media transcoding. You can obtain it from [https://ffmpeg.org](https://ffmpeg.org) or install it via npm (we recommend against using ffmpeg-static or other binaries):

```bash
$ npm install --save ffmpeg-static
# or
$ npm install --save @ffmpeg-installer/ffmpeg
# or
$ npm install --save @node-ffmpeg/node-ffmpeg-installer
# or
$ npm install --save ffmpeg-binaries
```

> Use `FFMPEG_PATH` environment variable to load ffmpeg from custom path.

#### Streaming Library

If you want to add support for YouTube playback, you need to install a streaming library. Choose one of the following options:

```bash
$ npm install --save ytdl-core
# or
$ npm install --save play-dl
# or
$ npm install --save @distube/ytdl-core
# or
$ npm install --save yt-stream
```

Once you have completed these installations, let's proceed with writing a simple music bot.

### Setup

Let's create a main player instance. This instance handles and keeps track of all the queues and its components.

```js
const { Player } = require('discord-player');

// get some extractors if you want to handpick sources
const { SpotifyExtractor, SoundCloudExtractor } = require('@discord-player/extractor');

const client = new Discord.Client({
    // Make sure you have 'GuildVoiceStates' intent enabled
    intents: ['GuildVoiceStates' /* Other intents */]
});

// this is the entrypoint for discord-player based application
const player = new Player(client);

// This method will load all the extractors from the @discord-player/extractor package
await player.extractors.loadDefault();

// If you dont want to use all of the extractors and register only the required ones manually, use
await player.extractors.register(SpotifyExtractor, {});
await player.extractors.register(SoundCloudExtractor, {});
```

Discord Player is mostly events based. It emits different events based on the context and actions. Let's add a basic event listener to notify the user when a track starts to play:

```js
// this event is emitted whenever discord-player starts to play a track
player.events.on('playerStart', (queue, track) => {
    // we will later define queue.metadata object while creating the queue
    queue.metadata.channel.send(`Started playing **${track.title}**!`);
});
```

Let's move on to the command part. You can define the command as per your requirements. We will only focus on the command handler part:

```js
async function execute(interaction) {
    const channel = interaction.member.voice.channel;
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

That's all it takes to build your own music bot. Please check out the [Documentation](https://discord-player.js.org) for more features/functionalities.

## Community Resources

Explore a curated list of resources built by the Discord Player community, including open-source music bots and extractors. Visit [https://discord-player.js.org/showcase](https://discord-player.js.org/showcase) for more information.
