# Discord Player v8

Discord Player v8 keeps the familiar `Player` and `GuildQueue` object model while using Remedia for media decoding, playback, voice transport, and remote nodes. Discord Player manages guild queues, track history, repeat and shuffle policies, events, and playback scheduling.

## Playback flow

`Player.play()` resolves a structural channel and delegates to the queue. `GuildQueue.play()` manages tracks and queue progression. `queue.node.play()` is the raw Remedia entry point and never advances the managed queue.

```ts
import { Player, QueueRepeatMode, Track, useHistory, useQueue } from 'discord-player';

const player = new Player({ nodes: [], send: sendDiscordGatewayPayload });
await player.initialize(botUserId);

const queue = await player.createQueue(guildId, {
  maxSize: 100,
  maxHistorySize: 50,
});

await queue.connect({
  channelId: voiceChannelId,
  selfDeaf: true,
  volume: 80,
  filterGraph: 'bass=gain=8',
});

// A source integration must provide a Track subclass or bridge that resolves
// this Track to a Remedia MediaSource before queue-managed playback can start.
const track = new Track({ title: 'Example track', author: 'Example artist' });
await queue.play(track);

player.events.on('playerStart', (queue, track, rawEvent) => {
  console.log(queue.guildId, track.title, rawEvent?.generation);
});
```

`Player.play(channel, resource, options)` also accepts a structural channel object or `{ guildId, channelId }`. No discord.js runtime dependency is required. `player.queues` and the compatibility alias `player.nodes` both refer to the guild queue manager; Remedia node snapshots are available at `player.remedia?.nodes`.

## Queue policies and controls

With an existing queue:

```ts
queue.repeatMode = QueueRepeatMode.QUEUE;
queue.enableShuffle(); // Dynamic random selection
queue.disableShuffle();

await queue.node.pause();
await queue.node.seek(30_000);
await queue.node.setVolume(80); // Discord Player percentage convention

const progress = queue.node.createProgressBar();
```

`queue.history` provides `previous()`, `back()`, and `next()` navigation. Paused playback still counts as active. Queue-managed natural completion, skip, stop, and failure are distinct lifecycle events.

History records naturally completed Tracks when repeat mode is `OFF` or `AUTOPLAY`, and records skipped Tracks. `TRACK` and `QUEUE` repeat modes do not add each replay to history. A playback failure returns the Track to the upcoming queue head without adding it to history. Stopping playback leaves history unchanged. `queue.clear()` and queue destruction clear history.

## Context hooks

Use `player.context.provide()` to scope helpers to a Player and optional guild without global Player selection:

```ts
await player.context.provide({ guildId }, async () => {
  const queue = useQueue();
  const history = useHistory();
  // The context is preserved across asynchronous work.
});
```

## Track and Playlist persistence

`Track` and `Playlist` implement the exported `Serializable<T>` contract. `serialize()` returns a versioned persistence entity; `toJSON()` remains the public display/logging representation and is not used as the persistence payload.

```ts
import { deserialize, encode, decode, serialize, Track } from 'discord-player';

const track = new Track({ id: 'track-123', title: 'Example', durationMS: 180_000, source: 'youtube' });
const payload = serialize(track);
// { type: 'track', version: 1, data: { id, title, ..., durationMS, requestedBy, metadata } }

const restored = deserialize(decode(encode(payload)));
```

The schema version is independent of the npm package version. Track payloads store duration once in milliseconds, requester identity as a string, and omit Playlist links. A restored Track rebuilds its display duration from milliseconds, so formatting may be normalized; a zero duration is restored as an empty display string. Playlist payloads keep ordered Track entities and omit runtime playback/plugin state. Metadata must contain only finite JSON primitives, dense arrays, and plain objects; unsupported values and circular references throw `SerializationError`.

`deserialize()` accepts the previous v7 `$type` payloads as a migration boundary. V7 did not persist Track IDs, so a migrated Track with no ID receives a new ID. Legacy requester objects are reduced to their string `id`; extractor/query state is not restored, and migrated Tracks still need a source integration before they can play. Incomplete or unsupported legacy fields are rejected. Newly serialized data uses only the v8 `{ type, version, data }` format.

## Source integration boundary

This package does not include source extractors or a plugin runtime. `Player.search()` can wrap existing Track, Playlist, and SearchResult values; query strings return an empty result until a source integration handles them. The base `Track.getStreamableSource()` rejects with `SourceUnavailableError`. `queue.node.play()` accepts a resolved Remedia `MediaSource` and provides raw playback without changing queue state.

## Remedia capabilities

Discord Player uses Remedia `0.1.0-dev.1`. Queue connection settings initialize `DiscordSession` with self-deaf, self-mute, linear volume, and raw filtergraph configuration. Queue volume remains a 0–100 percentage and is converted to Remedia gain internally. Channel changes call `DiscordSession.move(channelId)` on the existing session, retaining the queue, current Track, filters, volume, and history. `queue.setSelfDeaf()` and `queue.setSelfMute()` update the connected session and queue defaults.

## Compatibility notes

- `queue.node.play()` is intentionally raw and does not enqueue Tracks, update history, or advance the queue when playback ends. Use `queue.play()` for queue-managed playback.
- Queue navigation and voice controls are asynchronous where Remedia operations are asynchronous and return Promises accordingly.
- Legacy stream pipeline classes, dispatcher utilities, FFmpeg filter wrappers, and audio equalizer processing are not part of v8. Raw Remedia filtergraphs are available through `queue.node.filters`.
- Source plugins, extractor behavior, and the planned `PrivateTrack` source bridge are not included in this release scope.
