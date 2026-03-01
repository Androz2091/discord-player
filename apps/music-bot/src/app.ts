import { Logger } from 'commandkit';
import { Player, StreamType } from 'discord-player';
import { Client, IntentsBitField } from 'discord.js';
import { createWriteStream } from 'node:fs';

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

const player = Player.create(client);

player.on('error', Logger.error);
player.events.on('error', (_, e) => Logger.error(e));
player.events.on('playerError', (_, e) => Logger.error(e));
player.events.on('playerStart', (queue, track) => {
  queue.metadata.channel.send(`Started playing ${track.title}`);
});
player.events.on('playerFinish', (queue, track) => {
  queue.metadata.channel.send(`Finished playing ${track.title}`);
});
player.events.on('playerSeek', (queue, time) => {
  Logger.log(`Seeked ${queue.currentTrack} to ${time}ms`);
});
player.events.on('debug', (queue, message) => {
  Logger.debug(message);
});

const interceptor = player.createStreamInterceptor({
  async shouldIntercept(queue, track) {
    return !track.raw.isFile;
  },
});

interceptor.onStream((queue, track, format, stream) => {
  const ext = format === StreamType.Opus ? '.opus' : '.pcm';
  stream.interceptors.add(
    createWriteStream(
      import.meta.dirname +
        '/../.streams/' +
        track.title.replace(/[^a-z0-9]/gi, '_') +
        ext,
    ),
  );
});

export default client;
