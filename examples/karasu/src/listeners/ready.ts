import { SpotifyExtractor } from '@discord-player/extractor';
import { Listener } from '@sapphire/framework';
import { useMasterPlayer } from 'discord-player';

export class UserEvent extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			once: true
		});
	}

	public async run() {
		console.log(`Logged in as ${this.container.client.user?.username}`);

		const player = useMasterPlayer();
		if (player) {
			await player.extractors.loadDefault();
			await player.extractors.unregister(SpotifyExtractor.identifier)
			await player.extractors.register(SpotifyExtractor, {
				bridgeFrom: "Soundcloud"
			})
			console.log(player.scanDeps());
		}
	}
}
