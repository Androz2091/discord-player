# Migrating to Discord Player v6

We have introduced some breaking changes in Discord Player v6. Which means, your old code will no longer work with v6.
The new update brings new queue system and removes old one.

## Basic Example of new queue

```diff
- queue.play()
+ queue.node.play()

- queue.pause()
+ queue.node.pause()

- queue.setFilters({ bassboost: !queue.getFiltersEnabled().includes('bassboost') })
+ queue.filters.ffmpeg.toggle('bassboost')

- queue.back()
+ queue.history.back()

- player.createQueue(...)
+ player.nodes.create(...)

- player.on('...')
+ player.events.on('...')

- player.createQueue()...queue.play()
+ player.play()
^ Discord Player will handle queue creation, search results, tracks queuing, playing

some new filters
+ player.filters.biquad.setFilter(BiquadFilterType.LowPass)
^ Filters like LowPass, HighPass, LowShelf, HighShelf, AllPass, etc.

equalizer
+ player.filters.equalizer.setEQ(EqualizerConfigurationPreset.Jazz)

+ player.filters.equalizer.setEQ([{ band: 0, gain: 0.25 }])
^ looks pretty similar to lavalink huh?

Some DSP Filters
+ player.filters.filters.setFilters(['8D'])
^ 8D also works in FFmpeg, but this one does not use FFmpeg and you will see it applying immediately unlike FFmepg ones

- onBeforeCreateStream() (just to use play-dl?)
+ You dont need anything, just make sure play-dl is installed ;)

+ onAfterCreateStream()
^ Post processing PCM stream
```

## Events

Events are now emitted from `player.events` object. [Here are the list of possible events](https://discord-player.netlify.app/docs/types/discord-player/GuildQueueEvents).

## How do I reply to the event like v5?

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

## How do I stop the player

You have to use `<Queue>.delete()` to destroy the queue. It will also stop the player.

```js
const queue = player.nodes.get(message.guild.id);
if (!queue.deleted) queue.delete();
```
