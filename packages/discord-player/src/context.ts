import { AsyncLocalStorage } from 'node:async_hooks';
import type { DiscordPlayer } from './player.js';
import type { GuildQueue } from './structures/guild-queue.js';
import type { GuildQueueHistoryManager } from './managers/guild-queue-history.manager.js';
import type { PlayerTimestamp } from './structures/guild-queue-player-node.js';

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

  /** Optional guild ID used to resolve the scoped queue. */
  guildId?: string;

  /** Optional structural guild object. */
  guild?: { id: string } | null;

  /** Optional pre-resolved queue. */
  queue?: GuildQueue | null;

  /** Application metadata attached to the command context. */
  metadata?: unknown;

  /** Contextual volume override. */
  volume?: number;

  /** Contextual player timeline override. */
  timeline?: PlayerTimestamp | null;
}

/** Input accepted by `PlayerContext.provide()`. */
export interface PlayerContextInput {
  /** Optional guild ID used to resolve the scoped queue. */
  guildId?: string;

  /** Optional structural guild object. */
  guild?: { id: string } | null;

  /** Optional pre-resolved queue. */
  queue?: GuildQueue | null;

  /** Application metadata attached to the command context. */
  metadata?: unknown;

  /** Contextual volume override. */
  volume?: number;

  /** Contextual player timeline override. */
  timeline?: PlayerTimestamp | null;
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
   * @param value Guild, queue, metadata, or other application context values.
   * @param receiver Callback run in the async context.
   * @returns The callback's return value.
   */
  public override provide<Result>(
    /** Guild, queue, metadata, or other application context values. */
    value: PlayerContextInput,
    /** Callback run in the async context. */
    receiver: ContextReceiver<Result>,
  ): Result {
    const guildId = value.guildId ?? value.guild?.id;
    const scoped: PlayerContextValue = {
      ...value,
      player: this.owner,
      guildId,
      queue: value.queue ?? (guildId ? this.owner.queues.get(guildId) : null),
    };

    return activePlayerContext.run(scoped, () => super.provide(scoped, receiver));
  }
}

/** Read the Player explicitly associated with the active async scope. */
export function useMainPlayer(): DiscordPlayer | null {
  return activePlayerContext.getStore()?.player ?? null;
}

/** Read the Player associated with the current async scope. */
export function usePlayer(): DiscordPlayer | null {
  return useMainPlayer();
}

/**
 * Resolve a queue in the active Player scope, optionally by explicit guild ID.
 * @param guildId Guild ID to resolve; defaults to the active context's guild.
 */
export function useQueue(
  /** Guild ID to resolve; defaults to the active context's guild. */
  guildId?: string,
): GuildQueue | null {
  const context = activePlayerContext.getStore();

  if (!context) return null;

  if (guildId) return context.player.queues.get(guildId);

  if (context.queue) return context.queue;

  return context.guildId ? context.player.queues.get(context.guildId) : null;
}

/** Read the active queue's history manager. */
export function useHistory(): GuildQueueHistoryManager | null {
  return useQueue()?.history ?? null;
}

/** Read command metadata first, then the active queue metadata. */
export function useMetadata<Value = unknown>(): Value | undefined {
  const context = activePlayerContext.getStore();

  if (!context) return undefined;

  return (context.metadata ?? context.queue?.metadata) as Value | undefined;
}

/** Read contextual volume or the active queue node's percentage volume. */
export function useVolume(): number | null {
  const context = activePlayerContext.getStore();

  if (!context) return null;

  return context.volume ?? context.queue?.node.volume ?? null;
}

/** Read contextual timeline or the active queue node's current timeline. */
export function useTimeline(): PlayerTimestamp | null {
  const context = activePlayerContext.getStore();

  if (!context) return null;

  return context.timeline ?? context.queue?.node.getTimestamp() ?? null;
}
