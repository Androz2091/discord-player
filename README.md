# Discord Player

Discord Player is a robust framework for developing Discord Music bots using JavaScript and TypeScript. It is built on top of the [discord-voip](https://npm.im/discord-voip) library and offers a comprehensive set of customizable tools, making it one of the most feature enrich framework in town.

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![discordBadge](https://img.shields.io/discord/558328638911545423?style=for-the-badge&color=7289da)](https://androz2091.fr/discord)

# Why Choose Discord Player?

- Beginner-friendly with easy-to-understand features
- TypeScript support
- Offers hackable APIs.
- Supports audio player sharing
- Quick and easy setup process
- Wide range of player management features
- Offers 64+ built-in audio filter presets
- Highly customizable according to your needs
- Automatic queue management
- Query caching support
- Extensible sources through the Extractors API
- Object-oriented design
- Built-in stats tracker
- Offers easy debugging methods
- Out-of-the-box voice states handling
- IP Rotation support
- Easy serialization and deserialization
- Experimental support for [Eris](https://npmjs.com/eris) client

## Installation

### Before you start

Discord Player requires Discord.js 14.0 or higher. Please ensure that you have a compatible version by running `npm list discord.js` in your terminal. If you're using an earlier version, please update it. The [discord.js Guide](https://discordjs.guide) provides resources to assist you with the update process.

#### Main Library

```bash
$ npm install --save discord-player # main library
$ npm install --save @discord-player/extractor # extractors provider
```

#### Opus Library

We recommend mediaplex for libopus. Mediaplex also helps with audio metadata extraction.

```bash
$ npm install --save mediaplex
```

#### FFmpeg or Avconv

FFmpeg or Avconv is required for media transcoding. You can obtain it from [https://ffmpeg.org](https://ffmpeg.org) or via npm.

> We do not recommend installing ffmpeg via npm because binaries pulled from npm is known to be unstable. It is recommended to install it from the official source.

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

### Setup

Let's create a main player instance. This instance handles and keeps track of all the queues and its components.

```js index.js
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

const client = new Discord.Client({
  // Make sure you have 'GuildVoiceStates' intent enabled
  intents: ['GuildVoiceStates' /* Other intents */],
});

// this is the entrypoint for discord-player based application
const player = new Player(client);

// Now, lets load all the default extractors.
await player.extractors.loadMulti(DefaultExtractors);
```

Discord Player is mostly events based. It emits different events based on the context and actions. Let's add a basic event listener to notify the user when a track starts to play:

```js index.js
// this event is emitted whenever discord-player starts to play a track
player.events.on('playerStart', (queue, track) => {
  // we will later define queue.metadata object while creating the queue
  queue.metadata.channel.send(`Started playing **${track.cleanTitle}**!`);
});
```

## Eris Setup

Discord Player has limited support for Eris. You can use the following code to set up Discord Player with Eris:

```js index.js
const { Player, createErisCompat } = require('discord-player');

const player = new Player(createErisCompat(client));
```

Before you add the command, make sure to provide the context to the commands if you wish to use discord-player's hooks (like `useMainPlayer`).

### Before

```js index.js
// execute the command
await command.execute(interaction);
```

### After

```js index.js
// execute the command
await player.context.provide({ guild: interaction.guild }, () => command.execute(interaction));
```

This allows discord-player to automatically know the current guild and the queue, resulting in cleaner code and seamless integration. This eradicates the need to pass the player instance to the command or use hacks like `client.player = player`.

Let's move on to the command part. You can define the command as per your requirements. We will only focus on the command part:

```js play.js
const { useMainPlayer } = require('discord-player');

export async function execute(interaction) {
  const player = useMainPlayer(); // get player instance
  const channel = interaction.member.voice.channel;
  if (!channel) return interaction.reply('You are not connected to a voice channel!'); // make sure we have a voice channel
  const query = interaction.options.getString('query', true); // we need input/query to play

  // let's defer the interaction as things can take time to process
  await interaction.deferReply();

  try {
    const { track } = await player.play(channel, query, {
      nodeOptions: {
        // nodeOptions are the options for guild node (aka your queue in simple word)
        metadata: interaction, // we can access this metadata object using queue.metadata later on
      },
    });

    return interaction.followUp(`**${track.cleanTitle}** enqueued!`);
  } catch (e) {
    // let's return error if something failed
    return interaction.followUp(`Something went wrong: ${e}`);
  }
}
```

That's all it takes to build your own music bot. Please check out the [Documentation](https://discord-player.js.org) for more features/functionalities.

## Community Resources

Explore a curated list of resources built by the Discord Player community, including open-source music bots and extractors. Visit [https://discord-player.js.org/showcase](https://discord-player.js.org/showcase) for more information.
