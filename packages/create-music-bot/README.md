# create-music-bot

Create a [Discord Player v8](https://discord-player.js.org/docs/v8) music bot with one command. The generated project uses [discord.js](https://discord.js.org) and plays direct links to audio files through the embedded [Remedia](https://github.com/twlite/remedia) audio engine.

v8 is in development, so install the `dev` tag:

```bash
npm create music-bot@dev my-bot
```

Run it without a project name to answer the prompts: the project name, TypeScript or JavaScript, and whether to install dependencies. `pnpm create`, `yarn create`, and `bun create` work the same way.

## Options

Pass options after `--` with npm.

```bash
npm create music-bot@dev my-bot -- --template js --install
```

| Option                    | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `-t, --template <ts\|js>` | Language of the project. Defaults to `ts` when not prompting |
| `--install`               | Install dependencies after generating the project            |
| `--no-install`            | Skip installation. This is the default when not prompting    |
| `--overwrite`             | Replace existing files without asking                        |
| `-y, --yes`               | Never prompt. A directory argument is required               |
| `-h, --help`              | Show help                                                    |
| `-v, --version`           | Show the generator version                                   |

The generator also never prompts when it is not attached to a terminal.

An existing directory is reused only when no generated file would replace one of its files. Otherwise the generator asks first, or exits unless `--overwrite` is passed. It never deletes files.

## What you get

```text
my-bot/
  src/
    index.ts          Starts the bot and stops it on Ctrl+C or SIGTERM
    bot.ts            Creates the Discord client and the Player, and handles Discord events
    commands.ts       /play, /pause, /resume, /skip, /stop, /queue
    events.ts         Playback announcements and error logging
    media-source.ts   Source plugin for direct audio links on allowed hosts
    config.ts         Reads .env
  .env.example
  .gitignore
  package.json
  README.md
  tsconfig.json       TypeScript projects only
```

The JavaScript project has the same files with a `.js` extension. Both are ESM and have identical behavior.

## Requirements

- Node.js 22.18 or newer.
- FFmpeg 9 shared libraries on the machine that runs the bot. See the [FFmpeg guide](https://discord-player.js.org/docs/v8/installation/ffmpeg).
- A Discord bot token.

## Versions

The generator and Discord Player share one release version. A generator at `8.0.0-dev.3` creates a project that depends on exactly `discord-player@8.0.0-dev.3`, so a prerelease generator never installs the v7 `latest` release.

## Documentation

[Getting started](https://discord-player.js.org/docs/v8/getting-started) covers the generated project and how to extend it. To add Discord Player to an existing project instead, follow [manual setup](https://discord-player.js.org/docs/v8/getting-started/manual-setup).
