## Stream Hooks

Stream hooks are middlewares which has the ability to modify the streaming behavior. There are two types of stream hooks in Discord Player:

### onBeforeCreateStream

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

`<GuildQueue>.onBeforeCreateStream` is called before actually downloading the stream. It is a different concept from extractors, where you are **just** downloading
streams. `source` here will be a track source. Streams from `onBeforeCreateStream` are then piped to `FFmpeg` and sent to `onAfterCreateStream` hook.

### onAfterCreateStream

This hook can be used to post-process pcm stream. This is the final step before creating audio resource. Example:

```js
const queue = player.nodes.create(..., {
    ...,
    async onAfterCreateStream(pcmStream, queue) {
        // return opus encoded stream
        const encoder = new OpusEncoder();
        return {
            stream: encoder.encode(pcmStream),
            type: StreamType.Opus
        };
    }
});
```