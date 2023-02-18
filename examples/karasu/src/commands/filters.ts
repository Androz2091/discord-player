import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';
import type { FiltersName } from 'discord-player';

@ApplyOptions<Command.Options>({
	description: 'FFmpeg filters'
})
export class FiltersCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) =>
					option
						.setName('filter')
						.setDescription('The biquad filter to use')
						.addChoices(
							{ name: 'Off', value: 'Off' },
							...([
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
			const queue = this.container.client.player.nodes.get(interaction.guild?.id!);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);
			const filter = interaction.options.getString('filter', true) as FiltersName | 'Off';

			if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });
			if (!queue.currentTrack)
				return interaction.reply({ content: `${this.container.client.dev.error} | There is nothing playing`, ephemeral: true });
			if (!queue.filters.ffmpeg)
				return interaction.reply({
					content: `${this.container.client.dev.error} | Equalizer is not available to this queue`,
					ephemeral: true
				});

			await interaction.deferReply();

			if (filter === 'Off') {
				await queue.filters.ffmpeg.setFilters(false);
				return interaction.followUp({
					content: `${this.container.client.dev.success} | Audio Filters disabled!`
				});
			}

			await queue.filters.ffmpeg.toggle(filter);

			return interaction.followUp({
				content: `${this.container.client.dev.success} | **${filter}** filter ${
					queue.filters.ffmpeg.isEnabled(filter) ? 'enabled' : 'disabled'
				}!`
			});
		}
	}
}
