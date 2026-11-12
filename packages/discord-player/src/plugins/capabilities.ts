import type { GuildQueueEventsMap } from '../structures/common/guild-queue-events.js';
import type { Operation, OperationInput, PluginRegistry } from '@discord-player/plugin-host';
import type { GuildQueueOptions, QueueRepeatMode } from '../structures/guild-queue.js';
import { Track } from '../structures/track.js';

/** An explicit veto or replacement from a modern plugin. Undefined leaves the input unchanged. */
export type CapabilityDecision<T> =
  | { readonly action: 'cancel'; readonly reason: string }
  | { readonly action: 'replace'; readonly value: T };

/** Portable queue identity; no mutable queue internals are exposed. */
export interface QueueCapabilityContext {
  /** Guild owning this operation. */
  readonly guildId: string;
}

/** Queue admission input. Returned tracks are validated before capacity checks and commit. */
export interface QueueAdmission extends QueueCapabilityContext {
  /** Detached batch of canonical Track references. */
  readonly tracks: readonly Track[];
  /** Insertion position, or null for append. */
  readonly index: number | null;
}

/** One candidate occurrence, distinguished even when the Track repeats. */
export interface TrackCandidate {
  /** Stable occurrence identity. */
  readonly entryId: string;
  /** Track identifier. */
  readonly id: string;
  /** Public title. */
  readonly title: string;
}

/** Selection policy shared by ordinary playback and crossfade staging. */
export interface QueueSelection extends QueueCapabilityContext {
  /** Detached occurrence descriptions. */
  readonly candidates: readonly TrackCandidate[];
  /** Framework's proposed occurrence index. */
  readonly index: number;
  /** Whether selection is speculative staging. */
  readonly crossfade: boolean;
}

/** Actual public queue event arguments, after the queue object, in their documented order. */
export type QueueEventObservation = {
  [K in keyof GuildQueueEventsMap]: QueueCapabilityContext & {
    /** Public event discriminant. */
    readonly event: K;
    /** Detached argument tuple, retaining original typed payloads. */
    readonly args: GuildQueueEventsMap[K] extends [unknown, ...infer Rest] ? Readonly<Rest> : never;
  };
}[keyof GuildQueueEventsMap];

/** Public operation inputs for synchronous local interception. */
export interface LocalCapabilityInputs {
  /** Before admission through add/insert/copy/prepend/append. */
  'queue.beforeAdd': QueueAdmission;
  /** Before allocating and caching a queue. */
  'queue.beforeCreate': QueueCapabilityContext & {
    /** Detached initial defaults; metadata retains the application's generic type. */
    readonly configuration: Readonly<Pick<GuildQueueOptions, 'volume' | 'maxSize' | 'maxHistorySize' | 'repeatMode'>>;
  };
  /** Before changing an audio filtergraph. */
  'audio.beforeFilters': QueueCapabilityContext & { readonly graph: string | null };
  /** Before shuffle policy changes. */
  'queue.beforeShuffle': QueueCapabilityContext;
  /** Before Remedia initialization. */
  'player.beforeInitialize': { readonly playerId: string; readonly clientId: string };
  /** Before changing queue capacity or history limits. */
  'queue.beforeConfigure': QueueCapabilityContext;
  /** Before starting a previous history Track. */
  'playback.beforeHistory': QueueCapabilityContext;
  /** Before creating a voice session or moving its channel. */
  'voice.beforeSession': QueueCapabilityContext & { readonly channelId: string };
  /** Before an emptiness/end/stop disconnect policy executes. */
  'voice.beforeLeave': QueueCapabilityContext & { readonly reason: 'empty' | 'end' | 'stop' };
  /** Before automatically pausing an occupied or empty channel. */
  'voice.beforeAutoPause': QueueCapabilityContext;
  /** Override the related-track candidate index. */
  'queue.selectRelated': QueueSelection;
  /** Before removing an occurrence. */
  'queue.beforeRemove': QueueCapabilityContext;
  /** Before moving an occurrence. */
  'queue.beforeMove': QueueCapabilityContext;
  /** Before swapping occurrences. */
  'queue.beforeSwap': QueueCapabilityContext;
  /** Before clearing upcoming tracks and history. */
  'queue.beforeClear': QueueCapabilityContext;
  /** Choose an existing occurrence by index. */
  'queue.selectNext': QueueSelection;
  /** Before changing repeat policy. */
  'queue.beforeRepeat': QueueCapabilityContext & { readonly mode: QueueRepeatMode };
  /** Before changing metadata. */
  'queue.beforeMetadata': QueueCapabilityContext & { readonly metadata: unknown };
  /** Before starting a managed playback request. */
  'playback.beforeStart': QueueCapabilityContext & {
    /** Detached managed Track inputs, before queue admission. */
    readonly tracks: readonly Track[];
  };
  /** Before skipping managed playback. */
  'playback.beforeSkip': QueueCapabilityContext;
  /** Before stopping managed playback. */
  'playback.beforeStop': QueueCapabilityContext;
  /** Before seeking. */
  'playback.beforeSeek': QueueCapabilityContext & { readonly positionMs: number };
  /** Before pausing. */
  'playback.beforePause': QueueCapabilityContext;
  /** Before resuming. */
  'playback.beforeResume': QueueCapabilityContext;
  /** Before connecting or moving the queue. */
  'voice.beforeConnect': QueueCapabilityContext;
  /** Before updating volume. */
  'audio.beforeVolume': QueueCapabilityContext & { readonly volume: number };
}

type LocalContracts = {
  [K in keyof LocalCapabilityInputs]: Operation<
    LocalCapabilityInputs[K],
    CapabilityDecision<LocalCapabilityInputs[K]>,
    'intercept'
  >;
};

declare module '@discord-player/plugin-host' {
  interface SynchronousOperationMap extends LocalCapabilityInputs {
    'queue.changed': true;
    'queue.created': true;
    'queue.destroyed': true;
    'queue.event': true;
    'player.ready': true;
    'player.initialized': true;
    'player.destroying': true;
  }
  interface OperationMap extends LocalContracts {
    /** Observe committed queue operations. */
    'queue.changed': Operation<QueueCapabilityContext & { readonly size: number }, void, 'broadcast'>;
    /** Observe queue creation after caching. */
    'queue.created': Operation<QueueCapabilityContext, void, 'broadcast'>;
    /** Observe destruction after mandatory cleanup. */
    'queue.destroyed': Operation<QueueCapabilityContext, void, 'broadcast'>;
    /** Observe actual public queue events, including errors and crossfade lifecycle. */
    'queue.event': Operation<QueueEventObservation, void, 'broadcast'>;
    /** Observe initialized Remedia resources. */
    'player.initialized': Operation<{ readonly playerId: string }, void, 'broadcast'>;
    /** Observe mandatory shutdown before plugins are disposed. */
    'player.destroying': Operation<{ readonly playerId: string }, void, 'broadcast'>;
    /** Observe ready registrations. */
    'player.ready': Operation<{ readonly playerId: string }, void, 'broadcast'>;
  }
}

/** Cancellation requested by a modern capability handler. */
export class CapabilityCancelledError extends Error {
  /** Construct an explicit policy rejection.
   * @param operation Rejected operation.
   * @param reason Plugin's public explanation.
   */
  constructor(
    public readonly operation: string,
    reason: string,
  ) {
    super(`${operation}: ${reason}`);
    this.name = 'CapabilityCancelledError';
  }
}

/** Install local-only contracts before plugin setup. Standalone runtimes do not install these. @internal
 * @param registry Player-owned shared operation registry.
 */
export function installLocalCapabilities(registry: PluginRegistry): void {
  for (const name of [
    'player.beforeInitialize',
    'queue.beforeConfigure',
    'playback.beforeHistory',
    'voice.beforeSession',
    'voice.beforeLeave',
    'voice.beforeAutoPause',
    'queue.selectRelated',
    'queue.beforeCreate',
    'audio.beforeFilters',
    'queue.beforeShuffle',
    'queue.beforeAdd',
    'queue.beforeRemove',
    'queue.beforeMove',
    'queue.beforeSwap',
    'queue.beforeClear',
    'queue.selectNext',
    'queue.beforeRepeat',
    'queue.beforeMetadata',
    'playback.beforeStart',
    'playback.beforeSkip',
    'playback.beforeStop',
    'playback.beforeSeek',
    'playback.beforePause',
    'playback.beforeResume',
    'voice.beforeConnect',
    'audio.beforeVolume',
  ] as const)
    registry.defineOperation(name, 'intercept', true);

  for (const name of [
    'queue.changed',
    'queue.created',
    'queue.destroyed',
    'queue.event',
    'player.ready',
    'player.initialized',
    'player.destroying',
  ] as const)
    registry.defineOperation(name, 'broadcast', true);
}

/** Run a controlled synchronous interception. @internal
 * @param registry Owning registry.
 * @param operation Operation name.
 * @param input Detached operation input.
 * @returns Original or explicitly replaced input.
 */
export function intercept<K extends keyof LocalCapabilityInputs>(
  registry: PluginRegistry,
  operation: K,
  input: LocalCapabilityInputs[K],
): LocalCapabilityInputs[K] {
  registry.assertNotDispatching();
  if (!registry.hasCapability(operation)) return input;
  const result = registry.executeSync(operation, Object.freeze(input) as OperationInput<K>) as
    | CapabilityDecision<LocalCapabilityInputs[K]>
    | undefined;
  if (!result) return input;
  if (result.action === 'cancel') throw new CapabilityCancelledError(operation, result.reason);
  if (
    result.action !== 'replace' ||
    !result.value ||
    ('guildId' in input && (!('guildId' in result.value) || result.value.guildId !== input.guildId))
  )
    throw new TypeError(`Invalid replacement for ${operation}`);
  return result.value;
}

/** Validate transformed admission without exposing the underlying collection. @internal
 * @param input Admission decision.
 * @returns Detached validated Track batch.
 */
export function admissionTracks(input: QueueAdmission): Track[] {
  if (!Array.isArray(input.tracks) || !input.tracks.every((track) => track instanceof Track))
    throw new TypeError('queue.beforeAdd must return Track instances.');
  return [...input.tracks];
}
