import { Client, SnowflakeUtil, VoiceState, IntentsBitField, User, ChannelType, GuildVoiceChannelResolvable } from 'discord.js';
import { Playlist, Track, GuildQueueEvents, VoiceConnectConfig, GuildNodeCreateOptions, GuildNodeManager, SearchResult } from './Structures';
import { VoiceUtils } from './VoiceInterface/VoiceUtils';
import { PlayerEvents, QueryType, SearchOptions, PlayerInitOptions, PlaylistInitData, SearchQueryType } from './types/types';
import { QueryResolver } from './utils/QueryResolver';
import { Util } from './utils/Util';
import { generateDependencyReport } from '@discordjs/voice';
import { ExtractorExecutionContext } from './extractors/ExtractorExecutionContext';
import { BaseExtractor } from './extractors/BaseExtractor';
import * as _internals from './utils/__internal__';
import { QueryCache } from './utils/QueryCache';
import { PlayerEventsEmitter } from './utils/PlayerEventsEmitter';

const kSingleton = Symbol('InstanceDiscordPlayerSingleton');

export class Player extends PlayerEventsEmitter<PlayerEvents> {
    #lastLatency = -1;
    #voiceStateUpdateListener = this.handleVoiceState.bind(this);
    #lagMonitorTimeout!: NodeJS.Timeout;
    #lagMonitorInterval!: NodeJS.Timer;
    public static _singletonKey = kSingleton;
    public readonly id = SnowflakeUtil.generate().toString();
    public readonly client!: Client;
    public readonly options!: PlayerInitOptions;
    public nodes = new GuildNodeManager(this);
    public readonly voiceUtils = new VoiceUtils();
    public extractors = new ExtractorExecutionContext(this);
    public events = new PlayerEventsEmitter<GuildQueueEvents>(['error', 'playerError']);

    /**
     * Creates new Discord Player
     * @param {Client} client The Discord Client
     * @param {PlayerInitOptions} [options] The player init options
     */
    public constructor(client: Client, options: PlayerInitOptions = {}) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!options.ignoreInstance && kSingleton in Player) return (<any>Player)[kSingleton] as Player;

        super(['error']);

        /**
         * The discord.js client
         * @type {Client}
         */
        this.client = client;

        if (this.client?.options?.intents && !new IntentsBitField(this.client?.options?.intents).has(IntentsBitField.Flags.GuildVoiceStates)) {
            Util.warn('client is missing "GuildVoiceStates" intent', 'InvalidIntentsBitField');
        }

        /**
         * The extractors collection
         * @type {ExtractorModel}
         */
        this.options = {
            autoRegisterExtractor: true,
            lockVoiceStateHandler: false,
            blockExtractors: [],
            blockStreamFrom: [],
            connectionTimeout: 20000,
            smoothVolume: true,
            lagMonitor: 30000,
            queryCache: options.queryCache === null ? null : new QueryCache(this),
            ...options,
            ytdlOptions: {
                highWaterMark: 1 << 25,
                ...options.ytdlOptions
            }
        };

        this.client.on('voiceStateUpdate', this.#voiceStateUpdateListener);

        if (this.options?.autoRegisterExtractor) {
            this.extractors.loadDefault().then((r) => {
                if (r.error) {
                    this.emit('error', new Error(`Failed to load default extractors: ${r.error?.stack ?? r.error}`));
                } else {
                    this.debug('Default extractors loaded!');
                }

                this.debug(`[Dependencies Report]\n${this.scanDeps()}`);
            });
        }

        if (typeof this.options.lagMonitor === 'number' && this.options.lagMonitor > 0) {
            this.#lagMonitorInterval = setInterval(() => {
                const start = performance.now();
                this.#lagMonitorTimeout = setTimeout(() => {
                    this.#lastLatency = performance.now() - start;
                    this.debug(`[Lag Monitor] Event loop latency: ${this.#lastLatency}ms`);
                }, 0).unref();
            }, this.options.lagMonitor).unref();
        }

        _internals.addPlayer(this);

        if (!(kSingleton in Player)) {
            Object.defineProperty(Player, kSingleton, {
                value: this,
                writable: true,
                configurable: true,
                enumerable: false
            });
        }
    }

    public debug(m: string) {
        return this.emit('debug', m);
    }

    /**
     * Creates discord-player singleton instance.
     * @param client The client that instantiated player
     * @param options Player initializer options
     */
    public static singleton(client: Client, options: PlayerInitOptions = {}) {
        return new Player(client, {
            ...options,
            ignoreInstance: false
        });
    }

    /**
     * Get all active player instances
     */
    public static getAllPlayers() {
        return _internals.getPlayers();
    }

    /**
     * Clear all player instances
     */
    public static clearAllPlayers() {
        return _internals.instances.clear();
    }

    /**
     * The current query cache provider
     */
    public get queryCache() {
        return this.options.queryCache ?? null;
    }

    /**
     * Alias to `Player.nodes`
     */
    public get queues() {
        return this.nodes;
    }

    /**
     * Event loop lag
     * @type {number}
     */
    public get eventLoopLag() {
        return this.#lastLatency;
    }

    /**
     * Generates statistics
     */
    public generateStatistics() {
        return {
            instances: _internals.instances.size,
            queuesCount: this.queues.cache.size,
            queryCacheEnabled: this.queryCache != null,
            queues: this.queues.cache.map((m) => m.stats.generate())
        };
    }

    /**
     * Destroy player
     */
    public async destroy() {
        this.nodes.cache.forEach((node) => node.delete());
        this.client.off('voiceStateUpdate', this.#voiceStateUpdateListener);
        this.removeAllListeners();
        this.events.removeAllListeners();
        await this.extractors.unregisterAll();
        if (this.#lagMonitorInterval) clearInterval(this.#lagMonitorInterval);
        if (this.#lagMonitorTimeout) clearInterval(this.#lagMonitorTimeout);
        _internals.clearPlayer(this);
    }

    private _handleVoiceState(oldState: VoiceState, newState: VoiceState) {
        const queue = this.nodes.get(oldState.guild.id);
        if (!queue || !queue.connection || !queue.channel) return;

        // dispatch voice state update
        const wasHandled = this.events.emit('voiceStateUpdate', queue, oldState, newState);
        // if the event was handled, return assuming the listener implemented all of the logic below
        if (wasHandled && !this.options.lockVoiceStateHandler) return;

        if (oldState.channelId && !newState.channelId && newState.member?.id === newState.guild.members.me?.id) {
            try {
                queue.delete();
            } catch {
                /* noop */
            }
            return void this.events.emit('disconnect', queue);
        }

        if (!oldState.channelId && newState.channelId && newState.member?.id === newState.guild.members.me?.id) {
            if (newState.serverMute != null && oldState.serverMute !== newState.serverMute) {
                queue.node.setPaused(newState.serverMute);
            } else if (newState.channel?.type === ChannelType.GuildStageVoice && newState.suppress != null && oldState.suppress !== newState.suppress) {
                queue.node.setPaused(newState.suppress);
                if (newState.suppress) {
                    newState.guild.members.me?.voice.setRequestToSpeak(true).catch(Util.noop);
                }
            }
        }

        if (!newState.channelId && oldState.channelId === queue.channel.id) {
            if (!Util.isVoiceEmpty(queue.channel)) return;
            const timeout = setTimeout(() => {
                if (!Util.isVoiceEmpty(queue.channel!)) return;
                if (!this.nodes.has(queue.guild.id)) return;
                if (queue.options.leaveOnEmpty) queue.delete();
                this.events.emit('emptyChannel', queue);
            }, queue.options.leaveOnEmptyCooldown || 0).unref();
            queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
        }

        if (newState.channelId && newState.channelId === queue.channel.id) {
            const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
            const channelEmpty = Util.isVoiceEmpty(queue.channel);
            if (!channelEmpty && emptyTimeout) {
                clearTimeout(emptyTimeout);
                queue.timeouts.delete(`empty_${oldState.guild.id}`);
            }
        }

        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            if (newState.member?.id === newState.guild.members.me?.id) {
                if (queue.connection && newState.member?.id === newState.guild.members.me?.id) queue.channel = newState.channel!;
                const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
                const channelEmpty = Util.isVoiceEmpty(queue.channel);
                if (!channelEmpty && emptyTimeout) {
                    clearTimeout(emptyTimeout);
                    queue.timeouts.delete(`empty_${oldState.guild.id}`);
                } else {
                    const timeout = setTimeout(() => {
                        if (queue.connection && !Util.isVoiceEmpty(queue.channel!)) return;
                        if (!this.nodes.has(queue.guild.id)) return;
                        if (queue.options.leaveOnEmpty) queue.delete();
                        this.events.emit('emptyChannel', queue);
                    }, queue.options.leaveOnEmptyCooldown || 0).unref();
                    queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
                }
            } else {
                if (newState.channelId !== queue.channel.id) {
                    if (!Util.isVoiceEmpty(queue.channel)) return;
                    if (queue.timeouts.has(`empty_${oldState.guild.id}`)) return;
                    const timeout = setTimeout(() => {
                        if (!Util.isVoiceEmpty(queue.channel!)) return;
                        if (!this.nodes.has(queue.guild.id)) return;
                        if (queue.options.leaveOnEmpty) queue.delete();
                        this.events.emit('emptyChannel', queue);
                    }, queue.options.leaveOnEmptyCooldown || 0).unref();
                    queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
                } else {
                    const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
                    const channelEmpty = Util.isVoiceEmpty(queue.channel!);
                    if (!channelEmpty && emptyTimeout) {
                        clearTimeout(emptyTimeout);
                        queue.timeouts.delete(`empty_${oldState.guild.id}`);
                    }
                }
            }
        }
    }

    /**
     * Handles voice state update
     * @param {VoiceState} oldState The old voice state
     * @param {VoiceState} newState The new voice state
     * @returns {void}
     */
    public handleVoiceState(oldState: VoiceState, newState: VoiceState): void {
        this._handleVoiceState(oldState, newState);
    }

    /**
     * Lock voice state handler
     */
    public lockVoiceStateHandler() {
        this.options.lockVoiceStateHandler = true;
    }

    /**
     * Unlock voice state handler
     */
    public unlockVoiceStateHandler() {
        this.options.lockVoiceStateHandler = false;
    }

    /**
     * Checks if voice state handler is locked
     */
    public isVoiceStateHandlerLocked() {
        return !!this.options.lockVoiceStateHandler;
    }

    /**
     * Initiate audio player
     * @param channel The voice channel on which the music should be played
     * @param query The track or source to play
     * @param options Options for player
     */
    public async play<T = unknown>(
        channel: GuildVoiceChannelResolvable,
        query: string | Track | SearchResult,
        options: SearchOptions & {
            nodeOptions?: GuildNodeCreateOptions<T>;
            connectionOptions?: VoiceConnectConfig;
            afterSearch?: (result: SearchResult) => Promise<SearchResult>;
        } = {}
    ) {
        const vc = this.client.channels.resolve(channel);
        if (!vc?.isVoiceBased()) throw new Error('Expected a voice channel');

        const originalResult = query instanceof SearchResult ? query : await this.search(query, options);

        const result = (await options.afterSearch?.(originalResult)) || originalResult;
        if (result.isEmpty()) {
            throw new Error(`No results found for "${query}" (Extractor: ${result.extractor?.identifier || 'N/A'})`);
        }

        const queue = this.nodes.create(vc.guild, options.nodeOptions);
        if (!queue.channel) await queue.connect(vc, options.connectionOptions);

        if (!result.playlist) {
            queue.addTrack(result.tracks[0]);
        } else {
            queue.addTrack(result.playlist);
        }

        if (!queue.isPlaying()) await queue.node.play();

        return {
            track: result.tracks[0],
            extractor: result.extractor,
            searchResult: result,
            queue
        };
    }

    /**
     * @typedef {object} PlayerSearchResult
     * @property {Playlist} [playlist] The playlist (if any)
     * @property {Track[]} tracks The tracks
     */
    /**
     * Search tracks
     * @param {string|Track} query The search query
     * @param {SearchOptions} options The search options
     * @returns {Promise<SearchResult>}
     */
    public async search(query: string | Track, options: SearchOptions = {}): Promise<SearchResult> {
        if (options.requestedBy != null) options.requestedBy = this.client.users.resolve(options.requestedBy)!;
        options.blockExtractors ??= this.options.blockExtractors;
        if (query instanceof Track) {
            this.debug(`Searching ${query.title}`);
            return new SearchResult(this, {
                playlist: query.playlist || null,
                tracks: [query],
                query: query.toString(),
                extractor: null,
                queryType: query.queryType,
                requestedBy: options.requestedBy
            });
        }

        this.debug(`Searching ${query}`);

        let extractor: BaseExtractor | null = null;

        options.searchEngine ??= QueryType.AUTO;

        this.debug(`Search engine set to ${options.searchEngine}`);

        const queryType = options.searchEngine === QueryType.AUTO ? QueryResolver.resolve(query) : options.searchEngine;

        this.debug(`Query type identified as ${queryType}`);

        // force particular extractor
        if (options.searchEngine.startsWith('ext:')) {
            extractor = this.extractors.get(options.searchEngine.substring(4))!;
            if (!extractor) return new SearchResult(this, { query, queryType });
        }

        // query all extractors
        if (!extractor) {
            // cache validation
            if (!options.ignoreCache) {
                this.debug(`Checking cache...`);
                const res = await this.queryCache?.resolve({
                    query,
                    queryType,
                    requestedBy: options.requestedBy
                });
                // cache hit
                if (res?.hasTracks()) {
                    this.debug(`Cache hit for query ${query}`);
                    return res;
                }

                this.debug(`Cache miss for query ${query}`);
            }

            this.debug(`Executing extractors...`);

            // cache miss
            extractor =
                (
                    await this.extractors.run(async (ext) => {
                        if (options.blockExtractors?.includes(ext.identifier)) return false;
                        return ext.validate(query, queryType as SearchQueryType);
                    })
                )?.extractor || null;
        }

        // no extractors available
        if (!extractor) {
            this.debug('Failed to find appropriate extractor');
            return new SearchResult(this, { query, queryType });
        }

        this.debug(`Executing metadata query using ${extractor.identifier} extractor...`);
        const res = await extractor
            .handle(query, {
                type: queryType as SearchQueryType,
                requestedBy: options.requestedBy as User
            })
            .catch(() => null);

        if (res) {
            this.debug('Metadata query was successful!');
            const result = new SearchResult(this, {
                query,
                queryType,
                playlist: res.playlist,
                tracks: res.tracks,
                extractor
            });

            if (!options.ignoreCache) {
                this.debug(`Adding data to cache...`);
                await this.queryCache?.addData(result);
            }

            return result;
        }

        this.debug('Failed to find result using appropriate extractor. Querying all extractors...');
        const result = await this.extractors.run(
            async (ext) =>
                !options.blockExtractors?.includes(ext.identifier) &&
                (await ext.validate(query)) &&
                ext.handle(query, {
                    type: queryType as SearchQueryType,
                    requestedBy: options.requestedBy as User
                })
        );
        if (!result?.result) {
            this.debug(`Failed to query metadata query using ${result?.extractor.identifier || 'N/A'} extractor.`);
            return new SearchResult(this, { query, queryType });
        }

        this.debug(`Metadata query was successful using ${result.extractor.identifier}!`);

        const data = new SearchResult(this, {
            query,
            queryType,
            playlist: result.result.playlist,
            tracks: result.result.tracks,
            extractor: result.extractor
        });

        if (!options.ignoreCache) {
            this.debug(`Adding data to cache...`);
            await this.queryCache?.addData(data);
        }

        return data;
    }

    /**
     * Generates a report of the dependencies used by the `@discordjs/voice` module. Useful for debugging.
     * @returns {string}
     */
    public scanDeps() {
        const line = '-'.repeat(50);
        const depsReport = generateDependencyReport();
        const extractorReport = this.extractors.store
            .map((m) => {
                return m.identifier;
            })
            .join('\n');
        return `${depsReport}\nLoaded Extractors:\n${extractorReport || 'None'}\n${line}`;
    }

    public *[Symbol.iterator]() {
        yield* this.nodes.cache.values();
    }

    /**
     * Creates `Playlist` instance
     * @param data The data to initialize a playlist
     */
    public createPlaylist(data: PlaylistInitData) {
        return new Playlist(this, data);
    }
}
