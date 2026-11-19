import type * as PluginTypes from './plugins/types.js';
import type { SerializedEntityUnion } from './utils/serde.js';
import type { SearchResultData } from './structures/search-result.js';
import type { MediaSource } from '@remedia/client';
import type { LyricsRequest, LyricsResult } from './lyrics.js';
import type { SourcePluginRuntime } from './runtime.js';

/** Extensible source operation contracts. Augmented operations also need host definitions. */
export interface OperationMap {
  /** Transform a validated persistence payload before restoring an entity. */
  'serialization.beforeRestore': PluginTypes.Operation<SerializedEntityUnion, SerializedEntityUnion, 'pipe'>;

  /** Transform serialized application metadata; the result is validated again. */
  'serialization.afterSerialize': PluginTypes.Operation<SerializedEntityUnion, SerializedEntityUnion, 'pipe'>;

  /** Transform source preparation while preserving portable provider identity. */
  'media.beforeResolve': PluginTypes.Operation<PluginTypes.SourceTrackRequest, PluginTypes.SourceTrackRequest, 'pipe'>;

  /** Transform a portable search query before provider selection. */
  'search.beforeQuery': PluginTypes.Operation<PluginTypes.SourceQuery, PluginTypes.SourceQuery, 'pipe'>;

  /** Transform metadata returned by search orchestration. */
  'search.afterResults': PluginTypes.Operation<SearchResultData, SearchResultData, 'pipe'>;

  /** Transform encoded bytes across modern plugins, independent of source ownership. */
  'media.transform': PluginTypes.Operation<
    PluginTypes.SourceStreamTransform,
    PluginTypes.SourceStreamTransform,
    'pipe'
  >;

  /** Transform a resolved descriptor. Standalone execution has no guild context. */
  'media.descriptor': PluginTypes.Operation<
    { readonly source: MediaSource; readonly guildId: string | null },
    { readonly source: MediaSource; readonly guildId: string | null },
    'pipe'
  >;

  /** Optional lyrics lookup, independent of all source operations. */
  'lyrics.search': PluginTypes.Operation<LyricsRequest, LyricsResult[] | null, 'collect'>;

  /** Collect scored providers. */
  'search.query.match': PluginTypes.Operation<PluginTypes.SourceQuery, PluginTypes.SourceMatch | null, 'collect'>;

  /** Resolve metadata with the selected provider. */
  'search.query.resolve': PluginTypes.Operation<PluginTypes.SourceQuery, SearchResultData, 'first'>;

  /** Resolve playable media. */
  'track.stream': PluginTypes.Operation<PluginTypes.SourceTrackRequest, PluginTypes.SourceStream, 'first'>;

  /** Resolve related media using seed metadata and a portable history snapshot. */
  'track.related': PluginTypes.Operation<PluginTypes.SourceRelatedRequest, SearchResultData, 'first'>;

  /** Explicit fallback for sources that cannot stream their own metadata. */
  'track.bridge': PluginTypes.Operation<PluginTypes.SourceBridgeRequest, PluginTypes.SourceStream, 'first'>;

  /** Local encoded stream transformation. */
  'stream.transform': PluginTypes.Operation<
    PluginTypes.SourceStreamTransform,
    PluginTypes.SourceStreamTransform,
    'pipe'
  >;

  /** Notification after a source is resolved. */
  'track.stream.resolved': PluginTypes.Operation<PluginTypes.SourceTrackRequest, void, 'broadcast'>;
}

/** Operation names whose handlers must complete synchronously. */
export interface SynchronousOperationMap {}

/** Registration-owned singleton services enabled by an embedding runtime. */
export interface ProviderMap {}

/** Runtime identities; embedding packages add full Player types without a runtime dependency. */
export interface PluginRuntimeMap {
  /** Standalone source runtime. */
  partial: SourcePluginRuntime;
}

/** Queue types supplied by embedding packages; standalone execution has no queues. */
export interface PluginQueueMap {}

export * from './types.js';
export * from './errors.js';
export * from './structures/track.js';
export * from './structures/playlist.js';
export * from './structures/search-result.js';
export * from './utils/serde.js';
export * from './plugins/types.js';
export * from './plugins/registry.js';
export * from './compat/extractors.js';
export * from './compat/utils.js';
export * from './legacy-player.js';
export * from './runtime.js';
export * from './host.js';
export * from './protocol.js';
export { cloneJSONValue } from './utils/serialization.js';
export { SafeEventEmitter, type EventMap } from './utils/safe-event-emitter.js';

export type { MediaAccessPolicy } from './media.js';

export { parseLyrics, normalizeLyrics, searchLyrics } from './lyrics.js';
export type { LyricsLine, LyricsResult, LyricsRequest } from './lyrics.js';
export * from './providers/lrclib.js';
export type { RemotePluginHostOptions } from './remote.js';
