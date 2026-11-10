import type { RemediaClient } from '@remedia/client';
import type { SafeEventEmitter } from './utils/safe-event-emitter.js';
import type { PluginRegistry } from './plugins/registry.js';
import type { ExtractorExecutionContext } from './compat/extractor-execution-context.js';
import type { MediaResource, SearchOptions } from './types.js';
import type { SearchResult } from './structures/search-result.js';

/** Events supported by the source compatibility context. */
export interface SourceRuntimeEvents {
  /** Source diagnostics. */
  debug: [message: string];

  /** Non-fatal source errors. */
  error: [error: Error];

  /** Compatibility event forwarded by a real Player. */
  voiceStateUpdate: [guildId: string, event: unknown];
}

/** Source-related Player surface shared by actual Players and standalone hosts. */
export interface LegacyPlayerContext {
  /** Shared source registry. */
  readonly plugins: PluginRegistry;

  /** Legacy extractor registration and lookup. */
  readonly extractors: ExtractorExecutionContext;

  /** Supported source options. */
  readonly options: { blockExtractors?: readonly string[]; probeTimeout?: number };

  /** Access the embedding audio client; standalone contexts reject required access. */
  getRemedia(): RemediaClient;

  /** Optional audio client lookup, null in standalone execution.
   * @param throwOnMissing Optional lookup flag.
   */
  getRemedia(throwOnMissing: false): RemediaClient | null;

  /** Search registered providers.
   * @param query Query or existing metadata.
   * @param options Source hints and cancellation.
   */
  search(query: MediaResource, options?: SearchOptions): Promise<SearchResult>;

  /** Report a diagnostic.
   * @param message Diagnostic text.
   */
  debug(message: string): void;

  /** Publish a supported event.
   * @param event Event name.
   * @param args Event arguments.
   */
  emit: SafeEventEmitter<SourceRuntimeEvents>['emit'];
}
