import { Player } from '../Player';
import { Collection } from '@discord-player/utils';
import { BaseExtractor, ExtractorStreamable } from './BaseExtractor';
import { Util } from '../utils/Util';
import { PlayerEventsEmitter } from '../utils/PlayerEventsEmitter';
import { TypeUtil } from '../utils/TypeUtil';
import { Track } from '../fabric';
import { createContext } from '../hooks';
import { BridgeFailedError } from '../errors';

export interface ExtractorSession {
  id: string;
  attemptedExtractors: Set<string>;
  bridgeAttemptedExtractors: Set<string>;
}

export interface ExtractorExecutionEvents {
  /**
   * Emitted when a extractor is registered
   * @param context The context where extractor was registered
   * @param extractor The extractor that was registered
   */
  registered: (
    context: ExtractorExecutionContext,
    extractor: BaseExtractor,
  ) => unknown;
  /**
   * Emitted when a extractor is unregistered
   * @param context The context where extractor was unregistered
   * @param extractor The extractor that was unregistered
   */
  unregistered: (
    context: ExtractorExecutionContext,
    extractor: BaseExtractor,
  ) => unknown;
  /**
   * Emitted when a extractor is activated
   * @param context The context where this event occurred
   * @param extractor The extractor which was activated
   */
  activate: (
    context: ExtractorExecutionContext,
    extractor: BaseExtractor,
  ) => unknown;
  /**
   * Emitted when a extractor is deactivated
   * @param context The context where this event occurred
   * @param extractor The extractor which was deactivated
   */
  deactivate: (
    context: ExtractorExecutionContext,
    extractor: BaseExtractor,
  ) => unknown;
  /**
   * Emitted when a extractor fails to activate/deactivate
   * @param context The context where this event occurred
   * @param extractor The extractor which was deactivated
   */
  error: (
    context: ExtractorExecutionContext,
    extractor: BaseExtractor,
    error: Error,
  ) => unknown;
}

export class ExtractorExecutionContext extends PlayerEventsEmitter<ExtractorExecutionEvents> {
  /**
   * The extractors store
   */
  public store = new Collection<string, BaseExtractor>();

  public readonly context = createContext<ExtractorSession>();

  public constructor(public player: Player) {
    super(['error']);
  }

  /**
   * Get the current execution id
   */
  public getExecutionId(): string | null {
    return this.context.consume()?.id ?? null;
  }

  /**
   * Get the current execution context
   */
  public getContext() {
    return this.context.consume() ?? null;
  }

  public async loadDefault() {
    const sample = `\timport { DefaultExtractors } from '@discord-player/extractor';\n\tawait player.extractors.loadMulti(DefaultExtractors);`;

    throw new Error(
      `extractors.loadDefault() is no longer supported. Use extractors.loadMulti instead. Example:\n${sample}\n`,
    );
  }

  /**
   * Load a bundle of extractors.
   * @example import { DefaultExtractors } from '@discord-player/extractor';
   *
   * await player.extractors.loadMulti(DefaultExtractors);
   */
  public async loadMulti<
    O extends object,
    T extends (typeof BaseExtractor<O>)[],
    R extends Record<
      T[number]['identifier'],
      ConstructorParameters<T[number]>[1]
    >,
  >(bundle: T, options: R = {} as R) {
    bundle.forEach((ext) => {
      // @ts-ignore
      this.register(ext, options?.[ext.identifier] || {});
    });

    return { success: true, error: null };
  }

  /**
   * Validate if the given extractor is registered
   * @param identifier The extractor identifier
   */
  public isRegistered(identifier: string) {
    return this.store.has(identifier);
  }

  /**
   * The size of registered extractors
   */
  public get size() {
    return this.store.size;
  }

  /**
   * Get single extractor
   * @param identifier The extractor to get
   */
  public get(identifier: string) {
    return this.store.get(identifier);
  }

  /**
   * Register single extractor
   * @param _extractor The extractor to register
   * @param options Options supplied to the extractor
   */
  public async register<O extends object, T extends typeof BaseExtractor<O>>(
    _extractor: T,
    options: ConstructorParameters<T>['1'],
  ): Promise<InstanceType<T> | null> {
    if (
      typeof _extractor.identifier !== 'string' ||
      this.store.has(_extractor.identifier)
    )
      return null;
    const extractor = new _extractor(this, options);

    try {
      this.store.set(_extractor.identifier, extractor);
      if (this.player.hasDebugger)
        this.player.debug(`${_extractor.identifier} extractor loaded!`);
      this.emit('registered', this, extractor);
      await extractor.activate();
      if (this.player.hasDebugger)
        this.player.debug(`${_extractor.identifier} extractor activated!`);
      this.emit('activate', this, extractor);
      return extractor as unknown as InstanceType<T>;
    } catch (e) {
      this.store.delete(_extractor.identifier);
      if (this.player.hasDebugger)
        this.player.debug(
          `${_extractor.identifier} extractor failed to activate! Error: ${e}`,
        );
      this.emit('error', this, extractor, e as Error);
      return null;
    }
  }

  /**
   * Unregister single extractor
   * @param _extractor The extractor to unregister
   */
  public async unregister<K extends string | BaseExtractor>(_extractor: K) {
    const extractor =
      typeof _extractor === 'string'
        ? this.store.get(_extractor)
        : this.store.find((r) => r === _extractor);
    if (!extractor) return;

    try {
      const key =
        extractor.identifier || this.store.findKey((e) => e === extractor)!;
      this.store.delete(key);
      if (this.player.hasDebugger)
        this.player.debug(`${extractor.identifier} extractor disabled!`);
      this.emit('unregistered', this, extractor);
      await extractor.deactivate();
      if (this.player.hasDebugger)
        this.player.debug(`${extractor.identifier} extractor deactivated!`);
      this.emit('deactivate', this, extractor);
    } catch (e) {
      if (this.player.hasDebugger)
        this.player.debug(
          `${extractor.identifier} extractor failed to deactivate!`,
        );
      this.emit('error', this, extractor, e as Error);
    }
  }

  /**
   * Unregister all extractors
   */
  public async unregisterAll() {
    try {
      await Promise.all(this.store.map((e) => this.unregister(e)));
    } catch {
      // do nothing
    }
  }

  /**
   * Run all the extractors
   * @param fn The runner function
   * @param filterBlocked Filter blocked extractors
   */
  public async run<T = unknown>(
    fn: ExtractorExecutionFN<T>,
    filterBlocked = true,
  ) {
    const blocked = this.player.options.blockExtractors ?? [];

    if (!this.store.size) {
      Util.warn(
        'Skipping extractors execution since zero extractors were registered',
        'NoExtractors',
      );
      return;
    }

    // sort by priority so that extractors with higher priority are executed first
    const extractors = this.store.sort((a, b) => b.priority - a.priority);

    let err: Error | null = null,
      lastExt: BaseExtractor | null = null;

    for (const ext of extractors.values()) {
      if (filterBlocked && blocked.some((e) => e === ext.identifier)) continue;
      if (this.player.hasDebugger)
        this.player.debug(`Executing extractor ${ext.identifier}...`);
      const result = await fn(ext).then(
        (res) => {
          return res;
        },
        (e) => {
          if (this.player.hasDebugger)
            this.player.debug(
              `Extractor ${ext.identifier} failed with error: ${e}`,
            );

          return TypeUtil.isError(e) ? e : new Error(`${e}`);
        },
      );

      lastExt = ext;

      if (result && !TypeUtil.isError(result)) {
        if (this.player.hasDebugger)
          this.player.debug(
            `Extractor ${ext.identifier} executed successfully!`,
          );

        return {
          extractor: ext,
          error: null,
          result,
        } as ExtractorExecutionResult<T>;
      } else if (TypeUtil.isError(result)) {
        err = result;
      }
    }

    if (err)
      return {
        extractor: lastExt!,
        error: err,
        result: false,
      } as ExtractorExecutionResult<false>;
  }

  /**
   * Request bridge for a track
   * @param track The track to request bridge for
   * @param sourceExtractor The source extractor of the track
   */
  public async requestBridge(
    track: Track,
    sourceExtractor: BaseExtractor | null = track.extractor,
  ) {
    const previouslyAttempted =
      this.getContext()?.bridgeAttemptedExtractors ?? new Set<string>();

    const result = await this.run<ExtractorStreamable>(async (ext) => {
      if (sourceExtractor && ext.identifier === sourceExtractor.identifier)
        return false;
      if (previouslyAttempted.has(ext.identifier)) return false;

      previouslyAttempted.add(ext.identifier);

      const result = await ext.bridge(track, sourceExtractor);

      if (!result) return false;

      return result;
    });

    if (!result?.result)
      throw new BridgeFailedError(
        this.getExecutionId(),
        result?.error?.stack ||
          result?.error?.message ||
          'No extractors available to bridge',
      );

    track.bridgedExtractor = result.extractor;

    return result;
  }

  /**
   * Request bridge from the specified extractor
   * @param track The track to request bridge for
   * @param sourceExtractor The source extractor of the track
   * @param targetExtractor The target extractor to bridge to
   */
  public async requestBridgeFrom(
    track: Track,
    sourceExtractor: BaseExtractor | null,
    targetExtractor: ExtractorResolvable,
  ) {
    const target = this.resolve(targetExtractor);
    if (!target) return null;
    return target.bridge(track, sourceExtractor);
  }

  /**
   * Check if extractor is disabled
   */
  public isDisabled(identifier: string) {
    return this.player.options.blockExtractors?.includes(identifier) ?? false;
  }

  /**
   * Check if extractor is enabled
   */
  public isEnabled(identifier: string) {
    return !this.isDisabled(identifier);
  }

  /**
   * Resolve extractor identifier
   */
  public resolveId(resolvable: ExtractorResolvable) {
    return typeof resolvable === 'string' ? resolvable : resolvable.identifier;
  }

  /**
   * Resolve extractor
   */
  public resolve(resolvable: ExtractorResolvable) {
    return typeof resolvable === 'string' ? this.get(resolvable) : resolvable;
  }
}

export interface ExtractorExecutionResult<T = unknown> {
  extractor: BaseExtractor;
  error: Error | null;
  result: T;
}

export type ExtractorExecutionFN<T = unknown> = (
  extractor: BaseExtractor,
) => Promise<T | boolean>;

export type ExtractorResolvable = string | BaseExtractor;
