import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';
import { EqualizerConfigurationPreset, BASS_EQ_BANDS } from 'discord-player';

@ApplyOptions<Command.Options>({
	description: 'Equalizer'
})
export class EqualizerCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) =>
					option
						.setName('preset')
						.setDescription('The biquad filter to use')
						.addChoices(
							{ name: 'Off', value: 'Off' },
							{ name: 'Bass', value: 'Bass' },
							...Object.keys(EqualizerConfigurationPreset).map((m) => ({
								name: m,
								value: m
							}))
						)
						.setRequired(true)
				);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member instanceof GuildMember) {
			const queue = this.container.client.player.nodes.get(interaction.guild?.id!);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);
			const preset = interaction.options.getString('preset', true);

			if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });
			if (!queue.currentTrack)
				return interaction.reply({ content: `${this.container.client.dev.error} | There is nothing playing`, ephemeral: true });
			if (!queue.filters.equalizer)
				return interaction.reply({
					content: `${this.container.client.dev.error} | Equalizer is not available to this queue`,
					ephemeral: true
				});

			await interaction.deferReply();

			if (preset === 'Off') {
				queue.filters.equalizer.disable();
			} else if (preset === 'Bass') {
				queue.filters.equalizer.setEQ(BASS_EQ_BANDS);
				queue.filters.equalizer.enable();
			} else {
				queue.filters.equalizer.setEQ(EqualizerConfigurationPreset[preset]);
				queue.filters.equalizer.enable();
			}

			return interaction.followUp({
				content: `${this.container.client.dev.success} | **Equalizer** set to: \`${preset}\``
			});
		}
	}
}
