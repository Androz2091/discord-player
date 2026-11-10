# Discord Player v8

Discord Player v8 keeps the familiar `Player` and `GuildQueue` object model while using Remedia for media decoding, playback, voice transport, and remote nodes. Discord Player manages guild queues, track history, repeat and shuffle policies, events, and playback scheduling.

## Playback flow

`Player.play()` resolves a structural channel and delegates to the queue. `GuildQueue.play()` manages tracks and queue progression. `queue.node.play()` is the raw Remedia entry point and never advances the managed queue.

```ts
import { Player, QueueRepeatMode, Track, useHistory, useQueue } from 'discord-player';

const player = new Player({ nodes: [{ type: 'embedded', id: 'local' }], send: sendDiscordGatewayPayload });

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
  connectTimeoutMs: 120_000, // Optional initial-join deadline
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

const track = new Track({ id: 'track-123', title: 'Example', durationMS: 180_000, source: 'arbitrary' });
const payload = serialize(track);
// { type: 'track', version: 1, data: { id, title, ..., durationMS, requestedBy, metadata } }

const restored = deserialize(decode(encode(payload)));
```

Zod schemas validate versioned payloads, portable source references, and legacy migration data. A JSON-safety preflight rejects cycles, getters, and non-JSON values before schema traversal. The schema version is independent of the npm package version. Track payloads store duration once in milliseconds, requester identity as a string, and omit Playlist links. A restored Track rebuilds its display duration from milliseconds, so formatting may be normalized; a zero duration is restored as an empty display string. Playlist payloads keep ordered Track entities and omit runtime playback/plugin state. Metadata must contain only finite JSON primitives, dense arrays, and plain objects; unsupported values and circular references throw `SerializationError`.

`deserialize()` accepts the previous v7 `$type` payloads as a migration boundary. V7 did not persist Track IDs, so a migrated Track with no ID receives a new ID. Legacy requester objects are reduced to their string `id`; extractor/query state is not restored, and migrated Tracks still need a source integration before they can play. Incomplete or unsupported legacy fields are rejected. Newly serialized data uses only the v8 `{ type, version, data }` format.

## Source plugins

```ts
import { DiscordPlayer, Track, definePlugin } from 'discord-player';

const rawHTTP = definePlugin<{ userAgent?: string }>({
  id: 'org.example.raw-http',
  kind: 'source',

  setup(ctx) {
    ctx.on('search.query.match', ({ query }) => (/^https?:\/\//i.test(query) ? { score: 100 } : null));

    ctx.on('search.query.resolve', ({ query }) => ({
      playlist: null,
      tracks: [new Track({ title: 'Direct media', url: query })],
    }));

    ctx.on('track.stream', ({ track }, { signal }) => {
      signal.throwIfAborted();

      return { url: track.url };
    });
  },
});

const player = new DiscordPlayer({
  nodes: [{ type: 'embedded', id: 'local' }],

  send: (guildId, payload) => gatewaySend(guildId, payload),

  plugins: [rawHTTP()],
});

await player.initialize(botUserId);

const result = await player.search('https://example.test/audio.mp3');

// Use player.play(channel, result) or queue.play(result) for managed playback.
await player.plugins.execute('search.query.resolve', { query: 'https://example.test/audio.mp3' });
```

Factories require options when their options type has required fields. Setup and
destroy may be async. `ctx.onCleanup()` owns resource cleanup; handler removers
are idempotent. Constructor descriptors and `await player.plugins.register(rawHTTP())`
use the same host. Unregister with `await player.plugins.unregister(id)`.
Each Player has independent contexts, handlers and lifetimes. Options may contain
local configuration; factories must avoid shared mutable state outside setup.

Search collects scored matches, orders higher handler priority first and then
higher score, and resolves metadata through the winning plugin. Equal ranks keep
registration order. No match produces an empty result. `pluginId` explicitly
targets a source; `searchEngine: 'ext:identifier'` retains legacy targeting.
`blockExtractors` applies to matching, direct execution, streaming and bridging.

The operation map is declaration mergeable. Define added operations with
`player.plugins.defineOperation(name, policy)` before registering their handlers.
Policies are `first` (first result other than undefined), `collect` (ordered
results), `pipe` (each result replaces the input), and `broadcast` (notifications).
Built-ins use collect for `search.query.match`, first for search resolution,
streams, related tracks and bridging, pipe for `stream.transform`, and broadcast
for `track.stream.resolved`. Only undefined declines; valid null/false results
are retained. Match null means no match. Errors reject with `PluginError`, which
identifies the plugin and operation. Cancellation propagates as the signal reason.

Removing a plugin immediately excludes it from new dispatches and aborts its
lifetime signal. In-flight handlers must cooperate with cancellation; removal
waits for their promises before destroy and cleanup, in reverse cleanup order.
A handler must not await removal of its own registration. Subscriptions created
during failed setup are removed, and destroy/cleanup are still attempted. Failed
registration IDs become reusable after cleanup. Repeated removal shares teardown.

Search stamps tracks with a `sourceReference` containing `pluginId` and JSON data.
Plugins should provide sufficient public identifiers for restoration and must not
put credentials, streams, functions or circular metadata there. Stream handlers
receive the restored Track and reference, without depending on legacy extractor
objects. Existing version 1 track payloads remain valid without a reference.

Streams accept Remedia MediaSource objects, HTTP(S) strings, file-path strings,
and encoded Node Readables. Readables/buffers require embedded mode; remote mode
rejects them explicitly and supports only server-accessible URLs/files. Returned
Readables transfer their playback lifetime to the host: cancellation, plugin
removal and queue termination destroy them. Transform handlers can return an
encoded replacement Readable. Direct resolveStream callers should drain/destroy
the result or provide a cancellation signal. `queue.node.play()` remains raw
Remedia playback without managed queue/history integration.

## Legacy extractor adapter

```ts
class RawExtractor extends BaseExtractor<{ root?: string }> {
  static identifier = 'org.example.legacy-raw';

  async validate(query: string) {
    return query.startsWith('https://');
  }

  async handle(query: string, context: ExtractorSearchContext) {
    const track = new Track(this.context.player, {
      title: 'Direct media',
      url: query,
      requestedBy: context.requestedBy,
      engine: query,
    });

    track.extractor = this;

    return this.createResponse(null, [track]);
  }

  async stream(track: Track) {
    return track.raw.engine as string;
  }
}

await player.extractors.register(RawExtractor, {});
```

Only BaseExtractor subclass constructors are accepted. Instances, plugin factories
and modern descriptors reject at runtime and in TypeScript. `register`, `get`,
`isRegistered`, `loadMulti`, `unregister`, `unregisterAll` and `reconfigure` retain
the familiar registration interface. Reconfigure replaces the owned instance;
retained references should be refreshed with get. Activation/deactivation map to
plugin setup/destroy. Validate, handle, stream, related tracks, bridge and local
post-stream transformations all execute through the shared operation host.
Protocols support `prefix:query` and `prefix://query`; priorities preserve legacy
precedence. Genuine failures reject rather than falling through silently.

Legacy Track/Playlist Player constructors, Track.extractor, raw, queryType,
requestMetadata/setMetadata, response helpers and duration utilities are supported.
Symbolic query hints retain their conventional camel-case string values; automatic
provider-specific URL classification belongs to source plugins. Local legacy raw
metadata and callbacks are omitted from persistence. Restoration retains only
public source references and locations; extractors needing private raw engines
must migrate their stream resolver. Legacy execution-session internals and the
old independent extractor dispatcher are unavailable.

The official v7 raw-stream implementation is exercised offline as an anonymous
fixture; downloader/MIME dependencies are controlled and native probing is not
exercised. This is targeted compatibility coverage, not certification of the
entire official extractor bundle. Obsolete FFmpeg, Discord voice, raw PCM/Opus
format overrides and audio resource manipulation require migration. Runtime
plugins, remote plugin execution/protocols and automatic distribution are deferred.

## Remedia capabilities

Discord Player uses Remedia and FFmpeg 9 shared libraries for embedded playback. Remote voice connections use an 80-second RPC deadline and a 100-second default overall initial join deadline, with bounded retries using fresh Gateway credentials. Queue connection settings initialize `DiscordSession` with self-deaf, self-mute, linear volume, and raw filtergraph configuration. Queue volume remains a 0–100 percentage and is converted to Remedia gain internally. Channel changes call `DiscordSession.move(channelId)` on the existing session, retaining the queue, current Track, filters, volume, and history. `queue.setSelfDeaf()` and `queue.setSelfMute()` update the connected session and queue defaults.

## Audio filters

`queue.node.filters` is a `GuildQueuePlayerAudioFilters` instance. It provides
35 fixed v7 FFmpeg presets and accepts raw filtergraphs without exposing the old
stream pipeline or custom preset-registration APIs.

```ts
const filters = queue.node.filters;

await filters.set(['8d', 'nightcore']); // Replace the chain with named presets.
filters.get('8D'); // true; both spellings are accepted.
filters.get(); // Complete raw FFmpeg filtergraph, or null.
filters.enabled; // Detached canonical preset names.
await filters.toggle('nightcore'); // false: this preset is now disabled.
await filters.toggle('bassboost', true);
await filters.remove('8d');
await filters.setRaw('volume=0.8'); // Replace with an opaque raw graph.
await filters.toggle('nightcore'); // Append a named effect while retaining the raw graph.
await filters.clear();
```

`set()` accepts a single preset, a preset array, a raw graph string, or null.
`setRaw()` always treats its string as an opaque graph, even if it is also a preset
name. `remove()` and `toggle()` operate on managed named presets; they do not parse
or edit individual filters inside an opaque graph. After a graph is changed through
raw session controls, exact single-preset graphs are recognized and other graphs
are treated as opaque.

Controls are available before connection and update queue defaults for the next
session. Connected changes use Remedia's filter controls under the node operation
lock; accepted changes persist across moves and reconnects. Failed native updates
reject without committing the requested named state. No track replay or voice-session
replacement is performed. Preset and raw-graph support depends on the selected
Remedia build; the native backend remains responsible for FFmpeg graph validation.

## Compatibility notes

- `queue.node.play()` is intentionally raw and does not enqueue Tracks, update history, or advance the queue when playback ends. Use `queue.play()` for queue-managed playback.
- Queue navigation and voice controls are asynchronous where Remedia operations are asynchronous and return Promises accordingly.
- Legacy stream pipeline classes, dispatcher utilities, and audio equalizer processing are not part of v8. Named FFmpeg presets and raw filtergraphs are available through `queue.node.filters`.
- Runtime plugins and the planned private source bridge remain deferred.
