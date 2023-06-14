# Discord Player

> **Did You Know?** Discord Player has been a part of Discord.js community since **2020/01/12**, authored by **[Androz2091](https://github.com/androz2091)**. Over the years, it went through several updates and releases, which makes it stand at version 6 at the time of writing this.

# Migrating to Discord Player v6

## Before you start

Discord Player requires Discord.js 14.0 or higher. PLease make sure you have a compatible version using `npm list discord.js` in your terminal. If you're using an earlier version please update it. The [Discord.JS Guide](https://discordjs.guide/) has resources to help with that.

## Installation

#### Main Library

```bash
$ yarn add discord-player # main library
$ yarn add @discord-player/extractor # extractors provider
```

> Discord Player recognizes `@discord-player/extractor` and loads it automatically by default.

#### Opus Library

Discord Player is a high level framework for Discord VoIP. Discord only accepts opus packets, thus you need to install opus library. You can install any of these:

```bash
$ yarn add @discordjs/opus
$ yarn add opusscript
```

#### FFmpeg or Avconv

FFmpeg or Avconv is required for media transcoding. You can get it from [https://ffmpeg.org](https://www.ffmpeg.org/download.html) or by installing it from npm (ffmpeg-static or other binaries are not recommended):

```bash
$ yarn add ffmpeg-static
# or
$ yarn add @ffmpeg-installer/ffmpeg
# or
$ yarn add @node-ffmpeg/node-ffmpeg-installer
# or
$ yarn add ffmpeg-binaries
```

> Use `FFMPEG_PATH` environment variable to load ffmpeg from custom path.

#### Streaming Library

You also need to install streaming library if you want to add support for youtube playback. You can install one of these libraries:

```bash
$ yarn add ytdl-core
$ yarn add play-dl
$ yarn add @distube/ytdl-core
```

Done with all these? Let's write a simple music bot then.

---

### Setup

Let's create a master player instance, this should ideally be in your `index.js` or corresponding file.

```js
const { Player } = require('discord-player');
const client = new Discord.Client({
    // Make sure you have 'GuildVoiceStates' intent enabled
    intents: ['GuildVoiceStates' /* Other intents */]
});

// this is the entrypoint for discord-player based application
const player = new Player(client);

// This is to load the default extractors from the @discord-player/extractor package
await player.extractors.loadDefault();
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

Let's write the command part for `play.js`. You can define the command as you desire. We will only check the command handler part:

```js
import { useMasterPlayer } from 'discord-player';

async function execute(interaction) {
    const player = useMainPlayer(); // Get the player instance that we created earlier
    const channel = interaction.message.member.voice.channel;
    if (!channel) return interaction.reply('You are not connected to a voice channel!'); // make sure we have a voice channel
    const query = interaction.options.getString('query', true); // we need input/query to play

    // let's defer the interaction as things can take time to process
    await interaction.deferReply();
    const searchResult = await player.search(query, { requestedBy: interaction.user });

    if (!searchResult.hasTracks()) {
        // If player didn't find any songs for this query
        await interaction.editReply(`We found no tracks for ${query}!`);
        return;
    } else {
        try {
            await player.play(channel, searchResult, {
                nodeOptions: {
                    metadata: interaction // we can access this metadata object using queue.metadata later on
                }
            });
            await interaction.editReply(`Loading your track`);
        } catch (e) {
            // let's return error if something failed
            return interaction.followUp(`Something went wrong: ${e}`);
        }
    }
}
```

_You can find the full list of available nodeOptions over [here](https://discord-player.js.org/docs/types/discord-player/GuildNodeInit)_

That's all it takes to build a simple play command.

### New queue system and Player singleton

The old `Queue` is deprecated and is replaced with `GuildQueue` which is similar to `Queue` but handles things in a better way.

You can now create a `Player.singleton(client)` to avoid polluting your client and in order to be able to access the player instance anywhere in your code.

---

## Commonly used methods that changed

### Queue Creation Changes

Discord Player `player.play` will handle queue creation, search results, tracks queuing, and the playing functionality for simpler user experience.

```diff
- player.createQueue(guild, {
-  autoSelfDeaf: true,
-  initialVolume: 80,
-  leaveOnEmpty: true,
-  leaveOnEmptyCooldown: 300000,
-  leaveOnEnd: true,
-  leaveOnEndCooldown: 300000,
- });
- queue.play();

# Either
+ player.play(channel, result, {
+  nodeOptions: {
+   metadata: {
+    channel: interaction.channel,
+    client: interaction.guild.members.me,
+    requestedBy: interaction.user,
+   },
+   selfDeaf: true,
+   volume: 80,
+   leaveOnEmpty: true,
+   leaveOnEmptyCooldown: 300000,
+   leaveOnEnd: true,
+   leaveOnEndCooldown: 300000,
+  },
+ });

# Or
+ const queue = player.nodes.create(interaction.guild, {
+   metadata: {
+    channel: interaction.channel,
+    client: interaction.guild.members.me,
+    requestedBy: interaction.user,
+   },
+   selfDeaf: true,
+   volume: 80,
+   leaveOnEmpty: true,
+   leaveOnEmptyCooldown: 300000,
+   leaveOnEnd: true,
+   leaveOnEndCooldown: 300000,
+ });
+ queue.node.play()
```

### Player Changes

The main changes to the Player class are outlined below.

```diff
- player.on('event')
+ player.events.on('event')

+ player.singleton(client, options);
Note: parameters can be omitted after initial use to get the singleton.

- onBeforeCreateStream();
Note: it is not removed but is no longer needed when when you want to use play-dl. Now you only need play-dl installed.

+ onAfterCreateStream()
Note: this is used for post processing PCM stream. This hook can return stream type as well.
```

### Queue Changes

Several aspects of the queue have changed, the most notable one is
`getQueue()` which has been moved into `nodes.get()`. The changes are all listed below and were done as a way to improve the queue system while following a modular approach.

```diff
- player.getQueue(guildId);
+ player.nodes.get(guildId);

- queue.clear();
+ queue.tracks.clear();

- queue.destroy();
+ queue.delete();

- queue.current;
+ queue.currentTrack;

- queue.setPaused(true); // still functional
+ queue.node.pause();

- queue.setPaused(false); // still functional
+ queue.node.resume();

- queue.shuffle();
+ queue.tracks.shuffle();

- queue.remove(trackNum);
+ queue.node.remove(trackNum);

- queue.skip();
+ queue.node.skip();

- queue.skipTo(trackNum);
+ queue.node.skipTo(trackNum);

- queue.playing;
+ queue.node.isPlaying();

- queue.tracks.length;
+ queue.tracks.size;
but can be retrieved with:
+ queue.getSize();

+ queue.isEmpty();

+ queue.node.isPaused();

- queue.addTracks();
Note: although this was removed, queue.addTrack() now works with both single track, array of tracks and playlists

- queue.setFilters({ bassboost: !queue.getFiltersEnabled().includes('bassboost') })
+ queue.filters.ffmpeg.toggle('bassboost')

- queue.back()
+ queue.history.back()

- queue.createProgressBar();
+ queue.node.createProgressBar();

- queue.insert(track, position);
+ queue.insertTrack(track, position);

- queue.remove(track);
+ queue.removeTrack(track);

- queue.metadata = ...
Note: metadata setter is still functional
+ queue.setMetadata();
```

### Event Changes

Player [events](https://discord-player.js.org/docs/types/discord-player/GuildQueueEvents) are now emitted from the `player.events` object. (ex. `player.events.on(event.name, (...args) => event.execute(...args));`)

```diff
- botDisconnect
+ disconnect

- channelEmpty
+ emptyChannel

- connectionCreate
+ connection

- connectionError
+ playerError

- queueEnd
+ emptyQueue

- trackAdd
+ audioTrackAdd

- tracksAdd
+ audioTracksAdd

- trackEnd
+ playerFinish

- trackStart
+ playerStart
```

---

## New Additions

### Events

In addition to the change in events, there are also new events that have been added, listed below.

```diff
+ playerTrigger

+ playerSkip

+ audioTrackRemove

+ audioTracksRemove
```

### Filters

There are several new filter options, with some shown below. A full list can be found [here](https://discord-player.js.org/docs/types/discord-player/QueueFilters).

The 8D filter used is **not** the one in FFmpeg and you will see it applied immediately unlike the FFmpeg one.

```diff
Filters like LowPass, HighPass, LowShelf, HighShelf, AllPass, etc:
+ player.filters.biquad.setFilter(BiquadFilterType.LowPass)

Equalizer
+ player.filters.equalizer.setEQ(EqualizerConfigurationPreset.Jazz)

or similar to lavalink
+ player.filters.equalizer.setEQ([{ band: 0, gain: 0.25 }])

DSP Filters
+ player.filters.filters.setFilters(['8D'])
```

### Voice Recording

> **Note**  
> Recording should not be done without another's permission. In addition, since the voice receiving API is unofficial and is not fully supported by Discord you may not get perfect results.

With the introduction of v6 there was also the introduction of voice recording. This means that you can record the audio in a voice channel. An example is found below.

```js
const player = Player.singleton(client);
const queue = player.nodes.create(interaction.guildId);

try {
    await queue.connect(interaction.member.voice.channelId, { deaf: false });
} catch {
    return interaction.followUp('Failed to connect to your channel');
}

// initialize receiver stream
const stream = queue.voiceReceiver.recordUser(interaction.member.id, {
    mode: 'pcm', // record in pcm format
    end: EndBehaviorType.AfterSilence // stop recording once user stops talking
});

const writer = stream.pipe(createWriteStream(`./recording-${interaction.member.id}.pcm`)); // write the stream to a file

writer.once('finish', () => {
    if (interaction.isRepliable()) interaction.followUp(`Finished writing audio!`);
    queue.delete();
});
```

You can also convert the recorded audio from PCM to any format you'd like.

```js
ffmpeg -i "./recording-USER_ID.pcm" -f s16le -ac 2 -ar 48000 "./recording.mp3"
```

### Hooks

So what are hooks for? You might have noticed, getting `queue` for basic tasks requires you to write something like:

```js
const queue = client.player.nodes.get(guildId);
```

The idea behind queues is for when you don't have access to `client.player`, this is where hooks come in. You will be able to get the queue with just:

```js
import { useQueue } from 'discord-player';

const queue = useQueue(guildId);
```

Hooks are currently still an experimental feature that will continue to be worked upon. As of right now, all hooks start with the `use` keyword. The following are some the available hooks:

-   **useQueue**: Lets you access `GuildQueue` instance from anywhere in your process
-   **useHistory**: Lets you access `GuildQueueHistory` from anywhere in your process
-   **usePlayer**: Lets you access `GuildQueuePlayerNode` from anywhere in your process (Note: this does not return discord-player's main `Player`)

---

## Frequently Asked Questions

### How do I reply to the event like v5?

v6 still supports v5's `metadata` object:

```js
const queue = player.nodes.create(message.guild, {
    metadata: message
});
```

The metadata `message` will always be available in every event emitted for that specific `Queue`. You can access it via `queue.metadata`:

```js
player.events.on('playerStart', (queue, track) => {
    const channel = queue.metadata.channel; // queue.metadata is your "message" object
    channel.send(`🎶 | Started playing **${track.title}**`);
});
```
