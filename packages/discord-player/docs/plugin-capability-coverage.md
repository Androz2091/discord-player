# Capability coverage audit

The registry is shared by Player and source hosts. Local contracts are installed by
Player before setup; source hosts reject them. This matrix records execution
boundaries and intentional limits, rather than promising a hook for every method.

| Domain / execution path                              | Contract                                                                                     | Execution / limitations                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Player constructor registrations                     | `player.ready`                                                                               | Sync observation after constructor plugins activate; not Discord readiness                                      |
| Remedia initialization                               | `player.beforeInitialize`, `player.initialized`                                              | Sync identity interception / observation                                                                        |
| Shutdown                                             | `player.destroying`                                                                          | Observation; failure joins cleanup errors, cannot veto shutdown                                                 |
| Queue manager create/cache                           | `queue.beforeCreate`, `queue.created`                                                        | Sync veto / observation; existing cache hits are unchanged                                                      |
| Queue configuration                                  | `queue.beforeConfigure`, `queue.beforeMetadata`, `queue.beforeRepeat`, `queue.beforeShuffle` | Sync; metadata veto only to preserve generic application type                                                   |
| Admission: add, insert, append, prepend, copy        | `queue.beforeAdd`                                                                            | Sequential transforms; Track validation, capacity and index checks before commit                                |
| Remove, move, swap, clear                            | `queue.beforeRemove/Move/Swap/Clear`                                                         | Sync veto; original mutation retains occurrence IDs                                                             |
| All collection changes including compatibility store | `queue.changed`                                                                              | Sync observation; cannot veto mandatory internal progression                                                    |
| Ordinary / dynamic shuffle selection                 | `queue.selectNext`                                                                           | Sync policy selecting an existing occurrence index                                                              |
| Natural completion / repeat / history                | `queue.event`, `playback.beforeHistory`                                                      | Actual events observed; repeat retains existing generation reconciliation                                       |
| Autoplay related selection                           | `queue.selectRelated`, existing `track.related`                                              | Sync selection before legacy autoplay callback; async source retrieval                                          |
| Managed play, skip, stop                             | `playback.beforeStart/Skip/Stop`                                                             | Sync veto at public request boundary; raw node playback remains a low-level API                                 |
| Pause, resume, seek                                  | `playback.beforePause/Resume/Seek`                                                           | Sync, before async node lock; finite seek validation                                                            |
| Source matching, resolution, bridging                | Existing `search.query.*`, `track.stream`, `track.bridge`; `media.beforeResolve`             | Async; source identity and deployment retained                                                                  |
| Search query and metadata                            | `search.beforeQuery`, `search.afterResults`                                                  | Async transforms; actual Track results validated                                                                |
| Stream creation / preparation                        | Existing stream hooks plus `media.beforeResolve`, `media.descriptor`                         | Existing hooks retain precedence and cancellation                                                               |
| Encoded bytes                                        | `media.transform`; legacy `stream.transform`                                                 | Modern transforms compose independently of source ownership; legacy post-stream stays provider-scoped           |
| Remote descriptor boundary                           | `media.descriptor`                                                                           | Portable descriptor only; host affinity retained; no access to host-to-Remedia bytes                            |
| Crossfade preparation and promotion                  | `queue.selectNext` with `crossfade: true`, `queue.event`                                     | Select queued occurrence; staging/cancellation/promotion observed through existing events; no fabricated starts |
| Voice create / move / reconnect                      | `voice.beforeConnect`, `voice.beforeSession`, `queue.event`                                  | Sync; no replacement of Remedia's recovery implementation                                                       |
| Automatic voice policies                             | `voice.beforeLeave`, `voice.beforeAutoPause`                                                 | Sync veto only after existing authoritative membership / cooldown checks                                        |
| Session disposal / queue deletion                    | `queue.destroyed`, existing session events                                                   | Mandatory cleanup cannot be vetoed                                                                              |
| Volume / graph / presets                             | `audio.beforeVolume`, `audio.beforeFilters`                                                  | Sync validated transformation before Remedia applies controls                                                   |
| Diagnostics / failures                               | `queue.event`, existing Player events, attributed `PluginError`                              | Observer errors report to Player error channel; no fake success or retry policy                                 |
| Persistence                                          | `plugins.serialize/restore`, `serialization.afterSerialize/beforeRestore`                    | Explicit async alternative; existing synchronous model/global serde has no owning registry                      |

No local lifecycle operation is sent over RPC. Source hosts advertise the actual
shared registrations through existing discovery. Modern capabilities are not
added to BaseExtractor. Player and queue configuration objects remain public for
compatibility; direct property writes outside supported methods cannot be
intercepted. Session ownership, terminal event identity, crossfade generation
commit and mandatory cleanup remain framework decisions. Plugins cannot veto
facts already reported by Remedia, or replace transport internals that Remedia
owns. There is no automatic plugin error recovery/retry capability.

Validation uses deterministic mock Remedia sessions and local media fixtures;
it does not establish live Discord or native transport behavior.
