import { Command } from '@sapphire/framework';
import { QueueRepeatMode, useQueue } from 'discord-player';
import { GuildMember } from 'discord.js';

const repeatModes = [
	{ name: 'Off', value: QueueRepeatMode.OFF },
	{ name: 'Track', value: QueueRepeatMode.TRACK },
	{ name: 'Queue', value: QueueRepeatMode.QUEUE },
	{ name: 'Autoplay', value: QueueRepeatMode.AUTOPLAY }
];

export class LoopCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Loops the current playing track or the entire queue'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addNumberOption((option) =>
					option
						.setName('mode')
						.setDescription('Choose a loop mode')
						.setRequired(true)
						.addChoices(...repeatModes)
				);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member instanceof GuildMember) {
			const queue = useQueue(interaction.guild!.id);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);

			if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

			if (!queue.currentTrack)
				return interaction.reply({
					content: `${this.container.client.dev.error} | There is no track **currently** playing`,
					ephemeral: true
				});

			await interaction.deferReply();

			const mode = interaction.options.getNumber('mode', true);
			const name = mode === QueueRepeatMode.OFF ? 'Looping' : repeatModes.find((m) => m.value === mode)?.name;

			queue.setRepeatMode(mode as QueueRepeatMode);

			return interaction.followUp({
				content: `${this.container.client.dev.success} | **${name}** has been **${mode === queue.repeatMode ? 'enabled' : 'disabled'}**`
			});
		}
	}
}
