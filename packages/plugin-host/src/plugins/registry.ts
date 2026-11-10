import type { MediaSource } from '@remedia/client';
import type { Track } from '../structures/track.js';
import { PluginError } from './plugin-error.js';
import { dispatchOperation, selectHandlers } from './operation-dispatch.js';
import { resolveTrackStream } from './stream-resolver.js';
import type { ExecuteOptions, StreamResolutionOptions } from './execution-options.js';
import type { Entry, Handler, HandledCallback } from './registry-internals.js';
import type {
  DispatchPolicy,
  OperationInput,
  OperationName,
  OperationResult,
  PluginRegistration,
  SourceOperationMap,
} from './types.js';
import type { LegacyPlayerContext } from '../legacy-player.js';

export { PluginError } from './plugin-error.js';
export type { ExecuteOptions, StreamResolutionOptions } from './execution-options.js';

/** Context-owned source execution registry. Removal aborts and drains calls before teardown. */
export class PluginRegistry {
  private entries = new Map<string, Entry>();
  private handlers: Handler[] = [];
  private order = 0;
  private resultOwners = new WeakMap<object, Entry>();
  private destroyed = false;

  /** Create an independent host.
   * @param player Structural source context.
   * @param blocked Default disabled source IDs supplied by the owning Player.
   * @param hostId Owning deployment, absent in ordinary embedded execution.
   */
  public constructor(
    public readonly player: LegacyPlayerContext,
    private readonly blocked: () => readonly string[] = () => [],
    private readonly hostId?: string,
  ) {}

  private definitions = new Map<OperationName, DispatchPolicy>([
    ['search.query.match', 'collect'],
    ['search.query.resolve', 'first'],
    ['track.stream', 'first'],
    ['track.related', 'first'],
    ['track.bridge', 'first'],
    ['stream.transform', 'pipe'],
    ['track.stream.resolved', 'broadcast'],
  ]);

  /** Define a declaration-merged operation before registering handlers.
   * @param name Operation name.
   * @param policy Dispatch policy matching its contract.
   */
  public defineOperation<K extends OperationName>(name: K, policy: SourceOperationMap[K]['policy']): void {
    if (this.definitions.has(name)) {
      throw new Error(`Operation already defined: ${name}`);
    }

    this.definitions.set(name, policy);
  }

  /** Whether an ID is reserved or active.
   * @param id Plugin ID.
   */
  public has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Registration lifetime for transport-owned ephemeral state.
   * @internal
   * @param id Source provider identifier.
   * @returns Lifetime signal, or undefined for an absent registration.
   */
  public registrationSignal(id: string): AbortSignal | undefined {
    return this.entries.get(id)?.controller.signal;
  }

  /** Whether an active matching handler explicitly accepts a protocol.
   * @param protocol Query prefix without punctuation.
   * @param options Source targeting and block list.
   */
  public supportsProtocol(protocol: string, options: ExecuteOptions = {}): boolean {
    return this.handlers.some(
      (handler) =>
        handler.operation === 'search.query.match' &&
        handler.entry.active &&
        (!options.pluginId || handler.entry.id === options.pluginId) &&
        !this.blocked().includes(handler.entry.id) &&
        !options.blocked?.includes(handler.entry.id) &&
        handler.protocols?.includes(protocol),
    );
  }

  /** Register and initialize a source descriptor, reserving its ID synchronously.
   * @param registration Descriptor produced by definePlugin.
   */
  public async register<O>(registration: PluginRegistration<O>): Promise<void> {
    const definition = registration?.definition;

    if (this.destroyed) {
      throw new Error('Plugin host has been destroyed.');
    }

    if (!definition || definition.kind !== 'source' || !definition.id || typeof definition.setup !== 'function') {
      throw new TypeError('Expected a source plugin registration descriptor.');
    }

    if (this.entries.has(definition.id)) {
      throw new Error(`Duplicate plugin ID: ${definition.id}`);
    }

    const controller = new AbortController();
    const entry: Entry = {
      id: definition.id,
      registration,
      controller,
      cleanups: [],
      pending: new Set(),
      active: false,
      ready: Promise.resolve(),
      context: undefined!,
    };

    entry.context = {
      player: this.player,
      options: registration.options,
      signal: controller.signal,
      on: (operation, fn, options = {}) => {
        controller.signal.throwIfAborted();

        if (!this.definitions.has(operation)) {
          throw new Error(`Undefined operation: ${operation}`);
        }

        const handler: Handler = {
          entry,
          operation,
          fn,
          ...options,
          order: this.order++,
        };

        this.handlers.push(handler);

        return () => {
          this.handlers = this.handlers.filter((item) => item !== handler);
        };
      },
      onCleanup: (callback) => {
        controller.signal.throwIfAborted();
        entry.cleanups.push(callback);
      },
    };

    this.entries.set(entry.id, entry);

    entry.ready = Promise.resolve().then(async () => {
      try {
        await definition.setup(entry.context);
        entry.active = !controller.signal.aborted;
      } catch (cause) {
        controller.abort();

        try {
          await this.cleanup(entry);
        } catch (cleanup) {
          throw new AggregateError(
            [new PluginError(entry.id, 'setup', cause), cleanup],
            `Plugin ${entry.id} setup and cleanup failed`,
            { cause: cleanup },
          );
        }

        throw new PluginError(entry.id, 'setup', cause);
      }
    });

    await entry.ready;
  }

  private async cleanup(entry: Entry): Promise<void> {
    this.handlers = this.handlers.filter((handler) => handler.entry !== entry);

    const errors: unknown[] = [];

    try {
      await entry.registration.definition.destroy?.(entry.context);
    } catch (error) {
      errors.push(new PluginError(entry.id, 'destroy', error));
    }

    for (const cleanup of entry.cleanups.splice(0).reverse()) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(new PluginError(entry.id, 'cleanup', error));
      }
    }

    if (this.entries.get(entry.id) === entry) {
      this.entries.delete(entry.id);
    }

    if (errors.length) {
      throw new AggregateError(errors, `Plugin ${entry.id} cleanup failed`);
    }
  }

  /** Abort new and active work, drain handlers, and release resources. Handlers must cooperate with cancellation.
   * @param id Plugin ID.
   * @returns Whether the registration existed.
   */
  public async unregister(id: string): Promise<boolean> {
    const entry = this.entries.get(id);

    if (!entry) {
      return false;
    }

    if (entry.removing) {
      return entry.removing;
    }

    entry.active = false;
    entry.controller.abort();

    entry.removing = (async () => {
      try {
        await entry.ready;
      } catch {
        return true;
      }

      await Promise.allSettled([...entry.pending]);
      await this.cleanup(entry);

      return true;
    })();

    return entry.removing;
  }

  /** Initialize pending registrations before dispatch. */
  public async ready(): Promise<void> {
    await Promise.all([...this.entries.values()].map((entry) => entry.ready));
  }

  /** Destroy all registrations, attempting every cleanup even when one fails. */
  public async destroy(): Promise<void> {
    this.destroyed = true;

    const results = await Promise.allSettled([...this.entries.keys()].map((id) => this.unregister(id)));
    const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason);

    if (errors.length) {
      throw new AggregateError(errors, 'Plugin cleanup failed');
    }
  }

  /** Execute using the operation's declared policy. Genuine failures reject immediately.
   * @param operation Typed operation name.
   * @param input Operation payload.
   * @param options Target, block list and cancellation.
   * @returns Result inferred from the operation policy.
   */
  public async execute<K extends OperationName>(
    operation: K,
    input: OperationInput<K>,
    options: ExecuteOptions = {},
  ): Promise<OperationResult<K>> {
    return this.run(operation, input, options);
  }

  private async run<K extends OperationName>(
    operation: K,
    input: OperationInput<K>,
    options: ExecuteOptions,
    handled?: HandledCallback,
  ): Promise<OperationResult<K>> {
    const track = input && typeof input === 'object' && 'track' in input ? input.track : undefined;
    if (track?.sourceReference?.hostId && track.sourceReference.hostId !== this.hostId) {
      throw new Error(
        `Source host ${track.sourceReference.hostId} is unavailable in this runtime; execute this Track on its owning source host`,
      );
    }
    options.signal?.throwIfAborted();
    await this.ready();
    options.signal?.throwIfAborted();

    const result = await dispatchOperation(
      operation,
      input,
      options,
      {
        handlers: this.handlers,
        definitions: this.definitions,
        blocked: () => this.blocked(),
        resultOwners: this.resultOwners,
      },
      handled,
    );
    if (this.hostId && result && (operation === 'search.query.resolve' || operation === 'track.related')) {
      for (const item of (result as { tracks: Track[] }).tracks) {
        if (item.sourceReference) item.sourceReference.hostId = this.hostId;
      }
    }
    return result;
  }

  /** Inspect byte transformations using the same selection rules as execution.
   * @internal
   * @param pluginId Actual stream owner; absent means unrestricted dispatch.
   * @param options Additional provider blocking.
   * @returns Whether a byte transformation would be invoked.
   */
  hasStreamTransforms(pluginId?: string, options: StreamResolutionOptions = {}): boolean {
    return (
      selectHandlers(
        'stream.transform',
        {},
        { ...options, pluginId },
        {
          handlers: this.handlers,
          definitions: this.definitions,
          blocked: () => this.blocked(),
          resultOwners: this.resultOwners,
        },
      ).length > 0
    );
  }

  /** Resolve and normalize a track for the already selected Remedia node.
   * @param track Data model with a portable provider reference.
   * @param options Target node mode and cancellation.
   */
  public async resolveStream(track: Track, options: StreamResolutionOptions = {}): Promise<MediaSource> {
    return resolveTrackStream(
      track,
      options,
      (operation, input, execution, handled) => this.run(operation, input, execution, handled),
      (owner) => this.hasStreamTransforms(owner, options),
    );
  }
}
