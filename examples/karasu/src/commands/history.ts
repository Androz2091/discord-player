import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { Command } from '@sapphire/framework';
import { useHistory } from 'discord-player';

export class QueueHistoryCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Displays the history history in an embed'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const history = useHistory(interaction.guild?.id!);

		if (!history) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
		if (!history.tracks || !history.currentTrack)
			return interaction.reply({ content: `${this.container.client.dev.error} | There is no tracks history`, ephemeral: true });

		await interaction.deferReply();

		let pagesNum = Math.ceil(history.tracks.size / 5);

		if (pagesNum <= 0) {
			pagesNum = 1;
		}

		const tracks = history.tracks.toArray().map((track, idx) => `**${++idx})** [${track.title}](${track.url})`);

		const paginatedMessage = new PaginatedMessage();

		// handle error if pages exceed 25 pages
		if (pagesNum > 25) pagesNum = 25;

		for (let i = 0; i < pagesNum; i++) {
			const list = tracks.slice(i * 5, i * 5 + 5).join('\n');

			paginatedMessage.addPageEmbed((embed) =>
				embed
					.setColor('Red')
					.setTitle('Tracks Queue History')
					.setDescription(list || '**No more songs in history**')
					.addFields([{ name: '💿 Now Playing', value: `[${history.currentTrack?.title}](${history.currentTrack?.url})` }])
					.setFooter({
						text: `Page ${i + 1} of ${pagesNum} | Total ${history.tracks.size} tracks`
					})
			);
		}

		return paginatedMessage.run(interaction);
	}
}
