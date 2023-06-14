import { Command } from '@sapphire/framework';
import { useMainPlayer, useQueue } from 'discord-player';
import { GuildMember } from 'discord.js';

export class DisconnectCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Connects the bot to the voice channel while also creating a new queue'
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
		if (interaction.member instanceof GuildMember) {
			const permissions = this.container.client.perms.voice(interaction, this.container.client);
			if (permissions.member()) return interaction.reply({ content: permissions.member(), ephemeral: true });
			if (permissions.client()) return interaction.reply({ content: permissions.client(), ephemeral: true });
			const queue = useQueue(interaction.guild!.id);
			const player = useMainPlayer();

			if (queue)
				return interaction.reply({ content: `${this.container.client.dev.error} | I am **already** in a voice channel`, ephemeral: true });

			const newQueue = player?.queues.create(interaction.guild!.id, {
				metadata: {
					channel: interaction.channel,
					client: interaction.guild?.members.me
				},
				leaveOnEmptyCooldown: 300000,
				leaveOnEmpty: true,
				leaveOnEnd: false,
				bufferingTimeout: 0,
				volume: 10,
				defaultFFmpegFilters: ['lofi', 'bassboost', 'normalizer']
			});
			await newQueue?.connect(interaction.member.voice.channel!.id);
			return interaction.reply({
				content: `${this.container.client.dev.success} | I have **successfully connected** to the voice channel`
			});
		}
	}
}
