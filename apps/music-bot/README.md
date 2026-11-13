# Discord Player music bot

A small CommandKit bot demonstrating Discord Player v8's Player, guild queue, history, and player-node APIs with an embedded or remote Remedia node.

Copy `.env.example` to `.env`, set `DISCORD_TOKEN`, and run `pnpm --filter music-bot dev` from the workspace root. Set `MUSIC_DIRECTORY` to a local music folder to enable filename search. Relative directory paths resolve from the bot's working directory. The bot needs permission to send messages and embeds, connect to voice, and speak.

## Remedia execution mode

By default the bot uses the in-process `@remedia/node` addon. Set `REMEDIA_MODE=remote` and configure `REMEDIA_URL`, `REMEDIA_USERNAME`, and `REMEDIA_PASSWORD` to use an authenticated standalone `remedia-server` instead. The remote URL can use `remedias://` for TLS. Missing or invalid configuration fails startup rather than silently falling back to embedded.

Embedded mode requires FFmpeg 9 shared libraries on the bot host; remote mode requires them only on the server. Local file matches from `MUSIC_DIRECTORY` refer to paths on the bot host, so they are generally not playable by a separate server unless that path is also accessible and allowed on the server. HTTP(S) sources must be allowed by the server's media URL policy.

See [remote installation](../website/content/docs/v8/remedia/remote.mdx) and [voice recovery](../website/content/docs/v8/remedia/voice-recovery.mdx).

## Commands

| Command              | Behavior                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `/play query`        | Play an HTTP(S) media URL or matching files from `MUSIC_DIRECTORY`.                      |
| `/join`              | Join your voice channel or move the existing queue there.                                |
| `/pause`, `/resume`  | Pause or resume the current track.                                                       |
| `/skip`              | Skip the current track and select the next one.                                          |
| `/stop`              | Stop the current track and retain upcoming tracks.                                       |
| `/queue list`        | Show the current track and the first ten upcoming tracks.                                |
| `/queue start`       | Start the next upcoming track after stopping.                                            |
| `/queue clear`       | Clear upcoming tracks and history while current playback continues.                      |
| `/nowplaying`        | Show the current track, position, playback status, and volume.                           |
| `/loop mode`         | Repeat the current track, repeat the queue after natural completion, or turn repeat off. |
| `/shuffle [enabled]` | Toggle or explicitly enable/disable dynamic shuffle.                                     |
| `/seek seconds`      | Seek to a position in seconds.                                                           |
| `/volume [percent]`  | Show volume or set it from 0 to 100 percent.                                             |
| `/filter [preset]`   | Show active presets, toggle bass boost/nightcore/vaporwave/8D, or turn filters off.      |
| `/disconnect`        | Delete the queue, clear history, and disconnect from voice.                              |
| `/ping`              | Show Discord gateway latency.                                                            |

Music controls require the member to share the bot's voice channel. All command confirmations and errors use private embeds. Queue and playback events post public embeds in the channel used by the latest `/play` or `/join` request.

## Playback and announcements

The registered `rawHTTPExtractor` source plugin resolves HTTP(S) URLs or searches `MUSIC_DIRECTORY` into ordinary `Track` instances. `/play query` searches through the plugin, then passes the resolved `SearchResult` to `player.play()`, allowing Discord Player to manage insertion, repeat/shuffle, history, and progression.

For local searches, matching normalizes both the query and relative filename/path by ignoring punctuation, symbols, spacing, case, and accents. Exact relative paths take precedence over normalized matches. `/play query` provides autocomplete through the same source plugin, including initial suggestions for empty input and up to 25 matching choices. Suggestions use exact relative file paths so selecting one resolves that file. Values beyond the autocomplete size limit are omitted; they can still be entered as a free-text search. Autocomplete passes a two-second abort signal into search.

The search includes nested directories, skips symlinks, and returns matching regular files in sorted order. An empty search string lists all regular files through `player.search('')`. Missing, unset, invalid, or unreadable music directories return empty results. The directory should contain media files supported by Remedia; file-format probing remains owned by the media engine.

The `track.stream` handler returns `{ url }` for HTTP media and `{ file }` for local media. Local tracks store directory-relative source references, so deserialized tracks can resolve against the current `MUSIC_DIRECTORY`. The plugin rechecks that a local source exists inside that directory before streaming. Search and stream resolution use the operation's propagated `AbortSignal`, including cancellation while waiting for filesystem operations. Site page extraction is not implemented.

Pause, resume, seek, and volume use `queue.node` controls. Scheduling commands use the queue, and filters use `queue.node.filters.toggle()` with framework-owned named presets. Presets can be combined, selecting one again disables it, and Off clears the entire chain.

The bot listens on `player.events` for queue creation/deletion, voice connection changes and recovery, track additions/removals, start/finish/skip/stop, pause/resume/seek, volume changes, an exhausted queue, and failures. Notifications retain the event's queue metadata so queue creation and deletion can announce even before caching or after removal. Underlying repeated connection events are deduplicated by session/channel identity.

Run `pnpm --filter music-bot typecheck` and `pnpm --filter music-bot test` to check the example without logging in to Discord. The TypeScript Vitest tests build the bot and use typed interaction and queue fixtures to verify API routing, embedded replies, and lifecycle announcements.

`pnpm --filter music-bot typecheck` checks both application code and the TypeScript test suites. Vitest runs the source modules with the configured `@` alias; assertions and mocks use Vitest throughout.
