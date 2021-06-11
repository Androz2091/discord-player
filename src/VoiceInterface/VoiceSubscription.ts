import {
    AudioPlayer,
    AudioPlayerError,
    AudioPlayerStatus,
    AudioResource,
    createAudioPlayer,
    createAudioResource,
    entersState,
    StreamType,
    VoiceConnection,
    VoiceConnectionStatus
} from "@discordjs/voice";
import { Duplex, Readable } from "stream";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";

export interface VoiceEvents {
    error: (error: AudioPlayerError) => any;
    debug: (message: string) => any;
    start: () => any;
    finish: () => any;
}

class VoiceSubscription extends EventEmitter<VoiceEvents> {
    public readonly voiceConnection: VoiceConnection;
    public readonly audioPlayer: AudioPlayer;
    public connectPromise?: Promise<void>;

    constructor(connection: VoiceConnection) {
        super();

        this.voiceConnection = connection;
        this.audioPlayer = createAudioPlayer();

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

        this.audioPlayer.on("stateChange", (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                void this.emit("finish");
            } else if (newState.status === AudioPlayerStatus.Playing) {
                void this.emit("start");
            }
        });

        this.audioPlayer.on("debug", (m) => void this.emit("debug", m));
        this.audioPlayer.on("error", (error) => void this.emit("error", error));
        this.voiceConnection.subscribe(this.audioPlayer);
    }

    /**
     * Creates stream
     * @param {Readable|Duplex|string} src The stream source
     * @param {({type?:StreamType;data?:any;inlineVolume?:boolean})} [ops] Options
     * @returns {AudioResource}
     */
    createStream(src: Readable | Duplex | string, ops?: { type?: StreamType; data?: any; inlineVolume?: boolean }) {
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
