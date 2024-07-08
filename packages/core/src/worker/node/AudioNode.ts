import {
    DiscordGatewayAdapterCreator,
    entersState,
    joinVoiceChannel,
    VoiceConnection,
    VoiceConnectionDisconnectReason,
    VoiceConnectionStatus,
} from 'discord-voip';
import { getBoolean } from '../../common/utils';
import type { AudioNodeManager } from './AudioNodeManager';
import { EventEmitter } from '@discord-player/utils';

export interface VoiceConnectionCreateOptions {
    /**
     * The client id.
     */
    clientId: string;
    /**
     * The voice channel id.
     */
    channelId: string;
    /**
     * The guild id.
     */
    guildId: string;
    /**
     * Self deafen.
     */
    selfDeaf?: boolean;
    /**
     * Self mute
     */
    selfMute?: boolean;
    /**
     * Whether to enable debug logs event.
     */
    debug?: boolean;
    /**
     * Custom connection timeout in milliseconds.
     */
    timeout?: number;
}

const DEFAULT_TIMEOUT = 120_000;

export const AudioNodeEvent = {
    Ready: 'ready',
    Disconnect: 'disconnect',
} as const;

export type AudioNodeEvent = (typeof AudioNodeEvent)[keyof typeof AudioNodeEvent];

export interface AudioNodeEvents {
    [AudioNodeEvent.Ready]: () => Awaited<void>;
    [AudioNodeEvent.Disconnect]: () => Awaited<void>;
}

export class AudioNode extends EventEmitter<AudioNodeEvents> {
    /**
     * The id of this node.
     */
    public id = crypto.randomUUID();

    /**
     * Creates a voice connection.
     * @param data The voice connection create options.
     * @param transmitter The gateway adapter creator.
     */
    public static create(
        manager: AudioNodeManager,
        data: VoiceConnectionCreateOptions,
        transmitter: DiscordGatewayAdapterCreator,
    ) {
        const connection = joinVoiceChannel({
            channelId: data.channelId,
            guildId: data.guildId,
            group: data.clientId,
            adapterCreator: transmitter,
            selfMute: getBoolean(data.selfMute, false),
            selfDeaf: getBoolean(data.selfDeaf, true),
            debug: getBoolean(data.debug),
        });

        return new AudioNode(manager, connection, data.timeout ?? DEFAULT_TIMEOUT);
    }

    /**
     * Creates a new audio node.
     * @param connection The voice connection.
     */
    public constructor(
        private readonly manager: AudioNodeManager,
        public connection: VoiceConnection,
        private readonly timeout: number,
    ) {
        super();
        this.#bindEvents();
    }

    /**
     * Destroys the audio node.
     * @private
     */
    #destroy() {
        const { connection } = this;
        const hasAdapter = this.manager.transmitters.has(connection.joinConfig.guildId);

        connection.destroy(hasAdapter);
    }

    /**
     * Binds the events.
     * @private
     */
    #bindEvents() {
        const { connection } = this;

        connection.on(VoiceConnectionStatus.Ready, () => {
            this.emit(AudioNodeEvent.Ready);
        });

        connection.on(VoiceConnectionStatus.Destroyed, () => {
            this.emit(AudioNodeEvent.Disconnect);
        });

        connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
            try {
                if (newState.reason === VoiceConnectionDisconnectReason.Manual) {
                    return this.#destroy();
                }

                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, this.timeout),
                    entersState(connection, VoiceConnectionStatus.Connecting, this.timeout),
                ]);
            } catch {
                this.#destroy();
            }
        });
    }
}
