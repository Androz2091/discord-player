import { BucketScope, LogLevel, SapphireClient } from '@sapphire/framework';
import { Player } from 'discord-player';
import { GatewayIntentBits } from 'discord.js';
import Emojis from './emojis';
import { envParseArray } from './lib/env-parser';
import * as Permissions from './lib/perms';

export class KarasuClient extends SapphireClient {
	public player: Player;
	public dev: typeof Emojis;
	public perms: typeof Permissions;
	public constructor() {
		super({
			disableMentionPrefix: true,
			intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
			defaultCooldown: {
				filteredUsers: envParseArray('OWNERS'),
				scope: BucketScope.User,
				delay: 10_000,
				limit: 2
			},
			logger: {
				level: LogLevel.Error
			}
		});
		this.dev = Emojis;
		this.perms = Permissions;
		this.player = new Player(this as any);
	}
}

declare module 'discord.js' {
	interface Client {
		readonly player: Player;
		readonly perms: typeof Permissions;
		readonly dev: typeof Emojis;
	}
}
