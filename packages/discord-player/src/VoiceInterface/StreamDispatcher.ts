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
    VoiceConnectionDisconnectReason,
    version
} from '@discordjs/voice';
import { StageChannel, VoiceChannel } from 'discord.js';
import type { Readable } from 'stream';
import { EventEmitter } from '@discord-player/utils';
import { Track } from '../Structures/Track';
import { Util } from '../utils/Util';
import { PlayerError, ErrorStatusCode } from '../Structures/PlayerError';
import { EqualizerBand, BiquadFilters, PCMFilters, FiltersChain } from '@discord-player/equalizer';
import { GuildQueue, PostProcessedResult } from '../Structures';
import { VoiceReceiverNode } from '../Structures/VoiceReceiverNode';

const needsKeepAlivePatch = (() => {
    if ('DP_NO_KEEPALIVE_PATCH' in process.env) return false;
    // we dont care about dev version and semver:major >= 1
    if (version.includes('-dev') || version.startsWith('1')) return false;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_major, minor, patch] = version.split('.').map((n) => parseInt(n));

    // we need a patch if semver:minor is < 15 and semver:patch < 1
    return minor > 14 ? false : minor < 15 && patch < 1;
})();

interface CreateStreamOps {
    type?: StreamType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
    disableVolume?: boolean;
    disableEqualizer?: boolean;
    disableBiquad?: boolean;
    eq?: EqualizerBand[];
    biquadFilter?: BiquadFilters;
    disableFilters?: boolean;
    defaultFilters?: PCMFilters[];
    volume?: number;
    disableResampler?: boolean;
    sampleRate?: number;
}

export interface VoiceEvents {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    error: (error: AudioPlayerError) => any;
    debug: (message: string) => any;
    start: (resource: AudioResource<Track>) => any;
    finish: (resource: AudioResource<Track>) => any;
    dsp: (filters: PCMFilters[]) => any;
    eqBands: (filters: EqualizerBand[]) => any;
    sampleRate: (filters: number) => any;
    biquad: (filters: BiquadFilters) => any;
    volume: (volume: number) => any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
}

class StreamDispatcher extends EventEmitter<VoiceEvents> {
    public readonly voiceConnection: VoiceConnection;
    public readonly audioPlayer: AudioPlayer;
    public receiver = new VoiceReceiverNode(this);
    public channel: VoiceChannel | StageChannel;
    public audioResource?: AudioResource<Track> | null;
    private readyLock = false;
    public dsp = new FiltersChain();

    /**
     * Creates new connection object
     * @param {VoiceConnection} connection The connection
     * @param {VoiceChannel|StageChannel} channel The connected channel
     * @private
     */
    constructor(connection: VoiceConnection, channel: VoiceChannel | StageChannel, public queue: GuildQueue, public readonly connectionTimeout: number = 20000) {
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

        this.voiceConnection.on('debug', (m) => void this.emit('debug', m));
        this.voiceConnection.on('error', (error) => void this.emit('error', error as AudioPlayerError));
        this.audioPlayer.on('debug', (m) => void this.emit('debug', m));
        this.audioPlayer.on('error', (error) => void this.emit('error', error));

        this.dsp.onUpdate = () => {
            if (!this.dsp) return;
            if (this.dsp.filters?.filters) this.emit('dsp', this.dsp.filters?.filters);
            if (this.dsp.biquad?.filter) this.emit('biquad', this.dsp.biquad?.filter);
            if (this.dsp.equalizer) this.emit('eqBands', this.dsp.equalizer.getEQ());
            if (this.dsp.volume) this.emit('volume', this.dsp.volume.volume);
            if (this.dsp.resampler) this.emit('sampleRate', this.dsp.resampler.targetSampleRate);
        };

        this.dsp.onError = (e) => this.emit('error', e as AudioPlayerError);

        this.voiceConnection.on('stateChange', async (oldState, newState) => {
            if (needsKeepAlivePatch) {
                this.queue.debug(`Detected @discordjs/voice version ${version} which needs keepAlive patch, applying patch...`);
                const oldNetworking = Reflect.get(oldState, 'networking');
                const newNetworking = Reflect.get(newState, 'networking');

                const networkStateChangeHandler = (_: object, newNetworkState: object) => {
                    const newUdp = Reflect.get(newNetworkState, 'udp');
                    clearInterval(newUdp?.keepAliveInterval);
                };

                oldNetworking?.off('stateChange', networkStateChangeHandler);
                newNetworking?.on('stateChange', networkStateChangeHandler);
            }

            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
                    try {
                        await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, this.connectionTimeout);
                    } catch {
                        try {
                            if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) this.voiceConnection.destroy();
                        } catch (err) {
                            this.emit('error', err as AudioPlayerError);
                        }
                    }
                } else if (this.voiceConnection.rejoinAttempts < 5) {
                    await Util.wait((this.voiceConnection.rejoinAttempts + 1) * 5000);
                    this.voiceConnection.rejoin();
                } else {
                    try {
                        if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) this.voiceConnection.destroy();
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
                if (oldState.status === AudioPlayerStatus.Idle || oldState.status === AudioPlayerStatus.Buffering) {
                    return this.emit('start', this.audioResource!);
                }
            } else if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                this.emit('finish', this.audioResource!);
                this.dsp.destroy();
                this.audioResource = null;
            }
        });

        this.voiceConnection.subscribe(this.audioPlayer);
    }

    /**
     * Check if the player has been paused manually
     */
    get paused() {
        return this.audioPlayer.state.status === AudioPlayerStatus.Paused;
    }

    set paused(val: boolean) {
        val ? this.pause(true) : this.resume();
    }

    /**
     * Whether or not the player is currently paused automatically or manually.
     */
    isPaused() {
        return this.paused || this.audioPlayer.state.status === AudioPlayerStatus.AutoPaused;
    }

    /**
     * Whether or not the player is currently buffering
     */
    isBuffering() {
        return this.audioPlayer.state.status === AudioPlayerStatus.Buffering;
    }

    /**
     * Whether or not the player is currently playing
     */
    isPlaying() {
        return this.audioPlayer.state.status === AudioPlayerStatus.Playing;
    }

    /**
     * Whether or not the player is currently idle
     */
    isIdle() {
        return this.audioPlayer.state.status === AudioPlayerStatus.Idle;
    }

    /**
     * Whether or not the voice connection has been destroyed
     */
    isDestroyed() {
        return this.voiceConnection.state.status === VoiceConnectionStatus.Destroyed;
    }

    /**
     * Whether or not the voice connection has been destroyed
     */
    isDisconnected() {
        return this.voiceConnection.state.status === VoiceConnectionStatus.Disconnected;
    }

    /**
     * Whether or not the voice connection is ready to play
     */
    isReady() {
        return this.voiceConnection.state.status === VoiceConnectionStatus.Ready;
    }

    /**
     * Whether or not the voice connection is signalling
     */
    isSignalling() {
        return this.voiceConnection.state.status === VoiceConnectionStatus.Signalling;
    }

    /**
     * Whether or not the voice connection is connecting
     */
    isConnecting() {
        return this.voiceConnection.state.status === VoiceConnectionStatus.Connecting;
    }

    /**
     * Creates stream
     * @param {Readable} src The stream source
     * @param {object} [ops] Options
     * @returns {AudioResource}
     */
    async createStream(src: Readable, ops?: CreateStreamOps) {
        if (!ops?.disableFilters) this.queue.debug('Initiating DSP filters pipeline...');
        const stream = !ops?.disableFilters
            ? this.dsp.create(src, {
                  dsp: {
                      filters: ops?.defaultFilters,
                      disabled: ops?.disableFilters
                  },
                  biquad: ops?.biquadFilter
                      ? {
                            filter: ops.biquadFilter,
                            disabled: ops?.disableBiquad
                        }
                      : undefined,
                  resampler: {
                      targetSampleRate: ops?.sampleRate,
                      disabled: ops?.disableResampler
                  },
                  equalizer: {
                      bandMultiplier: ops?.eq,
                      disabled: ops?.disableEqualizer
                  },
                  volume: {
                      volume: ops?.volume,
                      disabled: ops?.disableVolume
                  }
              })
            : src;

        this.queue.debug('Executing onAfterCreateStream hook...');
        const postStream = await this.queue.onAfterCreateStream?.(stream, this.queue).catch(
            () =>
                ({
                    stream: stream,
                    type: ops?.type ?? StreamType.Arbitrary
                } as PostProcessedResult)
        );

        this.queue.debug('Preparing AudioResource...');
        this.audioResource = createAudioResource(postStream?.stream ?? stream, {
            inputType: postStream?.type ?? ops?.type ?? StreamType.Arbitrary,
            metadata: ops?.data,
            // volume controls happen from AudioFilter DSP utility
            inlineVolume: false
        });

        return this.audioResource;
    }

    public get resampler() {
        return this.dsp?.resampler;
    }

    public get filters() {
        return this.dsp?.filters;
    }

    public get biquad() {
        return this.dsp?.biquad || null;
    }

    public get equalizer() {
        return this.dsp?.equalizer || null;
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
            if (this.audioPlayer) this.audioPlayer.stop(true);
            if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) this.voiceConnection.destroy();
        } catch {} // eslint-disable-line no-empty
    }

    /**
     * Stops the player
     * @returns {void}
     */
    end() {
        try {
            this.audioPlayer.stop();
        } catch {
            //
        }
    }

    /**
     * Pauses the stream playback
     * @param {boolean} [interpolateSilence=false] If true, the player will play 5 packets of silence after pausing to prevent audio glitches.
     * @returns {boolean}
     */
    pause(interpolateSilence?: boolean) {
        const success = this.audioPlayer.pause(interpolateSilence);
        return success;
    }

    /**
     * Resumes the stream playback
     * @returns {boolean}
     */
    resume() {
        const success = this.audioPlayer.unpause();
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
        if (!this.dsp.volume) return false;
        return this.dsp.volume.setVolume(value);
    }

    /**
     * The current volume
     * @type {number}
     */
    get volume() {
        if (!this.dsp.volume) return 100;
        return this.dsp.volume.volume;
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
