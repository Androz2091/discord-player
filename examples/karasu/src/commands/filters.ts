import { Command } from '@sapphire/framework';
import type { FiltersName } from 'discord-player';
import { GuildMember } from 'discord.js';

export class FiltersCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'The FFmpeg filters that can be applied to tracks'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) =>
					option
						.setName('filter')
						.setDescription('The FFmpeg filter to use')
						.addChoices(
							{ name: 'Off', value: 'Off' },
							...([
								{ name: 'lofi', value: 'lofi' },
								{ name: '8D', value: '8D' },
								{ name: 'bassboost', value: 'bassboost' },
								{ name: 'compressor', value: 'compressor' },
								{ name: 'karaoke', value: 'karaoke' },
								{ name: 'vibrato', value: 'vibrato' },
								{ name: 'vaporwave', value: 'vaporwave' },
								{ name: 'nightcore', value: 'nightcore' },
								{ name: 'tremolo', value: 'tremolo' }
							] as { name: FiltersName; value: FiltersName }[])
						)
						.setRequired(true)
				);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member instanceof GuildMember) {
			const queue = this.container.client.player.nodes.get(interaction.guild!.id);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);
			const filter = interaction.options.getString('filter') as FiltersName | 'Off';

			if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });
			if (!queue.currentTrack)
				return interaction.reply({
					content: `${this.container.client.dev.error} | There is no track **currently** playing`,
					ephemeral: true
				});
			if (!queue.filters.ffmpeg)
				return interaction.reply({
					content: `${this.container.client.dev.error} | The FFmpeg filters are not **available** to be used in this queue`,
					ephemeral: true
				});

			await interaction.deferReply();

			if (filter === 'Off') {
				await queue.filters.ffmpeg.setFilters(false);
				return interaction.followUp({
					content: `${this.container.client.dev.success} | **Audio filter** have been *disabled**`
				});
			}

			// if the filter is bassboost, then enable audio normalizer to avoid distortion
			await queue.filters.ffmpeg.toggle(filter.includes('bassboost') ? ['bassboost', 'normalizer'] : filter);

			return interaction.followUp({
				content: `${this.container.client.dev.success} | **${filter}** filter has been **${
					queue.filters.ffmpeg.isEnabled(filter) ? 'enabled' : 'disabled'
				}**`
			});
		}
	}
}
