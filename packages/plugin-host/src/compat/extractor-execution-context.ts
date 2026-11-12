import { AsyncLocalStorage } from 'node:async_hooks';
import { Collection } from '@discordjs/collection';
import type { LegacyPlayerContext } from '../legacy-player.js';
import type { Track } from '../structures/track.js';
import type { SourceStream } from '../plugins/types.js';
import { BaseExtractor } from './base-extractor.js';
import { createExtractorPlugin } from './extractor-plugin.js';
import type { ExtractorConstructor, ExtractorExecutionResult } from './extractor-types.js';

/** Small legacy ownership adapter; all execution goes through player.plugins. */
export class ExtractorExecutionContext {
  private bridgeAttempts = new AsyncLocalStorage<Set<string>>();

  private instances = new Collection<string, BaseExtractor<any>>();

  /** Read-only view of registered legacy instances. */
  public get store(): ReadonlyMap<string, BaseExtractor<any>> {
    return this.instances;
  }

  /** Number of legacy registrations. */
  public get size(): number {
    return this.instances.size;
  }

  /** Create an adapter owned by one Player.
   * @param player Owning Player.
   */
  constructor(
    /** Player owning legacy registrations. */
    public readonly player: LegacyPlayerContext,
  ) {}

  /** Look up a legacy registration.
   * @param id Extractor identifier.
   */
  public get(id: string): BaseExtractor<any> | undefined {
    return this.instances.get(id);
  }

  /** Test legacy registration membership.
   * @param id Extractor identifier.
   */
  public isRegistered(id: string): boolean {
    return this.instances.has(id);
  }

  /** Check the Player block list.
   * @param id Extractor identifier.
   */
  public isDisabled(id: string): boolean {
    return this.player.options.blockExtractors?.includes(id) ?? false;
  }

  /** Check whether a source is allowed.
   * @param id Extractor identifier.
   */
  public isEnabled(id: string): boolean {
    return !this.isDisabled(id);
  }

  /** Register a legacy class through a source plugin.
   * @param Extractor Legacy BaseExtractor subclass constructor.
   * @param options Original options passed to the instance.
   * @returns The owned compatibility instance.
   */
  public async register<C extends ExtractorConstructor>(
    Extractor: C,
    ...args: {} extends ConstructorParameters<C>[1]
      ? [options?: ConstructorParameters<C>[1]]
      : [options: ConstructorParameters<C>[1]]
  ): Promise<InstanceType<C>> {
    if (
      typeof Extractor !== 'function' ||
      !(Extractor.prototype instanceof BaseExtractor) ||
      typeof Extractor.identifier !== 'string'
    ) {
      throw new TypeError('extractors.register expects a BaseExtractor subclass constructor.');
    }

    const instance = new Extractor(this, args[0] ?? {});
    const plugin = createExtractorPlugin(
      instance,
      this,
      () => this.bridgeAttempts.getStore(),
      () => {
        this.instances.set(instance.identifier, instance);
      },
      () => {
        if (this.instances.get(instance.identifier) === instance) {
          this.instances.delete(instance.identifier);
        }
      },
    );

    await this.player.plugins.register(plugin());

    return instance as InstanceType<C>;
  }

  /** Remove an extractor and its source subscriptions.
   * @param extractor ID or owned instance.
   */
  public async unregister(extractor: string | BaseExtractor<any>): Promise<boolean> {
    return this.player.plugins.unregister(typeof extractor === 'string' ? extractor : extractor.identifier);
  }

  /** Remove all legacy registrations. */
  public async unregisterAll(): Promise<void> {
    for (const id of this.instances.keys()) {
      await this.unregister(id);
    }
  }

  /** Replace an instance through the same registration path.
   * @param id Legacy ID.
   * @param options Replacement options.
   */
  public async reconfigure(id: string, options: object): Promise<BaseExtractor<any>> {
    const instance = this.get(id);

    if (!instance) {
      throw new Error(`Unknown extractor: ${id}`);
    }

    const Constructor = instance.constructor as ExtractorConstructor;

    await this.unregister(id);

    return this.register(Constructor, options);
  }

  /** Register a bundle sequentially with deterministic precedence.
   * @param bundle Legacy constructors.
   * @param options Options keyed by identifier.
   */
  public async loadMulti(bundle: readonly ExtractorConstructor[], options: Record<string, object> = {}): Promise<void> {
    for (const Constructor of bundle) {
      await this.register(Constructor, options[Constructor.identifier] ?? {});
    }
  }

  /** Request explicit bridge fallback using the shared registry.
   * @param track Track needing a bridge.
   * @param sourceExtractor Original provider.
   */
  public async requestBridge(track: Track, sourceExtractor: BaseExtractor<any> | null = track.extractor) {
    const dispatch = () =>
      this.player.plugins.execute(
        'track.bridge',
        { track, sourcePluginId: sourceExtractor?.identifier },
        { blocked: this.player.options.blockExtractors },
      );
    const result = this.bridgeAttempts.getStore()
      ? await dispatch()
      : await this.bridgeAttempts.run(new Set<string>(), dispatch);

    if (result === undefined) {
      throw new Error('No source plugin handled track.bridge');
    }

    return { result, error: null, extractor: track.bridgedExtractor } satisfies ExtractorExecutionResult<SourceStream>;
  }
}
