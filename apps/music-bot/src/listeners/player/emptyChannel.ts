import { container, Listener } from '@sapphire/framework';
import { PermissionsBitField } from 'discord.js';

export class PlayerEvent extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			emitter: container.client.player.events,
			event: 'emptyChannel'
		});
	}

	public run(queue) {
		const resolved = new PermissionsBitField([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]);
		const missingPerms = queue.metadata.channel.permissionsFor(queue.metadata.client).missing(resolved);
		if (missingPerms.length) return;

		queue.metadata.channel
			.send('I left the channel after **5 minutes** due to **channel inactivity**')
			.then((m: { delete: () => void }) => setTimeout(() => m.delete(), 15000));
	}
}
