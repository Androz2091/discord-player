import type { RemotePluginHostOptions } from '../remote.js';
import type { Readable } from 'node:stream';
import type { MediaSource } from '@remedia/client';
import type { Track } from '../structures/track.js';
import type { SearchOptions } from '../types.js';
import type { JSONValue } from '../utils/serialization.js';
import type { OperationMap, SynchronousOperationMap, ProviderMap, PluginRuntimeMap, PluginQueueMap } from '../index.js';

/** Serializable provider identity; never put credentials or live objects in this payload. */
export type ProviderReference = {
  /** Deployment identity, separate from the provider ID. Omit for ordinary embedded sources. */
  hostId?: string;

  /** Remedia node owning this deployment; retained across serialization and history. */
  nodeId?: string;

  /** Registered source plugin ID. */
  pluginId: string;

  /** Provider-specific portable data, usually a public URL or identifier. */
  data: JSONValue;
};

/** Supported local source results. Readables and byte buffers require embedded Remedia. */
export type SourceStream =
  | (MediaSource & {
      /** Trustworthy absolute URL/source expiration supplied by the provider, in Unix milliseconds. Omit when unknown. */
      expiresAtMs?: number;
    })
  | string
  | Uint8Array
  | Readable;

/** Operation dispatch behavior. */
export type DispatchPolicy = 'first' | 'collect' | 'pipe' | 'broadcast' | 'intercept';

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

  /** Generic hint when searchEngine does not select a registered provider. */
  providerHint?: string;

  /** Portable search hints and local cancellation. */
  options?: Omit<SearchOptions, 'searchEngine' | 'hostId' | 'signal' | 'resolveCustomProtocols' | 'guildId'>;

  /** Explicit protocol prefix when present. */
  protocol?: string;
}

/** Match result carries identity so metadata resolves through the same provider. */
export interface SourceMatch {
  /** Provider ID; supplied automatically by the host. */
  pluginId?: string;

  /** Deployment selected by matching; absent for embedded handlers. */
  hostId?: string;

  /** Confidence score; higher wins within a priority tier. */
  score: number;
}

/** Source request for one Track. */
export interface SourceTrackRequest {
  /** Track metadata and portable provider identity. */
  track: Track;
}

/** Related-media request with a bounded queue-history snapshot. */
export interface SourceRelatedRequest extends SourceTrackRequest {
  /** Retained history, including the outgoing seed during speculative discovery. */
  history?: {
    /** Tracks ordered from oldest to newest. */
    tracks: readonly Track[];
  };
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

/** Names available to source plugins. */
export type OperationName = keyof OperationMap;

/** Typed input selected by operation name. */
export type OperationInput<K extends OperationName> = OperationMap[K]['input'];

/** Typed handler result selected by operation name. */
export type OperationOutput<K extends OperationName> = OperationMap[K]['output'];

/** Dispatch result selected by the declared policy. */
export type OperationResult<K extends OperationName> = OperationMap[K]['policy'] extends 'collect'
  ? OperationOutput<K>[]
  : OperationMap[K]['policy'] extends 'broadcast'
    ? void
    : OperationOutput<K> | undefined;

/** Registered runtime identities available to plugin setup. */
export type PluginPlayer = PluginRuntimeMap[keyof PluginRuntimeMap];

/** Embedding queue type, or never in standalone-only programs. */
export type PluginQueue = PluginQueueMap[keyof PluginQueueMap];

/** Per-invocation cancellation supplied to all handlers. */
export interface OperationContext {
  /** Caller cancellation combined with registration removal. */
  signal: AbortSignal;

  /** Explicit local guild routing, or null for unscoped/standalone calls. */
  guildId: string | null;

  /** Queue resolved through the owning runtime, or null when unavailable. */
  queue: PluginQueue | null;
}

/** A handler may decline only by returning undefined.
 * @param input Typed operation payload.
 * @param context Invocation cancellation.
 * @returns A handled result, or undefined to decline.
 */
export type OperationHandler<K extends OperationName> = (
  input: OperationInput<K>,
  context: OperationContext,
) =>
  | OperationOutput<K>
  | undefined
  | (K extends keyof SynchronousOperationMap ? never : Promise<OperationOutput<K> | undefined>);

/** Handler ordering metadata. */
export interface HandlerOptions {
  /** Higher values run first; equal priorities preserve registration order. */
  priority?: number;

  /** Protocols accepted by this handler; absent means unrestricted. */
  protocols?: readonly string[];

  /** Local guild constraints; unavailable guild context never matches. */
  guildIds?: readonly string[];
}

/** Source setup context shared by embedded and standalone execution. */
export interface PluginContext<Options> {
  /** Options belonging to this registration. */
  readonly options: Options;

  /** Registration lifetime signal. */
  readonly signal: AbortSignal;

  /** Structural source context hosting this registration. */
  readonly player: PluginPlayer;

  /** Register an owned operation handler.
   * @param operation Operation name.
   * @param handler Typed implementation.
   * @param options Ordering and routing metadata.
   * @returns An idempotent subscription removal function.
   */
  on<K extends OperationName>(operation: K, handler: OperationHandler<K>, options?: HandlerOptions): () => void;

  /** Supply one locally owned implementation of a declared singleton capability.
   * @param capability Provider capability declared by the embedding Player.
   * @param implementation Registration-owned implementation.
   */
  provide<K extends keyof ProviderMap>(capability: K, implementation: ProviderMap[K]): void;

  /** Register cleanup, run in reverse order after active handlers settle.
   * @param callback Resource cleanup.
   */
  onCleanup(callback: () => void | Promise<void>): void;
}

/** Source declaration reusable across Player instances. */
export interface PluginDefinition<Options> {
  /** Unique registration identifier. */
  id: string;

  /** Existing HTTP deployment providing this provider's metadata capabilities. */
  remoteHost?: RemotePluginHostOptions;

  /** Default operation priority. */
  priority?: number;

  /** Initialize owned resources and handlers.
   * @param ctx Registration context.
   */
  setup?(ctx: PluginContext<Options>): void | Promise<void>;

  /** Optional teardown after calls have drained.
   * @param ctx Registration context.
   */
  destroy?(ctx: PluginContext<Options>): void | Promise<void>;
}

/** Registration descriptor produced by a factory. */
export interface PluginRegistration<Options = unknown> {
  /** Reusable source declaration. */
  definition: PluginDefinition<Options>;

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
  definition: PluginDefinition<Options>,
): PluginFactory<Options> {
  return ((options: Options = {} as Options) => ({
    definition,
    options,
  })) as PluginFactory<Options>;
}
