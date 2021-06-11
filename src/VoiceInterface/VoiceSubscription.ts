import {
    AudioPlayer,
    AudioResource,
    createAudioPlayer,
    createAudioResource,
    entersState,
    StreamType,
    VoiceConnection,
    VoiceConnectionStatus
} from "@discordjs/voice";
import { Duplex, Readable } from "stream";

class VoiceSubscription {
    public readonly voiceConnection: VoiceConnection;
    public readonly audioPlayer: AudioPlayer;
    public connectPromise?: Promise<void>;

    constructor(connection: VoiceConnection) {
        this.voiceConnection = connection;
        this.audioPlayer = createAudioPlayer();

        connection.subscribe(this.audioPlayer);

        this.voiceConnection.on("stateChange", (_, newState) => {
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (this.voiceConnection.reconnectAttempts < 5) {
                    setTimeout(() => {
                        if (this.voiceConnection.state.status === VoiceConnectionStatus.Disconnected) {
                            this.voiceConnection.reconnect();
                        }
                    }, (this.voiceConnection.reconnectAttempts + 1) * 5000).unref();
                } else {
                    this.voiceConnection.destroy();
                }
            } else if (newState.status === VoiceConnectionStatus.Destroyed) {
                this.stop();
            } else if (
                !this.connectPromise &&
                (newState.status === VoiceConnectionStatus.Connecting ||
                    newState.status === VoiceConnectionStatus.Signalling)
            ) {
                this.connectPromise = entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20000)
                    .then(() => undefined)
                    .catch(() => {
                        if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed)
                            this.voiceConnection.destroy();
                    })
                    .finally(() => (this.connectPromise = undefined));
            }
        });
    }

    /**
     * Creates stream
     * @param {Readable|Duplex|string} src The stream source
     * @param {({type?:StreamType;data?:any;inlineVolume?:boolean})} [ops] Options
     * @returns {AudioResource}
     */
    createStream(src: Readable | Duplex | string, ops?: { type?: StreamType, data?: any, inlineVolume?: boolean }) {
        return createAudioResource(src, {
            inputType: ops?.type ?? StreamType.Arbitrary,
            metadata: ops?.data,
            inlineVolume: Boolean(ops?.inlineVolume)
        });
    }

    /**
     * The player status
     */
    get status() {
        return this.audioPlayer.state.status;
    }

    /**
     * Stops the player
     */
    stop() {
        this.audioPlayer.stop();
    }

    /**
     * Play stream
     * @param {AudioResource} resource The audio resource to play
     */
    playStream(resource: AudioResource) {
        this.audioPlayer.play(resource);
    }
}

export { VoiceSubscription };
