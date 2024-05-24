import { Command } from '@sapphire/framework';
import { useQueue, useMainPlayer, Util } from 'discord-player';
import { EmbedBuilder } from 'discord.js';

export class LyricsCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Displays lyrics of the given track'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) => {
					return option.setName('name').setDescription('The track of the lyrics to search').setRequired(false);
				});
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const player = useMainPlayer();
		const queue = useQueue(interaction.guild!.id);
		const track = interaction.options.getString('name') || (queue?.currentTrack?.cleanTitle as string);

		await interaction.deferReply();

		const results = await player.lyrics
			.search({
				q: track
			})
			.catch((e) => {
				console.log(e);
			});

		const lyrics = results?.[0];

		if (!lyrics?.syncedLyrics && !lyrics?.plainLyrics)
			return interaction.editReply({ content: `${this.container.client.dev.error} | No lyrics found for this track` });

		if (lyrics.syncedLyrics) {
			const syncedLyrics = queue?.syncedLyrics(lyrics);

			syncedLyrics?.onChange(async (lyrics, timestamp) => {
				await interaction.channel?.send({
					content: `[${Util.formatDuration(timestamp)}]: ${lyrics}`
				});
			});

			syncedLyrics?.subscribe();
		}

		const trimmedLyrics = (lyrics.plainLyrics || lyrics.syncedLyrics || '').substring(0, 1997);

		const embed = new EmbedBuilder()
			.setTitle(lyrics.trackName)
			.setAuthor({
				name: lyrics.artistName
			})
			.setDescription(trimmedLyrics.length === 1997 ? `${trimmedLyrics}...` : trimmedLyrics)
			.setColor('Yellow');

		return interaction.editReply({ embeds: [embed] });
	}
}
