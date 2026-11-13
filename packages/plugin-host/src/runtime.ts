import { searchRemedia } from './remedia.js';
import type { SourceQuery } from './plugins/types.js';
import type { RemediaClient } from '@remedia/client';
import { PluginRegistry } from './plugins/registry.js';
import { PluginError } from './plugins/plugin-error.js';
import { ExtractorExecutionContext } from './compat/extractor-execution-context.js';
import { Track } from './structures/track.js';
import { Playlist } from './structures/playlist.js';
import { SearchResult, type SearchResultData } from './structures/search-result.js';
import { SafeEventEmitter } from './utils/safe-event-emitter.js';
import type { LegacyPlayerContext, SourceRuntimeEvents } from './legacy-player.js';
import type { MediaResource, SearchOptions } from './types.js';

/** Standalone source configuration; no playback services are created. */
export interface SourcePluginRuntimeOptions {
  /** Stable deployment identifier for standalone execution. */
  hostId?: string;

  /** Actual Player context when embedded. */
  player?: LegacyPlayerContext;

  /** Disabled provider IDs. */
  blockExtractors?: readonly string[];

  /** Legacy probe timeout hint. */
  probeTimeout?: number;
}

/** Shared source execution and compatibility facade, independent of audio and Discord clients. */
export class SourcePluginRuntime extends SafeEventEmitter<SourceRuntimeEvents> implements LegacyPlayerContext {
  /** Canonical operation registry and lifecycle owner. */
  public readonly plugins: PluginRegistry;

  /** Legacy constructor adapter sharing the same registry. */
  public readonly extractors: ExtractorExecutionContext;

  /** Actual Player or this runtime's source facade. */
  public readonly player: LegacyPlayerContext;

  /** Source compatibility options. */
  public readonly options: LegacyPlayerContext['options'];

  /** Create a source runtime.
   * @param options Source settings and optional embedding context.
   */
  constructor(options: SourcePluginRuntimeOptions = {}) {
    super();
    this.player = options.player ?? this;
    this.options = options.player?.options ?? options;
    this.plugins = new PluginRegistry(this.player, () => this.options.blockExtractors ?? [], options.hostId);
    this.extractors = new ExtractorExecutionContext(this.player);
  }

  /** Required audio access is unavailable in standalone execution. */
  getRemedia(): RemediaClient;

  /** Optional audio access returns null.
   * @param throwOnMissing Optional lookup flag.
   */
  getRemedia(throwOnMissing: false): RemediaClient | null;

  getRemedia(throwOnMissing = true): RemediaClient | null {
    if (throwOnMissing) throw new Error('SourcePluginRuntime does not initialize an audio client; use DiscordPlayer');

    return null;
  }

  /** Emit a source diagnostic.
   * @param message Diagnostic text.
   */
  debug(message: string): void {
    this.emit('debug', message);
  }

  /** Release source registrations and active streams. */
  async destroy(): Promise<void> {
    await this.plugins.destroy();
  }

  /** Search using the same routing policy in embedded and standalone execution.
   * @param query Query or existing metadata.
   * @param options Source targeting and cancellation.
   */
  public async search(query: MediaResource, options: SearchOptions = {}): Promise<SearchResult> {
    options.signal?.throwIfAborted();

    if (query instanceof SearchResult) {
      return query;
    }

    if (query instanceof Track) {
      return new SearchResult({ tracks: [query], playlist: null });
    }

    if (Array.isArray(query)) {
      return new SearchResult({ tracks: query, playlist: null });
    }

    if (query instanceof Playlist) {
      return new SearchResult({ tracks: query.tracks, playlist: query });
    }

    const blocked = [...(this.options.blockExtractors ?? []), ...(options.blockExtractors ?? [])];
    await this.plugins.ready();

    const engine = options.searchEngine;
    const legacy = engine?.startsWith('ext:') ? engine.slice(4) : undefined;

    if (
      legacy !== undefined &&
      !this.extractors.get(legacy) &&
      !this.player
        .getRemedia(false)
        ?.nodes.some(
          (node) =>
            node.type === 'remote' && node.status === 'healthy' && node.capabilities?.pluginOperations?.forwarding,
        )
    )
      throw new Error(`Legacy extractor ${legacy} is not registered`);

    const target = legacy ?? (engine && this.plugins.has(engine) ? engine : undefined);
    const prefix =
      options.resolveCustomProtocols !== false && !/^(?:https?|file):/i.test(query) && !/^[a-z]:/i.test(query)
        ? /^([a-z][a-z0-9+.-]*):(?:\/\/)?(.*)$/is.exec(query)
        : null;
    const protocol =
      prefix && this.plugins.supportsProtocol(prefix[1]!, { pluginId: target, blocked }) ? prefix[1] : undefined;
    const providerHint = target ? undefined : engine;
    let input: SourceQuery = {
      query: protocol ? prefix![2]! : query,
      protocol,
      providerHint,
      options: {
        requestedBy: options.requestedBy,
        requestOptions: options.requestOptions,
        limit: options.limit,
        blockExtractors: options.blockExtractors,
      },
    };
    if (this.plugins.hasCapability('search.beforeQuery')) {
      const transformed = await this.plugins.execute('search.beforeQuery', input, { signal: options.signal });
      if (!transformed || typeof transformed.query !== 'string')
        throw new TypeError('search.beforeQuery requires a string query.');
      input = { ...input, ...transformed };
    }
    const execution = { signal: options.signal, blocked, pluginId: target, hostId: options.hostId };
    const matches = target
      ? [{ pluginId: target, score: 0, hostId: options.hostId }]
      : protocol
        ? this.plugins.protocolMatches(protocol, execution)
        : await this.plugins.execute('search.query.match', input, execution);
    const failures: PluginError[] = [];

    for (const match of matches) {
      if (!match?.pluginId || match.score < 0) continue;

      let result: SearchResultData | undefined;

      try {
        result = await this.plugins.execute('search.query.resolve', input, {
          ...execution,
          pluginId: match.pluginId,
          hostId: match.hostId ?? (target ? options.hostId : null),
        });
      } catch (error) {
        options.signal?.throwIfAborted();

        if (
          !target &&
          !match.hostId &&
          error instanceof PluginError &&
          error.operation === 'search.query.resolve' &&
          error.pluginId === match.pluginId
        ) {
          failures.push(error);

          continue;
        }

        throw error;
      }

      if (!result?.tracks.length) {
        if (target) break;
        continue;
      }
      for (const track of result.tracks) {
        track.sourceReference ??= {
          pluginId: match.pluginId,
          ...(match.hostId ? { hostId: match.hostId } : {}),
          data: { url: track.url },
        };
        if (options.requestedBy !== undefined) track.requestedBy = options.requestedBy;
      }
      const transformed = this.plugins.hasCapability('search.afterResults')
        ? await this.plugins.execute('search.afterResults', result, { signal: options.signal })
        : result;
      if (
        !transformed ||
        !Array.isArray(transformed.tracks) ||
        !transformed.tracks.every((track) => track instanceof Track)
      )
        throw new TypeError('search.afterResults requires Track instances.');
      return new SearchResult(transformed);
    }

    if (failures.length === 1) throw failures[0];

    if (failures.length > 1) {
      const details = failures.map((error) => error.message).join('; ');

      throw new AggregateError(failures, `All matching source providers failed during search: ${details}`, {
        cause: failures[0],
      });
    }

    const client = this.player.getRemedia(false);
    if (!client) return SearchResult.empty();
    const result = await searchRemedia(
      client,
      input.query === query ? query : input.protocol ? `${input.protocol}:${input.query}` : input.query,
      {
        ...options,
        ...input.options,
        searchEngine: input.providerHint ?? options.searchEngine,
        blockExtractors: blocked,
      },
    );
    if (result.isEmpty() || !this.plugins.hasCapability('search.afterResults')) return result;
    const transformed = await this.plugins.execute('search.afterResults', result, { signal: options.signal });
    if (
      !transformed ||
      !Array.isArray(transformed.tracks) ||
      !transformed.tracks.every((track) => track instanceof Track)
    )
      throw new TypeError('search.afterResults requires Track instances.');
    return new SearchResult(transformed);
  }
}
