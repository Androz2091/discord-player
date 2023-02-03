# How does Discord Player actually work?

- Discord Player can be used by first initializing `Player` class with your discord.js client. Discord Player uses `Queue` to assign queue manager to individual guild.
Which means each guild will have its own queue object. Every player action has to go through the `Queue` object for example, `play`, `pause`, `volume` etc.

- When `Player` is initialized, it creates a cache to store external extractors or queues information. Queue is created by calling `createQueue` method of `Player` instance.
A client should have only one `Player` instance, otherwise it will be complicated to track queues and other metadata.

- Searching tracks can be done via `search` method of `Player` instance. Discord Player offers `search engine` option to target specific searches. Discord Player first
calls all the registered extractors first with the search query. If all external extractors failed to validate the query, player then passes the query to built-in extractors.
Invalid or unknown queries may return `arbitrary` result.

- The track result obtained from `search` can be loaded into `Queue` by calling `queue.addTrack`/`queue.addTracks`/`queue.play`.

- Player calls `onBeforeCreateStream` if user has enabled the function while creating queue. This method runs each time before stream is downloaded. Users may use it
to modify how and which stream will be played.

- Queue is based on FIFO method (First In First Out)

- Final stream is a pcm format, required for volume controls which is created by Discord Player itself.

- Since inline volume is enabled by default for volume controls, you may face more resource usage.

- You can disable inline volume for better performance but setting volume won't work and current volume will always be 100.

- All the audio filters are handled by FFmpeg and stream has to reload in order to update filters.
