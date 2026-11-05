import { player } from '@/lib/discord-player.ts';
import { musicCommand, MusicCommandError, requireVoiceChannel } from '@/lib/music-command.ts';
import type { QueueMetadata } from '@/lib/common.ts';
import type { CommandData } from 'commandkit';

export const command: CommandData = {
  name: 'join',
  description: 'Join your voice channel, or move the existing queue there.',
};

export const chatInput = musicCommand(async (interaction) => {
  const channel = requireVoiceChannel(interaction);
  if (!channel.joinable) throw new MusicCommandError('I cannot join your voice channel. Check my permissions.');
  const textChannel = interaction.channel;
  if (!textChannel?.isSendable()) throw new MusicCommandError('Use a channel where I can send playback updates.');
  const queue = await player.queues.create<QueueMetadata>(interaction.guildId, { metadata: { textChannel } });
  queue.metadata = { textChannel };
  await queue.connect({ channelId: channel.id });
  return `Connected to <#${channel.id}>.`;
});
