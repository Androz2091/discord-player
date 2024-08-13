import { Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';

export class DisconnectCommand extends Command {
    public constructor(context: Command.Context, options: Command.Options) {
        super(context, {
            ...options,
            description: 'Disconnects the bot from the voice channel and deletes the queue'
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
        const queue = useQueue(interaction.guild?.id!);
        const permissions = this.container.client.perms.voice(interaction, this.container.client);

        if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am **not** in a voice channel`, ephemeral: true });
        if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

        queue.delete();
        return interaction.reply({
            content: `${this.container.client.dev.success} | I have **successfully disconnected** from the voice channel`
        });
    }
}
