import type { Readable } from 'node:stream';
import type { MediaSource } from '@remedia/client';
import type { Track } from '../structures/track.js';
import type { SearchResultData } from '../structures/search-result.js';
import type { SearchOptions } from '../types.js';
import type { JSONValue } from '../utils/serialization.js';
import type { DiscordPlayer } from '../player.js';

/** Serializable provider identity; never put credentials or live objects in this payload. */
export type SourceReference = {
  /** Registered source plugin ID. */
  pluginId: string;

  /** Provider-specific portable data, usually a public URL or identifier. */
  data: JSONValue;
};

/** Supported local source results. Readables and byte buffers require embedded Remedia. */
export type SourceStream = MediaSource | string | Readable;

/** Operation dispatch behavior. */
export type DispatchPolicy = 'first' | 'collect' | 'pipe' | 'broadcast';

/** Declaration merged operation contract. */
export interface Operation<Input, Output, Policy extends DispatchPolicy> {
  /** Handler input. */
  input: Input;

  /** Handled result; undefined always declines. */
  output: Output;

  /** Dispatch policy selected by the definition. */
  policy: Policy;
}

/** Search request independent of Discord client libraries. */
export interface SourceQuery {
  /** Search text or source location. */
  query: string;

  /** Portable search hints and local cancellation. */
  options?: SearchOptions;

  /** Explicit protocol prefix when present. */
  protocol?: string;
}

/** Match result carries identity so metadata resolves through the same provider. */
export interface SourceMatch {
  /** Provider ID; supplied automatically by the host. */
  pluginId?: string;

  /** Confidence score; higher wins within a priority tier. */
  score: number;
}

/** Source request for one Track. */
export interface SourceTrackRequest {
  /** Track metadata and portable provider identity. */
  track: Track;
}

/** Related-media request with optional local legacy history. */
export interface SourceRelatedRequest extends SourceTrackRequest {
  /** Local history compatibility payload; not part of a future remote request. */
  history?: unknown;
}

/** Fallback request excluding the original provider. */
export interface SourceBridgeRequest extends SourceTrackRequest {
  /** Original metadata provider. */
  sourcePluginId?: string;
}

/** Encoded local stream transformation payload. */
export interface SourceStreamTransform extends SourceTrackRequest {
  /** Encoded binary stream. */
  stream: Readable;
}

/** Extensible source operation contracts. Augmented operations also need host definitions. */
export interface SourceOperationMap {
  /** Collect scored providers. */
  'search.query.match': Operation<SourceQuery, SourceMatch | null, 'collect'>;

  /** Resolve metadata with the selected provider. */
  'search.query.resolve': Operation<SourceQuery, SearchResultData, 'first'>;

  /** Resolve playable media. */
  'track.stream': Operation<SourceTrackRequest, SourceStream, 'first'>;

  /** Resolve related media; history is local compatibility context only. */
  'track.related': Operation<SourceRelatedRequest, SearchResultData, 'first'>;

  /** Explicit fallback for sources that cannot stream their own metadata. */
  'track.bridge': Operation<SourceBridgeRequest, SourceStream, 'first'>;

  /** Local encoded stream transformation. */
  'stream.transform': Operation<SourceStreamTransform, SourceStreamTransform, 'pipe'>;

  /** Notification after a source is resolved. */
  'track.stream.resolved': Operation<SourceTrackRequest, void, 'broadcast'>;
}

/** Names available to source plugins. */
export type OperationName = keyof SourceOperationMap;

/** Typed input selected by operation name. */
export type OperationInput<K extends OperationName> = SourceOperationMap[K]['input'];

/** Typed handler result selected by operation name. */
export type OperationOutput<K extends OperationName> = SourceOperationMap[K]['output'];

/** Dispatch result selected by the declared policy. */
export type OperationResult<K extends OperationName> = SourceOperationMap[K]['policy'] extends 'collect'
  ? OperationOutput<K>[]
  : SourceOperationMap[K]['policy'] extends 'broadcast'
    ? void
    : OperationOutput<K> | undefined;

/** Per-invocation cancellation supplied to all handlers. */
export interface OperationContext {
  /** Caller cancellation combined with registration removal. */
  signal: AbortSignal;
}

/** A handler may decline only by returning undefined.
 * @param input Typed operation payload.
 * @param context Invocation cancellation.
 * @returns A handled result, or undefined to decline.
 */
export type OperationHandler<K extends OperationName> = (
  input: OperationInput<K>,
  context: OperationContext,
) => OperationOutput<K> | undefined | Promise<OperationOutput<K> | undefined>;

/** Handler ordering metadata. */
export interface HandlerOptions {
  /** Higher values run first; equal priorities preserve registration order. */
  priority?: number;

  /** Protocols accepted by this handler; absent means unrestricted. */
  protocols?: readonly string[];
}

/** Source setup context deliberately excludes Player and Discord objects. */
export interface SourcePluginContext<Options> {
  /** Options belonging to this registration. */
  readonly options: Options;

  /** Registration lifetime signal. */
  readonly signal: AbortSignal;

  /** Player instance hosting this registration. */
  readonly player: DiscordPlayer;

  /** Register an owned operation handler.
   * @param operation Operation name.
   * @param handler Typed implementation.
   * @param options Ordering and routing metadata.
   * @returns An idempotent subscription removal function.
   */
  on<K extends OperationName>(operation: K, handler: OperationHandler<K>, options?: HandlerOptions): () => void;

  /** Register cleanup, run in reverse order after active handlers settle.
   * @param callback Resource cleanup.
   */
  onCleanup(callback: () => void | Promise<void>): void;
}

/** Source declaration reusable across Player instances. */
export interface SourcePluginDefinition<Options> {
  /** Unique registration identifier. */
  id: string;

  /** Only source execution is implemented. */
  kind: 'source';

  /** Initialize owned resources and handlers.
   * @param ctx Registration context.
   */
  setup(ctx: SourcePluginContext<Options>): void | Promise<void>;

  /** Optional teardown after calls have drained.
   * @param ctx Registration context.
   */
  destroy?(ctx: SourcePluginContext<Options>): void | Promise<void>;
}

/** Reserved runtime kind; no runtime capabilities are implemented. */
export interface RuntimePluginDefinition {
  /** Unique registration identifier. */
  id: string;

  /** Reserved discriminant, rejected by the source host. */
  kind: 'runtime';
}

/** Registration descriptor produced by a factory. */
export interface PluginRegistration<Options = unknown> {
  /** Reusable source declaration. */
  definition: SourcePluginDefinition<Options>;

  /** Registration-local options. */
  options: Options;
}

/** Factory requires options only when the options type has required fields.
 * @param options Registration-local configuration.
 * @returns A registration descriptor with no shared runtime state.
 */
export type PluginFactory<Options> = {} extends Options
  ? (options?: Options) => PluginRegistration<Options>
  : (options: Options) => PluginRegistration<Options>;

/** Define a reusable source plugin.
 * @param definition Source lifecycle and identity.
 * @returns A typed registration factory. Each call supplies independent options.
 */
export function definePlugin<Options = Record<string, never>>(
  definition: SourcePluginDefinition<Options>,
): PluginFactory<Options> {
  return ((options: Options = {} as Options) => ({
    definition,
    options,
  })) as PluginFactory<Options>;
}
