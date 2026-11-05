import { player } from '@/lib/discord-player.ts';
import { displayTrack, formatTime, musicCommand, MusicCommandError, requireVoiceChannel } from '@/lib/music-command.ts';
import { UrlTrack } from '@/lib/url-track.ts';
import type { QueueMetadata } from '@/lib/common.ts';
import { musicEmbed } from '@/lib/embeds.ts';
import type { CommandData } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';

export const command: CommandData = {
  name: 'play',
  description: 'Play or queue a direct media URL in your voice channel.',
  options: [
    {
      name: 'url',
      description: 'A direct HTTP or HTTPS audio/video URL.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

export const chatInput = musicCommand(async (interaction) => {
  const channel = requireVoiceChannel(interaction);
  if (!channel.joinable) throw new MusicCommandError('I cannot join your voice channel. Check my permissions.');
  const existingQueue = player.queues.get<QueueMetadata>(interaction.guildId);
  if (existingQueue?.node.session && existingQueue.node.session.channelId !== channel.id) {
    throw new MusicCommandError('Join my voice channel to add music, or use /join to move me.');
  }
  const textChannel = interaction.channel;
  if (!textChannel?.isSendable()) throw new MusicCommandError('Use a channel where I can send playback updates.');

  let track: UrlTrack;
  try {
    track = new UrlTrack(interaction.options.getString('url', true), interaction.user.id);
  } catch {
    throw new MusicCommandError('Enter a complete HTTP or HTTPS media URL.');
  }
  if (existingQueue) existingQueue.metadata = { textChannel };

  const result = await player.play<QueueMetadata>(channel, track, {
    nodeOptions: { metadata: { textChannel } },
  });
  if (result.playerResult) {
    const duration = result.playerResult.audioStream.durationMs;
    return musicEmbed('🎶 Playback started', displayTrack(track), 0x57f287).addFields(
      { name: 'Voice channel', value: `<#${channel.id}>`, inline: true },
      { name: 'Duration', value: duration === null ? 'Unknown' : formatTime(duration), inline: true },
    );
  }
  return musicEmbed('➕ Added to queue', displayTrack(track)).addFields({
    name: 'Upcoming tracks',
    value: String(result.queue.size),
    inline: true,
  });
});
