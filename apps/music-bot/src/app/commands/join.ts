import { player } from '@/lib/discord-player.ts';
import type { CommandData, ChatInputCommand } from 'commandkit';

export const command: CommandData = {
  name: 'join',
  description: 'Joins the voice channel of the user who invoked the command.',
};

export const chatInput: ChatInputCommand = async (ctx) => {
  if (!ctx.interaction.inCachedGuild()) return;

  const member = ctx.interaction.member;

  if (!member.voice.channelId) {
    return ctx.interaction.reply({
      content: 'You need to be in a voice channel to use this command.',
      ephemeral: true,
    });
  }

  if (!member.voice.channel?.joinable) {
    return ctx.interaction.reply({
      content: 'I cannot join your voice channel. Please check my permissions.',
      ephemeral: true,
    });
  }

  await ctx.interaction.deferReply({ ephemeral: true });

  const queue = await player.queues.create(ctx.interaction.guildId, {
    metadata: {
      textChannel: ctx.interaction.channel,
    },
  });

  const session = await queue.connect({
    channelId: member.voice.channelId,
  });

  await ctx.interaction.editReply({
    content: `Joined <#${session.channelId}>!`,
  });
};
