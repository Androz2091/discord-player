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

HTTP results contain version 1 Track and Playlist data. A `PortableSourceTrack`
adds an optional opaque `sourceState` field. `deserializeSourceResult()` removes
that transport extension before strict versioned deserialization and links the
shared Track instances to their Playlist. For raw `deserialize()`, remove the
`sourceState` extension first. Provider identity remains in `sourceReference`.

The host retains original Track objects (including `raw.engine`, extractor
identity and metadata callbacks) in a bounded cache: 10000 tracks and one hour by
default, configurable with `maxTrackStates` and `trackStateTtlMs`. Expiration is
checked on use; eviction releases references. Cache entries are invalidated by
provider removal and host shutdown. No media streams are retained by this cache.

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
cover the workspace. Source tests use synthetic encoded bytes and local fixtures,
without public media-provider access. CI builds the host before discord-player,
includes its dist artifacts, and publishes it before dependent packages using the
shared release inventory.
