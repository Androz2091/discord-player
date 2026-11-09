# Remedia integration requirements

This is a proposed implementation contract, not an existing server API. No Remedia
source was modified. Inspection baseline: published `@remedia/plugin-host`
0.1.0-dev.0 (also npm's current version during this review), `@remedia/client`
0.1.0-dev.4, and the local Remedia Rust checkout on 2026-11-09.

## Available today

The generic TypeScript host has a protocolVersion 1 manifest, plugin IDs and
operation names, direct `handle`/`execute`, authenticated JSON HTTP execution,
deferred encoded-byte factories, and expiring single-use HTTP media grants.
Manifest `name` is a display name, not a stable deployment ID. Its configuration
has no deployment identifier. The source adapter requires a configured
opaque `hostId` for HTTP execution and carries it in its application's portable
source reference. A network endpoint and its credentials belong in operator configuration, never Track metadata.

Rust `crates/remedia-server/src/rpc/params.rs::PlaySource` currently accepts only
`file {path}` and `url {url}`. Neither that enum nor server configuration exposes
plugin-host discovery, authenticated operation forwarding, or source reopening.
`play` and `stageNext` resolve client-selected locations; stage expiration is not
an operation-based refresh mechanism. Do not treat this adapter as automatic
remote source playback support. Hosted Tracks fail explicitly in the bot's local
registry, even if an unrelated local provider has the same ID.

## Generic host routing (server and client changes)

1. Add operator-owned host registrations keyed by a stable, unique host identifier.
   Each maps to an allowed HTTPS endpoint, secret reference, protocol version,
   timeouts, response size limits and operation allowlist. Duplicate IDs fail startup.
   Endpoint discovery must use the server's DNS/redirect policy and authenticate the
   endpoint; a public manifest alone is insufficient proof of identity. A manifest
   host identifier can be an optional v1 extension, but must match configuration.
2. Negotiate an advertised `pluginOperations` capability. Older nodes continue
   accepting file/URL sources and reject operation sources explicitly. No bot-side
   fallback should silently execute a different deployment/provider.
3. Add a generic source variant, for example
   `{type:"operation", hostId, pluginId, operation, input}`. `input` is bounded JSON
   opaque to Remedia. Host ID addresses a deployment; plugin ID addresses a
   registration within it. Allow only configured operations to produce playback
   descriptors. Rust must not parse application provider references or Track models.
4. Execute only when preparing playback on the selected node, including stage-next.
   Return a validated location descriptor `{url, expiresAtMs?}` or a negotiated
   media grant. Preserve expiration through transformations/staging. Refuse stale
   results; invoke the same operation again when fresh resolution is permitted.
   Never persist the bearer grant as the source identity.
5. Own an operation cancellation scope per preparation/generation. Stop, skip,
   replacement, stage discard, transport loss and shutdown cancel both pending
   operations and active media. Stale completions cannot replace a newer generation.
   Enforce separate pending-operation and active-stream limits.
6. Reconnect by stable host ID. Retry only replay-safe metadata/source operations,
   with bounded attempts and an operation ID; never automatically redeem a used
   grant. Unavailable hosts and provider reconstruction failures remain explicit.
   Credentials are sent only to the configured execution origin, never redirected
   or forwarded to a media URL. Logs redact secrets and signed URLs.

Server acceptance tests: two hosts with identical plugin IDs route independently;
unknown/removed host rejects; host restarts with the same ID reconstruct; changed
host ID rejects old sources; expired credentials trigger fresh resolution; absent
capability rejects without local fallback; stage/skip races cancel old operations;
authorization failure does not retry another host; restart never restores grant
URLs as durable source identity; operations cannot redirect to internal networks.

## Media probing, Range and reopening

Real HTTP tests in this repository generate MP3, Ogg/Opus and faststart M4A and run
FFmpeg against the published middleware. Default FFmpeg probing fails with HTTP
416 because FFmpeg requests `Range: bytes=0-` and v1 rejects any Range request.
Explicit `-seekable 0` decodes all three formats sequentially. This is not proof of
Discord voice playback, Rust playback, seeking, reconnects or recovery. Small
MP4/M4A files with a trailing moov atom may happen to fit FFmpeg's internal buffers;
large or interleaved files can require seeking and must not be advertised as safe.

An immediate server mitigation can select sequential/non-seekable FFmpeg input
only for a descriptor explicitly advertising this capability. It must not force
that option globally onto ordinary seekable URLs. Single-use grants still cannot
support FFmpeg reconnects, separate probe/play opens, or seeking that reopens input.

A proper extension needs capability negotiation before implementation:

- A source factory describes stable content identity, MIME, byte length when
  known, validator/ETag, expiration, sequential versus random access, and whether
  independent opens/reopens are supported. Unknown length is not random access.
- An open input contains cancellation and an optional single validated byte range
  `{start,endInclusive?}`. The output contains owned encoded bytes, actual byte
  offset/length and the same content validator. The host validates these before
  emitting 206/Content-Range. It returns 416 for unsatisfiable ranges. Do not merely
  slice a stream or ignore Range while pretending the source is seekable.
- The host owns grant/session authentication, maximum opens, concurrent requests,
  expiry and final disposal. Each open owns its upstream request/file handle;
  abort or client disconnect releases only that open. Revocation closes all opens.
  End-of-open is distinct from end-of-source-session. An unused session expires
  and disposes without opening media.
- A reopen operation refreshes expiring signed URLs through the original generic
  operation reference. Byte-range continuation requires unchanged content identity
  and validator. Otherwise restart playback with an explicit discontinuity/error;
  never append bytes from a different encoding.
- v1 sources remain single-use and non-seekable. The extension must not make old
  clients interpret multi-open sessions as old grants or leak reusable credentials.

Remedia tests must use real FFmpeg and HTTP: default initial bytes=0 probe, MP3 and
Ogg continuous playback, large tail-moov M4A seek, faststart M4A sequential decode,
separate probe then play, two concurrent ranges, unsatisfiable ranges, HEAD without
redemption, disconnect mid-range, reconnect before/after expiry, changed ETag on
reopen, server shutdown, and bounded buffering with slow consumers. Include old
client/new host and new client/old host capability rejection tests. Until those
contracts exist, remote execution is not end-to-end ready.
