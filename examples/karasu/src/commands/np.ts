import { quran } from '@quranjs/api';
import type { ChapterId } from '@quranjs/api/dist/types';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';

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
		const queue = this.container.client.player.nodes.get(interaction.guild!.id);

		if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
		if (!queue.currentTrack)
			return interaction.reply({ content: `${this.container.client.dev.error} | There is no track **currently** playing`, ephemeral: true });

		await interaction.deferReply();
		const { title, url, author, thumbnail } = queue.currentTrack;

		if (author === 'download.quranicaudio.com') {
			const { nameSimple, nameArabic, versesCount } = await quran.v4.chapters.findById(title.replace('.mp3', '') as unknown as ChapterId);

			const embed = new EmbedBuilder()
				.setAuthor({
					name: 'Now Playing',
					iconURL: interaction.user.displayAvatarURL()
				})
				.setColor('Green')
				.setDescription(`[${nameSimple}](${url})`)
				.addFields([
					{ name: 'Arabic', value: `${nameArabic}`, inline: true },
					// eslint-disable-next-line @typescript-eslint/dot-notation
					{ name: 'Verses', value: `${versesCount}`, inline: true },
					{ name: 'Reciter', value: '[Mishary Rashid Alafasy](https://quran.com/en/reciters/7)', inline: true }
				]);

			return interaction.followUp({ embeds: [embed] });
		}

		const ts = queue.node.getTimestamp();

		const embed = new EmbedBuilder()
			.setAuthor({
				name: 'Now Playing',
				iconURL: interaction.user.displayAvatarURL()
			})
			.setColor('Red')
			.setDescription(`[${title}](${url})`)
			.setThumbnail(thumbnail ?? interaction.user.displayAvatarURL())
			.addFields([
				{ name: 'Duration', value: `${ts?.current.label}/${ts?.total.label} (${ts?.progress}%)`, inline: true },
				// eslint-disable-next-line @typescript-eslint/dot-notation
				{ name: 'Requested By', value: `${queue.metadata!['requestedBy'] || 'Unknown User'}`, inline: true },
				{ name: 'By', value: `${author}`, inline: true },
				{
					name: 'Latency',
					value: `>>> **Voice Connection**: \`${queue.ping}ms\`\n**Event Loop**: \`${queue.player.eventLoopLag.toFixed(0)}ms\``,
					inline: false
				}
			])
			.setFooter({
				text: queue.node.createProgressBar()!
			});

		return interaction.followUp({ embeds: [embed] });
	}
}
