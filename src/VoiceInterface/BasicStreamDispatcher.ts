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
    VoiceConnectionStatus,
    VoiceConnectionDisconnectReason
} from "@discordjs/voice";
import { StageChannel, VoiceChannel } from "discord.js";
import { Duplex, Readable } from "stream";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";
import Track from "../Structures/Track";
import { Util } from "../utils/Util";

export interface VoiceEvents {
    error: (error: AudioPlayerError) => any;
    debug: (message: string) => any;
    start: () => any;
    finish: () => any;
}

class BasicStreamDispatcher extends EventEmitter<VoiceEvents> {
    public readonly voiceConnection: VoiceConnection;
    public readonly audioPlayer: AudioPlayer;
    public readonly channel: VoiceChannel | StageChannel;
    public audioResource?: AudioResource<Track>;
    private readyLock: boolean = false;

    constructor(connection: VoiceConnection, channel: VoiceChannel | StageChannel) {
        super();

        this.voiceConnection = connection;
        this.audioPlayer = createAudioPlayer();
        this.channel = channel;

        this.voiceConnection.on("stateChange", async (_, newState) => {
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
                    try {
                        await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5000);
                    } catch {
                        this.voiceConnection.destroy();
                    }
                } else if (this.voiceConnection.rejoinAttempts < 5) {
                    await Util.wait((this.voiceConnection.rejoinAttempts + 1) * 5000);
                    this.voiceConnection.rejoin();
                } else {
                    this.voiceConnection.destroy();
                }
            } else if (newState.status === VoiceConnectionStatus.Destroyed) {
                this.end();
            } else if (!this.readyLock && (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)) {
                this.readyLock = true;
                try {
                    await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20000);
                } catch {
                    if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) this.voiceConnection.destroy();
                } finally {
                    this.readyLock = false;
                }
            }
        });

        this.audioPlayer.on("stateChange", (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                if (!this.paused) {
                    this.audioResource = null;
                    void this.emit("finish");
                }
            } else if (newState.status === AudioPlayerStatus.Playing) {
                if (!this.paused) void this.emit("start");
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
        const success = this.audioPlayer.pause(interpolateSilence);
        return success;
    }

    resume() {
        const success = this.audioPlayer.unpause();
        return success;
    }

    /**
     * Play stream
     * @param {AudioResource} resource The audio resource to play
     */
    async playStream(resource: AudioResource<Track> = this.audioResource) {
        if (!resource) throw new Error("Audio resource is not available!");
        if (!this.audioResource) this.audioResource = resource;
        if (this.voiceConnection.state.status !== VoiceConnectionStatus.Ready) await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20000);
        this.audioPlayer.play(resource);

        return this;
    }

    setVolume(value: number) {
        if (!this.audioResource || isNaN(value) || value < 0 || value > Infinity) return false;

        // ye boi logarithmic ✌
        this.audioResource.volume.setVolumeLogarithmic(value / 100);
        return true;
    }

    get volume() {
        if (!this.audioResource || !this.audioResource.volume) return 100;
        const currentVol = this.audioResource.volume.volume;
        return Math.round(Math.pow(currentVol, 1 / 1.660964) * 100);
    }

    get streamTime() {
        if (!this.audioResource) return 0;
        return this.audioResource.playbackDuration;
    }

    get paused() {
        return [AudioPlayerStatus.AutoPaused, AudioPlayerStatus.Paused].includes(this.audioPlayer.state.status);
    }
}

export { BasicStreamDispatcher as StreamDispatcher };
