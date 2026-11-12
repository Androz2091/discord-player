# @discord-player/plugin-host

Standalone source execution for Discord Player v8, built on the published
`@remedia/plugin-host`. Requires Node.js 22.18 or newer.

```text
discord-player → @discord-player/plugin-host → @remedia/plugin-host
```

`discord-player` installs this package as a regular dependency and re-exports its
canonical `BaseExtractor`, `Track`, `Playlist`, `SearchResult`, plugin declarations,
registry, and serialization classes. Constructor identity and `instanceof` work
across package imports. No Player, queue manager, Discord client, native audio
binding, or Remedia audio engine is initialized by importing or creating a host.
The `@remedia/client` dependency supplies source descriptor types only.

The official `@discord-player/extractor` collection is an optional, separate package.
It is neither bundled nor automatically registered.

## Using a host from a bot

Normal applications register plugins locally. A metadata-only client descriptor can
register an existing standalone provider without repeating its host configuration:

```ts
const remoteSource = definePlugin({
  id: 'example.source',
  remoteHost: { hostId: 'sources-1', url: 'https://plugins.example.test', token: process.env.SOURCE_TOKEN },
});

const player = new Player({ ...audioOptions, plugins: [remoteSource()] });
const result = await player.search('some song');
await player.play(channel, result);
```

Advanced clients may register every advertised provider with
`player.plugins.registerHost(hostOptions)`. The obsolete constructor `sourceHosts`
option has been removed. Registration validates live provider capabilities and
deployment identity; it does not install plugins on the service.

This requires `@remedia/client@0.1.0-dev.7` and a matching remote server configured
with the same `pluginHosts` ID and the `discord-player.source` / `source.stream`
operation. The bot searches over HTTP and sends an operation descriptor for play
and automatic crossfade staging. Encoded bytes flow directly from host to audio
node. Local sources run locally. Embedded nodes cannot play hosted Tracks.

See the [complete deployment example](https://discord-player.js.org/docs/v8/plugins/remote-hosts).
The direct HTTP examples below describe protocol consumers; a bot should use
`player.search()` and queue playback, without fetching media grants itself.

## Registration and direct execution

```ts
import { createSourcePluginHost, SOURCE_PLUGIN_ID } from '@discord-player/plugin-host';
import { MyExtractor } from './my-extractor.js';
import { mySourcePlugin } from './my-source-plugin.js';

// Local-only handle() usage may omit hostId.
const host = createSourcePluginHost({ name: 'My Source Host' });

await host.extractors.register(MyExtractor);
await host.plugins.register(mySourcePlugin());

const response = await host.handle({
  pluginId: SOURCE_PLUGIN_ID,
  operation: 'source.search',
  input: { query: 'example' },
});

if (response.handled) console.log(response.result);

// Or use typed source APIs directly:
const result = await host.runtime.search('example');
const track = result.first();

if (track) {
  const source = await host.plugins.resolveStream(track);

  // Caller owns consumption and destruction of returned Readables.
  console.log(source);
}

await host.close();
```

Direct execution preserves model and stream references. It needs no public URL,
listener, or serialization. `host.remedia` exposes the actual generic Remedia host
for discovery and lifecycle inspection; use `host.handle` and `host.fetch` as the
application entrypoints, so the boundary conversion remains active.

Both Player and standalone execution use `SourcePluginRuntime`. There is one
registry with the existing `first`, `collect`, `pipe`, and `broadcast` policies,
provider priorities, protocol matching, bridging, registration cancellation,
post-stream transforms, and cleanup ownership. Player retains all queue, voice,
Gateway, crossfade, and playback orchestration.

## Hono

```ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createSourcePluginHost } from '@discord-player/plugin-host';
import { MyExtractor } from './my-extractor.js';

const host = createSourcePluginHost({ name: 'Sources', hostId: 'sources-eu-1', publicUrl: 'http://localhost:3000' });

await host.extractors.register(MyExtractor);

const app = new Hono();

app.all('*', (c) => host.fetch(c.req.raw));

const server = serve({ fetch: app.fetch, port: 3000 });

process.once('SIGTERM', () => {
  server.close();
  void host.close();
});
```

## Express

Mount Remedia's existing middleware at the origin root before body parsers.

```ts
import express from 'express';
import { createNodeMiddleware } from '@remedia/plugin-host/node';
import { createSourcePluginHost } from '@discord-player/plugin-host';
import { MyExtractor } from './my-extractor.js';

const host = createSourcePluginHost({ name: 'Sources', hostId: 'sources-eu-1', publicUrl: 'http://localhost:3000' });

await host.extractors.register(MyExtractor);

const app = express();

app.use(createNodeMiddleware(host));
app.use(express.json());

const server = app.listen(3000);

process.once('SIGTERM', () => {
  server.close();
  void host.close();
});
```

No listener starts automatically. Remedia owns HTTP routing, authorization,
request limits, media tokens, backpressure, stream cancellation, and disposal.
Configure `token`, `mediaTtlMs`, and `maxMediaTokens` through the host options.
`publicUrl` is a trusted HTTP(S) origin and is needed only for HTTP media results.

## HTTP source contract

One aggregate registration, `discord-player.source`, advertises:

| Operation        | Input                 | Result                                     |
| ---------------- | --------------------- | ------------------------------------------ |
| `source.search`  | `{ query, options? }` | Metadata through normal provider matching  |
| `source.related` | `{ track }`           | Related metadata from the track's provider |
| `source.stream`  | `{ track }`           | Deferred Remedia media descriptor          |

`source.stream` includes normal bridge fallback and post-stream transformations;
internal operation handlers are not separate Remedia registrations. HTTP options
accept portable plugin/source/searchEngine hints, limit, requester ID, and blocked
provider IDs. Local HTTP request options, functions and Discord objects do not
cross the boundary. The transport validates input before source execution.

```ts
import { SOURCE_PLUGIN_ID, deserializeSourceResult, type PortableSourceResult } from '@discord-player/plugin-host';

const response = await fetch('http://localhost:3000/remedia/v1/execute', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ pluginId: SOURCE_PLUGIN_ID, operation: 'source.search', input: { query: 'example' } }),
});

if (!response.ok) throw new Error(`Source search failed: ${response.status}`);

const search = (await response.json()) as { handled: boolean; result: PortableSourceResult };

if (!search.handled) throw new Error('Unhandled search');

const localModels = deserializeSourceResult(search.result);

console.log(localModels.first());

// Send the original portable representation back, including its optional state hint.
const mediaResponse = await fetch('http://localhost:3000/remedia/v1/execute', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    pluginId: SOURCE_PLUGIN_ID,
    operation: 'source.stream',
    input: { track: search.result.tracks[0] },
  }),
});

if (!mediaResponse.ok) throw new Error(`Source stream failed: ${mediaResponse.status}`);

const media = (await mediaResponse.json()) as { handled: boolean; result: { url: string; expiresAtMs: number } };

if (!media.handled) throw new Error('Unhandled media');

// Redeem media.result.url before expiresAtMs; this is a short-lived, single-use grant.
const bytes = await fetch(media.result.url);

console.log(bytes.body);
```

Media resolution starts when the grant is redeemed, using that request's
cancellation signal rather than the completed JSON request's signal. Readables,
files, buffers, and upstream HTTP(S) URLs become encoded byte streams before
post-stream transforms. URLs are proxied inside the host so provider resolution
and transforms remain there. The adapter never buffers complete media files.
Direct calls retain native descriptors; HTTP never returns nested Readables.

## Portable metadata and process-local state

HTTP results contain version 1 Track and Playlist data. `deserializeSourceResult()`
retains the opaque `sourceState` token on the normal Track and links Playlist
instances. Pass `serializeSourceTrack(track)` to source operations; no second HTTP
payload needs to be retained. `serialize()` and `toJSON()` deliberately omit the
temporary token. Persistence and clones made through persistence reconstruct from
provider metadata. Ordinary queue/history insertion retains the same Track and its
token. Host identity persists in `sourceReference.hostId`, separate from
`sourceReference.pluginId` and the provider's source name/data.

HTTP hosts must configure a stable non-secret `hostId`, including deployments
that do not configure `publicUrl`. Construction with `publicUrl` requires it, and
`fetch()` rejects HTTP use without it. Local-only `handle()` hosts may omit it and
receive a generated process identifier that intentionally does not survive restarts. Two hosts
can use the same provider IDs, but cannot redeem one another's Tracks. The embedded
registry rejects hosted Tracks when used as local sources. DiscordPlayer routes them
through configured remote hosts and compatible Remedia nodes instead.
Do not put endpoints, bearer tokens or credentials in sourceReference.

The per-host FIFO cache defaults to 1000 Track states for ten minutes. Previous
10000/one-hour defaults could retain substantial provider payloads and playlists.
Periodic cleanup runs even while idle (at most every 30 seconds), with additional
checks on use, provider lifetime changes and shutdown. Cached snapshots omit
Playlist links and metadata callbacks so one entry cannot retain the whole result
through those links. This is a count limit, not a byte memory guarantee: trusted
providers can still attach large engines. Tune limits for the deployment.

Concurrent remote playback receives copied engine/public metadata, never the
cached Track itself. Non-cloneable engines are reconstructed instead. Copies use
snapshot metadata rather than callbacks closing over the original Track. Direct
execution retains original object identity and the caller's ownership contract.

After eviction, expiration, or restart, modern plugins receive reconstructed
Track metadata and their portable sourceReference. Legacy extractors re-run
`handle()` through their original provider using the public Track URL, select the
matching URL, and then receive the newly constructed Track in `stream()`. If the
provider is unavailable or cannot reconstruct the track, execution fails with an
explicit diagnostic. This means queued tracks can survive cache loss when their
provider supports URL reconstruction; ephemeral-only sources must be searched
again. A serialized Track is never a promise of permanent source availability.

Raw engines, credentials, functions, live streams, circular objects and legacy
metadata callbacks are never serialized. Modern metadata and sourceReference
must follow the existing JSON-safe contract; plugins must put only public source
identifiers there, never secrets. Invalid metadata fails serialization rather
than being silently removed. Credentials belong to host-local plugin options.

## Legacy compatibility

The audited v7 extractors use `this.context.player` for Track/Playlist construction,
source lookup/bridging, diagnostics and `probeTimeout`. `LegacyPlayerContext` is a
structural source API, backed by the runtime when standalone and by the actual
Player when embedded. It supports plugins, extractors, search, debug/error events,
source options, and legacy constructors. Optional `getRemedia(false)` returns
null standalone; required audio access and queue/voice operations fail explicitly.
It never instantiates a dummy Player, queue or voice connection.

Legacy raw PCM/Opus override streams remain unsupported: return encoded media.
Queue history, Discord clients and other process-local playback objects are not
part of HTTP requests. An extractor that needs arbitrary Player/voice APIs or
cannot reconstruct private state after expiration requires migration; the source
compatibility surface does not emulate the whole Player API.

## Remedia server integration boundary

Remedia dev.7 supports generic host discovery, authenticated operation execution,
native decoding of single-use grants, and cancellation. Configure the deployment
in the server's `pluginHosts` list and in the bot plugin's `remoteHost` descriptor. Installing
`@remedia/plugin-host@0.1.0-dev.7` alone does not register a host with an audio node.

DiscordPlayer sends operation descriptors for playback and staged-next preparation;
the audio node invokes `source.stream` and consumes encoded bytes directly. The
bot uses HTTP only for metadata and never redeems a playback grant. Host affinity
is checked during session selection and before playback/staging. Embedded playback
continues to execute local registrations and rejects remote-host Tracks.

## Validation

`pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm format:check`
cover the workspace. Tests include the published optional extractor collection (SDK calls stubbed),
real HTTP disconnect/shutdown, and real FFmpeg decoding of generated MP3, Ogg/Opus
and faststart M4A. FFmpeg must be installed; CI installs it explicitly. No personal
media files or third-party service access are needed. CI builds the host before discord-player,
includes its dist artifacts, and publishes it before dependent packages using the
shared release inventory.

## Remote media policy

`mediaPolicy` denies private, loopback, link-local, reserved and transition IP
ranges by default. DNS results are checked and the selected address is pinned to
the connection, preserving TLS hostname verification. Every redirect is checked;
TLS downgrades and URL user/password credentials are rejected. Optional
`allowedHosts` restricts exact hostnames. No inbound authorization or provider
request headers are copied to upstreams. Providers needing custom authorization
must return an encoded Readable opened by their trusted SDK. Plugins execute
trusted code and can open their own network/file resources; this policy does not
sandbox extractor `handle()` or provider-created streams.

File descriptors require explicit `allowedFileRoots`. Canonical paths are checked,
then regular files are opened through owned handles. Authorized roots and parent
directories must be administrator-owned; concurrent hostile filesystem mutation is
outside this policy's trust boundary. Default limits are 32 active streams, 512 MiB
per stream, 30 minutes total, five redirects and 30 seconds upstream socket idle.
Tune `maxConcurrent`, `maxBytes`, `timeoutMs`, and `allowPrivateNetworks` for trusted
private deployments. Buffers are already allocated by providers; the host bounds
output bytes but cannot undo that allocation. Streaming uses backpressure; abort,
consumer disconnect, byte/deadline errors and host shutdown release resources.
After headers, errors terminate the body/socket, never masquerade as successful
JSON responses. Use Remedia's Node middleware to connect network disconnects to
Fetch cancellation. Configure `token` and HTTPS for remote authorization.

Default proxy delivery resolves media on grant redemption. Expired provider
sources are rejected rather than fetching expired credentials; request a fresh
`source.stream` grant. Provider expiration survives materialization and stream
transforms. Grant expiration is a separate deadline managed by Remedia.
`mediaDelivery: 'direct-url'` enables direct delivery for explicitly declared
`directUrlProviders` only. Invoking an arbitrary `track.stream` handler may already
open a Readable, so unknown or mixed-source providers must stay deferred. Declare
only trusted providers whose handlers return URL metadata without opening media:

```ts
const host = createSourcePluginHost({
  name: 'Sources',
  hostId: 'sources-eu-1',
  publicUrl: 'https://sources.example.com',
  mediaDelivery: 'direct-url',
  directUrlProviders: ['example.url-provider'],
});
```

These providers resolve URL metadata at `source.stream` invocation, never search.
The dispatcher checks active, unblocked transformations for the actual stream
owner. Applicable byte transforms force the existing secure proxy path, and run
once on redemption. Unrelated providers' transforms do not prevent direct delivery.
The check repeats after asynchronous URL preparation so newly registered transforms
cannot be skipped. A declining URL-only handler defers bridge resolution; a handler
that returns bytes despite its declaration fails explicitly and its stream is
destroyed, without a retry. Do not list legacy or mixed-result providers.

All other providers, including Readables, files and buffers, resolve and materialize
only when their grant is redeemed. There is no eager byte-source fallback or retained
live stream in an unredeemed grant. Cancellation, expiration, provider removal and
shutdown release transport resources; an old grant cannot bind a replacement
registration. Provider URL expiration remains intact. The consuming node must still
independently enforce its DNS/redirect policy for direct URLs. Authentication or
byte transformations requiring the host must use proxy delivery.

Single-use media grants reject Range requests. Remedia dev.7 redeems each grant with one
plain GET and feeds a bounded sequential queue to the decoder, so it never issues Range
requests, reopens or reconnects a grant. Seeking is forward-only. This does not add random
access or turn grant URLs into durable source references.
See [the Remedia integration contract](docs/remedia-contract.md) for the current
protocol and validation limits. Native Remedia playback and Discord voice delivery
remain outside this repository's HTTP/client integration tests.

## Optional capabilities

`definePlugin()` has no kind discriminator. Its typed `OperationMap` includes
`lyrics.search` independently of source operations. A lyrics provider returns an
array of normalized records with `plain.available` and `synced.available` discriminants;
only synchronized records carry sorted `{ timestampMs, line }` values. The optional
`lrclibPlugin()` implementation lives here and is not automatically registered by
Discord Player. Legacy `BaseExtractor.resolveLyrics()` adapts into that same operation.

HTTP discovery advertises actual provider IDs, protocols, priorities and operation
handlers. `metadata.execute` carries a typed `MetadataRequest` for normalized search,
lyrics or related metadata. `source.search` remains the high-level search endpoint;
`source.resolve` was removed. Portable lyrics requests use versioned Track metadata
without expiring source-state hints. `source.stream` and native operation-source
playback retain their existing media policy, cancellation and grant behavior.

Metadata currently travels over direct HTTP. Remedia dev.7 can forward generic plugin
operations to server-configured hosts (`client.plugins.list` / `execute`), but Discord Player
does not use that path yet. `remote.ts` isolates this boundary for a future supported
transport without introducing a second search dispatcher.
