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
import Track from "../Structures/Track";
import PlayerError from "../utils/PlayerError";

export interface VoiceEvents {
    error: (error: AudioPlayerError) => any;
    debug: (message: string) => any;
    start: () => any;
    finish: () => any;
}

class BasicStreamDispatcher extends EventEmitter<VoiceEvents> {
    public readonly voiceConnection: VoiceConnection;
    public readonly audioPlayer: AudioPlayer;
    public connectPromise?: Promise<void>;
    public audioResource?: AudioResource<Track>;

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
                this.end();
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
                this.audioResource = null;
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
     * @param {({type?:StreamType;data?:any;})} [ops] Options
     * @returns {AudioResource}
     */
    createStream(src: Readable | Duplex | string, ops?: { type?: StreamType; data?: any }) {
        this.audioResource = createAudioResource(src, {
            inputType: ops?.type ?? StreamType.Arbitrary,
            metadata: ops?.data,
            inlineVolume: true // we definitely need volume controls, right?
        });

        return this.audioResource;
    }

    /**
     * The player status
     */
    get status() {
        return this.audioPlayer.state.status;
    }

    /**
     * Disconnects from voice
     */
    disconnect() {
        try {
            this.voiceConnection.destroy();
        } catch {}
    }

    /**
     * Stops the player
     */
    end() {
        this.audioPlayer.stop();
    }

    pause(interpolateSilence?: boolean) {
        return this.audioPlayer.pause(interpolateSilence);
    }

    resume() {
        return this.audioPlayer.unpause();
    }

    /**
     * Play stream
     * @param {AudioResource} resource The audio resource to play
     */
    async playStream(resource: AudioResource<Track> = this.audioResource) {
        if (!resource) throw new PlayerError("Audio resource is not available!");
        if (!this.audioResource) this.audioResource = resource;
        if (this.voiceConnection.state.status !== VoiceConnectionStatus.Ready) await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20000);
        this.audioPlayer.play(resource);

        return this;
    }

    setVolume(value: number) {
        if (!this.audioResource || isNaN(value) || value < 0 || value > Infinity) return false;

        // ye boi logarithmic ✌
        this.audioResource.volume.setVolumeLogarithmic(value / 200);
        return true;
    }

    get streamTime() {
        if (!this.audioResource) return 0;
        return this.audioResource.playbackDuration;
    }
}

export { BasicStreamDispatcher as StreamDispatcher };
