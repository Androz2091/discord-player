# Remedia source-host integration

Supported with published `@remedia/client@0.1.0-dev.5`, `@remedia/plugin-host@0.1.0-dev.5`,
and the matching Remedia server (generic operations merged in twlite/remedia PR #13).

The standalone adapter exposes `GET /.well-known/remedia` and
`POST /remedia/v1/execute`. Its aggregate plugin ID is `discord-player.source`;
operations are `source.search`, `metadata.execute`, `source.related`, and `source.stream`.
Discovery names are display labels. Stable deployment `hostId` values belong in
operator configuration and in each Track's portable source reference.

Configure a client plugin with `definePlugin({ id, remoteHost: { hostId, url, token?, timeoutMs? } })`, then pass its factory registration in `Player({ plugins: [remotePlugin()], ... })`.
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
single-use encoded media grants, and owns playback/stage cancellation and grant
reopening. Credentials are origin-bound configuration, never Track data.
`serializeSourceTrack()` carries transient state for operations; persistent
`Track.serialize()` omits it and preserves durable provider/deployment identity.
Expired state is reconstructed on the standalone host when possible.

See the [complete deployment example](https://discord-player.js.org/docs/plugins/remote-hosts).

## Media probing, Range and reopening

Real HTTP tests in this repository generate MP3, Ogg/Opus and faststart M4A and run
FFmpeg against the published middleware. Default FFmpeg probing fails with HTTP
416 because FFmpeg requests `Range: bytes=0-` and v1 rejects any Range request.
Explicit `-seekable 0` decodes all three formats sequentially. This is not proof of
Discord voice playback, Rust playback, seeking, reconnects or recovery. Small
MP4/M4A files with a trailing moov atom may happen to fit FFmpeg's internal buffers;
large or interleaved files can require seeking and must not be advertised as safe.

Remedia dev.5's generic operation path treats host grants as single-use encoded
inputs and owns native decoding and operation re-execution. A grant is not a
seekable durable URL. Source providers must support reconstruction/reopening for
recovery; do not advertise arbitrary random-access or tail-moov M4A support from
the sequential fixture test alone.
