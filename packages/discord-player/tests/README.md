## Running the suite

- `pnpm --filter discord-player test` runs deterministic offline unit tests.
- `pnpm --filter discord-player typecheck` also checks compile-time API fixtures.
- `pnpm --filter discord-player test:coverage` measures all executable `src/**/*.ts`
  files and writes HTML and JSON reports to `coverage/`. Global thresholds enforce
  95% statements, lines, and functions, and 90% branches.

## Shared test doubles

`setup.ts` rejects unexpected HTTP requests and Remedia initialization. Tests must
install the corresponding fake explicitly; Discord credentials, native Remedia,
and external services are unnecessary.

- `mocks/remedia-session.ts` implements the Remedia control-method signatures with
  stable session IDs, deterministic playback generations, retained configuration, and
  controllable lifecycle events.
- `mocks/remedia.ts` creates a fresh client backend with typed node snapshots and
  tracked sessions. Private Remedia class fields require a nominal cast, kept at
  this boundary; public control methods are structurally checked against the SDK.
- `mocks/queue.ts` creates an isolated Player, connected queue, and raw-stream
  source plugin for queue tests. It also supplies controllable Track fixtures.
- `mocks/http.ts` installs a typed fetch mock with real Response objects.
- `mocks/async.ts` supplies deferred promises and an event-loop settling helper.
  Races use explicit promises; retry timing uses fake timers instead of sleeps.
- `mocks/legacy.ts` supplies a representative legacy extractor for adapter tests.

Each test gets fresh backend and plugin state. Vitest restores spies and stubbed
globals between tests. Tests cover unit behavior and orchestration, including
search-to-stream-to-queue playback, cancellation, stale events, repeated terminal
events, fallback ownership, resource cleanup, malformed persistence payloads,
context isolation, HTTP retry ordering, and legacy registration failures.

The official raw-stream fixture has its own provenance and dependency boundaries
in `fixtures/README.md`. Offline tests cannot establish native decoder behavior,
real Gateway negotiation, remote-server behavior, or live playback compatibility.

Real remote AutoPlay RPC coverage (requires an installed Remedia 0.3.0 executable):

```sh
REMEDIA_BINARY=/path/to/remedia pnpm --filter discord-player exec vitest run tests/remote-autoplay-rpc.spec.ts
```

This starts isolated Remedia and HTTP source-host processes with fixture credentials, evicts cached Track state, and checks normal playback and adaptive crossfade admission. RPC, authorization and provider execution are real; Discord transport and audio generations use the deterministic playback backend. It does not connect to Discord.
