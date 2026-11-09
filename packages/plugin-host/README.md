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

## Registration and direct execution

```ts
import { createSourcePluginHost, SOURCE_PLUGIN_ID } from '@discord-player/plugin-host';
import { MyExtractor } from './my-extractor.js';
import { mySourcePlugin } from './my-source-plugin.js';

const host = createSourcePluginHost({ name: 'My Source Host', hostId: 'sources-eu-1' });
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

const host = createSourcePluginHost({ name: 'Sources', publicUrl: 'http://localhost:3000' });
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

const host = createSourcePluginHost({ name: 'Sources', publicUrl: 'http://localhost:3000' });
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

| Operation        | Input                           | Result                                     |
| ---------------- | ------------------------------- | ------------------------------------------ |
| `source.search`  | `{ query, options? }`           | Metadata through normal provider matching  |
| `source.resolve` | `{ query, pluginId, options? }` | Metadata from an explicit provider         |
| `source.related` | `{ track }`                     | Related metadata from the track's provider |
| `source.stream`  | `{ track }`                     | Deferred Remedia media descriptor          |

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

Configure a stable non-secret `hostId` for restart recovery. The default is a
random process identifier and intentionally does not survive restarts. Two hosts
can use the same provider IDs, but cannot redeem one another's Tracks. The embedded
registry explicitly rejects hosted Tracks until generic server forwarding exists.
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

The inspected Remedia Rust sources do not implement plugin-host discovery or
source operation routing. Creating a remote Remedia client does not register this
host with an audio server. A bot can call this HTTP protocol explicitly and redeem
the media descriptor, or pass a reachable descriptor URL to supported playback
APIs before the grant expires. Automatic Rust-side routing still requires host
configuration/discovery, authenticated operation execution, sourceReference
round-tripping, cancellation, and timely media-grant redemption. No new Rust API,
custom IPC transport or automatic remote registry is claimed by this package.

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
`mediaDelivery: 'direct-url'` opts into returning accessible provider URLs directly,
with their expiration and without a proxy request. This resolves at source.stream
invocation, never search. URL sources then follow local URL semantics (no byte
transforms); use proxy delivery when transforms or host-side authentication are
required. The consuming node must independently enforce DNS/redirect policies.
Readables/files/buffers still use media grants in this mode.

**Remote execution is not end-to-end ready.** Published single-use media grants
reject FFmpeg's default Range probing. See [the implementable Remedia contract and
acceptance tests](docs/remedia-contract.md) for routing, sequential playback,
seeking, probing, reopening and recovery requirements. No Range support is
claimed here.
