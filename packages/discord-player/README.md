# Discord Player

A robust and versatile [Discord](https://discord.com) music bot for [discord.js](https://discord.js.org) with a focus on performance and ease of use.

> **Note:** This package is still in development and is not yet ready for production use.

## Example (Concept)

> At the moment, the following example is a concept only and does not represent the final API. The API is subject to change at any time.

### Initialize the server

```js
import { createServer } from '@discord-player/server';

const server = createServer({
    async authenticate(id, password) {
        return id === 'my-id' && password === 'my-password';
    },
    port: 5678,
});

const { address, port } = await server.listen();

console.log(`Server listening on ${address}:${port}`);
console.log(`Connect with discord-player://my-id:my-password@${address}:${port}`);
```

### Client usage

```js
import { createPlayer } from 'discord-player';
import { DiscordJS } from '@discord-player/discord.js';

const adapter = DiscordJS(client);
const player = createPlayer(adapter, {
    nodes: ['discord-player://id:password@localhost:5678'],
});

// track start event
player.events.on('trackStart', (queue, track) => {
    const { textChannel } = queue.metadata;
    textChannel.send(`Now playing: ${track.title}`);
});

// play command
const { track } = await player.play(voiceChannel, query, {
    metadata: {
        textChannel: message.channel,
    },
});

message.channel.send(`Queued: ${track.title}`);
```
