import { container, Listener } from '@sapphire/framework';
import { cyanBright, gray } from 'colorette';

export class PlayerEvent extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			emitter: container.client.player.events,
			event: 'debug'
		});
	}

	public run(_queue, message) {
		console.log(`[${cyanBright('DEBUG')}] ${gray(message)}\n`);
	}
}
