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
} from '@discordjs/voice';
import { StageChannel, VoiceChannel } from 'discord.js';
import { Duplex, Readable } from 'stream';
import { TypedEmitter as EventEmitter } from 'tiny-typed-emitter';
import Track from '../Structures/Track';
import { Util } from '../utils/Util';
import { PlayerError, ErrorStatusCode } from '../Structures/PlayerError';
import { EqualizerBand, EqualizerStream, BiquadStream, BiquadFilters } from '@discord-player/equalizer';

interface CreateStreamOps {
    type?: StreamType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
    disableVolume?: boolean;
    disableEqualizer?: boolean;
    disableBiquad?: boolean;
    eq?: EqualizerBand[];
    biquadFilter?: BiquadFilters;
}

export interface VoiceEvents {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    error: (error: AudioPlayerError) => any;
    debug: (message: string) => any;
    start: (resource: AudioResource<Track>) => any;
    finish: (resource: AudioResource<Track>) => any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
}

class StreamDispatcher extends EventEmitter<VoiceEvents> {
    public readonly voiceConnection: VoiceConnection;
    public readonly audioPlayer: AudioPlayer;
    public channel: VoiceChannel | StageChannel;
    public audioResource?: AudioResource<Track> | null;
    private readyLock = false;
    public paused: boolean;
    public equalizer: EqualizerStream | null = null;
    public biquad: BiquadStream | null = null;

    /**
     * Creates new connection object
     * @param {VoiceConnection} connection The connection
     * @param {VoiceChannel|StageChannel} channel The connected channel
     * @private
     */
    constructor(connection: VoiceConnection, channel: VoiceChannel | StageChannel, public readonly connectionTimeout: number = 20000) {
        super();

        /**
         * The voice connection
         * @type {VoiceConnection}
         */
        this.voiceConnection = connection;

        /**
         * The audio player
         * @type {AudioPlayer}
         */
        this.audioPlayer = createAudioPlayer();

        /**
         * The voice channel
         * @type {VoiceChannel|StageChannel}
         */
        this.channel = channel;

        /**
         * The paused state
         * @type {boolean}
         */
        this.paused = false;

        this.voiceConnection.on('stateChange', async (_, newState) => {
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
                    try {
                        await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, this.connectionTimeout);
                    } catch {
                        try {
                            this.voiceConnection.destroy();
                        } catch (err) {
                            this.emit('error', err as AudioPlayerError);
                        }
                    }
                } else if (this.voiceConnection.rejoinAttempts < 5) {
                    await Util.wait((this.voiceConnection.rejoinAttempts + 1) * 5000);
                    this.voiceConnection.rejoin();
                } else {
                    try {
                        this.voiceConnection.destroy();
                    } catch (err) {
                        this.emit('error', err as AudioPlayerError);
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
                            this.emit('error', err as AudioPlayerError);
                        }
                    }
                } finally {
                    this.readyLock = false;
                }
            }
        });

        this.audioPlayer.on('stateChange', (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Playing) {
                if (!this.paused) return void this.emit('start', this.audioResource!);
            } else if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                if (!this.paused) {
                    void this.emit('finish', this.audioResource!);
                    if (this.equalizer) {
                        this.equalizer.destroy();
                        this.equalizer = null;
                    }
                    if (this.biquad) {
                        this.biquad.destroy();
                        this.biquad = null;
                    }
                    this.audioResource = null;
                }
            }
        });

        this.audioPlayer.on('debug', (m) => void this.emit('debug', m));
        this.audioPlayer.on('error', (error) => void this.emit('error', error));
        this.voiceConnection.subscribe(this.audioPlayer);
    }

    /**
     * Creates stream
     * @param {Readable|Duplex|string} src The stream source
     * @param {object} [ops] Options
     * @returns {AudioResource}
     */
    createStream(src: Readable | Duplex | string, ops?: CreateStreamOps) {
        if (!ops?.disableEqualizer) {
            this.equalizer = new EqualizerStream({
                channels: 1,
                disabled: false,
                bandMultiplier: ops?.eq || []
            });
        }

        if (!ops?.disableBiquad) {
            this.biquad = new BiquadStream({
                filter: ops?.biquadFilter
            });
        }
        let stream = this.equalizer && typeof src !== 'string' ? src.pipe(this.equalizer) : src;
        if (this.biquad && typeof stream !== 'string') stream = stream.pipe(this.biquad);

        this.audioResource = createAudioResource(stream, {
            inputType: ops?.type ?? StreamType.Arbitrary,
            metadata: ops?.data,
            inlineVolume: !ops?.disableVolume
        });

        return this.audioResource;
    }

    /**
     * The player status
     * @type {AudioPlayerStatus}
     */
    get status() {
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
    pause(interpolateSilence?: boolean) {
        const success = this.audioPlayer.pause(interpolateSilence);
        this.paused = success;
        return success;
    }

    /**
     * Resumes the stream playback
     * @returns {boolean}
     */
    resume() {
        const success = this.audioPlayer.unpause();
        this.paused = !success;
        return success;
    }

    /**
     * Play stream
     * @param {AudioResource<Track>} [resource=this.audioResource] The audio resource to play
     * @returns {Promise<StreamDispatcher>}
     */
    async playStream(resource: AudioResource<Track> = this.audioResource!) {
        if (!resource) throw new PlayerError('Audio resource is not available!', ErrorStatusCode.NO_AUDIO_RESOURCE);
        if (resource.ended) {
            return void this.emit('finish', resource);
        }
        if (!this.audioResource) this.audioResource = resource;
        if (this.voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
            try {
                await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, this.connectionTimeout);
            } catch (err) {
                return void this.emit('error', err as AudioPlayerError);
            }
        }

        try {
            this.audioPlayer.play(resource);
        } catch (e) {
            this.emit('error', e as AudioPlayerError);
        }

        return this;
    }

    /**
     * Sets playback volume
     * @param {number} value The volume amount
     * @returns {boolean}
     */
    setVolume(value: number) {
        if (!this.audioResource?.volume || isNaN(value) || value < 0 || value > Infinity) return false;

        this.audioResource.volume.setVolumeLogarithmic(value / 100);
        return true;
    }

    /**
     * The current volume
     * @type {number}
     */
    get volume() {
        if (!this.audioResource?.volume) return 100;
        const currentVol = this.audioResource.volume.volume;
        return Math.round(Math.pow(currentVol, 1 / 1.660964) * 100);
    }

    /**
     * The playback time
     * @type {number}
     */
    get streamTime() {
        if (!this.audioResource) return 0;
        return this.audioResource.playbackDuration;
    }
}

export { StreamDispatcher as StreamDispatcher };
