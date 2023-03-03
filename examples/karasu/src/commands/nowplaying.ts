import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export class NowPlayingCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Displays the current track in an embed'
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
		const queue = useQueue(interaction.guild!.id);

		if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
		if (!queue.currentTrack)
			return interaction.reply({ content: `${this.container.client.dev.error} | There is no track **currently** playing`, ephemeral: true });

		await interaction.deferReply();
		const track = queue.currentTrack;

		const ts = queue.node.getTimestamp();

		const embed = new EmbedBuilder()
			.setAuthor({
				name: (track.requestedBy ?? interaction.user).username,
				iconURL: (track.requestedBy ?? interaction.user).displayAvatarURL()
			})
			.setColor('Red')
			.setTitle('💿 Now Playing')
			.setDescription(`[${track.title}](${track.url})`)
			.setThumbnail(track.thumbnail ?? interaction.user.displayAvatarURL())
			.addFields([
				{ name: 'Author', value: track.author },
				{ name: 'Progress', value: `${queue.node.createProgressBar()} (${ts?.progress}%)` }
			])
			.setFooter({
				text: `Ping: ${queue.ping}ms | Event Loop Lag: ${queue.player.eventLoopLag.toFixed(0)}ms`
			});

		return interaction.followUp({ embeds: [embed] });
	}
}
