import type { RemediaClient } from '@remedia/client';
import { PluginRegistry } from './plugins/registry.js';
import { ExtractorExecutionContext } from './compat/extractor-execution-context.js';
import { Track } from './structures/track.js';
import { Playlist } from './structures/playlist.js';
import { SearchResult } from './structures/search-result.js';
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

  /** Queue orchestration requires an actual DiscordPlayer. */
  get queues(): never {
    throw new Error('SourcePluginRuntime does not provide queues; use DiscordPlayer for playback');
  }

  /** Voice nodes require an actual DiscordPlayer. */
  get nodes(): never {
    throw new Error('SourcePluginRuntime does not provide voice nodes; use DiscordPlayer for playback');
  }

  /** Audio clients are unavailable in standalone source execution. */
  get remedia(): never {
    throw new Error('SourcePluginRuntime does not initialize a Remedia audio client');
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

  /** Playback is outside the source compatibility API. */
  play(): never {
    throw new Error('SourcePluginRuntime cannot play audio; use DiscordPlayer');
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
    const target =
      options.pluginId ?? (options.searchEngine?.startsWith('ext:') ? options.searchEngine.slice(4) : undefined);

    await this.plugins.ready();

    const prefix = /^([\w.-]+):(?:\/\/)?(.*)$/s.exec(query);
    const protocol =
      prefix && this.plugins.supportsProtocol(prefix[1]!, { pluginId: target, blocked }) ? prefix[1] : undefined;
    const input = {
      query: protocol ? prefix![2]! : query,
      protocol,
      options: {
        ...options,
        searchEngine:
          (options.searchEngine?.startsWith('ext:') ? undefined : options.searchEngine) ??
          options.source ??
          (/^https?:\/\//i.test(query) ? 'arbitrary' : 'auto'),
      },
    };
    const execution = { signal: options.signal, blocked, pluginId: target };
    const matches = target
      ? [{ pluginId: target, score: 0 }]
      : await this.plugins.execute('search.query.match', input, execution);
    const match = matches.find((item) => item !== null && item.score >= 0);

    if (!match?.pluginId) {
      return SearchResult.empty();
    }

    const result = await this.plugins.execute('search.query.resolve', input, {
      ...execution,
      pluginId: match.pluginId,
    });

    if (!result) {
      return SearchResult.empty();
    }

    for (const track of result.tracks) {
      track.sourceReference ??= {
        pluginId: match.pluginId,
        data: { url: track.url },
      };

      if (options.requestedBy !== undefined) {
        track.requestedBy = options.requestedBy;
      }
    }

    return new SearchResult(result);
  }
}
