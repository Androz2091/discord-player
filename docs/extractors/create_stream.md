# Create Stream

This is a checkpoint where discord-player calls `createStream` before downloading stream.

# Example

```js
const dl = require("my-cool-vid-downloader");

// after creating queue, attach this handler, that's it!
queue.createStream = (track, source, queue) => {
    const stream = dl(track.url);
    return stream;
};
```