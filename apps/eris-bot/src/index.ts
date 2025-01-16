/* eslint-disable no-console */
import Eris from 'eris';
import { Player, createErisCompat } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';

const client = Eris(process.env.DISCORD_TOKEN!, {
  intents: ['all'],
});

const player = new Player(createErisCompat(client));

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

  await client.createMessage(
    meta.channel,
    `Now playing: ${track.title} (Extractor: \`${track.extractor?.identifier}\`/Bridge: \`${track.bridgedExtractor?.identifier}\`)`,
  );
});

player.events.on('playerFinish', async (queue, track) => {
  const meta = queue.metadata as { channel: string };

  await client.createMessage(
    meta.channel,
    `Finished track: ${track.title} (Extractor: \`${track.extractor?.identifier}\`)/Bridge: \`${track.bridgedExtractor?.identifier}\`)`,
  );
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
      if (!voiceChannel)
        return client.createMessage(
          message.channel.id,
          'You need to be in a voice channel!',
        );

      const query = args.join(' ');

      const { track } = await player.play(voiceChannel, query, {
        requestedBy: message.author.id,
        nodeOptions: {
          metadata: { channel: message.channel.id },
          volume: 50,
        },
      });

      return client.createMessage(
        message.channel.id,
        `Loaded: ${track.title} (Extractor: \`${track.extractor?.identifier}\`)/Bridge: \`${track.bridgedExtractor?.identifier}\`)`,
      );
    }
    case 'pause': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.createMessage(message.channel.id, 'No queue found!');

      queue.node.pause();

      return client.createMessage(message.channel.id, 'Paused the queue!');
    }
    case 'resume': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.createMessage(message.channel.id, 'No queue found!');

      queue.node.resume();

      return client.createMessage(message.channel.id, 'Resumed the queue!');
    }
    case 'stop': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.createMessage(message.channel.id, 'No queue found!');

      queue.delete();

      return client.createMessage(message.channel.id, 'Stopped the queue!');
    }
    case 'skip': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.createMessage(message.channel.id, 'No queue found!');

      const success = queue.node.skip();

      if (!success)
        return client.createMessage(
          message.channel.id,
          'Cannot skip the track!',
        );

      return client.createMessage(message.channel.id, 'Skipped the track!');
    }
    case 'volume': {
      const queue = player.queues.get(message.guildID);
      if (!queue)
        return client.createMessage(message.channel.id, 'No queue found!');

      if (!args.length)
        return client.createMessage(
          message.channel.id,
          `Current volume: ${queue.node.volume}`,
        );

      const volume = parseInt(args[0], 10);
      if (isNaN(volume))
        return client.createMessage(message.channel.id, 'Invalid volume!');

      queue.node.setVolume(volume);

      return client.createMessage(
        message.channel.id,
        `Set the volume to: ${volume}`,
      );
    }
  }
});

client.connect();
