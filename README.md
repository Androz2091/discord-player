# Discord Player

Discord Player is a music framework for Discord bots. Manage queues, tracks, playback, filters, and events while [Remedia](https://github.com/twlite/remedia) handles audio and Discord voice.

> This README describes the **v8 development branch**. For v7, use the documentation matching your installed version.

## Install

Node.js 22.18+ and ESM are required. For embedded playback:

```bash
pnpm add discord-player discord.js @remedia/node
```

Install [FFmpeg 9 shared libraries](https://discord-player.js.org/docs/installation/ffmpeg) on the machine running audio. Remote-only bot processes do not need FFmpeg locally.

## Create a player

```ts
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { directMedia } from './direct-media.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const player = new Player({
  nodes: [{ id: 'local', type: 'embedded' }],
  plugins: [directMedia()],
  send(guildId, packet) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Guild unavailable');
    return guild.shard.send(packet);
  },
});

client.on('raw', (packet) => player.receive(packet));
client.once(Events.ClientReady, (ready) => {
  void player.initialize(ready.user.id).catch(console.error);
});
```

The `directMedia` plugin is defined in the [getting-started tutorial](https://discord-player.js.org/docs/getting-started/source-plugin). Source plugins supply playable audio. Discord Player does not automatically register a music provider.

Inside your play command, after initialization:

```ts
const result = await player.play({ guildId, channelId }, 'https://your-media-host.example/song.mp3');
if (result.track) console.log('Playing', result.track.title);
```

Replace the example URL with a real audio file.

## Playback controls

```ts
const queue = player.getQueue(guildId);
if (queue) {
  await queue.node.pause();
  await queue.node.resume();
  await queue.node.setVolume(70);
  await queue.skip();
}
```

## Documentation

- [Getting started](https://discord-player.js.org/docs/getting-started)
- [Queues and events](https://discord-player.js.org/docs/guides)
- [Source plugins](https://discord-player.js.org/docs/plugins)
- [Embedded and remote playback](https://discord-player.js.org/docs/remedia)
- [Migrating from v7](https://discord-player.js.org/docs/migration)
- [API reference](https://discord-player.js.org/docs/reference)
