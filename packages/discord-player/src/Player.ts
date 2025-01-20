import { FFmpeg } from '@discord-player/ffmpeg';
import {
  Client,
  SnowflakeUtil,
  VoiceState,
  IntentsBitField,
  User,
  GuildVoiceChannelResolvable,
  version as djsVersion,
  Events,
} from 'discord.js';
import {
  Playlist,
  Track,
  SearchResult,
  SearchOptions,
  PlaylistInitData,
} from './fabric';
import {
  GuildQueueEvents,
  VoiceConnectConfig,
  GuildNodeCreateOptions,
  GuildNodeManager,
  GuildQueue,
  ResourcePlayOptions,
  GuildQueueEvent,
} from './queue';
import { VoiceUtils } from './stream/VoiceUtils';
import {
  QueryResolver,
  QueryType,
  ResolvedQuery,
  SearchQueryType,
} from './utils/QueryResolver';
import { Util } from './utils/Util';
import {
  AudioResource,
  version as dVoiceVersion,
  StreamType,
} from 'discord-voip';
import { ExtractorExecutionContext } from './extractors/ExtractorExecutionContext';
import { BaseExtractor } from './extractors/BaseExtractor';
import { QueryCache, QueryCacheProvider } from './utils/QueryCache';
import { PlayerEventsEmitter } from './utils/PlayerEventsEmitter';
import { InvalidArgTypeError, NoResultError } from './errors';
import { defaultVoiceStateHandler } from './DefaultVoiceStateHandler';
import { Context, createContext } from './hooks';
import { HooksCtx, SUPER_CONTEXT } from './hooks/common';
import { LrcLib } from './lrclib/LrcLib';
import { getCompatName, isClientProxy } from './compat/common';
import { DependencyReportGenerator } from './utils/DependencyReportGenerator';
import { getGlobalRegistry } from './utils/__internal__';
import { version as dpVersion } from './version';
import {
  PlayerStreamInterceptor,
  type PlayerStreamInterceptorOptions,
} from './PlayerStreamInterceptor';
import type { InterceptedStream } from './stream/InterceptedStream';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PlayerEvents {
  debug: (message: string) => any;
  error: (error: Error) => any;
  voiceStateUpdate: (
    queue: GuildQueue,
    oldState: VoiceState,
    newState: VoiceState,
  ) => any;
}

export const PlayerEvent = {
  debug: 'debug',
  Debug: 'debug',
  error: 'error',
  Error: 'error',
  voiceStateUpdate: 'voiceStateUpdate',
  VoiceStateUpdate: 'voiceStateUpdate',
} as const;
export type PlayerEvent = (typeof PlayerEvent)[keyof typeof PlayerEvent];

export interface PlayerNodeInitializationResult<T = any> {
  track: Track;
  extractor: BaseExtractor | null;
  searchResult: SearchResult;
  queue: GuildQueue<T>;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export type TrackLike =
  | string
  | Track
  | SearchResult
  | Track[]
  | Playlist
  | AudioResource;

export interface PlayerNodeInitializerOptions<T> extends SearchOptions {
  nodeOptions?: GuildNodeCreateOptions<T>;
  connectionOptions?: VoiceConnectConfig;
  audioPlayerOptions?: ResourcePlayOptions;
  signal?: AbortSignal;
  afterSearch?: (result: SearchResult) => Promise<SearchResult>;
}

export type VoiceStateHandler = (
  player: Player,
  queue: GuildQueue,
  oldVoiceState: VoiceState,
  newVoiceState: VoiceState,
) => Awaited<void>;

export interface PlayerInitOptions {
  /**
   * The voice connection timeout
   */
  connectionTimeout?: number;
  /**
   * Time in ms to re-monitor event loop lag
   */
  lagMonitor?: number;
  /**
   * Prevent voice state handler from being overridden
   */
  lockVoiceStateHandler?: boolean;
  /**
   * List of extractors to disable querying metadata from
   */
  blockExtractors?: string[];
  /**
   * List of extractors to disable streaming from
   */
  blockStreamFrom?: string[];
  /**
   * Query cache provider
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryCache?: QueryCacheProvider<any> | null;
  /**
   * Skip ffmpeg process when possible
   */
  skipFFmpeg?: boolean;
  /**
   * The probe timeout in milliseconds. Defaults to 5000.
   */
  probeTimeout?: number;
  /**
   * Configure ffmpeg path
   */
  ffmpegPath?: string;
  /**
   * Whether to override the fallback context. Defaults to `true`.
   */
  overrideFallbackContext?: boolean;
}

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
  public static readonly version: string = dpVersion;
  /**
   * The unique identifier of this player instance
   */
  public readonly id = SnowflakeUtil.generate().toString();
  /**
   * The discord.js client
   */
  public readonly client!: Client;
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
  public events = new PlayerEventsEmitter<GuildQueueEvents>([
    GuildQueueEvent.Error,
    GuildQueueEvent.PlayerError,
  ]);
  /**
   * The player version
   */
  public readonly version = Player.version;
  /**
   * The lyrics api
   */
  public readonly lyrics = new LrcLib(this);

  #streamInterceptor: PlayerStreamInterceptor | null = null;

  /**
   * Creates new Discord Player
   * @param {Client} client The Discord Client
   * @param {PlayerInitOptions} [options] The player init options
   */
  public constructor(client: Client, options: PlayerInitOptions = {}) {
    super([PlayerEvent.Error]);

    if (options.ffmpegPath) {
      if (typeof options.ffmpegPath !== 'string')
        throw new TypeError(
          `Expected type "string" for options.ffmpegPath. Got ${typeof options.ffmpegPath} instead`,
        );

      process.env.FFMPEG_PATH = options.ffmpegPath;
    }

    const isCompatMode = isClientProxy(client);

    /**
     * The discord client
     * @type {Client}
     */
    this.client = client;

    if (!isCompatMode) {
      try {
        if (!(client instanceof Client)) {
          Util.warn(
            `Client is not an instance of discord.js@${djsVersion} client, some things may not work correctly. This can happen due to corrupt dependencies or having multiple installations of discord.js.`,
            'InvalidClientInstance',
          );
        }

        const ibf =
          this.client.options.intents instanceof IntentsBitField
            ? this.client.options.intents
            : new IntentsBitField(this.client.options.intents);

        if (!ibf.has(IntentsBitField.Flags.GuildVoiceStates)) {
          Util.warn(
            'client is missing "GuildVoiceStates" intent',
            'InvalidIntentsBitField',
          );
        }
      } catch {
        // noop
      }
    }

    this.options = {
      lockVoiceStateHandler: false,
      blockExtractors: [],
      blockStreamFrom: [],
      connectionTimeout: 20000,
      lagMonitor: 30000,
      queryCache:
        options.queryCache === null
          ? null
          : options.queryCache || new QueryCache(this),
      skipFFmpeg: true,
      probeTimeout: 5000,
      overrideFallbackContext: true,
      ...options,
    } satisfies PlayerInitOptions;

    if (!isCompatMode) {
      // @ts-ignore private method
      this.client.incrementMaxListeners();
      this.client.on(Events.VoiceStateUpdate, this.#voiceStateUpdateListener);
    } else {
      try {
        // @ts-ignore private method
        this.client.__dp_voiceStateUpdate_proxy(this.#voiceStateUpdateListener);
      } catch (e) {
        Util.warn(
          'Failed to attach voice state update proxy, voice state handler will not work properly',
          'CompatModeError',
        );
      }
    }

    if (
      typeof this.options.lagMonitor === 'number' &&
      this.options.lagMonitor > 0
    ) {
      this.#lagMonitorInterval = setInterval(() => {
        const start = performance.now();
        this.#lagMonitorTimeout = setTimeout(() => {
          this.#lastLatency = performance.now() - start;
          if (this.hasDebugger)
            this.debug(
              `[Lag Monitor] Event loop latency: ${this.#lastLatency}ms`,
            );
        }, 0).unref();
      }, this.options.lagMonitor).unref();
    }

    if (this.options.overrideFallbackContext) {
      getGlobalRegistry().set('@[player]', this);
    }
  }

  /**
   * The hooks context for this player instance.
   */
  public get context() {
    if (!this.#hooksCtx) {
      this.#hooksCtx = createContext();

      const originalProvider = this.#hooksCtx.provide.bind(this.#hooksCtx);

      this.#hooksCtx.provide = (value, receiver) => {
        return SUPER_CONTEXT.provide(this, () => {
          return originalProvider(value, () => {
            return receiver();
          });
        });
      };
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
   * Creates new discord-player instance.
   * @param client The client that instantiated player
   * @param options Player initializer options
   */
  public static create(client: Client, options: PlayerInitOptions = {}) {
    return new Player(client, options);
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
      queuesCount: this.queues.cache.size,
      queryCacheEnabled: this.queryCache != null,
      queues: this.queues.cache.map((m) => m.stats.generate()),
    };
  }

  /**
   * Whether the player is in compatibility mode. Compatibility mode is enabled when non-discord.js client is used.
   */
  public isCompatMode() {
    return isClientProxy(this.client);
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

    if (!this.isCompatMode()) {
      this.client.off(Events.VoiceStateUpdate, this.#voiceStateUpdateListener);
      // @ts-ignore private method
      this.client.decrementMaxListeners();
    }

    this.removeAllListeners();
    this.events.removeAllListeners();
    await this.extractors.unregisterAll();
    if (this.#lagMonitorInterval) clearInterval(this.#lagMonitorInterval);
    if (this.#lagMonitorTimeout) clearInterval(this.#lagMonitorTimeout);
  }

  private _handleVoiceState(oldState: VoiceState, newState: VoiceState) {
    const queue = this.nodes.get(oldState.guild.id);
    if (!queue || !queue.connection || !queue.channel) return;

    // dispatch voice state update
    const wasHandled = this.events.emit(
      GuildQueueEvent.VoiceStateUpdate,
      queue,
      oldState,
      newState,
    );
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
  public handleVoiceState(oldState: VoiceState, newState: VoiceState): void {
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
  public async play<T = unknown>(
    channel: GuildVoiceChannelResolvable,
    query: TrackLike,
    options: PlayerNodeInitializerOptions<T> = {},
  ): Promise<PlayerNodeInitializationResult<T>> {
    const vc = this.client.channels.resolve(channel);
    if (!vc?.isVoiceBased())
      throw new InvalidArgTypeError(
        'channel',
        'VoiceBasedChannel',
        !vc ? 'undefined' : `channel type ${vc.type}`,
      );

    const originalResult =
      query instanceof SearchResult ? query : await this.search(query, options);
    const result =
      (await options.afterSearch?.(originalResult)) || originalResult;
    if (result.isEmpty()) {
      throw new NoResultError(
        `No results found for "${query}" (Extractor: ${
          result.extractor?.identifier || 'N/A'
        })`,
      );
    }

    const queue = this.nodes.create(vc.guild, options.nodeOptions);

    if (this.hasDebugger) this.debug(`[AsyncQueue] Acquiring an entry...`);
    const entry = queue.tasksQueue.acquire({ signal: options.signal });
    if (this.hasDebugger)
      this.debug(`[AsyncQueue] Entry ${entry.id} was acquired successfully!`);

    if (this.hasDebugger)
      this.debug(`[AsyncQueue] Waiting for the queue to resolve...`);
    await entry.getTask();
    if (this.hasDebugger)
      this.debug(`[AsyncQueue] Entry ${entry.id} was resolved!`);

    try {
      if (!queue.channel) await queue.connect(vc, options.connectionOptions);

      if (!result.playlist) {
        queue.addTrack(result.tracks[0]);
      } else {
        queue.addTrack(result.playlist);
      }
      if (!queue.isPlaying())
        await queue.node.play(null, options.audioPlayerOptions);
    } finally {
      if (this.hasDebugger)
        this.debug(`[AsyncQueue] Releasing an entry from the queue...`);
      queue.tasksQueue.release();
    }

    return {
      track: result.tracks[0],
      extractor: result.extractor,
      searchResult: result,
      queue,
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
  public async search(
    searchQuery: TrackLike,
    options: SearchOptions = {},
  ): Promise<SearchResult> {
    if (searchQuery instanceof SearchResult) return searchQuery;

    if (searchQuery instanceof AudioResource) {
      searchQuery = this.createTrackFromAudioResource(searchQuery);
    }

    if (options.requestedBy != null)
      options.requestedBy = this.client.users.resolve(options.requestedBy)!;

    options.blockExtractors ??= this.options.blockExtractors;
    options.fallbackSearchEngine ??= QueryType.AUTO_SEARCH;

    if (searchQuery instanceof Track) {
      return new SearchResult(this, {
        playlist: searchQuery.playlist || null,
        tracks: [searchQuery],
        query: searchQuery.title,
        extractor: searchQuery.extractor,
        queryType: searchQuery.queryType,
        requestedBy: options.requestedBy,
      });
    }

    if (searchQuery instanceof Playlist) {
      return new SearchResult(this, {
        playlist: searchQuery,
        tracks: searchQuery.tracks,
        query: searchQuery.title,
        extractor: searchQuery.tracks[0]?.extractor,
        queryType: QueryType.AUTO,
        requestedBy: options.requestedBy,
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
        requestedBy: options.requestedBy,
      });
    }

    if (this.hasDebugger) this.debug(`Searching ${searchQuery}`);

    let extractor: BaseExtractor | null = null,
      protocol: string | null = null;

    options.searchEngine ??= QueryType.AUTO;
    options.fallbackSearchEngine ??= QueryType.AUTO_SEARCH;

    if (this.hasDebugger)
      this.debug(
        `Search engine set to ${options.searchEngine}, fallback search engine set to ${options.fallbackSearchEngine}`,
      );

    if (/^\w+:/.test(searchQuery)) {
      const [protocolName, ...query] = searchQuery.split(':');
      if (this.hasDebugger)
        this.debug(`Protocol ${protocolName} detected in query`);

      const matchingExtractor = this.extractors.store.find(
        (e) =>
          !this.extractors.isDisabled(e.identifier) &&
          e.protocols.includes(protocolName),
      );

      if (matchingExtractor) {
        if (this.hasDebugger)
          this.debug(
            `Protocol ${protocolName} is supported by ${matchingExtractor.identifier} extractor!`,
          );
        extractor = matchingExtractor;
        searchQuery = query.join(':');
        protocol = protocolName;
      } else {
        if (this.hasDebugger)
          this.debug(
            `Could not find an extractor that supports ${protocolName} protocol. Falling back to default behavior...`,
          );
      }
    }

    const redirected = await QueryResolver.preResolve(searchQuery);
    const { type: queryType, query } =
      options.searchEngine === QueryType.AUTO
        ? QueryResolver.resolve(redirected, options.fallbackSearchEngine)
        : ({ type: options.searchEngine, query: redirected } as ResolvedQuery);

    if (this.hasDebugger)
      this.debug(
        `Query type identified as ${queryType}${
          extractor && protocol
            ? ' but might not be used due to the presence of protocol'
            : ''
        }`,
      );

    // force particular extractor
    if (options.searchEngine.startsWith('ext:')) {
      if (this.hasDebugger)
        this.debug(`Forcing ${options.searchEngine.substring(4)} extractor...`);
      extractor = this.extractors.get(options.searchEngine.substring(4))!;
      if (!extractor)
        return new SearchResult(this, {
          query,
          queryType,
          extractor,
          requestedBy: options.requestedBy,
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
          requestedBy: options.requestedBy,
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
        requestedBy: options.requestedBy,
      });
    }

    if (this.hasDebugger)
      this.debug(
        `Executing metadata query using ${extractor.identifier} extractor...`,
      );
    const res = await extractor
      .handle(query, {
        type: queryType as SearchQueryType,
        requestedBy: options.requestedBy as User,
        requestOptions: options.requestOptions,
        protocol,
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
        requestedBy: options.requestedBy,
      });

      if (!options.ignoreCache) {
        if (this.hasDebugger) this.debug(`Adding data to cache...`);
        await this.queryCache?.addData(result);
      }

      return result;
    }

    if (this.hasDebugger)
      this.debug(
        'Failed to find result using appropriate extractor. Querying all extractors...',
      );
    const result = await this.extractors.run(
      async (ext) =>
        !options.blockExtractors?.includes(ext.identifier) &&
        (await ext.validate(query)) &&
        ext.handle(query, {
          type: queryType as SearchQueryType,
          requestedBy: options.requestedBy as User,
          requestOptions: options.requestOptions,
          protocol,
        }),
    );
    if (!result?.result) {
      if (this.hasDebugger)
        this.debug(
          `Failed to query metadata query using ${
            result?.extractor.identifier || 'N/A'
          } extractor.`,
        );
      return new SearchResult(this, {
        query,
        queryType,
        requestedBy: options.requestedBy,
        extractor: result?.extractor,
      });
    }

    if (this.hasDebugger)
      this.debug(
        `Metadata query was successful using ${result.extractor.identifier}!`,
      );

    const data = new SearchResult(this, {
      query,
      queryType,
      playlist: result.result.playlist,
      tracks: result.result.tracks,
      extractor: result.extractor,
      requestedBy: options.requestedBy,
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
    const runtime =
      'Bun' in globalThis ? 'Bun' : 'Deno' in globalThis ? 'Deno' : 'Node';
    const depsReport = [
      'Discord Player',
      line,
      `- discord-player: ${Player.version}${
        this.isCompatMode()
          ? ` (${getCompatName(this.client)} compatibility mode)`
          : ''
      }`,
      `- discord-voip: ${dVoiceVersion}`,
      `- discord.js: ${djsVersion}`,
      `- Node version: ${process.version} (Detected Runtime: ${runtime}, Platform: ${process.platform} [${process.arch}])`,
      (() => {
        const info = FFmpeg.resolveSafe();
        if (!info) return 'FFmpeg/Avconv not found';

        return [
          `- ffmpeg: ${info.version}`,
          `- command: ${info.command}`,
          `- static: ${info.module}`,
          `- libopus: ${info.result!.includes('--enable-libopus')}`,
        ].join('\n');
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
      DependencyReportGenerator.generateString(),
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

  /**
   * Creates a track from an audio resource.
   * @param resource The audio resource
   */
  public createTrackFromAudioResource(resource: AudioResource) {
    const metadata = (resource.metadata || {}) as Record<string, unknown>;
    const ref = SnowflakeUtil.generate().toString();
    const maybeTitle =
      'title' in metadata ? `${metadata.title}` : `Track ${ref}`;
    const maybeAuthor =
      'author' in metadata ? `${metadata.author}` : 'Unknown author';
    const maybeDuration =
      'duration' in metadata ? `${metadata.duration}` : '00:00';
    const maybeThumbnail =
      'thumbnail' in metadata ? `${metadata.thumbnail}` : undefined;
    const maybeURL =
      'url' in metadata ? `${metadata.url}` : `discord-player://blob/${ref}`;
    const maybeDescription =
      'description' in metadata
        ? `${metadata.description}`
        : 'No description available.';
    const maybeViews = 'views' in metadata ? Number(metadata.views) || 0 : 0;

    const track = new Track(this, {
      title: maybeTitle,
      author: maybeAuthor,
      duration: maybeDuration,
      thumbnail: maybeThumbnail,
      url: maybeURL,
      description: maybeDescription,
      queryType: QueryType.DISCORD_PLAYER_BLOB,
      source: 'arbitrary',
      metadata,
      live: false,
      views: maybeViews,
    });

    resource.metadata = track;

    track.setResource(resource as AudioResource<Track>);

    return track;
  }

  /**
   * Handles intercepting streams
   * @param stream The stream to intercept
   */
  public async handleInterceptingStream(
    queue: GuildQueue,
    track: Track,
    format: StreamType,
    stream: InterceptedStream,
  ) {
    if (!this.#streamInterceptor) return;

    return this.#streamInterceptor.handle(queue, track, format, stream);
  }

  /**
   * Creates a global stream interceptor
   * @param options The stream interceptor options
   */
  public createStreamInterceptor(options: PlayerStreamInterceptorOptions) {
    if (this.#streamInterceptor) {
      return this.#streamInterceptor;
    }

    this.#streamInterceptor = new PlayerStreamInterceptor(this, options);

    return this.#streamInterceptor;
  }
}
