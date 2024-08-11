/* eslint-disable no-console */
import 'dotenv/config';
import Eris from 'eris';
import { Player, createErisCompat } from 'discord-player';

const client = Eris(process.env.DISCORD_TOKEN!, {
    intents: ['all']
});

const player = new Player(createErisCompat(client));

player.extractors.loadDefault((ext) => ext !== 'YouTubeExtractor');

player.on('debug', console.log).events.on('debug', (queue, msg) => console.log(`[${queue.guild.name}] ${msg}`));

client.once('ready', () => {
    console.log('Ready!');
    console.log(player.scanDeps());
});

player.events.on('playerStart', async (queue, track) => {
    const meta = queue.metadata as { channel: string };

    await client.createMessage(meta.channel, `Now playing: ${track.title}`);
});

player.events.on('playerFinish', async (queue, track) => {
    const meta = queue.metadata as { channel: string };

    await client.createMessage(meta.channel, `Finished track: ${track.title}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;
    if (!message.guildID) return;

    const [command, ...args] = message.content.slice(1).split(' ');

    switch (command) {
        case 'ping':
            return client.createMessage(message.channel.id, 'Pong!');
        case 'play': {
            const voiceChannel = message.member?.voiceState.channelID;
            if (!voiceChannel) return client.createMessage(message.channel.id, 'You need to be in a voice channel!');

            const query = args.join(' ');

            const { track } = await player.play(voiceChannel, query, {
                requestedBy: message.author.id,
                nodeOptions: {
                    metadata: { channel: message.channel.id },
                    volume: 50,
                    defaultFFmpegFilters: ['lofi', 'bassboost_low', 'normalizer']
                }
            });

            return client.createMessage(message.channel.id, `Loaded: ${track.title}`);
        }
        case 'pause': {
            const queue = player.queues.get(message.guildID);
            if (!queue) return client.createMessage(message.channel.id, 'No queue found!');

            queue.node.pause();

            return client.createMessage(message.channel.id, 'Paused the queue!');
        }
        case 'resume': {
            const queue = player.queues.get(message.guildID);
            if (!queue) return client.createMessage(message.channel.id, 'No queue found!');

            queue.node.resume();

            return client.createMessage(message.channel.id, 'Resumed the queue!');
        }
        case 'stop': {
            const queue = player.queues.get(message.guildID);
            if (!queue) return client.createMessage(message.channel.id, 'No queue found!');

            queue.delete();

            return client.createMessage(message.channel.id, 'Stopped the queue!');
        }
    }
});

client.connect();
