import { musicCommand, MusicCommandError, requireQueue } from '@/lib/music-command.ts';
import { QueueRepeatMode } from 'discord-player';
import type { CommandData } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';

const modes: Record<string, QueueRepeatMode> = {
  off: QueueRepeatMode.OFF,
  track: QueueRepeatMode.TRACK,
  queue: QueueRepeatMode.QUEUE,
};

export const command: CommandData = {
  name: 'loop',
  description: 'Repeat the current track, repeat the queue, or turn looping off.',
  options: [
    {
      name: 'mode',
      description: 'Repeat policy applied when a track finishes.',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: 'Off', value: 'off' },
        { name: 'Track', value: 'track' },
        { name: 'Queue', value: 'queue' },
      ],
    },
  ],
};

export const chatInput = musicCommand((interaction) => {
  const queue = requireQueue(interaction);
  const choice = interaction.options.getString('mode', true);
  const mode = modes[choice];

  if (mode === undefined) throw new MusicCommandError('Choose off, track, or queue.');

  queue.setRepeatMode(mode);

  return `Loop mode: ${choice}.`;
});
