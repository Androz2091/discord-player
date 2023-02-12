import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { APIApplicationCommandOptionChoice, GuildMember } from 'discord.js';
import { BiquadFilterType } from 'discord-player';

type SupportedBiquadFilters = keyof typeof BiquadFilterType | 'Off';

@ApplyOptions<Command.Options>({
	description: 'Biquad filterer'
})
export class BiquadCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		const biquadFilters = Object.keys(BiquadFilterType)
			.filter((k) => typeof k[0] === 'string')
			.map((m) => ({
				name: m,
				value: m
			})) as APIApplicationCommandOptionChoice<SupportedBiquadFilters>[];

		biquadFilters.unshift({
			name: 'Disable',
			value: 'Off'
		});

		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) =>
					option
						.setName('filter')
						.setDescription('The biquad filter to use')
						.addChoices(...biquadFilters)
						.setRequired(true)
				)
				.addNumberOption((option) => {
					return option.setMinValue(-50).setMaxValue(50).setName('gain').setDescription('The dB gain value').setRequired(false);
				});
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member instanceof GuildMember) {
			const queue = this.container.client.player.nodes.get(interaction.guild?.id!);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);
			const filter = interaction.options.getString('filter', true) as SupportedBiquadFilters;
			const dB = interaction.options.getNumber('gain');

			if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });
			if (!queue.currentTrack)
				return interaction.reply({ content: `${this.container.client.dev.error} | There is nothing playing`, ephemeral: true });
			if (!queue.filters.biquad)
				return interaction.reply({
					content: `${this.container.client.dev.error} | This filter is not available to this queue`,
					ephemeral: true
				});

			await interaction.deferReply();

			if (filter === 'Off') {
				queue.filters.biquad.disable();
			} else {
				if (typeof dB === 'number') queue.filters.biquad.setGain(dB);
				queue.filters.biquad.enable();
				queue.filters.biquad.setFilter(BiquadFilterType[filter]);
			}

			return interaction.followUp({
				content: `${this.container.client.dev.success} | **Biquad Filter** set to: \`${filter}\``
			});
		}
	}
}
