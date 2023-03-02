# Migrating to Discord Player v6

## Before you start
> **Note**  
> v6 is currently in development and is actively being worked on. No updates will be made to v5.4.0 going forward. To start using v6 before full release you can install all the necessary components using:  
> `npm i discord-player@dev @discord-player/utils@dev @discord-player/equalizer@dev @discord-player/extractor@dev`

v6 requires Discord.js 14.0 or higher. PLease make sure you have a compatible version using `npm list discord.js` in your terminal. If you're using an earlier version please update it. The [Discord Js Guide](https://discordjs.guide/) has resources to help with that.

We have introduced some breaking changes in Discord Player v6 so your old code will no longer work without making the necessary changes. Discord Player v6 also prefers play-dl over ytdl-core.

### New queue system and Player singleton

The old `Queue` is deprecated and is replaced with `GuildQueue` which is similar to `Queue` but handles things in a better way.

You can now create a `Player.singleton(client)` to avoid polluting your client and in order to be able to access the player instance anywhere in your code.

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

+ player.play(channel, result, {
+  nodeOptions: {
+   metadata: {
+    channel: interaction.channel,
+    client: interaction.guild.members.me,
+    requestedBy: interaction.user,
+   },
+   autoSelfDeaf: true,
+   initialVolume: 80,
+   leaveOnEmpty: true,
+   leaveOnEmptyCooldown: 300000,
+   leaveOnEnd: true,
+   leaveOnEndCooldown: 300000,
+  },
+ });
```

### Player Changes
The main changes to the Player class are outlined below. The caching is used for . Several [filter additions](#filters) were made as well.

```diff
- player.on('event')
+ player.events.on('event')

+ player.singleton(client, options);
Note: parameters can be omitted after initial use to get the singleton.

- player.search(query, options);
+ player.search changes

// TODO somestuff for cache? maybe in additions section

- onBeforeCreateStream();
Note: it is not removed but is no longer needed when when you want to use play-dl. Now you only need play-dl installed.

+ onAfterCreateStream()
Note: this is used for post processing PCM stream.
// Maybe move to additions section
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
+ queue.skipTo(trackNum);

- queue.playing;
+ queue.node.isPlaying();

- queue.tracks.length; 
+ queue.tracks.size;
but can be retrieved with:
+ queue.getSize();

+ queue.isEmpty();

+ queue.node.isPaused();

- queue.addTracks();
Note: although this was removed, queue.addTrack() now works with both single tracks and playlists

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

+ queue.setMetadata();
```

### Event Changes
Player [events](https://discord-player.netlify.app/docs/types/discord-player/GuildQueueEvents) are now emitted from the `player.events` object. (ex. `player.events.on(event.name, (...args) => event.execute(...args));`)

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
There are several new filter options, with some shown below. A full list can be found [here](https://discord-player.netlify.app/docs/types/discord-player/QueueFilters).

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

Hooks are currently still an experimental feature that will continue to be worked upon. As of right now, all hooks start with the `use` keyword. The following are the available hooks:

- **useQueue**: Lets you access `GuildQueue` instance from anywhere in your process
- **useHistory**: Lets you access `GuildQueueHistory` from anywhere in your process
- **usePlayer**: Lets you access `GuildQueuePlayerNode` from anywhere in your process (Note: this does not return discord-player's main `Player`)

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

### How do I stop the player

You have to use `<Queue>.delete()` to destroy the queue. It will also stop the player.

```js
const queue = player.nodes.get(guildId);
if (!queue.deleted) queue.delete();
```
