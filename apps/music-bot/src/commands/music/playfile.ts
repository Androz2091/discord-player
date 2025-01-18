import { SlashCommandProps } from 'commandkit';
import { randomUUID } from 'crypto';
import { QueryType, useMainPlayer } from 'discord-player';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { readdirSync } from 'fs';

const files = new Map<
  string,
  {
    name: string;
    value: string;
  }
>();

export const data = new SlashCommandBuilder()
  .setName('playfile')
  .setDescription('Play a song from fs')
  .addStringOption((option) =>
    option
      .setName('query')
      .setDescription('The song to play')
      .setRequired(true)
      .setChoices(
        ...readdirSync(process.cwd() + '/.streams')
          .filter((f) => f !== '.gitkeep')
          .map((f) => {
            const alt = randomUUID();
            files.set(alt, {
              name: f,
              value: `${process.cwd()}/.streams/${f}`,
            });

            return {
              name: f.replace(/_|\./g, ' '),
              value: alt,
            };
          }),
      ),
  );

export async function run({ interaction }: SlashCommandProps) {
  if (!interaction.inCachedGuild()) return;

  const player = useMainPlayer();

  const channel = interaction.member?.voice.channel;

  if (!channel) {
    return interaction.reply({
      content: 'You must be in a voice channel to use this command.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  const query = interaction.options.getString('query', true);
  const file = files.get(query);

  if (!file) {
    return interaction.editReply('Invalid file');
  }

  const result = await player.play(channel, file.value, {
    searchEngine: QueryType.FILE,
    nodeOptions: {
      metadata: {
        channel: interaction.channel,
      },
      volume: 50,
      disableReverb: true,
      disableCompressor: true,
      disableSeeker: false,
    },
  });

  await interaction.editReply(`Playing ${result.track} in ${channel}`);
}
