import { Collection, EventEmitter } from '@discord-player/utils';
import { CreateVoiceConnectionOptions, DiscordGatewayAdapterLibraryMethods, joinVoiceChannel, JoinVoiceChannelOptions } from '@discordjs/voice';
import { VoiceConnection } from './VoiceConnection';
import { GatewayVoiceStateUpdateDispatchData, GatewayVoiceServerUpdateDispatchData, GatewayDispatchEvents, GatewayVoiceState } from 'discord-api-types/v10';

export type JoinVoiceChannelConfig = Omit<CreateVoiceConnectionOptions & JoinVoiceChannelOptions, 'group' | 'adapterCreator'> & {
    connectionTimeout?: number;
};

export interface VoicePayload {
    op: number;
    // eslint-disable-next-line
    d: any;
}

export type VoiceStateUpdateDispatch = {
    op: GatewayDispatchEvents.VoiceStateUpdate | GatewayDispatchEvents.VoiceServerUpdate;
    d: GatewayVoiceStateUpdateDispatchData | GatewayVoiceServerUpdateDispatchData;
};

export interface VoiceManagerEvents {
    /**
     * Emitted when VoiceManager wants to send a payload to the main gateway
     * @param data The payload
     */
    payload: (data: VoicePayload) => unknown;
    /**
     * Emitted when VoiceManager writes a debug message
     * @param message The debug message
     */
    debug: (message: string) => unknown;
}

export const VoiceManagerEvent = {
    Payload: 'payload',
    Debug: 'debug'
} as const;

interface VoiceManagerInit {
    /**
     * Assumption for `sendPayload`. Setting this to `true` causes `VoiceManager` to assume payload was successfully sent.
     */
    ignoreStatus?: boolean;
}

export class VoiceManager extends EventEmitter<VoiceManagerEvents> {
    /**
     * The collection of voice connection adapters
     */
    public adapters = new Collection<string, DiscordGatewayAdapterLibraryMethods>();

    /**
     * Initialize the voice manager
     * @param options Voice manager options
     */
    public constructor(public options: VoiceManagerInit) {
        super();

        this.options.ignoreStatus ??= false;
    }

    /**
     * Call this method when the gateway `VOICE_SERVER_UPDATE` or `VOICE_STATE_UPDATE` payload is received.
     * @param payload The raw payload received from the gateway
     */
    public onUpdate(payload: VoiceStateUpdateDispatch) {
        if (![GatewayDispatchEvents.VoiceServerUpdate, GatewayDispatchEvents.VoiceStateUpdate].includes(payload.op) || !payload.d.guild_id) return;

        const connection = this.adapters.get(payload.d.guild_id);
        if (!connection) return;

        const isServerUpdate = payload.op === GatewayDispatchEvents.VoiceServerUpdate;

        if (isServerUpdate) {
            connection.onVoiceServerUpdate(payload.d as GatewayVoiceServerUpdateDispatchData);
        } else {
            connection.onVoiceStateUpdate(payload.d as GatewayVoiceStateUpdateDispatchData);
        }
    }

    /**
     * Call this method when the gateway `VOICE_STATE_UPDATE` payload is received
     * @param d The inner data of the payload
     */
    public onVoiceStateUpdate(d: GatewayVoiceState) {
        if (!d.guild_id) return;

        const connection = this.adapters.get(d.guild_id);
        if (!connection) return;

        connection.onVoiceStateUpdate(d);
    }

    /**
     * Call this method when the gateway `VOICE_SERVER_UPDATE` payload is received
     * @param d The inner data of the payload
     */
    public onVoiceServerUpdate(d: GatewayVoiceServerUpdateDispatchData) {
        const connection = this.adapters.get(d.guild_id);
        if (!connection) return;

        connection.onVoiceServerUpdate(d);
    }

    /**
     * Destroy all voice connection adapters
     */
    public destroy() {
        for (const adapter of this.adapters.values()) {
            adapter.destroy();
        }
    }

    /**
     * Connect to the given voice channel
     * @returns The voice connection
     */
    public connect(options: JoinVoiceChannelConfig) {
        const connection = joinVoiceChannel({
            ...options,
            group: options.guildId,
            adapterCreator: (methods) => {
                const key = `${options.channelId}::${options.guildId}::${options.guildId}`;

                this.adapters.set(key, methods);

                return {
                    sendPayload: (payload) => {
                        return this.emit(VoiceManagerEvent.Payload, payload) || (this.options.ignoreStatus ?? false);
                    },
                    destroy: () => {
                        this.adapters.delete(key);
                    }
                };
            }
        });

        return new VoiceConnection(this, connection, {
            connectionTimeout: options.connectionTimeout ?? 120_000
        });
    }
}
