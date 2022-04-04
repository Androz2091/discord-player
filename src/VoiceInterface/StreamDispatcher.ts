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
    VoiceConnectionDisconnectReason,
    VoiceConnectionStatus
} from "@discordjs/voice";
import { StageChannel, VoiceChannel } from "discord.js";
import { Duplex, Readable } from "stream";
import { TypedEmitter } from "tiny-typed-emitter";
import { ErrorStatusCode, PlayerError } from "../Structures/PlayerError";
import Track from "../Structures/Track";
import { Util } from "../utils/Util";

export interface VoiceEvents {
    error: (error: AudioPlayerError) => unknown;
    debug: (message: string) => unknown;
    start: (resource: AudioResource<Track>) => unknown;
    finish: (resource: AudioResource<Track>) => unknown;
}

export class StreamDispatcher extends TypedEmitter<VoiceEvents> {
    /**
     * The voice connection
     * @type {VoiceConnection}
     */
    public readonly voiceConnection: VoiceConnection;
    /**
     * The audio player
     * @type {AudioPlayer}
     */
    public readonly audioPlayer: AudioPlayer;
    /**
     * The voice channel
     * @type {VoiceChannel|StageChannel}
     */
    public channel: VoiceChannel | StageChannel;
    public audioResource?: AudioResource<Track>;
    private readyLock = false;
    /**
     * The paused state
     * @type {boolean}
     */
    public paused: boolean;

    /**
     * Creates new connection object
     * @param {VoiceConnection} connection The connection
     * @param {VoiceChannel|StageChannel} channel The connected channel
     * @private
     */
    constructor(connection: VoiceConnection, channel: VoiceChannel | StageChannel, public readonly connectionTimeout: number = 20000) {
        super();

        this.voiceConnection = connection;
        this.audioPlayer = createAudioPlayer();
        this.channel = channel;
        this.paused = false;

        this.voiceConnection.on("stateChange", async (_, newState) => {
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
                    try {
                        await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, this.connectionTimeout);
                    } catch {
                        try {
                            this.voiceConnection.destroy();
                        } catch (err) {
                            this.emit("error", err as AudioPlayerError);
                        }
                    }
                } else if (this.voiceConnection.rejoinAttempts < 5) {
                    await Util.wait((this.voiceConnection.rejoinAttempts + 1) * 5000);
                    this.voiceConnection.rejoin();
                } else {
                    try {
                        this.voiceConnection.destroy();
                    } catch (err) {
                        this.emit("error", err as AudioPlayerError);
                    }
                }
            } else if (newState.status === VoiceConnectionStatus.Destroyed) {
                this.end();
            } else if (!this.readyLock && (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)) {
                this.readyLock = true;
                try {
                    await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, this.connectionTimeout);
                } catch {
                    if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
                        try {
                            this.voiceConnection.destroy();
                        } catch (err) {
                            this.emit("error", err as AudioPlayerError);
                        }
                    }
                } finally {
                    this.readyLock = false;
                }
            }
        });

        this.audioPlayer.on("stateChange", (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Playing) {
                if (!this.paused && this.audioResource) return void this.emit("start", this.audioResource);
            } else if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                if (!this.paused && this.audioResource) {
                    void this.emit("finish", this.audioResource);
                    this.audioResource = undefined;
                }
            }
        });

        this.audioPlayer.on("debug", (m) => void this.emit("debug", m));
        this.audioPlayer.on("error", (error) => void this.emit("error", error));
        this.voiceConnection.subscribe(this.audioPlayer);
    }

    /**
     * Creates stream
     * @param {Readable|Duplex|string} src The stream source
     * @param {object} [ops={}] Options
     * @returns {AudioResource}
     */
    createStream(src: Readable | Duplex | string, ops: { type?: StreamType; data: Track; disableVolume?: boolean }): AudioResource<Track> {
        this.audioResource = createAudioResource(src, {
            inputType: ops?.type ?? StreamType.Arbitrary,
            metadata: ops?.data,
            // eslint-disable-next-line no-extra-boolean-cast
            inlineVolume: !Boolean(ops?.disableVolume)
        });

        return this.audioResource;
    }

    /**
     * The player status
     * @type {AudioPlayerStatus}
     */
    get status(): AudioPlayerStatus {
        return this.audioPlayer.state.status;
    }

    /**
     * Disconnects from voice
     * @returns {void}
     */
    disconnect() {
        try {
            this.audioPlayer.stop(true);
            this.voiceConnection.destroy();
        } catch {} // eslint-disable-line no-empty
    }

    /**
     * Stops the player
     * @returns {void}
     */
    end() {
        this.audioPlayer.stop();
    }

    /**
     * Pauses the stream playback
     * @param {boolean} [interpolateSilence=false] If true, the player will play 5 packets of silence after pausing to prevent audio glitches.
     * @returns {boolean}
     */
    pause(interpolateSilence?: boolean): boolean {
        const success = this.audioPlayer.pause(interpolateSilence);
        this.paused = success;
        return success;
    }

    /**
     * Resumes the stream playback
     * @returns {boolean}
     */
    resume(): boolean {
        const success = this.audioPlayer.unpause();
        this.paused = !success;
        return success;
    }

    /**
     * Play stream
     * @param {AudioResource<Track>} [resource=this.audioResource] The audio resource to play
     * @throws {PlayerError} Audio resource is not available!
     * @returns {Promise<StreamDispatcher>}
     */
    async playStream(resource = this.audioResource): Promise<StreamDispatcher | undefined> {
        if (!resource) throw new PlayerError("Audio resource is not available!", ErrorStatusCode.NO_AUDIO_RESOURCE);
        if (resource.ended) return void this.emit("error", new PlayerError("Cannot play a resource that has already ended.") as unknown as AudioPlayerError);
        if (!this.audioResource) this.audioResource = resource;
        if (this.voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
            try {
                await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, this.connectionTimeout);
            } catch (err) {
                return void this.emit("error", err as AudioPlayerError);
            }
        }

        try {
            this.audioPlayer.play(resource);
        } catch (e) {
            this.emit("error", e as AudioPlayerError);
        }

        return this;
    }

    /**
     * Sets playback volume
     * @param {number} value The volume amount
     * @returns {boolean}
     */
    setVolume(value: number): boolean {
        if (!this.audioResource?.volume || isNaN(value) || value < 0 || value > Infinity) return false;

        this.audioResource.volume.setVolumeLogarithmic(value / 100);
        return true;
    }

    /**
     * The current volume
     * @type {number}
     */
    get volume(): number {
        if (!this.audioResource?.volume) return 100;
        const currentVol = this.audioResource.volume.volume;
        return Math.round(Math.pow(currentVol, 1 / 1.660964) * 100);
    }

    /**
     * The playback time
     * @type {number}
     */
    get streamTime(): number {
        if (!this.audioResource) return 0;
        return this.audioResource.playbackDuration;
    }
}
