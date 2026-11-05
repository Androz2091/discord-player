# Discord Player music bot

A small CommandKit bot demonstrating Discord Player v8's Player, guild queue, history, and player-node APIs with an embedded Remedia node.

Copy `.env.example` to `.env`, set `DISCORD_TOKEN`, and run `pnpm --filter music-bot dev` from the workspace root. The bot needs permission to send messages and embeds, connect to voice, and speak.

## Commands

| Command              | Behavior                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `/play url`          | Join your voice channel and play a direct HTTP/HTTPS media URL, or add it to the active queue. |
| `/join`              | Join your voice channel or move the existing queue there.                                      |
| `/pause`, `/resume`  | Pause or resume the current track.                                                             |
| `/skip`              | Skip the current track and select the next one.                                                |
| `/stop`              | Stop the current track and retain upcoming tracks.                                             |
| `/queue list`        | Show the current track and the first ten upcoming tracks.                                      |
| `/queue start`       | Start the next upcoming track after stopping.                                                  |
| `/queue clear`       | Clear upcoming tracks and history while current playback continues.                            |
| `/nowplaying`        | Show the current track, position, playback status, and volume.                                 |
| `/loop mode`         | Repeat the current track, repeat the queue after natural completion, or turn repeat off.       |
| `/shuffle [enabled]` | Toggle or explicitly enable/disable dynamic shuffle.                                           |
| `/seek seconds`      | Seek to a position in seconds.                                                                 |
| `/volume [percent]`  | Show volume or set it from 0 to 100 percent.                                                   |
| `/filter [preset]`   | Show the current preset, apply bass boost/nightcore/vaporwave/8D, or turn filters off.         |
| `/disconnect`        | Delete the queue, clear history, and disconnect from voice.                                    |
| `/ping`              | Show Discord gateway latency.                                                                  |

Music controls require the member to share the bot's voice channel. All command confirmations and errors use private embeds. Queue and playback events post public embeds in the channel used by the latest `/play` or `/join` request.

## Playback and announcements

`UrlTrack` is a minimal example source adapter: it wraps the input URL in a real `Track` and returns `{ url }` from `getStreamableSource()`. `/play` calls `player.play(channel, track, options)`, allowing Discord Player to manage insertion, repeat/shuffle, history, and progression. Enter direct media URLs that Remedia can open; search queries and site page extraction are not implemented.

Pause, resume, seek, and volume use `queue.node` controls. Scheduling commands use the queue, and filters use `queue.node.filters` with a small set of app-owned raw filtergraph presets. Each preset replaces the previous graph.

The bot listens on `player.events` for queue creation/deletion, voice connection changes and recovery, track additions/removals, start/finish/skip/stop, pause/resume/seek, volume changes, an exhausted queue, and failures. Notifications retain the event's queue metadata so queue creation and deletion can announce even before caching or after removal. Underlying repeated connection events are deduplicated by session/channel identity.

Run `pnpm --filter music-bot typecheck` and `pnpm --filter music-bot test` to check the example without logging in to Discord. The tests build the bot and use mocked interactions and queues to verify API routing, embedded replies, and lifecycle announcements.
