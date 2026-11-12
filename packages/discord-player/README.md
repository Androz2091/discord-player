# Discord Player v8

Build Discord music bots with queues, playback controls, events, history, filters, and source plugins. [Remedia](https://github.com/twlite/remedia) handles audio processing and voice transport.

> v8 is under development and has breaking changes from v7. See the [migration guide](https://discord-player.js.org/docs/v8/migration).

## Install

Requires Node.js 22.18+ and ESM.

```bash
pnpm add discord-player@dev
# For playback inside your bot process:
pnpm add @remedia/node@0.1.0
```

Starting a new bot? `npm create music-bot@dev my-bot` generates a working project. v8 is a preview release, so use the `dev` tag: without it your package manager installs v7.

Embedded playback needs [FFmpeg 9 shared libraries](https://discord-player.js.org/docs/v8/installation/ffmpeg). For remote playback, the audio server needs them instead.

## Set up the player

```ts
import { Player } from 'discord-player';

const player = new Player({
  nodes: [{ id: 'local', type: 'embedded' }],
  plugins: [mySourcePlugin()],
  send: (guildId, packet) => sendGatewayPacket(guildId, packet),
});

client.on('raw', (packet) => player.receive(packet));
await player.initialize(client.user.id);
```

`client`, `mySourcePlugin`, and `sendGatewayPacket` belong to your application. Follow the [discord.js walkthrough](https://discord-player.js.org/docs/v8/getting-started/manual-setup) for a working example. Discord Player does not create your gateway connection or automatically add music sources.

## Play and control audio

```ts
const { queue, track } = await player.play({ guildId, channelId }, 'https://your-media-host.example/song.mp3');

if (!track) throw new Error('No matching track');

await queue.node.pause();
await queue.node.resume();
await queue.node.setVolume(70);
await queue.skip();
```

The URL is a placeholder. Your source plugin must recognize the query and return playable media.

Use `player.play()` or `queue.play()` for normal music playback. `queue.node.play()` starts raw Remedia playback without advancing the managed queue.

## Events

```ts
player.events.on('playerStart', (queue, track) => {
  console.log('Playing', track.title);
});

player.events.on('playerError', (queue, error, track) => {
  console.error('Playback failed', track.title, error);
});
```

## Documentation

- [Getting started](https://discord-player.js.org/docs/v8/getting-started)
- [Queues and playback](https://discord-player.js.org/docs/v8/guides)
- [Source plugins](https://discord-player.js.org/docs/v8/plugins)
- [API reference](https://discord-player.js.org/docs/v8/reference)
- [Migration from v7](https://discord-player.js.org/docs/v8/migration)
