import { firstActivePlayer } from './active-players.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DiscordPlayer } from './player.js';
import type { GuildQueue } from './structures/guild-queue.js';
import type { GuildQueueHistory } from './managers/guild-queue-history.manager.js';
import type { NodeResolvable } from './managers/guild-queue.manager.js';
import type { GuildQueuePlayerNode, PlayerTimestamp } from './structures/guild-queue-player-node.js';
import type { Track } from './structures/track.js';
import { IllegalHookInvocationError } from './errors.js';

/** Callback executed inside an asynchronous context scope. */
export type ContextReceiver<Result> = () => Result;

/** Generic AsyncLocalStorage-backed context. */
export class Context<Value> {
  private readonly storage = new AsyncLocalStorage<Value>();

  /**
   * Create a context with an optional fallback value.
   * @param defaultValue Value returned by `consume()` when no context scope is active.
   */
  public constructor(
    /** Value returned by `consume()` when no scope is active. */
    private readonly defaultValue?: Value,
  ) {}

  /** Whether no value is active in the current async execution. */
  public get isLost(): boolean {
    return this.storage.getStore() === undefined;
  }

  /** Read the active value, falling back to the configured default. */
  public consume(): Value | undefined {
    return this.storage.getStore() ?? this.defaultValue;
  }

  /**
   * Run a callback within the supplied context value.
   * @param value Value visible to consumers while the callback runs.
   * @param receiver Callback executed inside the scope.
   * @returns The callback's return value.
   */
  public provide<Result>(
    /** Value visible to consumers while the callback runs. */
    value: Value,
    /** Callback executed inside the scope. */
    receiver: ContextReceiver<Result>,
  ): Result {
    if (value === undefined) throw new Error('Context value may not be undefined.');

    if (typeof receiver !== 'function') throw new TypeError('Context receiver must be a function.');

    return this.storage.run(value, receiver);
  }

  /**
   * Exit the current scope while invoking a callback.
   * @param receiver Callback executed outside this context.
   */
  public exit(
    /** Callback executed outside this context. */
    receiver: ContextReceiver<void>,
  ): void {
    this.storage.exit(receiver);
  }
}

/**
 * Create a generic AsyncLocalStorage context.
 * @param defaultValue Optional fallback value.
 */
export function createContext<Value>(
  /** Optional fallback value. */
  defaultValue?: Value,
): Context<Value> {
  return new Context(defaultValue);
}

/**
 * Read the currently active value of a generic context.
 * @param context Context whose active value should be read.
 */
export function useContext<Value>(
  /** Context whose active value should be read. */
  context: Context<Value>,
): Value | undefined {
  return context.consume();
}

/** Values exposed by a Player context scope. */
export interface PlayerContextValue {
  /** Player instance that established this scope. */
  player: DiscordPlayer;

  /** Guild ID used to resolve the scoped queue. */
  guildId?: string;

  /** Optional structural guild object. */
  guild?: { id: string } | null;

  /** Optional queue supplied to the context. */
  queue?: GuildQueue | null;
}

/** Input accepted by `PlayerContext.provide()`. */
export interface PlayerContextInput {
  /** Guild ID used to resolve the scoped queue. */
  guildId?: string;

  /** Optional structural guild object. */
  guild?: { id: string } | null;

  /** Optional queue supplied to the context. */
  queue?: GuildQueue | null;
}

const activePlayerContext = new AsyncLocalStorage<PlayerContextValue>();

/** Per-Player context provider that also scopes hook helpers to that Player instance. */
export class PlayerContext extends Context<PlayerContextValue> {
  /**
   * Create a scoped context for one Player instance.
   * @param owner Player whose queue manager supplies contextual queue lookup.
   */
  public constructor(
    /** Player whose queue manager supplies contextual queue lookup. */
    private readonly owner: DiscordPlayer,
  ) {
    super();
  }

  /**
   * Provide v7-style command context while preserving isolation between Player instances.
   * @param value Guild or queue values used by hook resolution.
   * @param receiver Callback run in the async context.
   * @returns The callback's return value.
   */
  public override provide<Result>(
    /** Guild or queue values used by hook resolution. */
    value: PlayerContextInput,
    /** Callback run in the async context. */
    receiver: ContextReceiver<Result>,
  ): Result {
    const guildId = value.guildId ?? value.guild?.id ?? value.queue?.guildId;
    const scoped: PlayerContextValue = { ...value, player: this.owner, guildId };

    return activePlayerContext.run(scoped, () => super.provide(scoped, receiver));
  }
}

interface HookContext {
  /** Player owning the current or fallback scope. */
  player: DiscordPlayer;

  /** Active Player context, if any. */
  context: PlayerContextValue | undefined;

  /** Whether the Player was resolved from the global fallback registry. */
  isFallback: boolean;
}

/**
 * Resolve the Player and context used by a hook.
 * @throws {IllegalHookInvocationError} When no Player exists in either context.
 */
function useHooksContext(): HookContext {
  const context = activePlayerContext.getStore();
  const player = context?.player ?? firstActivePlayer();

  if (!player) {
    throw new IllegalHookInvocationError(
      'discord-player',
      'Player context is not available. Create a DiscordPlayer before using this hook.',
    );
  }

  return { player, context, isFallback: context === undefined };
}

/**
 * Read the guild ID supplied by an active context.
 * @param context Active Player context, if any.
 */
function contextGuildId(context: PlayerContextValue | undefined): string | undefined {
  return context?.guildId ?? context?.guild?.id ?? context?.queue?.guildId;
}

/**
 * Resolve the queue targeted by a guild-scoped hook.
 * @param hookName Public hook name used in invocation errors.
 * @param node Explicit queue resolvable supplied by the caller.
 * @param resolution Whether queue instances bypass the owning Player cache.
 */
function resolveHookQueue<Metadata>(
  hookName: string,
  node: NodeResolvable | undefined,
  resolution: 'get' | 'resolve',
): { player: DiscordPlayer; queue: GuildQueue<Metadata> | null } {
  const { player, context, isFallback } = useHooksContext();

  if (node !== undefined) {
    const queue = resolution === 'resolve' ? player.nodes.resolve<Metadata>(node) : player.nodes.get<Metadata>(node);

    return { player, queue };
  }

  if (context?.queue) return { player, queue: context.queue as GuildQueue<Metadata> };

  const guildId = contextGuildId(context);

  if (!guildId) {
    throw new IllegalHookInvocationError(
      hookName,
      isFallback
        ? `${hookName} must be called with an explicit guild argument when not inside a player context.`
        : `${hookName} requires a guild or queue in the active player context, or an explicit guild argument.`,
    );
  }

  const queue =
    resolution === 'resolve' ? player.nodes.resolve<Metadata>(guildId) : player.nodes.get<Metadata>(guildId);

  return { player, queue };
}

/**
 * Read the scoped Player, otherwise the first active registered Player.
 * @throws {IllegalHookInvocationError} When no Player exists in either context.
 */
export function useMainPlayer(): DiscordPlayer {
  return useHooksContext().player;
}

/**
 * Read the raw playback node for a guild queue.
 * @param node Guild queue resolvable; defaults to the guild in the active context.
 */
export function usePlayer<Metadata = unknown>(): GuildQueuePlayerNode<Metadata> | null;
export function usePlayer<Metadata = unknown>(node: NodeResolvable): GuildQueuePlayerNode<Metadata> | null;
export function usePlayer<Metadata = unknown>(node?: NodeResolvable): GuildQueuePlayerNode<Metadata> | null {
  const { queue } = resolveHookQueue<Metadata>('usePlayer', node, 'get');

  return queue?.node ?? null;
}

/**
 * Read a guild queue.
 * @param node Guild queue resolvable; defaults to the guild in the active context.
 */
export function useQueue<Metadata = unknown>(): GuildQueue<Metadata> | null;
export function useQueue<Metadata = unknown>(node: NodeResolvable): GuildQueue<Metadata> | null;
export function useQueue<Metadata = unknown>(node?: NodeResolvable): GuildQueue<Metadata> | null {
  const { queue } = resolveHookQueue<Metadata>('useQueue', node, 'resolve');

  return queue;
}

/**
 * Read a guild queue history manager.
 * @param node Guild queue resolvable; defaults to the guild in the active context.
 */
export function useHistory<Metadata = unknown>(): GuildQueueHistory<Metadata> | null;
export function useHistory<Metadata = unknown>(node: NodeResolvable): GuildQueueHistory<Metadata> | null;
export function useHistory<Metadata = unknown>(node?: NodeResolvable): GuildQueueHistory<Metadata> | null {
  const { queue } = resolveHookQueue<Metadata>('useHistory', node, 'get');

  return queue?.history ?? null;
}

/** Functional metadata update. */
export type SetterFN<T, P> = (previous: P) => T;

/** Read and write queue metadata. */
export type MetadataDispatch<T> = readonly [() => T, (metadata: T | SetterFN<T, T>) => void];

/**
 * Read and write guild queue metadata.
 * @param node Guild queue resolvable; defaults to the guild in the active context.
 */
export function useMetadata<T = unknown>(): MetadataDispatch<T>;
export function useMetadata<T = unknown>(node: NodeResolvable): MetadataDispatch<T>;
export function useMetadata<T = unknown>(node?: NodeResolvable): MetadataDispatch<T> {
  const { queue } = resolveHookQueue<T>('useMetadata', node, 'get');

  const getter = () => queue?.metadata as T;
  const setter = (metadata: T | SetterFN<T, T>) => {
    if (!queue) return;

    if (typeof metadata === 'function') {
      queue.setMetadata((metadata as SetterFN<T, T>)(queue.metadata));

      return;
    }

    queue.setMetadata(metadata);
  };

  return [getter, setter] as const;
}

/** Functional volume update. */
export type VolumeSetterFN = (previous: number) => number;

/** Read and write queue volume, awaited because Remedia applies gain asynchronously. */
export type VolumeDispatch = readonly [() => number, (volume: number | VolumeSetterFN) => Promise<boolean | undefined>];

/**
 * Read and write guild queue volume.
 * @param node Guild queue resolvable; defaults to the guild in the active context.
 */
export function useVolume(): VolumeDispatch;
export function useVolume(node: NodeResolvable): VolumeDispatch;
export function useVolume(node?: NodeResolvable): VolumeDispatch {
  const { queue } = resolveHookQueue('useVolume', node, 'get');

  const getter = () => queue?.node.volume as number;
  const setter = async (volume: number | VolumeSetterFN) => {
    if (!queue) return undefined;

    const next = typeof volume === 'function' ? volume(queue.node.volume) : volume;

    await queue.node.setVolume(next);

    return true;
  };

  return [getter, setter] as const;
}

/** Options controlling the queue timeline exposed by {@link useTimeline}. */
export interface TimelineDispatcherOptions {
  /** Whether to prefer the last source snapshot over the live playback position. */
  ignoreFilters: boolean;

  /** Queue to control; defaults to the guild in the active context. */
  node: NodeResolvable;
}

/** Live controller for a guild queue's current playback. */
export interface GuildQueueTimeline {
  /** Current and total playback time, or null when no Track is selected. */
  readonly timestamp: PlayerTimestamp | null;

  /** Volume percentage, from zero through two hundred. */
  readonly volume: number;

  /** Whether playback is paused. */
  readonly paused: boolean;

  /** Current queue Track, including a paused Track. */
  readonly track: Track | null;

  /** Pause the current Remedia session. */
  pause(): Promise<boolean>;

  /** Resume the current Remedia session. */
  resume(): Promise<boolean>;

  /** Set volume using Discord Player's percentage convention. */
  setVolume(vol: number): Promise<boolean>;

  /** Seek the current Remedia session to a media position in milliseconds. */
  setPosition(time: number): Promise<boolean>;
}

/**
 * Read and control the current guild queue playback.
 * @param options Optional queue target and filter-aware timeline selection.
 * @remarks Control methods are asynchronous because Remedia owns the session.
 */
export function useTimeline(): GuildQueueTimeline | null;
export function useTimeline(options: Partial<TimelineDispatcherOptions>): GuildQueueTimeline | null;
export function useTimeline(options?: Partial<TimelineDispatcherOptions>): GuildQueueTimeline | null {
  const { queue } = resolveHookQueue('useTimeline', options?.node, 'get');

  if (!queue) return null;

  const timeline = Object.preventExtensions({
    get timestamp() {
      return queue.node.getTimestamp(options?.ignoreFilters);
    },
    get volume() {
      return queue.node.volume;
    },
    get paused() {
      return queue.node.isPaused();
    },
    get track() {
      return queue.currentTrack;
    },
    async pause() {
      if (!queue.node.getSession(false)) return false;

      await queue.node.pause();

      return true;
    },
    async resume() {
      if (!queue.node.getSession(false)) return false;

      await queue.node.resume();

      return true;
    },
    async setVolume(vol: number) {
      await queue.node.setVolume(vol);

      return true;
    },
    async setPosition(time: number) {
      if (!queue.node.getSession(false) || !queue.currentTrack) return false;

      await queue.node.seek(time);

      return true;
    },
  } satisfies GuildQueueTimeline);

  return timeline;
}
