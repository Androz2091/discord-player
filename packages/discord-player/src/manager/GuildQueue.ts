import { Player, PlayerNodeInitializerOptions, TrackLike } from '../Player';
import { ChannelType, Guild, GuildVoiceChannelResolvable, VoiceBasedChannel, VoiceState } from 'discord.js';
import { Collection, Queue, QueueStrategy } from '@discord-player/utils';
import { BiquadFilters, EqualizerBand, PCMFilters } from '@discord-player/equalizer';
import { Track, TrackResolvable } from '../fabric/Track';
import { StreamDispatcher } from '../VoiceInterface/StreamDispatcher';
import { type AudioPlayer, AudioResource, StreamType, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { Util, VALIDATE_QUEUE_CAP } from '../utils/Util';
import { Playlist } from '../fabric/Playlist';
import { GuildQueueHistory } from './GuildQueueHistory';
import { GuildQueuePlayerNode, StreamConfig } from './GuildQueuePlayerNode';
import { GuildQueueAudioFilters } from './GuildQueueAudioFilters';
import { Readable } from 'stream';
import { FiltersName, QueueRepeatMode, SearchQueryType } from '../types/types';
import { setTimeout } from 'timers';
import { GuildQueueStatistics } from './GuildQueueStatistics';
import { TypeUtil } from '../utils/TypeUtil';
import { AsyncQueue } from '../utils/AsyncQueue';
import { Exceptions } from '../errors';

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
    noEmitInsert: boolean;
    maxSize?: number;
    maxHistorySize?: number;
    preferBridgedMetadata: boolean;
}

export interface VoiceConnectConfig {
    deaf?: boolean;
    timeout?: number;
    group?: string;
    audioPlayer?: AudioPlayer;
}

export interface PostProcessedResult {
    stream: Readable;
    type: StreamType;
}

export type OnBeforeCreateStreamHandler = (track: Track, queryType: SearchQueryType, queue: GuildQueue) => Promise<Readable | null>;
export type OnAfterCreateStreamHandler = (stream: Readable, queue: GuildQueue) => Promise<PostProcessedResult | null>;

export type PlayerTriggeredReason = 'filters' | 'normal';

export const GuildQueueEvent = {
    /**
     * Emitted when audio track is added to the queue
     */
    audioTrackAdd: 'audioTrackAdd',
    /**
     * Emitted when audio tracks were added to the queue
     */
    audioTracksAdd: 'audioTracksAdd',
    /**
     * Emitted when audio track is removed from the queue
     */
    audioTrackRemove: 'audioTrackRemove',
    /**
     * Emitted when audio tracks are removed from the queue
     */
    audioTracksRemove: 'audioTracksRemove',
    /**
     * Emitted when a connection is created
     */
    connection: 'connection',
    /**
     * Emitted when a voice connection is destroyed
     */
    connectionDestroyed: 'connectionDestroyed',
    /**
     * Emitted when the bot is disconnected from the channel
     */
    disconnect: 'disconnect',
    /**
     * Emitted when the queue sends a debug info
     */
    debug: 'debug',
    /**
     * Emitted when the queue encounters error
     */
    error: 'error',
    /**
     * Emitted when the voice channel is empty
     */
    emptyChannel: 'emptyChannel',
    /**
     * Emitted when the queue is empty
     */
    emptyQueue: 'emptyQueue',
    /**
     * Emitted when the audio player starts streaming audio track
     */
    playerStart: 'playerStart',
    /**
     * Emitted when the audio player errors while streaming audio track
     */
    playerError: 'playerError',
    /**
     * Emitted when the audio player finishes streaming audio track
     */
    playerFinish: 'playerFinish',
    /**
     * Emitted when the audio player skips current track
     */
    playerSkip: 'playerSkip',
    /**
     * Emitted when the audio player is triggered
     */
    playerTrigger: 'playerTrigger',
    /**
     * Emitted when the voice state is updated. Consuming this event may disable default voice state update handler if `Player.isVoiceStateHandlerLocked()` returns `false`.
     */
    voiceStateUpdate: 'voiceStateUpdate',
    /**
     * Emitted when volume is updated
     */
    volumeChange: 'volumeChange',
    /**
     * Emitted when player is paused
     */
    playerPause: 'playerPause',
    /**
     * Emitted when player is resumed
     */
    playerResume: 'playerResume',
    /**
     * Biquad Filters Update
     */
    biquadFiltersUpdate: 'biquadFiltersUpdate',
    /**
     * Equalizer Update
     */
    equalizerUpdate: 'equalizerUpdate',
    /**
     * DSP update
     */
    dspUpdate: 'dspUpdate',
    /**
     * Audio Filters Update
     */
    audioFiltersUpdate: 'audioFiltersUpdate',
    /**
     * Audio player will play next track
     */
    willPlayTrack: 'willPlayTrack',
    /**
     * Emitted when a voice channel is repopulated
     */
    channelPopulate: 'channelPopulate',
    /**
     * Emitted when a queue is successfully created
     */
    queueCreate: 'queueCreate',
    /**
     * Emitted when a queue is deleted
     */
    queueDelete: 'queueDelete'
} as const;

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
     * Emitted when a connection is destroyed
     * @param queue The queue where this event occurred
     */
    connectionDestroyed: (queue: GuildQueue<Meta>) => unknown;
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
    /**
     * Emitted when audio player is paused
     * @param queue The queue where this event occurred
     */
    playerPause: (queue: GuildQueue<Meta>) => unknown;
    /**
     * Emitted when audio player is resumed
     * @param queue The queue where this event occurred
     */
    playerResume: (queue: GuildQueue<Meta>) => unknown;
    /**
     * Emitted when audio player's volume is changed
     * @param queue The queue where this event occurred
     * @param oldVolume The old volume
     * @param newVolume The updated volume
     */
    volumeChange: (queue: GuildQueue<Meta>, oldVolume: number, newVolume: number) => unknown;
    /**
     * Emitted when equalizer config is updated
     * @param queue The queue where this event occurred
     * @param oldFilters Old filters
     * @param newFilters New filters
     */
    equalizerUpdate: (queue: GuildQueue<Meta>, oldFilters: EqualizerBand[], newFilters: EqualizerBand[]) => unknown;
    /**
     * Emitted when biquad filters is updated
     * @param queue The queue where this event occurred
     * @param oldFilters Old filters
     * @param newFilters New filters
     */
    biquadFiltersUpdate: (queue: GuildQueue<Meta>, oldFilters: BiquadFilters | null, newFilters: BiquadFilters | null) => unknown;
    /**
     * Emitted when dsp filters is updated
     * @param queue The queue where this event occurred
     * @param oldFilters Old filters
     * @param newFilters New filters
     */
    dspUpdate: (queue: GuildQueue<Meta>, oldFilters: PCMFilters[], newFilters: PCMFilters[]) => unknown;
    /**
     * Emitted when ffmpeg audio filters is updated
     * @param queue The queue where this event occurred
     * @param oldFilters Old filters
     * @param newFilters New filters
     */
    audioFiltersUpdate: (queue: GuildQueue<Meta>, oldFilters: FiltersName[], newFilters: FiltersName[]) => unknown;

    /**
     * Emitted before streaming an audio track. This event can be used to modify stream config before playing a track.
     * Listening to this event will pause the execution of audio player until `done()` is invoked.
     * @param queue The queue where this event occurred
     * @param track The track that will be streamed
     * @param config Configurations for streaming
     * @param done Done callback
     */
    willPlayTrack: (queue: GuildQueue<Meta>, track: Track<unknown>, config: StreamConfig, done: () => void) => unknown;
    /**
     * Emitted when a voice channel is populated
     * @param queue The queue where this event occurred
     */
    channelPopulate: (queue: GuildQueue<Meta>) => unknown;
    /**
     * Emitted when a queue is successfully created
     * @param queue The queue where this event occurred
     */
    queueCreate: (queue: GuildQueue<Meta>) => unknown;
    /**
     * Emitted when a queue is successfully deleted
     * @param queue The queue where this event occurred
     */
    queueDelete: (queue: GuildQueue<Meta>) => unknown;
}

export class GuildQueue<Meta = unknown> {
    #transitioning = false;
    #deleted = false;
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
    public tasksQueue = new AsyncQueue();

    public constructor(public player: Player, public options: GuildNodeInit<Meta>) {
        this.tracks = new Queue<Track>(options.queueStrategy);
        if (TypeUtil.isFunction(options.onBeforeCreateStream)) this.onBeforeCreateStream = options.onBeforeCreateStream;
        if (TypeUtil.isFunction(options.onAfterCreateStream)) this.onAfterCreateStream = options.onAfterCreateStream;
        if (!TypeUtil.isNullish(options.repeatMode)) this.repeatMode = options.repeatMode;

        options.selfDeaf ??= true;
        options.maxSize ??= Infinity;
        options.maxHistorySize ??= Infinity;

        if (!TypeUtil.isNullish(this.options.biquad) && !TypeUtil.isBoolean(this.options.biquad)) {
            this.filters._lastFiltersCache.biquad = this.options.biquad;
        }

        if (Array.isArray(this.options.equalizer)) {
            this.filters._lastFiltersCache.equalizer = this.options.equalizer;
        }

        if (Array.isArray(this.options.filterer)) {
            this.filters._lastFiltersCache.filters = this.options.filterer;
        }

        if (TypeUtil.isNumber(this.options.resampler)) {
            this.filters._lastFiltersCache.sampleRate = this.options.resampler;
        }

        if (TypeUtil.isArray(this.options.ffmpegFilters)) {
            this.filters.ffmpeg.setDefaults(this.options.ffmpegFilters);
        }

        if (!TypeUtil.isNumber(options.maxSize)) {
            throw Exceptions.ERR_INVALID_ARG_TYPE('[GuildNodeInit.maxSize]', 'number', typeof options.maxSize);
        }

        if (!TypeUtil.isNumber(options.maxHistorySize)) {
            throw Exceptions.ERR_INVALID_ARG_TYPE('[GuildNodeInit.maxHistorySize]', 'number', typeof options.maxHistorySize);
        }

        if (options.maxSize < 1) options.maxSize = Infinity;
        if (options.maxHistorySize < 1) options.maxHistorySize = Infinity;

        if (this.hasDebugger) this.debug(`GuildQueue initialized for guild ${this.options.guild.name} (ID: ${this.options.guild.id})`);
        this.emit(GuildQueueEvent.queueCreate, this);
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
        this.emit(GuildQueueEvent.debug, this, m);
    }

    /**
     * The metadata of this queue
     */
    public get metadata() {
        return this.options.metadata!;
    }

    public set metadata(m: Meta) {
        this.options.metadata = m;
    }

    /**
     * Set metadata for this queue
     * @param m Metadata to set
     */
    public setMetadata(m: Meta) {
        this.options.metadata = m;
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
     * Max size of this queue
     */
    public get maxSize() {
        return this.options.maxSize ?? Infinity;
    }

    /**
     * Max size of this queue
     */
    public getMaxSize() {
        return this.maxSize;
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
     * Max history size of this queue
     */
    public get maxHistorySize() {
        return this.options.maxHistorySize ?? Infinity;
    }

    /**
     * Max history size of this queue
     */
    public getMaxHistorySize() {
        return this.maxHistorySize;
    }

    /**
     * Set max history size for this queue
     * @param size The size to set
     */
    public setMaxHistorySize(size: number) {
        if (!TypeUtil.isNumber(size)) {
            throw Exceptions.ERR_INVALID_ARG_TYPE('size', 'number', typeof size);
        }

        if (size < 1) size = Infinity;

        this.options.maxHistorySize = size;
    }

    /**
     * Set max size for this queue
     * @param size The size to set
     */
    public setMaxSize(size: number) {
        if (!TypeUtil.isNumber(size)) {
            throw Exceptions.ERR_INVALID_ARG_TYPE('size', 'number', typeof size);
        }

        if (size < 1) size = Infinity;

        this.options.maxSize = size;
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
     * Check if this queue is full
     */
    public isFull() {
        return this.tracks.size >= this.maxSize;
    }

    /**
     * Get queue capacity
     */
    public getCapacity() {
        if (this.isFull()) return 0;
        const cap = this.maxSize - this.size;
        return cap;
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
        const isMulti = Array.isArray(toAdd);

        VALIDATE_QUEUE_CAP(this, toAdd);

        this.tracks.add(toAdd);

        if (isMulti) {
            this.emit(GuildQueueEvent.audioTracksAdd, this, toAdd);
        } else {
            this.emit(GuildQueueEvent.audioTrackAdd, this, toAdd);
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
     * Moves a track in the queue
     * @param from The track to move
     * @param to The position to move to
     */
    public moveTrack(track: TrackResolvable, index = 0): void {
        return this.node.move(track, index);
    }

    /**
     * Copy a track in the queue
     * @param from The track to clone
     * @param to The position to clone at
     */
    public copyTrack(track: TrackResolvable, index = 0): void {
        return this.node.copy(track, index);
    }

    /**
     * Swap two tracks in the queue
     * @param src The first track to swap
     * @param dest The second track to swap
     */
    public swapTracks(src: TrackResolvable, dest: TrackResolvable): void {
        return this.node.swap(src, dest);
    }

    /**
     * Create stream dispatcher from the given connection
     * @param connection The connection to use
     */
    public createDispatcher(connection: VoiceConnection, options: Pick<VoiceConnectConfig, 'audioPlayer' | 'timeout'> = {}) {
        if (connection.state.status === VoiceConnectionStatus.Destroyed) {
            throw Exceptions.ERR_VOICE_CONNECTION_DESTROYED();
        }

        const channel = this.player.client.channels.cache.get(connection.joinConfig.channelId!);
        if (!channel) throw Exceptions.ERR_NO_VOICE_CHANNEL();
        if (!channel.isVoiceBased()) throw Exceptions.ERR_INVALID_ARG_TYPE('channel', `VoiceBasedChannel (type ${ChannelType.GuildVoice}/${ChannelType.GuildStageVoice})`, String(channel?.type));

        if (this.dispatcher) {
            this.#removeListeners(this.dispatcher);
            this.dispatcher.destroy();
            this.dispatcher = null;
        }

        this.dispatcher = new StreamDispatcher(connection, channel, this, options.timeout ?? this.options.connectionTimeout, options.audioPlayer);
    }

    /**
     * Connect to a voice channel
     * @param channelResolvable The voice channel to connect to
     * @param options Join config
     */
    public async connect(channelResolvable: GuildVoiceChannelResolvable, options: VoiceConnectConfig = {}) {
        const channel = this.player.client.channels.resolve(channelResolvable);
        if (!channel || !channel.isVoiceBased()) {
            throw Exceptions.ERR_INVALID_ARG_TYPE('channel', `VoiceBasedChannel (type ${ChannelType.GuildVoice}/${ChannelType.GuildStageVoice})`, String(channel?.type));
        }

        if (this.hasDebugger) this.debug(`Connecting to ${channel.type === ChannelType.GuildStageVoice ? 'stage' : 'voice'} channel ${channel.name} (ID: ${channel.id})`);

        if (this.dispatcher && channel.id !== this.dispatcher.channel.id) {
            if (this.hasDebugger) this.debug('Destroying old connection');
            this.#removeListeners(this.dispatcher);
            this.dispatcher.destroy();
            this.dispatcher = null;
        }

        this.dispatcher = await this.player.voiceUtils.connect(channel, {
            deaf: options.deaf ?? this.options.selfDeaf ?? true,
            maxTime: options?.timeout ?? this.options.connectionTimeout ?? 120_000,
            queue: this,
            audioPlayer: options?.audioPlayer,
            group: options.group
        });

        this.emit(GuildQueueEvent.connection, this);

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
            this.emit(GuildQueueEvent.queueDelete, this);
        }
    }

    /**
     * Revives this queue
     * @returns
     */
    public revive() {
        if (!this.deleted || this.player.nodes.has(this.id)) return;
        this.#deleted = false;
        this.setTransitioning(false);
        this.player.nodes.cache.set(this.id, this);
        this.player.events.emit(GuildQueueEvent.queueCreate, this);
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

    /**
     * Play a track in this queue
     * @param track The track to be played
     * @param options Player node initialization options
     */
    public async play(track: TrackLike, options?: PlayerNodeInitializerOptions<Meta>) {
        if (!this.channel) throw Exceptions.ERR_NO_VOICE_CONNECTION();

        return this.player.play(this.channel, track, options);
    }

    /**
     * Emit an event on this queue
     * @param event The event to emit
     * @param args The args for the event
     */
    public emit<K extends keyof GuildQueueEvents<Meta>>(event: K, ...args: Parameters<GuildQueueEvents<Meta>[K]>): boolean {
        if (this.deleted) return false;
        return this.player.events.emit(event, ...args);
    }

    #attachListeners(dispatcher: StreamDispatcher) {
        dispatcher.on('error', (e) => this.emit(GuildQueueEvent.error, this, e));
        dispatcher.on('debug', (m) => this.hasDebugger && this.emit(GuildQueueEvent.debug, this, m));
        dispatcher.on('finish', (r) => this.#performFinish(r));
        dispatcher.on('start', (r) => this.#performStart(r));
        dispatcher.on('destroyed', () => {
            this.#removeListeners(dispatcher);
            this.dispatcher = null;
        });
        dispatcher.on('dsp', (f) => {
            if (!Object.is(this.filters._lastFiltersCache.filters, f)) {
                this.emit(GuildQueueEvent.dspUpdate, this, this.filters._lastFiltersCache.filters, f);
            }
            this.filters._lastFiltersCache.filters = f;
        });
        dispatcher.on('biquad', (f) => {
            if (this.filters._lastFiltersCache.biquad !== f) {
                this.emit(GuildQueueEvent.biquadFiltersUpdate, this, this.filters._lastFiltersCache.biquad, f);
            }
            this.filters._lastFiltersCache.biquad = f;
        });
        dispatcher.on('eqBands', (f) => {
            if (!Object.is(f, this.filters._lastFiltersCache.equalizer)) {
                this.emit(GuildQueueEvent.equalizerUpdate, this, this.filters._lastFiltersCache.equalizer, f);
            }
            this.filters._lastFiltersCache.equalizer = f;
        });
        dispatcher.on('volume', (f) => {
            if (this.filters._lastFiltersCache.volume !== f) this.emit(GuildQueueEvent.volumeChange, this, this.filters._lastFiltersCache.volume, f);
            this.filters._lastFiltersCache.volume = f;
        });
    }

    public get hasDebugger() {
        return this.player.events.listenerCount(GuildQueueEvent.debug) > 0;
    }

    #removeListeners<T extends { removeAllListeners: () => unknown }>(target: T) {
        target.removeAllListeners();
    }

    #performStart(resource?: AudioResource<Track>) {
        const track = resource?.metadata || this.currentTrack;
        const reason = this.isTransitioning() ? 'filters' : 'normal';

        if (this.hasDebugger)
            this.debug(
                `Player triggered for Track ${JSON.stringify({
                    title: track?.title,
                    reason
                })}`
            );

        this.emit(GuildQueueEvent.playerTrigger, this, track!, reason);
        if (track && !this.isTransitioning()) this.emit(GuildQueueEvent.playerStart, this, track);
        this.setTransitioning(false);
    }

    #performFinish(resource?: AudioResource<Track>) {
        const track = resource?.metadata || this.currentTrack;

        if (this.hasDebugger)
            this.debug(
                `Track ${JSON.stringify({
                    title: track?.title,
                    isTransitionMode: this.isTransitioning()
                })} was marked as finished`
            );

        if (track && !this.isTransitioning()) {
            if (this.hasDebugger) this.debug('Adding track to history and emitting finish event since transition mode is disabled...');
            this.history.push(track);
            this.node.resetProgress();
            this.emit(GuildQueueEvent.playerFinish, this, track);
            if (this.#deleted) return;
            if (this.tracks.size < 1 && this.repeatMode === QueueRepeatMode.OFF) {
                if (this.hasDebugger) this.debug('No more tracks left in the queue to play and repeat mode is off, initiating #emitEnd()');
                this.#emitEnd();
            } else {
                if (this.repeatMode === QueueRepeatMode.TRACK) {
                    if (this.hasDebugger) this.debug('Repeat mode is set to track, repeating last track from the history...');
                    this.__current = this.history.tracks.dispatch() || track;
                    return this.node.play(this.__current!, { queue: false });
                }
                if (this.repeatMode === QueueRepeatMode.QUEUE) {
                    if (this.hasDebugger) this.debug('Repeat mode is set to queue, moving last track from the history to current queue...');
                    this.tracks.add(this.history.tracks.dispatch() || track);
                }
                if (!this.tracks.size) {
                    if (this.repeatMode === QueueRepeatMode.AUTOPLAY) {
                        if (this.hasDebugger) this.debug('Repeat mode is set to autoplay, initiating autoplay handler...');
                        this.#handleAutoplay(track);
                        return;
                    }
                } else {
                    if (this.hasDebugger) this.debug('Initializing next track of the queue...');
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
        this.emit(GuildQueueEvent.emptyQueue, this);
        if (this.options.leaveOnEnd) {
            const tm: NodeJS.Timeout = setTimeout(() => {
                if (this.isPlaying()) return clearTimeout(tm);
                this.dispatcher?.disconnect();
            }, this.options.leaveOnEndCooldown).unref();
        }
    }

    async #handleAutoplay(track: Track) {
        try {
            if (this.hasDebugger) this.debug(`Autoplay >> Finding related tracks for Track ${track.title} (${track.url}) [ext:${track.extractor?.identifier || 'N/A'}]`);
            const tracks =
                (await track.extractor?.getRelatedTracks(track))?.tracks ||
                (
                    await this.player.extractors.run(async (ext) => {
                        if (this.hasDebugger) this.debug(`Autoplay >> Querying extractor ${ext.identifier}`);
                        const res = await ext.getRelatedTracks(track);
                        if (!res.tracks.length) {
                            if (this.hasDebugger) this.debug(`Autoplay >> Extractor ${ext.identifier} failed to provide results.`);
                            return false;
                        }

                        if (this.hasDebugger) this.debug(`Autoplay >> Extractor ${ext.identifier} successfully returned results.`);

                        return res.tracks;
                    })
                )?.result ||
                [];
            if (!tracks?.length) {
                if (this.hasDebugger) this.debug(`Autoplay >> No related tracks found.`);
                throw 'no related tracks';
            }

            if (this.hasDebugger) this.debug(`Autoplay >> Picking random track from first 5 tracks...`);
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
}
