import { FFmpeg } from '@discord-player/ffmpeg';
import { type Snowflake } from 'discord-api-types/globals';
import { GatewayVoiceState } from 'discord-api-types/v10';
import { version as dVoiceVersion, generateDependencyReport } from 'discord-voip';
import { createClientAdapter } from './clientadapter/ClientAdapterFactory';
import { IClientAdapter } from './clientadapter/IClientAdapter';
import { defaultVoiceStateHandler } from './DefaultVoiceStateHandler';
import { Exceptions } from './errors';
import { BaseExtractor } from './extractors/BaseExtractor';
import { ExtractorExecutionContext } from './extractors/ExtractorExecutionContext';
import { Playlist, SearchResult, Track } from './fabric';
import { Context, createContext } from './hooks';
import { HooksCtx } from './hooks/common';
import { LrcLib } from './lrclib/LrcLib';
import { GuildNodeCreateOptions, GuildNodeManager, GuildQueue, GuildQueueEvent, GuildQueueEvents, ResourcePlayOptions, VoiceConnectConfig } from './queue';
import { PlayerEvent, PlayerEvents, PlayerInitOptions, PlaylistInitData, QueryType, SearchOptions, SearchQueryType } from './types/types';
import * as _internals from './utils/__internal__';
import { IPRotator } from './utils/IPRotator';
import { PlayerEventsEmitter } from './utils/PlayerEventsEmitter';
import { QueryCache } from './utils/QueryCache';
import { QueryResolver, ResolvedQuery } from './utils/QueryResolver';
import { generateRandomId } from './utils/Util';
import { VoiceUtils } from './VoiceInterface/VoiceUtils';

const kSingleton = Symbol('InstanceDiscordPlayerSingleton');

export interface PlayerNodeInitializationResult<T = unknown> {
    track: Track;
    extractor: BaseExtractor | null;
    searchResult: SearchResult;
    queue: GuildQueue<T>;
}

export type TrackLike = string | Track | SearchResult | Track[] | Playlist;

export interface PlayerNodeInitializerOptions<T> extends SearchOptions {
    nodeOptions?: GuildNodeCreateOptions<T>;
    connectionOptions?: VoiceConnectConfig;
    audioPlayerOptions?: ResourcePlayOptions;
    signal?: AbortSignal;
    afterSearch?: (result: SearchResult) => Promise<SearchResult>;
}

export type VoiceStateHandler = (player: Player, queue: GuildQueue, oldVoiceState: GatewayVoiceState, newVoiceState: GatewayVoiceState) => Awaited<void>;

export class Player extends PlayerEventsEmitter<PlayerEvents> {
    #lastLatency = -1;
    #voiceStateUpdateListener = this.handleVoiceState.bind(this);
    #lagMonitorTimeout!: NodeJS.Timeout;
    #lagMonitorInterval!: NodeJS.Timeout;
    #onVoiceStateUpdate: VoiceStateHandler = defaultVoiceStateHandler;
    #hooksCtx: Context<HooksCtx> | null = null;
    /**
     * The version of discord-player
     */
    public static readonly version: string = '[VI]{{inject}}[/VI]';
    public static _singletonKey = kSingleton;
    /**
     * The unique identifier of this player instance
     */
    public readonly id = generateRandomId();
    /**
     * The client adapter for the Discord API client used (e.g. discord.js, Eris)
     */
    public clientAdapter!: IClientAdapter;
    /**
     * The player options
     */
    public readonly options!: PlayerInitOptions;
    /**
     * The player nodes (queue) manager
     */
    public nodes = new GuildNodeManager(this);
    /**
     * The voice api utilities
     */
    public readonly voiceUtils = new VoiceUtils(this);
    /**
     * The extractors manager
     */
    public extractors = new ExtractorExecutionContext(this);
    /**
     * The player events channel
     */
    public events = new PlayerEventsEmitter<GuildQueueEvents>([GuildQueueEvent.Error, GuildQueueEvent.PlayerError]);
    /**
     * The route planner
     */
    public routePlanner: IPRotator | null = null;
    /**
     * The player version
     */
    public readonly version = Player.version;
    /**
     * The lyrics api
     */
    public readonly lyrics = new LrcLib(this);

    /**
     * Creates new Discord Player
     * @param {unknown} client The Discord API Client (e.g. discord.js, Eris)
     * @param {PlayerInitOptions} [options] The player init options
     */
    public constructor(client: unknown, options: PlayerInitOptions = {}) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!options.ignoreInstance && kSingleton in Player) return (<any>Player)[kSingleton] as Player;

        super([PlayerEvent.Error]);

        if (options.ffmpegPath) {
            if (typeof options.ffmpegPath !== 'string') throw new TypeError(`Expected type "string" for options.ffmpegPath. Got ${typeof options.ffmpegPath} instead`);

            process.env.FFMPEG_PATH = options.ffmpegPath;
        }

        this.options = {
            lockVoiceStateHandler: false,
            blockExtractors: [],
            blockStreamFrom: [],
            connectionTimeout: 20000,
            lagMonitor: 30000,
            queryCache: options.queryCache === null ? null : options.queryCache || new QueryCache(this),
            useLegacyFFmpeg: false,
            skipFFmpeg: true,
            probeTimeout: 5000,
            ...options,
            ytdlOptions: {
                highWaterMark: 1 << 25,
                ...options.ytdlOptions
            }
        } as PlayerInitOptions;

        if (typeof this.options.lagMonitor === 'number' && this.options.lagMonitor > 0) {
            this.#lagMonitorInterval = setInterval(() => {
                const start = performance.now();
                this.#lagMonitorTimeout = setTimeout(() => {
                    this.#lastLatency = performance.now() - start;
                    if (this.hasDebugger) this.debug(`[Lag Monitor] Event loop latency: ${this.#lastLatency}ms`);
                }, 0).unref();
            }, this.options.lagMonitor).unref();
        }

        if (this.options.ipconfig) {
            this.routePlanner = new IPRotator(this.options.ipconfig);
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

        this.createAdapter(client);
    }

    private createAdapter(client: unknown) {
        (async () => {
            this.clientAdapter = await createClientAdapter(client);
            this.clientAdapter.validateIntents();
            this.clientAdapter.incrementMaxListeners();
            this.clientAdapter.addVoiceStateUpdateListener(this.#voiceStateUpdateListener);
        })();
    }

    /**
     * The hooks context for this player instance.
     */
    public get context() {
        if (!this.#hooksCtx) {
            this.#hooksCtx = createContext();
        }

        return this.#hooksCtx;
    }

    /**
     * Override default voice state update handler
     * @param handler The handler callback
     */
    public onVoiceStateUpdate(handler: VoiceStateHandler) {
        this.#onVoiceStateUpdate = handler;
    }

    public debug(m: string) {
        return this.emit('debug', m);
    }

    /**
     * Creates discord-player singleton instance.
     * @param client The client that instantiated player
     * @param options Player initializer options
     */
    public static singleton(client: unknown, options: Omit<PlayerInitOptions, 'ignoreInstance'> = {}) {
        return new Player(client, {
            ...options,
            ignoreInstance: false
        });
    }

    /**
     * Creates new discord-player instance.
     * @param client The client that instantiated player
     * @param options Player initializer options
     */
    public static create(client: unknown, options: Omit<PlayerInitOptions, 'ignoreInstance'> = {}) {
        return new Player(client, {
            ...options,
            ignoreInstance: true
        });
    }

    /**
     * Get all active master player instances
     */
    public static getAllPlayers() {
        return _internals.getPlayers();
    }

    /**
     * Clear all master player instances
     */
    public static clearAllPlayers() {
        return _internals.instances.clear();
    }

    /**
     * The current query cache provider in use
     */
    public get queryCache() {
        return this.options.queryCache ?? null;
    }

    /**
     * Alias to `Player.nodes`.
     */
    public get queues() {
        return this.nodes;
    }

    /**
     * Event loop latency in ms. If your bot is laggy and this returns a number above 20ms for example,
     * some expensive task is being executed on the current thread which is slowing down the event loop.
     * @type {number}
     */
    public get eventLoopLag() {
        return this.#lastLatency;
    }

    /**
     * Generates statistics that could be useful. Statistics generator is still experimental.
     * @example ```typescript
     * const stats = player.generateStatistics();
     *
     * console.log(stats);
     *
     * // outputs something like
     * // {
     * //   instances: number,
     * //   queuesCount: number,
     * //   queryCacheEnabled: boolean,
     * //   queues: [
     * //      GuildQueueStatisticsMetadata,
     * //      GuildQueueStatisticsMetadata,
     * //      GuildQueueStatisticsMetadata,
     * //      ...
     * //   ]
     * // }
     * ```
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
     * Destroy every single queues managed by this master player instance
     * @example ```typescript
     * // use me when you want to immediately terminate every single queues in existence 🔪
     * await player.destroy();
     * ```
     */
    public async destroy() {
        this.nodes.cache.forEach((node) => node.delete());

        this.clientAdapter.removeVoiceStateUpdateListener(this.#voiceStateUpdateListener);
        this.clientAdapter.decrementMaxListeners();

        this.removeAllListeners();
        this.events.removeAllListeners();
        await this.extractors.unregisterAll();
        if (this.#lagMonitorInterval) clearInterval(this.#lagMonitorInterval);
        if (this.#lagMonitorTimeout) clearInterval(this.#lagMonitorTimeout);
        _internals.clearPlayer(this);
    }

    private _handleVoiceState(oldState: GatewayVoiceState, newState: GatewayVoiceState) {
        if (!newState.guild_id) return;
        const queue = this.nodes.get(newState.guild_id);
        if (!queue || !queue.connection || !queue.channel) return;

        // dispatch voice state update
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wasHandled = this.events.emit(GuildQueueEvent.voiceStateUpdate, queue, oldState as any, newState as any);
        // if the event was handled, return assuming the listener implemented all of the logic below
        if (wasHandled && !this.options.lockVoiceStateHandler) return;

        return this.#onVoiceStateUpdate(this, queue, oldState, newState);
    }

    /**
     * Handles voice state update
     * @param {VoiceState} oldState The old voice state
     * @param {VoiceState} newState The new voice state
     * @returns {void}
     * @example ```typescript
     * // passing voice state update data to this method will trigger voice state handler
     *
     * client.on('voiceStateUpdate', (oldState, newState) => {
     *   // this is definitely a rocket science, right here
     *   player.handleVoiceState(oldState, newState);
     * });
     * ```
     */
    public handleVoiceState(oldState: GatewayVoiceState, newState: GatewayVoiceState): void {
        this._handleVoiceState(oldState, newState);
    }

    /**
     * Lock voice state handler. When this method is called, discord-player will keep using the default voice state update handler, even if custom implementation exists.
     */
    public lockVoiceStateHandler() {
        this.options.lockVoiceStateHandler = true;
    }

    /**
     * Unlock voice state handler. When this method is called, discord-player will stop using the default voice state update handler if custom implementation exists.
     */
    public unlockVoiceStateHandler() {
        this.options.lockVoiceStateHandler = false;
    }

    /**
     * Checks if voice state handler is locked.
     */
    public isVoiceStateHandlerLocked() {
        return !!this.options.lockVoiceStateHandler;
    }

    /**
     * Initiate audio player
     * @param channel The voice channel on which the music should be played
     * @param query The track or source to play
     * @param options Options for player
     * @example ```typescript
     * // no need to worry about queue management, just use this method 😄
     * const query = 'this is my super cool search query that I want to play';
     *
     * try {
     *    const { track } = await player.play(voiceChannel, query);
     *   console.log(`🎉 I am playing ${track.title} 🎉`);
     * } catch(e) {
     *   console.log(`😭 Failed to play error oh no:\n\n${e}`);
     * }
     * ```
     */
    public async play<T = unknown>(channelId: Snowflake, query: TrackLike, options: PlayerNodeInitializerOptions<T> = {}): Promise<PlayerNodeInitializationResult<T>> {
        const channel = this.clientAdapter.getChannel(channelId);
        if (!channel?.isVoiceBased()) throw Exceptions.ERR_INVALID_ARG_TYPE('channel', 'VoiceBasedChannel', !channel ? 'undefined' : `channel type ${channel.type}`);

        const originalResult = query instanceof SearchResult ? query : await this.search(query, options);
        const result = (await options.afterSearch?.(originalResult)) || originalResult;
        if (result.isEmpty()) {
            throw Exceptions.ERR_NO_RESULT(`No results found for "${query}" (Extractor: ${result.extractor?.identifier || 'N/A'})`);
        }

        const queue = this.nodes.create(channel.guild.id, options.nodeOptions);

        if (this.hasDebugger) this.debug(`[AsyncQueue] Acquiring an entry...`);
        const entry = queue.tasksQueue.acquire({ signal: options.signal });
        if (this.hasDebugger) this.debug(`[AsyncQueue] Entry ${entry.id} was acquired successfully!`);

        if (this.hasDebugger) this.debug(`[AsyncQueue] Waiting for the queue to resolve...`);
        await entry.getTask();
        if (this.hasDebugger) this.debug(`[AsyncQueue] Entry ${entry.id} was resolved!`);

        try {
            if (!queue.channel) await queue.connect(channel.id, options.connectionOptions);

            if (!result.playlist) {
                queue.addTrack(result.tracks[0]);
            } else {
                queue.addTrack(result.playlist);
            }
            if (!queue.isPlaying()) await queue.node.play(null, options.audioPlayerOptions);
        } finally {
            if (this.hasDebugger) this.debug(`[AsyncQueue] Releasing an entry from the queue...`);
            queue.tasksQueue.release();
        }

        return {
            track: result.tracks[0],
            extractor: result.extractor,
            searchResult: result,
            queue
        };
    }

    /**
     * Search tracks
     * @param {string | Track | Track[] | Playlist | SearchResult} query The search query
     * @param {SearchOptions} options The search options
     * @returns {Promise<SearchResult>}
     * @example ```typescript
     * const searchQuery = 'pass url or text or discord-player track constructable objects, we got you covered 😎';
     * const result = await player.search(searchQuery);
     *
     * console.log(result); // Logs `SearchResult` object
     * ```
     */
    public async search(searchQuery: string | Track | Track[] | Playlist | SearchResult, options: SearchOptions = {}): Promise<SearchResult> {
        if (searchQuery instanceof SearchResult) return searchQuery;

        if (options.requestedBy != null) options.requestedBy = this.clientAdapter.getUser(options.requestedBy.id)!;
        options.blockExtractors ??= this.options.blockExtractors;
        options.fallbackSearchEngine ??= QueryType.AUTO_SEARCH;

        if (searchQuery instanceof Track) {
            return new SearchResult(this, {
                playlist: searchQuery.playlist || null,
                tracks: [searchQuery],
                query: searchQuery.title,
                extractor: searchQuery.extractor,
                queryType: searchQuery.queryType,
                requestedBy: options.requestedBy
            });
        }

        if (searchQuery instanceof Playlist) {
            return new SearchResult(this, {
                playlist: searchQuery,
                tracks: searchQuery.tracks,
                query: searchQuery.title,
                extractor: searchQuery.tracks[0]?.extractor,
                queryType: QueryType.AUTO,
                requestedBy: options.requestedBy
            });
        }

        if (Array.isArray(searchQuery)) {
            const tracks = searchQuery.filter((t) => t instanceof Track);
            return new SearchResult(this, {
                playlist: null,
                tracks,
                query: '@@#%{{UserLoadedContent}}%#@@',
                extractor: null,
                queryType: QueryType.AUTO,
                requestedBy: options.requestedBy
            });
        }

        if (this.hasDebugger) this.debug(`Searching ${searchQuery}`);

        let extractor: BaseExtractor | null = null,
            protocol: string | null = null;

        options.searchEngine ??= QueryType.AUTO;
        options.fallbackSearchEngine ??= QueryType.AUTO_SEARCH;

        if (this.hasDebugger) this.debug(`Search engine set to ${options.searchEngine}, fallback search engine set to ${options.fallbackSearchEngine}`);

        if (/^\w+:/.test(searchQuery)) {
            const [protocolName, ...query] = searchQuery.split(':');
            if (this.hasDebugger) this.debug(`Protocol ${protocolName} detected in query`);

            const matchingExtractor = this.extractors.store.find((e) => !this.extractors.isDisabled(e.identifier) && e.protocols.includes(protocolName));

            if (matchingExtractor) {
                if (this.hasDebugger) this.debug(`Protocol ${protocolName} is supported by ${matchingExtractor.identifier} extractor!`);
                extractor = matchingExtractor;
                searchQuery = query.join(':');
                protocol = protocolName;
            } else {
                if (this.hasDebugger) this.debug(`Could not find an extractor that supports ${protocolName} protocol. Falling back to default behavior...`);
            }
        }

        const redirected = await QueryResolver.preResolve(searchQuery);
        const { type: queryType, query } =
            options.searchEngine === QueryType.AUTO ? QueryResolver.resolve(redirected, options.fallbackSearchEngine) : ({ type: options.searchEngine, query: redirected } as ResolvedQuery);

        if (this.hasDebugger) this.debug(`Query type identified as ${queryType}${extractor && protocol ? ' but might not be used due to the presence of protocol' : ''}`);

        // force particular extractor
        if (options.searchEngine.startsWith('ext:')) {
            if (this.hasDebugger) this.debug(`Forcing ${options.searchEngine.substring(4)} extractor...`);
            extractor = this.extractors.get(options.searchEngine.substring(4))!;
            if (!extractor)
                return new SearchResult(this, {
                    query,
                    queryType,
                    extractor,
                    requestedBy: options.requestedBy
                });
        }

        // query all extractors
        if (!extractor) {
            // cache validation
            if (!options.ignoreCache) {
                if (this.hasDebugger) this.debug(`Checking cache...`);
                const res = await this.queryCache?.resolve({
                    query,
                    queryType,
                    requestedBy: options.requestedBy
                });
                // cache hit
                if (res?.hasTracks()) {
                    if (this.hasDebugger) this.debug(`Cache hit for query ${query}`);
                    return res;
                }

                if (this.hasDebugger) this.debug(`Cache miss for query ${query}`);
            }

            if (this.hasDebugger) this.debug(`Executing extractors...`);

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
            if (this.hasDebugger) this.debug('Failed to find appropriate extractor');
            return new SearchResult(this, {
                query,
                queryType,
                requestedBy: options.requestedBy
            });
        }

        if (this.hasDebugger) this.debug(`Executing metadata query using ${extractor.identifier} extractor...`);
        const res = await extractor
            .handle(query, {
                type: queryType as SearchQueryType,
                requestedBy: options.requestedBy,
                requestOptions: options.requestOptions,
                protocol
            })
            .catch(() => null);

        if (res) {
            if (this.hasDebugger) this.debug('Metadata query was successful!');
            const result = new SearchResult(this, {
                query,
                queryType,
                playlist: res.playlist,
                tracks: res.tracks,
                extractor,
                requestedBy: options.requestedBy
            });

            if (!options.ignoreCache) {
                if (this.hasDebugger) this.debug(`Adding data to cache...`);
                await this.queryCache?.addData(result);
            }

            return result;
        }

        if (this.hasDebugger) this.debug('Failed to find result using appropriate extractor. Querying all extractors...');
        const result = await this.extractors.run(
            async (ext) =>
                !options.blockExtractors?.includes(ext.identifier) &&
                (await ext.validate(query)) &&
                ext.handle(query, {
                    type: queryType as SearchQueryType,
                    requestedBy: options.requestedBy,
                    requestOptions: options.requestOptions,
                    protocol
                })
        );
        if (!result?.result) {
            if (this.hasDebugger) this.debug(`Failed to query metadata query using ${result?.extractor.identifier || 'N/A'} extractor.`);
            return new SearchResult(this, {
                query,
                queryType,
                requestedBy: options.requestedBy,
                extractor: result?.extractor
            });
        }

        if (this.hasDebugger) this.debug(`Metadata query was successful using ${result.extractor.identifier}!`);

        const data = new SearchResult(this, {
            query,
            queryType,
            playlist: result.result.playlist,
            tracks: result.result.tracks,
            extractor: result.extractor,
            requestedBy: options.requestedBy
        });

        if (!options.ignoreCache) {
            if (this.hasDebugger) this.debug(`Adding data to cache...`);
            await this.queryCache?.addData(data);
        }

        return data;
    }

    /**
     * Generates a report of the dependencies used by the `discord-voip` module. Useful for debugging.
     * @example ```typescript
     * console.log(player.scanDeps());
     * // -> logs dependencies report
     * ```
     * @returns {string}
     */
    public scanDeps() {
        const line = '-'.repeat(50);
        const runtime = 'Bun' in globalThis ? 'Bun' : 'Deno' in globalThis ? 'Deno' : 'Node';
        const clientName = this.clientAdapter.getClientName();
        const clientVersion = this.clientAdapter.getClientVersion();
        const depsReport = [
            'Discord Player',
            line,
            `- discord-player: ${Player.version}`,
            `- discord-voip: ${dVoiceVersion}`,
            `- ${clientName}: ${clientVersion}`,
            `- Node version: ${process.version} (Detected Runtime: ${runtime}, Platform: ${process.platform} [${process.arch}])`,
            (() => {
                if (this.options.useLegacyFFmpeg) return '- ffmpeg: N/A (using legacy ffmpeg)';
                const info = FFmpeg.locateSafe();
                if (!info) return 'FFmpeg/Avconv not found';

                return [`- ffmpeg: ${info.version}`, `- command: ${info.command}`, `- static: ${info.isStatic}`, `- libopus: ${info.metadata!.includes('--enable-libopus')}`].join('\n');
            })(),
            '\n',
            'Loaded Extractors:',
            line,
            this.extractors.store
                .map((m) => {
                    return m.identifier;
                })
                .join('\n') || 'N/A',
            '\n\ndiscord-voip',
            generateDependencyReport()
        ];

        return depsReport.join('\n');
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
