import { isMessageInstance } from '@sapphire/discord.js-utilities';
import { Command } from '@sapphire/framework';
import { ApplicationCommandType } from 'discord.js';

export class PingCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Returns the round trip and heartbeat'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description);
		});
		registry.registerContextMenuCommand((builder) => {
			builder //
				.setName(this.name)
				.setType(ApplicationCommandType.Message);
		});
		registry.registerContextMenuCommand((builder) => {
			builder //
				.setName(this.name)
				.setType(ApplicationCommandType.User);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const msg = await interaction.reply({ content: `Ping?`, fetchReply: true });

		if (isMessageInstance(msg)) {
			const diff = msg.createdTimestamp - interaction.createdTimestamp;
			const ping = Math.round(this.container.client.ws.ping);
			return interaction.editReply(`The round trip took **${diff}ms** and the heartbeat being **${ping}ms**`);
		}

		return interaction.editReply('Failed to retrieve ping...');
	}

	// context menu command
	public async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
		const msg = await interaction.reply({ content: `Ping?`, fetchReply: true });

		if (isMessageInstance(msg)) {
			const diff = msg.createdTimestamp - interaction.createdTimestamp;
			const ping = Math.round(this.container.client.ws.ping);
			return interaction.editReply(`The round trip took **${diff}ms** and the heartbeat being **${ping}ms**`);
		}

		return interaction.editReply('Failed to retrieve ping...');
	}
}
