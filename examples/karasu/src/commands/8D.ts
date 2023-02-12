import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: '8D filter'
})
export class PulsatorCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member instanceof GuildMember) {
			const queue = this.container.client.player.nodes.get(interaction.guild?.id!);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);

			if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });
			if (!queue.currentTrack)
				return interaction.reply({ content: `${this.container.client.dev.error} | There is nothing playing`, ephemeral: true });
			if (!queue.filters.filters)
				return interaction.reply({
					content: `${this.container.client.dev.error} | This filter is not available to this queue`,
					ephemeral: true
				});

			await interaction.deferReply();

			let ff = queue.filters.filters.filters;
			if (ff.includes('8D')) {
				ff = ff.filter((r) => r !== '8D');
			} else {
				ff.push('8D');
			}

			queue.filters.filters.setFilters(ff);

			return interaction.followUp({
				content: `${this.container.client.dev.success} | **8D** filter ${ff.includes('8D') ? 'enabled' : 'disabled'}!`
			});
		}
	}
}
