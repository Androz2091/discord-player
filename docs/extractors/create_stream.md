# Create Stream

This is a checkpoint where discord-player calls `createStream` before downloading stream.

### Custom stream Engine

Discord Player by default uses **[node-ytdl-core](https://github.com/fent/node-ytdl-core)** for youtube and some other extractors for other sources.
If you need to modify this behavior without touching extractors, you need to use `createStream` functionality of discord player.
Here's an example on how you can use **[play-dl](https://npmjs.com/package/play-dl)** to download youtube streams instead of using ytdl-core.

```js
const playdl = require("play-dl");

// other code

const queue = player.createQueue(...);
if (!queue.createStream) {
    queue.createStream = async (track, source, _queue) => {
        // only trap youtube source
        if (source === "youtube") {
            // track here would be youtube track
            return (await playdl.stream(track.url)).stream;
            // we must return readable stream or void (returning void means telling discord-player to look for default extractor)
        }
    };
}
```

`<Queue>.createStream` is called before actually downloading the stream. It is a different concept from extractors, where you are **just** downloading
streams. `source` here will be a video source. Streams from `createStream` are then piped to `FFmpeg` and finally sent to Discord voice servers.

# FAQ
## How can I remove this?

> If you already made this change and want to switch to default mode in runtime,
> you can set `queue.createStream` to `null` which will make `discord-player` use default config.

## Which stream format should I return?

> It's not necessary to return opus format or whatever, since every streams have to be converted to s16le, due to inline volume.

## Can I use ytdl-core-discord?

> Yes, you can.

## Can I use this for other sources, like soundcloud?

> Absolutely.