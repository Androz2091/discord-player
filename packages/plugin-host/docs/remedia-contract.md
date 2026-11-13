# Remedia source-host integration

The standalone adapter exposes `GET /.well-known/remedia` and
`POST /remedia/v1/execute`. Its aggregate plugin ID is `discord-player.source`;
operations are `source.search`, `metadata.execute`, `source.related`, and `source.stream`.
Discovery names are display labels. Stable deployment `hostId` values belong in
operator configuration and in each Track's portable source reference.

Automatic discovery through `RemediaClient.plugins.list()` is the default. Allow `source.search` and `source.stream` on the server; Discord Player forwards searches with `plugins.execute()`, preserving portable provider state and stamping the executing `nodeId` on Track references. Related metadata uses `source.related`, and Track-based lyrics use `metadata.execute` when allowed. Node affinity survives serialization and queue history. Conflicting queue origins, sticky assignments and existing sessions fail without migration. Remedia owns discovery caching and forwarding authorization; unsupported servers and embedded nodes keep local plugins.

For optional direct HTTP access, configure a client plugin with `definePlugin({ id, remoteHost: { hostId, url, token?, timeoutMs? } })`, then pass its factory registration in `Player({ plugins: [remotePlugin()], ... })`.
The bot performs metadata operations, reconstructing canonical Tracks with
`deserializeSourceResult()`. It sends remote playback and staged-next sources as:

```ts
const source: OperationMediaSource = {
  hostId: track.sourceReference!.hostId!,
  pluginId: SOURCE_PLUGIN_ID,
  operation: 'source.stream',
  input: { track: serializeSourceTrack(track) },
};
```

`OperationMediaSource` is exported by `@remedia/client`. Configure the same host ID,
endpoint, authentication and allowed operation on the server's `pluginHosts` list.
The server advertises `capabilities.pluginOperations`; session creation accepts
`pluginHosts` requirements. Both play and stage reject incompatible assignments.
No local provider fallback or automatic guild movement is performed.

Remedia executes source operations during native preparation, fetches and decodes
single-use encoded media grants once, and owns playback/stage cancellation. It never
reopens a grant: replaying a queue entry runs the operation again. Credentials are origin-bound configuration, never Track data.
`serializeSourceTrack()` carries transient state for operations; persistent
`Track.serialize()` omits it and preserves durable provider/deployment identity.
Expired state is reconstructed on the standalone host when possible.

See the [complete deployment example](https://discord-player.js.org/docs/v8/plugins/remote-hosts).

## Media probing, Range and reopening

Real HTTP tests in this repository generate MP3, Ogg/Opus and faststart M4A and run
FFmpeg against the published middleware. Default FFmpeg probing fails with HTTP
416 because FFmpeg requests `Range: bytes=0-` and v1 rejects any Range request.
Explicit `-seekable 0` decodes all three formats sequentially. This is not proof of
Discord voice playback, Rust playback, seeking, reconnects or recovery. Small
MP4/M4A files with a trailing moov atom may happen to fit FFmpeg's internal buffers;
large or interleaved files can require seeking and must not be advertised as safe.

Remedia's generic operation path treats host grants as single-use encoded
inputs, redeems each with one plain GET (no Range, reopen or reconnect), supports
forward-only seeking, and owns native decoding. Replay re-executes the operation. A grant is not a
seekable durable URL. Source providers must support reconstruction/reopening for
recovery; do not advertise arbitrary random-access or tail-moov M4A support from
the sequential fixture test alone.
