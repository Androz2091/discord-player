/* eslint-disable */
import { Player, StreamType } from 'discord-player';
import { Client, IntentsBitField } from 'discord.js';
import { CommandKit } from 'commandkit';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';

const client = new Client({
  // prettier-ignore
  intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ],
});

const player = Player.create(client);

player.on('error', console.error);
player.events.on('error', (_, e) => console.error(e));
player.events.on('playerError', (_, e) => console.error(e));

const interceptor = player.createStreamInterceptor({
  async shouldIntercept() {
    return true;
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

new CommandKit({
  client,
  bulkRegister: true,
  skipBuiltInValidations: true,
  eventsPath: join(import.meta.dirname, 'events'),
  commandsPath: join(import.meta.dirname, 'commands'),
});

await client.login();
