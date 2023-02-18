import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { lyricsExtractor } from '@discord-player/extractor';

const genius = lyricsExtractor();

@ApplyOptions<Command.Options>({
	description: 'Displays the lyrics'
})
export class LyricsCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) => {
					return option.setName('song').setDescription('Song to get lyrics for').setRequired(false);
				});
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const queue = this.container.client.player.nodes.get(interaction.guild?.id!);
		const song = interaction.options.getString('song', false) || queue?.currentTrack?.title;
		if (!song) {
			return interaction.reply({ content: `${this.container.client.dev.error} | Input is required!`, ephemeral: true });
		}

		await interaction.deferReply();

		const lyrics = await genius.search(song).catch(() => null);

		if (!lyrics) return interaction.followUp({ content: `${this.container.client.dev.error} | No lyrics found!`, ephemeral: true });
		const trimmedLyrics = lyrics.lyrics.substring(0, 1997);

		const embed = new EmbedBuilder()
			.setTitle(lyrics.title)
			.setURL(lyrics.url)
			.setThumbnail(lyrics.thumbnail)
			.setAuthor({
				name: lyrics.artist.name,
				iconURL: lyrics.artist.image,
				url: lyrics.artist.url
			})
			.setDescription(trimmedLyrics.length === 1997 ? `${trimmedLyrics}...` : trimmedLyrics)
			.setColor('Random');

		return interaction.followUp({ embeds: [embed] });
	}
}
