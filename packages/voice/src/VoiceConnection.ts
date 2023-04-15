import { DiscordVoiceConnection } from './common';
import type { VoiceJoinConfig, VoiceManager } from './VoiceManager';

export class VoiceConnection {
    public constructor(public readonly manager: VoiceManager, public readonly connection: DiscordVoiceConnection) {}

    public get channel() {
        return this.connection.joinConfig.channelId;
    }

    public get guild() {
        return this.connection.joinConfig.guildId;
    }

    public static async create(manager: VoiceManager, config: VoiceJoinConfig) {
        void config;
        // const connection = await DiscordJoinVoiceChannel({
        //     ...config,
        //     adapterCreator: (methods) => {
        //         manager.adapter;
        //     }
        // });

        // return new VoiceConnection(manager, connection);
    }
}
