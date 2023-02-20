import { Command } from '@sapphire/framework';
import { PCMAudioFilters, PCMFilters } from 'discord-player';
import { GuildMember } from 'discord.js';

export class PulsatorCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'The DSP filters that can be applied to tracks'
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
						.setDescription('The filter to toggle')
						.addChoices(
							...Object.keys(PCMAudioFilters).map((m) => ({
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
			const queue = this.container.client.player.nodes.get(interaction.guild!.id);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);
			const filter = interaction.options.getString('filter') as PCMFilters;

			if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });
			if (!queue.currentTrack)
				return interaction.reply({
					content: `${this.container.client.dev.error} | There is no track **currently** playing`,
					ephemeral: true
				});
			if (!queue.filters.filters)
				return interaction.reply({
					content: `${this.container.client.dev.error} | The DSP filters are not **available** to be used in this queue`,
					ephemeral: true
				});

			await interaction.deferReply();

			let ff = queue.filters.filters.filters;
			if (ff.includes(filter)) {
				ff = ff.filter((r) => r !== filter);
			} else {
				ff.push(filter);
			}

			queue.filters.filters.setFilters(ff);

			return interaction.followUp({
				content: `${this.container.client.dev.success} | **${filter}** filter has been **${ff.includes(filter) ? 'enabled' : 'disabled'}**`
			});
		}
	}
}
