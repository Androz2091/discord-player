import { DurationFormatter } from '@sapphire/duration';
import type { ChatInputCommandDeniedPayload, Events } from '@sapphire/framework';
import { Listener, UserError } from '@sapphire/framework';

export class UserEvent extends Listener<typeof Events.ChatInputCommandDenied> {
	public run({ identifier, context, message: content }: UserError, { interaction }: ChatInputCommandDeniedPayload) {
		// `context: { silent: true }` should make UserError silent:
		// Use cases for this are for example permissions error when running the `eval` command.
		if (Reflect.get(Object(context), 'silent')) return;

		if (identifier === 'preconditionCooldown') {
			const remaining = Reflect.get(Object(context), 'remaining');
			const ms = new DurationFormatter().format(remaining);
			return interaction.reply({
				content: `Slow down! You must wait **${ms}** before using the \`${interaction.commandName}\` comand.`,
				allowedMentions: { users: [interaction.user.id], roles: [] },
				ephemeral: true
			});
		}

		return interaction.reply({
			content,
			allowedMentions: { users: [interaction.user.id], roles: [] },
			ephemeral: true
		});
	}
}
