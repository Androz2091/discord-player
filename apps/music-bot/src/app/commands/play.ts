import { player } from '@/lib/discord-player.ts';
import type { CommandData, ChatInputCommand } from 'commandkit';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';

export const command: CommandData = {
  name: 'play',
  description: 'Plays a song in the voice channel of the user who invoked the command.',
  options: [
    {
      name: 'resource',
      description: 'The resource to play.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

export const chatInput: ChatInputCommand = async (ctx) => {
  if (!ctx.interaction.inCachedGuild()) return;

  const member = ctx.interaction.member;

  if (!member.voice.channelId || member.voice.channelId !== ctx.interaction.guild.members.me?.voice.channelId) {
    return ctx.interaction.reply({
      content: 'You need to be in the same voice channel as me to use this command.',
      ephemeral: true,
    });
  }

  await ctx.interaction.deferReply({ ephemeral: true });

  const queue = player.queues.get(ctx.interaction.guildId);

  if (!queue?.node.session) {
    return ctx.interaction.editReply({
      content: 'I am not connected to a voice channel. Please use the /join command first.',
    });
  }

  const resource = ctx.options.getString('resource', true);

  const customMetadata = {
    url: resource,
    playedBy: {
      name: ctx.interaction.user.displayName,
      id: ctx.interaction.user.id,
      avatar: ctx.interaction.user.displayAvatarURL(),
    },
  };

  const streamInfo = await queue.node.play(
    {
      url: resource,
    },
    {
      customMetadata,
    },
  );

  const embed = new EmbedBuilder()
    .setTitle('Now Playing')
    .setAuthor({
      name: customMetadata.playedBy.name,
      iconURL: customMetadata.playedBy.avatar,
    })
    .setDescription(`[${streamInfo.metadata?.title ?? 'Unknown Title'}](${customMetadata.url})`)
    .addFields({
      name: 'Duration',
      value: ((streamInfo.durationMs ?? 0) / 1000).toFixed(2) + ' seconds',
    })
    .setFooter({
      text: `Requested by ${ctx.interaction.user.displayName}`,
    })
    .setTimestamp();

  await ctx.interaction.editReply({
    embeds: [embed],
  });
};
