import { container, Listener } from '@sapphire/framework';

export class PlayerEvent extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			emitter: container.client.player,
			event: 'error'
		});
	}

	public run(error) {
		console.log(`Error emitted from player: ${error.message}`);
	}
}
