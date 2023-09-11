import { Collection } from '@discord-player/utils';
import { DiscordGatewayAdapterImplementerMethods } from 'discord-voip';
// import { DiscordVoiceAdapter } from './DiscordVoiceAdapter';
import { VoiceConnection } from './VoiceConnection';

export interface VoiceJoinConfig {
    channelId: string;
    guildId: string;
    group?: string;
    selfDeaf?: boolean;
    selfMute?: boolean;
}

export class VoiceManager {
    public connections = new Collection<string, VoiceConnection>();
    // public adapter = new DiscordVoiceAdapter(this);
    public internalAdaptersCache = new Collection<string, DiscordGatewayAdapterImplementerMethods>();

    public async join(config: VoiceJoinConfig) {
        if (this.connections.has(config.channelId)) return this.connections.get(config.channelId)!;
        const connection = await VoiceConnection.create(this, config);
        // this.connections.set(connection.channel!, connection);

        return connection;
    }
}
