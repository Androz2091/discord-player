import { serialize, deserialize, type SerializedEntityUnion } from '../utils/serde.js';
import { parseEntity } from '../utils/parse-serialized-entity.js';
import type { Playlist } from '../structures/playlist.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { registerRemote, discoverRemote, type RemotePluginHostOptions, type RemoteProvider } from '../remote.js';
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
  ProviderReference,
  OperationMap,
  ProviderMap,
} from './types.js';
import type { LegacyPlayerContext } from '../legacy-player.js';

export { PluginError } from './plugin-error.js';
export type { ExecuteOptions, StreamResolutionOptions } from './execution-options.js';

/** Context-owned capability registry. Removal aborts and drains calls before teardown. */
export class PluginRegistry {
  private providerNames = new Set<keyof ProviderMap>();

  private sealedProviders = new Set<keyof ProviderMap>();

  private providersIndex = new Map<
    keyof ProviderMap,
    { entry: Entry; value: unknown; dispose?: () => Promise<void> }
  >();

  /** Enable a local singleton capability before setup. Source hosts do not enable playback providers.
   * @param name Provider capability name.
   */
  public defineProvider<K extends keyof ProviderMap>(name: K): void {
    this.providerNames.add(name);
  }

  /** Read the selected provider registration lifetime.
   * @param name Provider capability name.
   * @returns Registration cancellation signal, absent for the default implementation.
   */
  public providerSignal<K extends keyof ProviderMap>(name: K): AbortSignal | undefined {
    return this.providersIndex.get(name)?.entry.controller.signal;
  }

  /** Select and seal a provider before resource initialization. Later replacement registrations fail.
   * @param name Provider capability name.
   * @param dispose Release owned framework resources before plugin teardown.
   * @returns The active implementation, or undefined for the framework default.
   */
  public selectProvider<K extends keyof ProviderMap>(
    name: K,
    dispose: () => Promise<void>,
  ): ProviderMap[K] | undefined {
    if (this.sealedProviders.has(name)) throw new Error(`Provider already selected: ${String(name)}`);
    this.sealedProviders.add(name);
    const provider = this.providersIndex.get(name);
    if (!provider?.entry.active) return undefined;
    provider.dispose = dispose;
    return provider.value as ProviderMap[K];
  }

  private advertisements = new WeakMap<object, RemoteProvider[]>();

  private entries = new Map<string, Entry>();

  private handlers = new Map<OperationName, Handler[]>();

  private synchronous = new Set<OperationName>();

  private dispatching = false;

  private calls = new AsyncLocalStorage<ReadonlySet<OperationName>>();

  private initializing = new Set<Promise<void>>();

  private order = 0;

  private resultOwners = new WeakMap<object, Entry>();

  private destroyed = false;

  private readonly lifetime = new AbortController();

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
    ['serialization.beforeRestore', 'pipe'],
    ['serialization.afterSerialize', 'pipe'],
    ['media.beforeResolve', 'pipe'],
    ['search.beforeQuery', 'pipe'],
    ['search.afterResults', 'pipe'],
    ['media.descriptor', 'pipe'],
    ['media.transform', 'pipe'],
    ['lyrics.search', 'collect'],
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
   * @param synchronous Whether callbacks must complete before returning; required for interception.
   */
  public defineOperation<K extends OperationName>(
    name: K,
    policy: OperationMap[K]['policy'],
    synchronous = false,
  ): void {
    if ((policy as DispatchPolicy) === 'intercept' && !synchronous)
      throw new TypeError('Interception requires synchronous dispatch.');
    if (synchronous && policy === 'collect') throw new TypeError('Synchronous collection dispatch is unsupported.');
    if (this.definitions.has(name)) {
      throw new Error(`Operation already defined: ${name}`);
    }

    this.definitions.set(name, policy);
    if (synchronous) this.synchronous.add(name);
  }

  /** Whether an ID is reserved or active.
   * @param id Plugin ID.
   * @param hostId Optional deployment constraint.
   */
  public has(id: string, hostId?: string): boolean {
    return [...this.entries.values()].some(
      (entry) => entry.id === id && (!hostId || entry.registration.definition.remoteHost?.hostId === hostId),
    );
  }

  /** Registration lifetime for transport-owned ephemeral state.
   * @internal
   * @param id Source provider identifier.
   * @returns Lifetime signal, or undefined for an absent registration.
   */
  public registrationSignal(id: string): AbortSignal | undefined {
    return this.entries.get(id)?.controller.signal;
  }

  /** List active provider/deployment references in priority and registration order.
   * @param operation Capability to inspect.
   * @returns Unique eligible provider/deployment references.
   */
  public providers(operation: OperationName): ProviderReference[] {
    const seen = new Set<string>();
    return selectHandlers(
      operation,
      {},
      {},
      {
        handlers: this.handlers,
        definitions: this.definitions,
        blocked: () => this.blocked(),
        resultOwners: this.resultOwners,
      },
    ).flatMap((handler) => {
      const pluginId = handler.entry.id;
      const hostId = handler.entry.registration.definition.remoteHost?.hostId;
      const key = `${hostId ?? ''}::${pluginId}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ pluginId, ...(hostId ? { hostId } : {}), data: null }];
    });
  }

  /** Check whether a deployment has an owned registration.
   * @param hostId Deployment identity.
   */
  public hasHost(hostId: string): boolean {
    return [...this.entries.values()].some((entry) => entry.registration.definition.remoteHost?.hostId === hostId);
  }

  /** Advertise only actual local operation handlers.
   * @returns Serializable provider capability descriptions.
   */
  public describe() {
    return [...this.entries.values()]
      .filter((entry) => entry.active)
      .map((entry) => {
        const handlers = [...entry.handlers];
        const operations = [...new Set(handlers.map((handler) => handler.operation))];
        return {
          id: entry.id,
          operations,
          protocols: [
            ...new Set(
              handlers
                .filter((handler) => handler.operation.startsWith('search.query.'))
                .flatMap((handler) => handler.protocols ?? []),
            ),
          ],
          priorities: Object.fromEntries(
            operations.map((operation) => [
              operation,
              Math.max(
                ...handlers
                  .filter((handler) => handler.operation === operation)
                  .map((handler) => handler.priority ?? 0),
              ),
            ]),
          ),
          subscriptions: handlers.map((handler) => ({
            operation: handler.operation,
            priority: handler.priority ?? 0,
            guildIds: handler.guildIds,
            order: handler.order,
          })),
        };
      });
  }

  /** Register all advertised providers from an existing HTTP deployment.
   * @param host Existing deployment and authentication.
   * @param signal Caller lifetime.
   */
  public async registerHost(host: RemotePluginHostOptions, signal: AbortSignal = this.lifetime.signal): Promise<void> {
    signal = AbortSignal.any([signal, this.lifetime.signal]);
    signal.throwIfAborted();
    const providers = await discoverRemote(host, signal);
    const owned: string[] = [];
    try {
      for (const provider of providers) {
        signal.throwIfAborted();
        if (this.has(provider.id, host.hostId)) continue;
        const registration = { definition: { id: provider.id, remoteHost: host }, options: {} };
        this.advertisements.set(registration, providers);
        await this.register(registration);
        owned.push(provider.id);
      }
      await this.ready();
      signal.throwIfAborted();
    } catch (error) {
      const results = await Promise.allSettled(owned.map((id) => this.unregister(id, host.hostId)));
      const cleanup = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
      if (cleanup.length)
        throw new AggregateError([error, ...cleanup], 'Remote provider registration and cleanup failed', {
          cause: error,
        });
      throw error;
    }
  }

  /** Whether an active matching handler explicitly accepts a protocol.
   * @param protocol Query prefix without punctuation.
   * @param options Source targeting and block list.
   */
  public supportsProtocol(protocol: string, options: ExecuteOptions = {}): boolean {
    return (['search.query.match', 'search.query.resolve'] as const)
      .flatMap((name) => this.handlers.get(name) ?? [])
      .some(
        (handler) =>
          (handler.operation === 'search.query.match' || handler.operation === 'search.query.resolve') &&
          handler.entry.active &&
          (!options.pluginId || handler.entry.id === options.pluginId) &&
          (options.hostId === undefined ||
            (handler.entry.registration.definition.remoteHost?.hostId ?? null) === options.hostId) &&
          !this.blocked().includes(handler.entry.id) &&
          !options.blocked?.includes(handler.entry.id) &&
          handler.protocols?.includes(protocol),
      );
  }

  /** Ordered owners of a custom query protocol.
   * @param protocol Registered protocol prefix.
   * @param options Targeting and block list.
   * @returns Eligible provider identities, in dispatch order.
   */
  public protocolMatches(protocol: string, options: ExecuteOptions = {}) {
    const handlers = (['search.query.match', 'search.query.resolve'] as const)
      .flatMap((operation) =>
        selectHandlers(operation, { protocol }, options, {
          handlers: this.handlers,
          definitions: this.definitions,
          blocked: () => this.blocked(),
          resultOwners: this.resultOwners,
        }).filter((handler) => handler.protocols?.includes(protocol)),
      )
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.order - b.order);
    const seen = new Set<string>();
    return handlers.flatMap((handler) => {
      const pluginId = handler.entry.id;
      const hostId = handler.entry.registration.definition.remoteHost?.hostId;
      const key = `${hostId ?? ''}::${pluginId}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ pluginId, hostId, score: 0 }];
    });
  }

  /** Register and initialize a source descriptor, reserving its ID synchronously.
   * @param registration Descriptor produced by definePlugin.
   */
  public async register<O>(registration: PluginRegistration<O>): Promise<void> {
    const definition = registration?.definition;

    if (this.destroyed) {
      throw new Error('Plugin host has been destroyed.');
    }

    if (
      !definition ||
      'kind' in definition ||
      !definition.id ||
      (typeof definition.setup !== 'function' && !definition.remoteHost)
    ) {
      throw new TypeError('Expected a plugin registration with setup() or remoteHost.');
    }

    const key = definition.remoteHost ? `${definition.remoteHost.hostId}::${definition.id}` : definition.id;

    if (this.entries.has(key)) {
      throw new Error(`Duplicate plugin ID: ${definition.id}`);
    }

    const controller = new AbortController();
    const entry: Entry = {
      id: definition.id,
      registration,
      controller,
      cleanups: [],
      handlers: new Set(),
      pending: new Set(),
      active: false,
      ready: Promise.resolve(),
      context: undefined!,
    };

    entry.context = {
      player: this.player,
      options: registration.options,
      signal: controller.signal,

      provide: (name, value) => {
        controller.signal.throwIfAborted();
        if (!this.providerNames.has(name)) throw new Error(`Unsupported local provider: ${String(name)}`);
        if (this.sealedProviders.has(name)) throw new Error(`Provider selection is sealed: ${String(name)}`);
        if (this.providersIndex.has(name)) throw new Error(`Duplicate provider: ${String(name)}`);
        if (!value) throw new TypeError(`Provider implementation is required: ${String(name)}`);
        this.providersIndex.set(name, { entry, value });
      },

      on: (operation, fn, options = {}) => {
        controller.signal.throwIfAborted();

        if (!this.definitions.has(operation)) {
          throw new Error(`Undefined operation: ${operation}`);
        }

        if (this.synchronous.has(operation) && fn.constructor.name === 'AsyncFunction')
          throw new TypeError(`Capability ${operation} requires a synchronous callback.`);

        if (!Number.isFinite(options.priority ?? definition.priority ?? 0))
          throw new TypeError('Handler priority must be finite.');

        const handler: Handler = {
          entry,
          operation,
          fn,
          priority: definition.priority,
          ...options,
          ...(definition.remoteHost && definition.priority !== undefined ? { priority: definition.priority } : {}),
          ...(options.guildIds ? { guildIds: Object.freeze([...options.guildIds]) } : {}),
          order: this.order++,
        };

        entry.handlers.add(handler);
        const list = this.handlers.get(operation) ?? [];
        this.handlers.set(
          operation,
          [...list, handler].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.order - b.order),
        );

        return () => {
          entry.handlers.delete(handler);
          const remaining = this.handlers.get(operation)?.filter((item) => item !== handler) ?? [];
          if (remaining.length) this.handlers.set(operation, remaining);
          else this.handlers.delete(operation);
        };
      },

      onCleanup: (callback) => {
        controller.signal.throwIfAborted();
        entry.cleanups.push(callback);
      },
    };

    this.entries.set(key, entry);

    entry.ready = Promise.resolve().then(async () => {
      try {
        if (definition.remoteHost)
          await registerRemote(
            entry.context,
            definition.id,
            definition.remoteHost,
            this.advertisements.get(registration),
          );
        await definition.setup?.(entry.context);
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

    this.initializing.add(entry.ready);
    try {
      await entry.ready;
    } finally {
      this.initializing.delete(entry.ready);
    }
  }

  private async cleanup(entry: Entry): Promise<void> {
    for (const operation of new Set([...entry.handlers].map((handler) => handler.operation))) {
      const remaining = this.handlers.get(operation)?.filter((handler) => handler.entry !== entry) ?? [];
      if (remaining.length) this.handlers.set(operation, remaining);
      else this.handlers.delete(operation);
    }
    entry.handlers.clear();

    const errors: unknown[] = [];

    for (const [name, provider] of this.providersIndex) {
      if (provider.entry !== entry) continue;
      this.providersIndex.delete(name);
      try {
        await provider.dispose?.();
      } catch (error) {
        errors.push(new PluginError(entry.id, String(name), error));
      }
    }

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

    for (const [key, value] of this.entries) if (value === entry) this.entries.delete(key);

    if (errors.length) {
      throw new AggregateError(errors, `Plugin ${entry.id} cleanup failed`);
    }
  }

  /** Abort new and active work, drain handlers, and release resources. Handlers must cooperate with cancellation.
   * @param id Plugin ID.
   * @param hostId Optional deployment identity when the provider exists on multiple hosts.
   * @returns Whether the registration existed.
   */
  public async unregister(id: string, hostId?: string): Promise<boolean> {
    const candidates = [...this.entries.values()].filter((item) => item.id === id);
    if (!hostId && !this.entries.has(id) && candidates.length > 1)
      throw new Error(`Plugin ${id} has multiple deployments; supply hostId to unregister one`);
    const entry = this.entries.get(hostId ? `${hostId}::${id}` : id) ?? (!hostId ? candidates[0] : undefined);

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
    if (this.initializing.size) await Promise.all(this.initializing);
  }

  /** Destroy all registrations, attempting every cleanup even when one fails. */
  public async destroy(): Promise<void> {
    this.destroyed = true;
    this.lifetime.abort();

    const results = await Promise.allSettled([...this.entries.keys()].map((id) => this.unregister(id)));
    const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason);

    if (errors.length) {
      throw new AggregateError(errors, 'Plugin cleanup failed');
    }
  }

  /** Whether an operation has active subscribers. Does not scan unrelated registrations.
   * @param operation Capability name.
   * @returns Whether at least one active handler exists.
   */
  public hasCapability(operation: OperationName): boolean {
    return this.handlers.get(operation)?.some((handler) => handler.entry.active) ?? false;
  }

  /** Reject reentrant application operations from synchronous capability handlers. */
  public assertNotDispatching(): void {
    if (this.dispatching)
      throw new Error('Reentrant application operations inside a capability handler are unsupported.');
  }

  /** Dispatch a synchronous local capability without scheduling promises.
   * @param operation Capability defined with synchronous execution.
   * @param input Validated operation payload.
   * @param options Scope and cancellation constraints.
   * @returns The selected result, or transformed input for pipe operations.
   */
  public executeSync<K extends OperationName>(
    operation: K,
    input: OperationInput<K>,
    options: ExecuteOptions = {},
  ): OperationResult<K> {
    options.signal?.throwIfAborted();
    if (!this.synchronous.has(operation)) throw new Error(`Operation is not synchronous: ${operation}`);
    const policy = this.definitions.get(operation);
    const list = this.handlers.get(operation);
    if (!list?.length) return (policy === 'pipe' ? input : undefined) as OperationResult<K>;
    this.assertNotDispatching();
    this.dispatching = true;
    let value: unknown = input;
    const errors: PluginError[] = [];
    try {
      for (const handler of selectHandlers(operation, input, options, {
        handlers: this.handlers,
        definitions: this.definitions,
        blocked: this.blocked,
        resultOwners: this.resultOwners,
      })) {
        const signal = options.signal
          ? AbortSignal.any([options.signal, handler.entry.controller.signal])
          : handler.entry.controller.signal;
        signal.throwIfAborted();
        try {
          const result = handler.fn(policy === 'pipe' || policy === 'intercept' ? value : input, { signal });
          if (result && typeof result === 'object' && 'then' in result) {
            const pending = Promise.resolve(result);
            handler.entry.pending.add(pending);
            void pending.then(
              () => handler.entry.pending.delete(pending),
              () => handler.entry.pending.delete(pending),
            );
            throw new TypeError('Synchronous capability handlers must not return promises.');
          }
          signal.throwIfAborted();
          if (result !== undefined && policy === 'intercept') {
            if (!result || typeof result !== 'object' || !('action' in result))
              throw new TypeError('Expected an explicit capability decision.');
            if (result.action === 'cancel') {
              if (!('reason' in result) || typeof result.reason !== 'string')
                throw new TypeError('Cancellation requires a reason.');
              return result as unknown as OperationResult<K>;
            }
            if (result.action !== 'replace' || !('value' in result)) throw new TypeError('Expected cancel or replace.');
            value = result.value;
          }
          if (result !== undefined && policy === 'first') return result as unknown as OperationResult<K>;
          if (result !== undefined && policy === 'pipe') value = result;
        } catch (cause) {
          const error = new PluginError(handler.entry.id, operation, cause);
          if (policy !== 'broadcast') throw error;
          errors.push(error);
        }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, `Observers failed during ${operation}`);
      return (
        policy === 'pipe' ? value : policy === 'intercept' ? { action: 'replace', value } : undefined
      ) as OperationResult<K>;
    } finally {
      this.dispatching = false;
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
    if (this.synchronous.has(operation)) return this.executeSync(operation, input, options);
    const guarded =
      operation.startsWith('media.') ||
      operation.startsWith('serialization.') ||
      operation === 'search.beforeQuery' ||
      operation === 'search.afterResults';
    if (!guarded) return this.run(operation, input, options);
    const active = this.calls.getStore();
    if (active?.has(operation)) throw new Error(`Recursive capability dispatch: ${operation}`);
    return this.calls.run(new Set([...(active ?? []), operation]), () => this.run(operation, input, options));
  }

  private async run<K extends OperationName>(
    operation: K,
    input: OperationInput<K>,
    options: ExecuteOptions,
    handled?: HandledCallback,
  ): Promise<OperationResult<K>> {
    const track = input && typeof input === 'object' && 'track' in input ? input.track : undefined;

    if (
      track?.sourceReference?.hostId &&
      track.sourceReference.hostId !== this.hostId &&
      !(this.handlers.get(operation) ?? []).some(
        (handler) =>
          handler.operation === operation &&
          handler.entry.active &&
          handler.entry.registration.definition.remoteHost?.hostId === track.sourceReference?.hostId,
      )
    ) {
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
    if (this.hasCapability('media.transform')) return true;
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

  /** Serialize using modern application-metadata transformations. Plain model serialization remains synchronous.
   * @param entity Track or playlist to persist.
   * @param options Cancellation and provider scope.
   * @returns A validated JSON persistence payload, without playback grants or live streams.
   */
  public async serialize(entity: Track | Playlist, options: ExecuteOptions = {}): Promise<SerializedEntityUnion> {
    const input = serialize<SerializedEntityUnion>(entity);
    const result = this.hasCapability('serialization.afterSerialize')
      ? await this.execute('serialization.afterSerialize', input, options)
      : input;
    return parseEntity(result);
  }

  /** Restore through modern metadata transformations and the existing schema validator.
   * @param payload Untrusted persistence payload.
   * @param options Cancellation and provider scope.
   * @returns A restored entity without ephemeral playback state.
   */
  public async restore(payload: unknown, options: ExecuteOptions = {}): Promise<Track | Playlist> {
    const input = parseEntity(payload);
    const result = this.hasCapability('serialization.beforeRestore')
      ? await this.execute('serialization.beforeRestore', input, options)
      : input;
    return deserialize(parseEntity(result));
  }

  /** Resolve and normalize a track for the already selected Remedia node.
   * @param track Data model with a portable provider reference.
   * @param options Target node mode and cancellation.
   */
  public async resolveStream(track: Track, options: StreamResolutionOptions = {}): Promise<MediaSource> {
    if (this.hasCapability('media.beforeResolve')) {
      const originalPluginId = track.sourceReference?.pluginId;
      const originalHostId = track.sourceReference?.hostId;
      const prepared = await this.execute('media.beforeResolve', { track }, { signal: options.signal });
      if (
        !prepared ||
        prepared.track.sourceReference?.pluginId !== originalPluginId ||
        prepared.track.sourceReference?.hostId !== originalHostId
      )
        throw new TypeError('media.beforeResolve must preserve provider and deployment identity.');
      track = prepared.track;
    }
    return resolveTrackStream(
      track,
      options,
      (operation, input, execution, handled) => this.run(operation, input, execution, handled),
      (owner) => this.hasStreamTransforms(owner, options),
      (operation) => this.hasCapability(operation),
    );
  }
}
