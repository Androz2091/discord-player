import { Player } from '../../Player';
import { ChannelType, Guild, GuildVoiceChannelResolvable } from 'discord.js';
import { EventEmitter, Queue, QueueStrategy } from '@discord-player/utils';
import { BiquadFilters, EqualizerBand, PCMFilters } from '@discord-player/equalizer';
import Track from '../Track';
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

export interface GuildNodeInit {
    guild: Guild;
    queueStrategy: QueueStrategy;
    equalizer: EqualizerBand[] | boolean;
    volume: number | boolean;
    biquad: BiquadFilters | boolean | undefined;
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
}

export interface VoiceConnectConfig {
    deaf?: boolean;
    timeout?: number;
}

export type OnBeforeCreateStreamHandler = (track: Track, queryType: SearchQueryType, queue: GuildQueue) => Promise<Readable | null>;

export interface GuildQueueEvents {
    audioTrackAdd: (track: Track) => unknown;
    audioTracksAdd: (track: Track[]) => unknown;
    audioPlaylistAdd: (playlist: Playlist) => unknown;
    connection: () => unknown;
    disconnect: () => unknown;
    debug: (message: string) => unknown;
    error: (error: Error) => unknown;
    emptyChannel: () => unknown;
    emptyQueue: () => unknown;
    playerStart: (track: Track) => unknown;
    playerError: (error: Error, track: Track) => unknown;
    playerFinish: (track: Track) => unknown;
    playerPause: (track: Track) => unknown;
    playerResume: (track: Track) => unknown;
    playerSkip: (track: Track) => unknown;
}

export class GuildQueue extends EventEmitter<GuildQueueEvents> {
    #transitioning = false;
    private __current: Track | null = null;
    public tracks: Queue<Track>;
    public history = new GuildQueueHistory(this);
    public dispatcher: StreamDispatcher | null = null;
    public node = new GuildQueuePlayerNode(this);
    public filters = new GuildQueueAudioFilters(this);
    public onBeforeCreateStream: OnBeforeCreateStreamHandler = async () => null;
    public repeatMode = QueueRepeatMode.OFF;

    public constructor(public player: Player, public options: GuildNodeInit) {
        super();
        this.tracks = new Queue<Track>(options.queueStrategy);
        if (typeof options.onBeforeCreateStream === 'function') this.onBeforeCreateStream = options.onBeforeCreateStream;
        if (options.repeatMode != null) this.repeatMode = options.repeatMode;
    }

    public get currentTrack() {
        return this.dispatcher?.audioResource?.metadata || this.__current;
    }

    public get channel() {
        return this.dispatcher?.channel || null;
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
        this.#transitioning = state;
    }

    public isTransitioning() {
        return this.#transitioning;
    }

    public isEmpty() {
        return this.tracks.size < 1;
    }

    public isPlaying() {
        return this.dispatcher?.audioResource != null;
    }

    public addTrack(track: Track | Track[] | Playlist) {
        const toAdd = track instanceof Playlist ? track.tracks : track;
        this.tracks.add(toAdd);
        const isMulti = Array.isArray(toAdd);

        if (isMulti) {
            this.emit('audioTracksAdd', toAdd);
        } else {
            this.emit('audioTrackAdd', toAdd);
        }
    }

    public async connect(channelResolvable: GuildVoiceChannelResolvable, options?: VoiceConnectConfig) {
        const channel = this.player.client.channels.resolve(channelResolvable);
        if (!channel || !channel.isVoiceBased()) {
            throw new Error(`Expected a voice based channel (type ${ChannelType.GuildVoice}/${ChannelType.GuildStageVoice}), received ${channel?.type}`);
        }
        if (this.dispatcher) {
            this.#removeListeners(this.dispatcher);
            this.dispatcher.disconnect();
        }

        this.dispatcher = await this.player.voiceUtils.connect(channel, {
            deaf: Boolean(options?.deaf),
            maxTime: options?.timeout ?? this.player.options.connectionTimeout ?? 120_000
        });

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
        this.player.nodes.delete(this.id);
    }

    #attachListeners(dispatcher: StreamDispatcher) {
        dispatcher.on('error', (e) => this.emit('error', e));
        dispatcher.on('debug', (m) => this.emit('debug', m));
        dispatcher.on('finish', (r) => this.#performFinish(r));
        dispatcher.on('start', (r) => this.#performStart(r));
    }

    #removeListeners(dispatcher: StreamDispatcher) {
        dispatcher.removeAllListeners();
    }

    #performStart(resource?: AudioResource<Track>) {
        const track = resource?.metadata || this.currentTrack;
        if (track && !this.isTransitioning()) this.emit('playerStart', track);
        this.setTransitioning(false);
    }

    #performFinish(resource?: AudioResource<Track>) {
        const track = resource?.metadata || this.currentTrack;
        if (track && !this.isTransitioning()) {
            this.history.push(track);
            this.node.resetProgress();
            this.emit('playerFinish', track);
            if (this.tracks.size < 1 && this.repeatMode === QueueRepeatMode.OFF) {
                this.__current = null;
                this.emit('emptyQueue');
                if (this.options.leaveOnEnd) {
                    const tm: NodeJS.Timeout = setTimeout(() => {
                        if (this.tracks.size) return clearTimeout(tm);
                        this.dispatcher?.disconnect();
                    }, this.options.leaveOnEndCooldown).unref();
                }
            } else {
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
}
