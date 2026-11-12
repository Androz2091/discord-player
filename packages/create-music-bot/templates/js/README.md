# {{name}}

A Discord music bot built with [Discord Player v8](https://discord-player.js.org/docs/v8) and [discord.js](https://discord.js.org). Audio is decoded and sent to Discord by [Remedia](https://github.com/twlite/remedia), which runs inside the bot process.

## Set up

1. **Install FFmpeg 9 shared libraries.** Remedia needs them on the machine that runs the bot. An `ffmpeg` executable alone is not enough. Follow the [FFmpeg guide](https://discord-player.js.org/docs/v8/installation/ffmpeg).
2. **Create a bot** in the [Discord Developer Portal](https://discord.com/developers/applications) and copy its token. Invite it with the `bot` and `applications.commands` scopes and the View Channel, Send Messages, Connect, and Speak permissions.
3. **Configure the bot.** Copy `.env.example` to `.env`, then set:
   - `DISCORD_TOKEN`: the bot token.
   - `ALLOWED_MEDIA_HOSTS`: comma-separated hostnames that `/play` may load audio from.
4. **Install and run.**

```bash
{{install}}
{{dev}}
```

The first start registers the slash commands. Global commands can take a few minutes to appear.

## Commands

| Command   | What it does                                       |
| --------- | -------------------------------------------------- |
| `/play`   | Queue an audio file from a direct link             |
| `/pause`  | Pause playback                                     |
| `/resume` | Resume playback                                    |
| `/skip`   | Skip the current track                             |
| `/stop`   | Stop, clear the queue, and leave the voice channel |
| `/queue`  | Show what is playing and what is next              |

Playback controls need the member to be in the same voice channel as the bot.

## Allowed media hosts

`/play` accepts only `http(s)` links whose hostname is listed in `ALLOWED_MEDIA_HOSTS`. While the list is empty, `/play` is disabled. Remedia follows redirects, so only list hosts you trust. The links must point directly at an audio file.

## Project structure

```text
src/
  index.js         Starts the bot and stops it on Ctrl+C or SIGTERM
  bot.js           Creates the Discord client and the Player, and handles Discord events
  commands.js      The slash commands
  events.js        Playback announcements and error logging
  media-source.js  Source plugin that turns an allowed link into a track
  config.js        Reads .env
```

## Run in production

```bash
{{start}}
```

Set `DISCORD_TOKEN` and `ALLOWED_MEDIA_HOSTS` in the environment or in `.env`. Stop the bot with `Ctrl+C` or `SIGTERM`; it leaves voice channels and closes the audio engine before exiting.

## Learn more

- [Discord Player v8 documentation](https://discord-player.js.org/docs/v8)
- [Source plugins](https://discord-player.js.org/docs/v8/plugins), for adding other music providers
- [Events](https://discord-player.js.org/docs/v8/guides/events)
- [Remote playback](https://discord-player.js.org/docs/v8/remedia/remote), for running audio on another machine
