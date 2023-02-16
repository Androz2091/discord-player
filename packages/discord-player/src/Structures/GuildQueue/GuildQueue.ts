import { Player } from '../../Player';
import { ChannelType, Guild, GuildVoiceChannelResolvable, VoiceBasedChannel, VoiceState } from 'discord.js';
import { Collection, Queue, QueueStrategy } from '@discord-player/utils';
import { BiquadFilters, EqualizerBand, PCMFilters } from '@discord-player/equalizer';
import { Track } from '../Track';
import { StreamDispatcher } from '../../VoiceInterface/StreamDispatcher';
import { AudioResource } from '@discordjs/voice';
import { Util } from '../../utils/Util';
import { Playlist } from '../Playlist';
import { GuildQueueHistory } from './GuildQueueHistory';
import { GuildQueuePlayerNode } from './GuildQueuePlayerNode';
import { GuildQueueAudioFilters } from './GuildQueueAudioFilters';
import { Readable } from 'stream';
import { QueueRepeatMode, SearchQueryType } from '../../types/types';
import { setTimeout } from 'timers';
import { YouTube } from 'youtube-sr';

export interface GuildNodeInit<Meta = unknown> {
    guild: Guild;
    queueStrategy: QueueStrategy;
    equalizer: EqualizerBand[] | boolean;
    volume: number | boolean;
    biquad: BiquadFilters | boolean | undefined;
    resampler: number | boolean;
    filterer: PCMFilters[] | boolean;
    disableHistory: boolean;
    skipOnNoStream: boolean;
    onBeforeCreateStream?: OnBeforeCreateStreamHandler;
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
}

export interface VoiceConnectConfig {
    deaf?: boolean;
    timeout?: number;
}

export type OnBeforeCreateStreamHandler = (track: Track, queryType: SearchQueryType, queue: GuildQueue) => Promise<Readable | null>;

export type PlayerTriggeredReason = 'filters' | 'normal';

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
     * Emitted when the voice state is updated.
     * Consuming this event may disable default voice state update handler if `Player.isVoiceStateHandlerLocked()` returns `false`.
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
    public repeatMode = QueueRepeatMode.OFF;
    public timeouts = new Collection<string, NodeJS.Timeout>();

    public constructor(public player: Player, public options: GuildNodeInit<Meta>) {
        this.tracks = new Queue<Track>(options.queueStrategy);
        if (typeof options.onBeforeCreateStream === 'function') this.onBeforeCreateStream = options.onBeforeCreateStream;
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
        this.debug(`GuildQueue initialized for guild ${this.options.guild.name} (ID: ${this.options.guild.id})`);
    }

    public debug(m: string) {
        this.player.events.emit('debug', this, m);
    }

    public get metadata() {
        return this.options.metadata;
    }

    public set metadata(m: Meta | undefined | null) {
        this.options.metadata = m;
    }

    public setMetadata(m: Meta | undefined | null) {
        this.#warnIfDeleted();
        this.options.metadata = m;
    }

    public get initializing() {
        return this.#initializing;
    }

    public set initializing(v: boolean) {
        this.#initializing = v;
        if (v) this.#resolveInitializerAwaiters();
    }

    public get currentTrack() {
        return this.dispatcher?.audioResource?.metadata || this.__current;
    }

    public get deleted() {
        return this.#deleted;
    }

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

    public get connection() {
        return this.dispatcher?.voiceConnection || null;
    }

    public get guild() {
        return this.options.guild;
    }

    public get id() {
        return this.guild.id;
    }

    public setTransitioning(state: boolean) {
        this.#warnIfDeleted();
        this.#transitioning = state;
    }

    public isTransitioning() {
        return this.#transitioning;
    }

    public setRepeatMode(mode: QueueRepeatMode) {
        this.#warnIfDeleted();
        this.repeatMode = mode;
    }

    public isEmpty() {
        this.#warnIfDeleted();
        return this.tracks.size < 1;
    }

    public isPlaying() {
        this.#warnIfDeleted();
        return this.dispatcher?.audioResource != null;
    }

    public addTrack(track: Track | Track[] | Playlist) {
        this.#warnIfDeleted();
        const toAdd = track instanceof Playlist ? track.tracks : track;
        this.tracks.add(toAdd);
        const isMulti = Array.isArray(toAdd);

        if (isMulti) {
            this.player.events.emit('audioTrackAdd', this, toAdd[0]);
            this.player.events.emit('audioTracksAdd', this, toAdd);
        } else {
            this.player.events.emit('audioTrackAdd', this, toAdd);
        }
    }

    public async connect(channelResolvable: GuildVoiceChannelResolvable, options: VoiceConnectConfig = {}) {
        this.#warnIfDeleted();
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
            maxTime: options?.timeout ?? this.options.connectionTimeout ?? 120_000
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

    public get ping() {
        return this.connection?.ping.udp ?? -1;
    }

    public delete() {
        if (this.player.nodes.delete(this.id)) {
            this.#deleted = true;
        }
    }

    public awaitInitialization() {
        return new Promise<boolean>((r) => {
            if (!this.#initializing) return r(true);
            this.#initializingPromises.push(r);
        });
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
        this.player.events.emit('playerTrigger', this, track!, this.isTransitioning() ? 'filters' : 'normal');
        if (track && !this.isTransitioning()) this.player.events.emit('playerStart', this, track);
        this.setTransitioning(false);
        this.initializing = false;
    }

    #performFinish(resource?: AudioResource<Track>) {
        const track = resource?.metadata || this.currentTrack;
        if (track && !this.isTransitioning()) {
            this.history.push(track);
            this.node.resetProgress();
            this.player.events.emit('playerFinish', this, track);
            if (this.tracks.size < 1 && this.repeatMode === QueueRepeatMode.OFF) {
                this.#emitEnd();
            } else {
                if (this.repeatMode === QueueRepeatMode.AUTOPLAY) {
                    this.#handleAutoplay(track);
                    return;
                }
                if (this.repeatMode === QueueRepeatMode.TRACK) {
                    this.__current = this.history.tracks.dispatch() || track;
                    return this.node.play(this.__current);
                }
                if (this.repeatMode === QueueRepeatMode.QUEUE) this.tracks.add(this.history.tracks.dispatch() || track);
                this.__current = this.tracks.dispatch()!;
                this.node.play(this.__current, {
                    queue: false
                });
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
        let info = await YouTube.getVideo(track.url)
            .then((x) => x.videos![0])
            .catch(Util.noop);

        // fallback
        if (!info)
            info = await YouTube.search(track.author)
                .then((x) => x[0])
                .catch(Util.noop);

        if (!info) {
            return this.#emitEnd();
        }

        const nextTrack = new Track(this.player, {
            title: info.title!,
            url: `https://www.youtube.com/watch?v=${info.id}`,
            duration: info.durationFormatted || Util.buildTimeCode(Util.parseMS(info.duration * 1000)),
            description: info.title!,
            thumbnail: typeof info.thumbnail === 'string' ? info.thumbnail! : info.thumbnail!.url!,
            views: info.views,
            author: info.channel!.name!,
            requestedBy: track.requestedBy,
            source: 'youtube',
            queryType: 'youtubeVideo'
        });

        this.node.play(nextTrack, {
            queue: false,
            seek: 0,
            transitionMode: false
        });
    }

    #resolveInitializerAwaiters() {
        this.#initializingPromises.forEach((p) => {
            p(!this.#initializing);
        });

        this.#initializingPromises = [];
    }

    #warnIfDeleted() {
        if (!this.deleted) return;
        Util.warn('Deleted queue usage detected! Please remove references to deleted queues in order to prevent memory leaks.', 'DiscordPlayerWarning');
    }
}
