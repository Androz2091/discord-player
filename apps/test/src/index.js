import { Client } from 'discord.js';
import { createPlayer } from 'discord-player';
import { DiscordJsAdapter } from './adapter';

const client = new Client({
    intents: [
        'GuildVoiceStates',
        'Guilds'
    ]
});

const adapter = new DiscordJsAdapter(client);

const player = createPlayer(adapter);

client.on('ready', async () => {
    await player.connect();

    const queue = player.queue.create('123');

    await queue.connect({
        channelId: '1234'
    });
});