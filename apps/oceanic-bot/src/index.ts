/* eslint-disable no-console */
import { Client } from 'oceanic.js';
import { Player, createOceanicCompat } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';

const client = new Client({
  auth: `Bot ${process.env.DISCORD_TOKEN!}`,
  gateway: {
    intents: ["ALL"],
  },
});

const player = new Player(createOceanicCompat(client));

player
  .on('debug', console.log)
  .events.on('debug', (queue, msg) =>
    console.log(`[${queue.guild.name}] ${msg}`),
  );

player.extractors.loadMulti(DefaultExtractors);

client.once('ready', () => {
  console.log('Ready!');
  console.log(player.scanDeps());
});

player.events.on('playerStart', async (queue, track) => {
  const meta = queue.metadata as { channel: string };

  await client.rest.channels.createMessage(
    meta.channel,
    { content: `Now playing: ${track.title} (Extractor: \`${track.extractor?.identifier}\`/Bridge: \`${track.bridgedExtractor?.identifier}\`)` },
  );
});

player.events.on('playerFinish', async (queue, track) => {
  const meta = queue.metadata as { channel: string };

  await client.rest.channels.createMessage(
    meta.channel,
    { content: `Finished track: ${track.title} (Extractor: \`${track.extractor?.identifier}\`/Bridge: \`${track.bridgedExtractor?.identifier}\`)` },
  );
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;
  if (!message.channel) return;
  if (!message.guildID) return;

  const [command, ...args] = message.content.slice(1).split(' ');

  switch (command) {
    case 'ping':
      return client.rest.channels.createMessage(message.channel.id, { content: 'Pong!' });
    case 'play': {
      const voiceChannel = message.member?.voiceState?.channelID;
      if (!voiceChannel)
        return client.rest.channels.createMessage(
          message.channel.id,
          { content: 'You need to be in a voice channel!' },
        );

      const query = args.join(' ');

      const { track } = await player.play(voiceChannel, query, {
        requestedBy: message.author.id,
        nodeOptions: {
          metadata: { channel: message.channel.id },
          volume: 50,
        },
      });

      return client.rest.channels.createMessage(
        message.channel.id,
        { content: `Loaded: ${track.title} (Extractor: \`${track.extractor?.identifier}\`/Bridge: \`${track.bridgedExtractor?.identifier}\`)` },
      );
    }
    case 'pause': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.rest.channels.createMessage(message.channel.id, { content: 'No queue found!' });

      queue.node.pause();

      return client.rest.channels.createMessage(message.channel.id, { content: 'Paused the queue!' });
    }
    case 'resume': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.rest.channels.createMessage(message.channel.id, { content: 'No queue found!' });

      queue.node.resume();

      return client.rest.channels.createMessage(message.channel.id, { content: 'Resumed the queue!' });
    }
    case 'stop': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.rest.channels.createMessage(message.channel.id, { content: 'No queue found!' });

      queue.delete();

      return client.rest.channels.createMessage(message.channel.id, { content: 'Stopped the queue!' });
    }
    case 'skip': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.rest.channels.createMessage(message.channel.id, { content: 'No queue found!' });

      const success = queue.node.skip();

      if (!success)
        return client.rest.channels.createMessage(
          message.channel.id,
          { content: 'Cannot skip the track!' },
        );

      return client.rest.channels.createMessage(message.channel.id, { content: 'Skipped the track!' });
    }
    case 'volume': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.rest.channels.createMessage(message.channel.id, { content: 'No queue found!' });

      if (!args.length)
        return client.rest.channels.createMessage(
          message.channel.id,
          { content: `Current volume: ${queue.node.volume}` },
        );

      const volume = parseInt(args[0], 10);
      if (isNaN(volume))
        return client.rest.channels.createMessage(message.channel.id, { content: 'Invalid volume!' });

      queue.node.setVolume(volume);

      return client.rest.channels.createMessage(
        message.channel.id,
        { content: `Set the volume to: ${volume}` },
      );
    }
  }
});

client.connect();
