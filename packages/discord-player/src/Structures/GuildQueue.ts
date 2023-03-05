import { Player } from '../Player';
import { ChannelType, Guild, GuildVoiceChannelResolvable, VoiceBasedChannel, VoiceState } from 'discord.js';
import { Collection, Queue, QueueStrategy } from '@discord-player/utils';
import { BiquadFilters, EqualizerBand, PCMFilters } from '@discord-player/equalizer';
import { Track, TrackResolvable } from './Track';
import { StreamDispatcher } from '../VoiceInterface/StreamDispatcher';
import { AudioResource, StreamType } from '@discordjs/voice';
import { Util } from '../utils/Util';
import { Playlist } from './Playlist';
import { GuildQueueHistory } from './GuildQueueHistory';
import { GuildQueuePlayerNode } from './GuildQueuePlayerNode';
import { GuildQueueAudioFilters } from './GuildQueueAudioFilters';
import { Readable } from 'stream';
import { FiltersName, QueueRepeatMode, SearchQueryType } from '../types/types';
import { setTimeout } from 'timers';
import { GuildQueueStatistics } from './GuildQueueStatistics';

export interface GuildNodeInit<Meta = unknown> {
    guild: Guild;
    queueStrategy: QueueStrategy;
    equalizer: EqualizerBand[] | boolean;
    volume: number | boolean;
    biquad: BiquadFilters | boolean | undefined;
    resampler: number | boolean;
    filterer: PCMFilters[] | boolean;
    ffmpegFilters: FiltersName[];
    disableHistory: boolean;
    skipOnNoStream: boolean;
    onBeforeCreateStream?: OnBeforeCreateStreamHandler;
    onAfterCreateStream?: OnAfterCreateStreamHandler;
    repeatMode?: QueueRepeatMode;
    leaveOnEmpty: boolean;
    leaveOnEmptyCooldown: number;
    leaveOnEnd: boolean;
    leaveOnEndCooldown: number;
    leaveOnStop: boolean;
    leaveOnStopCooldown: number;
    connectionTimeout: number;
    selfDeaf?: boolean;
    metadata?: Meta | null;
    bufferingTimeout: number;
}

export interface VoiceConnectConfig {
    deaf?: boolean;
    timeout?: number;
}

export interface PostProcessedResult {
    stream: Readable;
    type: StreamType;
}

export type OnBeforeCreateStreamHandler = (track: Track, queryType: SearchQueryType, queue: GuildQueue) => Promise<Readable | null>;
export type OnAfterCreateStreamHandler = (stream: Readable, queue: GuildQueue) => Promise<PostProcessedResult | null>;

export type PlayerTriggeredReason = 'filters' | 'normal';

export enum GuildQueueEvent {
    /**
     * Emitted when audio track is added to the queue
     */
    audioTrackAdd = 'audioTrackadd',
    /**
     * Emitted when audio tracks were added to the queue
     */
    audioTracksAdd = 'audioTracksAdd',
    /**
     * Emitted when audio track is removed from the queue
     */
    audioTrackRemove = 'audioTrackRemove',
    /**
     * Emitted when audio tracks are removed from the queue
     */
    audioTracksRemove = 'audioTracksRemove',
    /**
     * Emitted when a connection is created
     */
    connection = 'connection',
    /**
     * Emitted when the bot is disconnected from the channel
     */
    disconnect = 'disconnect',
    /**
     * Emitted when the queue sends a debug info
     */
    debug = 'debug',
    /**
     * Emitted when the queue encounters error
     */
    error = 'error',
    /**
     * Emitted when the voice channel is empty
     */
    emptyChannel = 'emptyChannel',
    /**
     * Emitted when the queue is empty
     */
    emptyQueue = 'emptyQueue',
    /**
     * Emitted when the audio player starts streaming audio track
     */
    playerStart = 'playerStart',
    /**
     * Emitted when the audio player errors while streaming audio track
     */
    playerError = 'playerError',
    /**
     * Emitted when the audio player finishes streaming audio track
     */
    playerFinish = 'playerFinish',
    /**
     * Emitted when the audio player skips current track
     */
    playerSkip = 'playerSkip',
    /**
     * Emitted when the audio player is triggered
     */
    playerTrigger = 'playerTrigger',
    /**
     * Emitted when the voice state is updated. Consuming this event may disable default voice state update handler if `Player.isVoiceStateHandlerLocked()` returns `false`.
     */
    voiceStateUpdate = 'voiceStateUpdate'
}

export interface GuildQueueEvents<Meta = unknown> {
    /**
     * Emitted when audio track is added to the queue
     * @param queue The queue where this event occurred
     * @param track The track
     */
    audioTrackAdd: (queue: GuildQueue<Meta>, track: Track) => unknown;
    /**
     * Emitted when audio tracks were added to the queue
     * @param queue The queue where this event occurred
     * @param tracks The tracks array
     */
    audioTracksAdd: (queue: GuildQueue<Meta>, track: Track[]) => unknown;
    /**
     * Emitted when audio track is removed from the queue
     * @param queue The queue where this event occurred
     * @param track The track
     */
    audioTrackRemove: (queue: GuildQueue<Meta>, track: Track) => unknown;
    /**
     * Emitted when audio tracks are removed from the queue
     * @param queue The queue where this event occurred
     * @param track The track
     */
    audioTracksRemove: (queue: GuildQueue<Meta>, track: Track[]) => unknown;
    /**
     * Emitted when a connection is created
     * @param queue The queue where this event occurred
     */
    connection: (queue: GuildQueue<Meta>) => unknown;
    /**
     * Emitted when the bot is disconnected from the channel
     * @param queue The queue where this event occurred
     */
    disconnect: (queue: GuildQueue<Meta>) => unknown;
    /**
     * Emitted when the queue sends a debug info
     * @param queue The queue where this event occurred
     * @param message The debug message
     */
    debug: (queue: GuildQueue<Meta>, message: string) => unknown;
    /**
     * Emitted when the queue encounters error
     * @param queue The queue where this event occurred
     * @param error The error
     */
    error: (queue: GuildQueue<Meta>, error: Error) => unknown;
    /**
     * Emitted when the voice channel is empty
     * @param queue The queue where this event occurred
     */
    emptyChannel: (queue: GuildQueue<Meta>) => unknown;
    /**
     * Emitted when the queue is empty
     * @param queue The queue where this event occurred
     */
    emptyQueue: (queue: GuildQueue<Meta>) => unknown;
    /**
     * Emitted when the audio player starts streaming audio track
     * @param queue The queue where this event occurred
     * @param track The track that is being streamed
     */
    playerStart: (queue: GuildQueue<Meta>, track: Track) => unknown;
    /**
     * Emitted when the audio player errors while streaming audio track
     * @param queue The queue where this event occurred
     * @param error The error
     * @param track The track that is being streamed
     */
    playerError: (queue: GuildQueue<Meta>, error: Error, track: Track) => unknown;
    /**
     * Emitted when the audio player finishes streaming audio track
     * @param queue The queue where this event occurred
     * @param track The track that was being streamed
     */
    playerFinish: (queue: GuildQueue<Meta>, track: Track) => unknown;
    /**
     * Emitted when the audio player skips current track
     * @param queue The queue where this event occurred
     * @param track The track that was skipped
     */
    playerSkip: (queue: GuildQueue<Meta>, track: Track) => unknown;
    /**
     * Emitted when the audio player is triggered
     * @param queue The queue where this event occurred
     * @param track The track which was played in this event
     */
    playerTrigger: (queue: GuildQueue<Meta>, track: Track, reason: PlayerTriggeredReason) => unknown;
    /**
     * Emitted when the voice state is updated. Consuming this event may disable default voice state update handler if `Player.isVoiceStateHandlerLocked()` returns `false`.
     * @param queue The queue where this event occurred
     * @param oldState The old voice state
     * @param newState The new voice state
     */
    voiceStateUpdate: (queue: GuildQueue<Meta>, oldState: VoiceState, newState: VoiceState) => unknown;
}

export class GuildQueue<Meta = unknown> {
    #transitioning = false;
    #initializing = false;
    #deleted = false;
    #initializingPromises: Array<(value: boolean | PromiseLike<boolean>) => void> = [];
    private __current: Track | null = null;
    public tracks: Queue<Track>;
    public history = new GuildQueueHistory<Meta>(this);
    public dispatcher: StreamDispatcher | null = null;
    public node = new GuildQueuePlayerNode<Meta>(this);
    public filters = new GuildQueueAudioFilters<Meta>(this);
    public onBeforeCreateStream: OnBeforeCreateStreamHandler = async () => null;
    public onAfterCreateStream: OnAfterCreateStreamHandler = async (stream) => ({
        stream,
        type: StreamType.Raw
    });
    public repeatMode = QueueRepeatMode.OFF;
    public timeouts = new Collection<string, NodeJS.Timeout>();
    public stats = new GuildQueueStatistics<Meta>(this);

    public constructor(public player: Player, public options: GuildNodeInit<Meta>) {
        this.tracks = new Queue<Track>(options.queueStrategy);
        if (typeof options.onBeforeCreateStream === 'function') this.onBeforeCreateStream = options.onBeforeCreateStream;
        if (typeof options.onAfterCreateStream === 'function') this.onAfterCreateStream = options.onAfterCreateStream;
        if (options.repeatMode != null) this.repeatMode = options.repeatMode;

        options.selfDeaf ??= true;

        if (this.options.biquad != null && typeof this.options.biquad !== 'boolean') {
            this.filters._lastFiltersCache.biquad = this.options.biquad;
        }
        if (Array.isArray(this.options.equalizer)) {
            this.filters._lastFiltersCache.equalizer = this.options.equalizer;
        }
        if (Array.isArray(this.options.filterer)) {
            this.filters._lastFiltersCache.filters = this.options.filterer;
        }
        if (typeof this.options.resampler === 'number') {
            this.filters._lastFiltersCache.sampleRate = this.options.resampler;
        }
        if (Array.isArray(this.options.ffmpegFilters)) {
            this.filters.ffmpeg.setDefaults(this.options.ffmpegFilters);
        }
        this.debug(`GuildQueue initialized for guild ${this.options.guild.name} (ID: ${this.options.guild.id})`);
    }

    /**
     * Estimated duration of this queue in ms
     */
    public get estimatedDuration() {
        return this.tracks.store.reduce((a, c) => a + c.durationMS, 0);
    }

    /**
     * Formatted duration of this queue
     */
    public get durationFormatted() {
        return Util.buildTimeCode(Util.parseMS(this.estimatedDuration));
    }

    /**
     * The voice receiver for this queue
     */
    public get voiceReceiver() {
        return this.dispatcher?.receiver ?? null;
    }

    /**
     * Write a debug message to this queue
     * @param m The message to write
     */
    public debug(m: string) {
        this.player.events.emit('debug', this, m);
    }

    /**
     * The metadata of this queue
     */
    public get metadata() {
        return this.options.metadata;
    }

    public set metadata(m: Meta | undefined | null) {
        this.options.metadata = m;
    }

    /**
     * Set metadata for this queue
     * @param m Metadata to set
     */
    public setMetadata(m: Meta | undefined | null) {
        this.options.metadata = m;
    }

    /**
     * Indicates if this queue is currently initializing
     */
    public get initializing() {
        return this.#initializing;
    }

    public set initializing(v: boolean) {
        this.#initializing = v;
        if (v) this.#resolveInitializerAwaiters();
    }

    /**
     * Indicates current track of this queue
     */
    public get currentTrack() {
        return this.dispatcher?.audioResource?.metadata || this.__current;
    }

    /**
     * Indicates if this queue was deleted previously
     */
    public get deleted() {
        return this.#deleted;
    }

    /**
     * The voice channel of this queue
     */
    public get channel() {
        return this.dispatcher?.channel || null;
    }

    public set channel(c: VoiceBasedChannel | null) {
        if (this.dispatcher) {
            if (c) {
                this.dispatcher.channel = c;
            } else {
                this.delete();
            }
        }
    }

    /**
     * The voice connection of this queue
     */
    public get connection() {
        return this.dispatcher?.voiceConnection || null;
    }

    /**
     * The guild this queue belongs to
     */
    public get guild() {
        return this.options.guild;
    }

    /**
     * The id of this queue
     */
    public get id() {
        return this.guild.id;
    }

    /**
     * Set transition mode for this queue
     * @param state The state to set
     */
    public setTransitioning(state: boolean) {
        this.#transitioning = state;
    }

    /**
     * if this queue is currently under transition mode
     */
    public isTransitioning() {
        return this.#transitioning;
    }

    /**
     * Set repeat mode for this queue
     * @param mode The repeat mode to apply
     */
    public setRepeatMode(mode: QueueRepeatMode) {
        this.repeatMode = mode;
    }

    /**
     * Gets the size of the queue
     */
    public get size() {
        return this.tracks.size;
    }

    /**
     * The size of this queue
     */
    public getSize() {
        return this.size;
    }

    /**
     * Clear this queue
     */
    public clear() {
        this.tracks.clear();
        this.history.clear();
    }

    /**
     * Check if this queue has no tracks left in it
     */
    public isEmpty() {
        return this.tracks.size < 1;
    }

    /**
     * Check if this queue currently holds active audio resource
     */
    public isPlaying() {
        return this.dispatcher?.audioResource != null && !this.dispatcher.audioResource.ended;
    }

    /**
     * Add track to the queue. This will emit `audioTracksAdd` when multiple tracks are added, otherwise `audioTrackAdd`.
     * @param track Track or playlist or array of tracks to add
     */
    public addTrack(track: Track | Track[] | Playlist) {
        const toAdd = track instanceof Playlist ? track.tracks : track;
        this.tracks.add(toAdd);
        const isMulti = Array.isArray(toAdd);

        if (isMulti) {
            this.player.events.emit('audioTracksAdd', this, toAdd);
        } else {
            this.player.events.emit('audioTrackAdd', this, toAdd);
        }
    }

    /**
     * Remove a track from queue
     * @param track The track to remove
     */
    public removeTrack(track: TrackResolvable) {
        return this.node.remove(track);
    }

    /**
     * Inserts the track to the given index
     * @param track The track to insert
     * @param index The index to insert the track at (defaults to 0)
     */
    public insertTrack(track: Track, index = 0): void {
        return this.node.insert(track, index);
    }

    /**
     * Connect to a voice channel
     * @param channelResolvable The voice channel to connect to
     * @param options Join config
     */
    public async connect(channelResolvable: GuildVoiceChannelResolvable, options: VoiceConnectConfig = {}) {
        const channel = this.player.client.channels.resolve(channelResolvable);
        if (!channel || !channel.isVoiceBased()) {
            throw new Error(`Expected a voice based channel (type ${ChannelType.GuildVoice}/${ChannelType.GuildStageVoice}), received ${channel?.type}`);
        }

        this.debug(`Connecting to ${channel.type === ChannelType.GuildStageVoice ? 'stage' : 'voice'} channel ${channel.name} (ID: ${channel.id})`);

        if (this.dispatcher) {
            this.debug('Destroying old connection');
            this.#removeListeners(this.dispatcher);
            this.dispatcher.disconnect();
        }

        this.dispatcher = await this.player.voiceUtils.connect(channel, {
            deaf: options.deaf ?? this.options.selfDeaf ?? true,
            maxTime: options?.timeout ?? this.options.connectionTimeout ?? 120_000,
            queue: this
        });

        this.player.events.emit('connection', this);

        if (this.channel!.type === ChannelType.GuildStageVoice) {
            await this.channel!.guild.members.me!.voice.setSuppressed(false).catch(async () => {
                return await this.channel!.guild.members.me!.voice.setRequestToSpeak(true).catch(Util.noop);
            });
        }

        this.#attachListeners(this.dispatcher);

        return this;
    }

    /**
     * The voice connection latency of this queue
     */
    public get ping() {
        return this.connection?.ping.udp ?? -1;
    }

    /**
     * Delete this queue
     */
    public delete() {
        if (this.player.nodes.delete(this.id)) {
            this.#deleted = true;
        }
    }

    /**
     * Revives this queue
     * @returns
     */
    public revive() {
        if (!this.deleted || this.player.nodes.has(this.id)) return;
        this.#deleted = false;
        this.player.nodes.cache.set(this.id, this);
    }

    /**
     * Wait for this queue to initialize
     */
    public awaitInitialization() {
        return new Promise<boolean>((r) => {
            if (!this.#initializing) return r(true);
            this.#initializingPromises.push(r);
        });
    }

    /**
     * Set self deaf
     * @param mode On/Off state
     * @param reason Reason
     */
    public setSelfDeaf(mode?: boolean, reason?: string) {
        return this.guild.members.me!.voice.setDeaf(mode, reason);
    }

    /**
     * Set self mute
     * @param mode On/Off state
     * @param reason Reason
     */
    public setSelfMute(mode?: boolean, reason?: string) {
        return this.guild.members.me!.voice.setMute(mode, reason);
    }

    #attachListeners(dispatcher: StreamDispatcher) {
        dispatcher.on('error', (e) => this.player.events.emit('error', this, e));
        dispatcher.on('debug', (m) => this.player.events.emit('debug', this, m));
        dispatcher.on('finish', (r) => this.#performFinish(r));
        dispatcher.on('start', (r) => this.#performStart(r));
        dispatcher.on('dsp', (f) => {
            this.filters._lastFiltersCache.filters = f;
        });
        dispatcher.on('biquad', (f) => {
            this.filters._lastFiltersCache.biquad = f;
        });
        dispatcher.on('eqBands', (f) => {
            this.filters._lastFiltersCache.equalizer = f;
        });
        dispatcher.on('volume', (f) => {
            this.filters._lastFiltersCache.volume = f;
        });
    }

    #removeListeners(dispatcher: StreamDispatcher) {
        dispatcher.removeAllListeners();
    }

    #performStart(resource?: AudioResource<Track>) {
        const track = resource?.metadata || this.currentTrack;
        const reason = this.isTransitioning() ? 'filters' : 'normal';

        this.debug(
            `Player triggered for Track ${JSON.stringify({
                title: track?.title,
                reason
            })}`
        );

        this.player.events.emit('playerTrigger', this, track!, reason);
        if (track && !this.isTransitioning()) this.player.events.emit('playerStart', this, track);
        this.setTransitioning(false);
        this.initializing = false;
    }

    #performFinish(resource?: AudioResource<Track>) {
        const track = resource?.metadata || this.currentTrack;

        this.debug(
            `Track ${JSON.stringify({
                title: track?.title,
                isTransitionMode: this.isTransitioning()
            })} was marked as finished`
        );

        if (track && !this.isTransitioning()) {
            this.debug('Adding track to history and emitting finish event since transition mode is disabled...');
            this.history.push(track);
            this.node.resetProgress();
            this.player.events.emit('playerFinish', this, track);
            if (this.tracks.size < 1 && this.repeatMode === QueueRepeatMode.OFF) {
                this.debug('No more tracks left in the queue to play and repeat mode is off, initiating #emitEnd()');
                this.#emitEnd();
            } else {
                if (this.repeatMode === QueueRepeatMode.TRACK) {
                    this.debug('Repeat mode is set to track, repeating last track from the history...');
                    this.__current = this.history.tracks.dispatch() || track;
                    return this.node.play(this.__current!, { queue: false });
                }
                if (this.repeatMode === QueueRepeatMode.QUEUE) {
                    this.debug('Repeat mode is set to queue, moving last track from the history to current queue...');
                    this.tracks.add(this.history.tracks.dispatch() || track);
                }
                if (!this.tracks.size) {
                    if (this.repeatMode === QueueRepeatMode.AUTOPLAY) {
                        this.debug('Repeat mode is set to autoplay, initiating autoplay handler...');
                        this.#handleAutoplay(track);
                        return;
                    }
                } else {
                    this.debug('Initializing next track of the queue...');
                    this.__current = this.tracks.dispatch()!;
                    this.node.play(this.__current, {
                        queue: false
                    });
                }
            }
        }
    }

    #emitEnd() {
        this.__current = null;
        this.player.events.emit('emptyQueue', this);
        if (this.options.leaveOnEnd) {
            const tm: NodeJS.Timeout = setTimeout(() => {
                if (this.tracks.size) return clearTimeout(tm);
                this.dispatcher?.disconnect();
            }, this.options.leaveOnEndCooldown).unref();
        }
    }

    async #handleAutoplay(track: Track) {
        try {
            this.debug(`Autoplay >> Finding related tracks for Track ${track.title} (${track.url}) [ext:${track.extractor?.identifier || 'N/A'}]`);
            const tracks =
                (await track.extractor?.getRelatedTracks(track))?.tracks ||
                (
                    await this.player.extractors.run(async (ext) => {
                        this.debug(`Autoplay >> Querying extractor ${ext.identifier}`);
                        const res = await ext.getRelatedTracks(track);
                        if (!res.tracks.length) {
                            this.debug(`Autoplay >> Extractor ${ext.identifier} failed to provide results.`);
                            return false;
                        }

                        this.debug(`Autoplay >> Extractor ${ext.identifier} successfully returned results.`);

                        return res.tracks;
                    })
                )?.result;
            if (!tracks?.length) {
                this.debug(`Autoplay >> No related tracks found.`);
                throw 'no related tracks';
            }

            this.debug(`Autoplay >> Picking random track from first 5 tracks...`);
            const nextTrack = Util.randomChoice(tracks.slice(0, 5));
            await this.node.play(nextTrack, {
                queue: false,
                seek: 0,
                transitionMode: false
            });
        } catch {
            return this.#emitEnd();
        }
    }

    #resolveInitializerAwaiters() {
        this.#initializingPromises.forEach((p) => {
            p(!this.#initializing);
        });

        this.#initializingPromises = [];
    }
}
