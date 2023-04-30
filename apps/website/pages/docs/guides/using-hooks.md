# Using hooks

Discord-Player has a lot of useful hooks, that can be used anywhere once the Player has been initialized.

Here are few examples on how to use them :

# Stream Hooks

Stream hooks are middleware which has the ability to modify the streaming behavior. There are two types of stream hooks in Discord Player:

### onBeforeCreateStream

Discord Player by default uses registered extractors to stream audio. If you need to override what needs to be streamed, you can use this hook.

> Sample Use Case : If you have local files for commonly played songs, then you can use `onBeforeCreateStream` to use the local file rather than fetching it from some online source.

```js
const { onBeforeCreateStream } = require("discord-player");
const fs = require('fs');
const queue = player.nodes.create(..., {
    ...,
    async onBeforeCreateStream(track, source, _queue) {
        if (track.title === 'some title') {
            return fs.createReadStream('./playThisInstead.mp3');
        }
    }
});
```

`<GuildQueue>.onBeforeCreateStream` is called before actually downloading the stream. It is a different concept from extractors, where you are **just** downloading
streams. `source` here will be a track source. Streams from `onBeforeCreateStream` are then piped to `FFmpeg` and sent to `onAfterCreateStream` hook.

### onAfterCreateStream

This hook can be used to post-process pcm stream. This is the final step before creating audio resource. Example:

```js
const { onAfterCreateStream } = require("discord-player");
const queue = player.nodes.create(..., {
    ...,
    async onAfterCreateStream(pcmStream, queue) {
        const encoder = new OpusEncoder();
        return {
            stream: encoder.encode(pcmStream),
            type: StreamType.Opus
        };
    }
});
```

# General Hooks

## useMasterPlayer (Fetch the player instance)

```js
const { useMasterPlayer } = require("discord-player");
...
const player = useMasterPlayer();
```

## usePlayer (Fetch the GuildQueuePlayerNode)

_You can find all the properties and methods of GuildQueuePlayerNode [here](https://discord-player.js.org/docs/classes/discord-player/GuildQueuePlayerNode)_

```js
const { usePlayer } = require("discord-player");
...
const guildNode = usePlayer(interaction.guild.id);
const progressBar = guildNode.createProgressBar(); // Create a progress bar string
const progressPercentage = guildNode.getTimestamp(); // Get the current track progress in %
...
```

## useQueue (Fetch the guild queue)

```js
const { useQueue } = require("discord-player");
...
const queue = useQueue(interaction.guild.id);
```

## useHistory (Fetch the guild queue history)

```js
const { useHistory } = require("discord-player");
...
const history = useHistory(interaction.guild.id);
```

## useMetadata (Manipulate the queue metadata)

```js
const { useMetadata } = require("discord-player");
...
const [getMetadata, setMetadata] = useMetadata(interaction.guild.id);
let currentMetadata = getMetadata(); // We can fetch the metadata using the getter
setMetadata(interaction.channel); // We can set the metadata using the setter
```

_You can also set the metadata while executing the play command. Check the example below._

```js
await player.play(channel, query, {
    nodeOptions: {
        metadata: interaction.channel
    }
});
```

## useTimeline (Fetch/Manipulate the current track in queue)

```js
const { useTimeline } = require("discord-player");
...
const { timestamp, volume, paused, pause, resume, setVolume, setPosition, track } = useTimeline(interaction.guildId);

// `timestamp` returns the progress in %, current time stamp & total time stamp in both mins:secs / ms
interaction.reply(`Current progress : (${timestamp.current.label} / ${timestamp.total.label}) : ${timestamp.progress}%`)

// `volume` returns the current volume value
interaction.reply(`Current volume : ${volume}`)

// `paused` returns the current pause state of player
interaction.reply(`Player paused : ${paused}`)

// `pause()` will pause the player
pause();

// `resume();` will resume the player
resume();

// `setVolume()` sets the volume
setVolume(200);

// `setPosition()` seeks the current track. Takes timestamp in ms as input.
await setPosition(18400);
```
