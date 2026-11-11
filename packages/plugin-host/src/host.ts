import { normalizeLyrics } from './lyrics.js';
import type { MediaSource as ClientMediaSource } from '@remedia/client';
import { authorizeMediaURL, openMedia, type MediaAccessPolicy } from './media.js';
import type { PortableSourceResult } from './protocol.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import {
  createMediaSource,
  createPluginHost,
  type PluginHostOptions,
  type PluginRequest,
  type ExecuteResult,
} from '@remedia/plugin-host';
import { SourcePluginRuntime, type SourcePluginRuntimeOptions } from './runtime.js';
import { Track } from './structures/track.js';
import type { SearchResultData } from './structures/search-result.js';
import { deserialize } from './utils/serde.js';
import { DeferredSourceRequired } from './plugins/stream-resolver.js';
import { serializeSourceTrack } from './protocol.js';
import { cloneJSONValue } from './utils/serialization.js';
import type { SearchOptions } from './types.js';

/** Stable aggregate protocol registration identifier. */
export const SOURCE_PLUGIN_ID = 'discord-player.source';

/** Standalone source host configuration. */
export interface SourcePluginHostOptions extends PluginHostOptions, Omit<SourcePluginRuntimeOptions, 'player'> {
  /** Stable non-secret deployment ID. Required for HTTP; generated only for local handle() usage. */
  hostId?: string;

  /** Return provider URLs directly when no byte transforms are needed. Default proxy.
   * Opt in only when the consuming node can enforce its own DNS/redirect policy and access these URLs.
   * Declared URL-only providers resolve at source.stream invocation; all byte sources remain deferred.
   */
  mediaDelivery?: 'proxy' | 'direct-url';

  /** Providers guaranteed to return only URLs without opening byte resources during track.stream.
   * Required for direct URL optimization; other providers stay lazy. Applicable transforms always force proxying.
   * A provider that violates this promise fails explicitly; legacy and mixed-source providers should be omitted.
   */
  directUrlProviders?: readonly string[];

  /** Remote materialization policy; files and private networks are denied by default. */
  mediaPolicy?: MediaAccessPolicy;

  /** Maximum retained process-local Track references; default 1000. */
  maxTrackStates?: number;

  /** State lifetime in milliseconds; default ten minutes. Expired tracks are reconstructed by URL. */
  trackStateTtlMs?: number;
}

/** Source runtime and the published Remedia transport sharing one set of handlers. */
export class SourcePluginHost {
  /** Source execution independent of transport. */
  readonly runtime: SourcePluginRuntime;

  /** Canonical source plugin registry. */
  readonly plugins;

  /** Legacy constructor registration adapter. */
  readonly extractors;

  /** Underlying generic host; exposes discovery, middleware matching and transport. */
  readonly remedia;

  /** Stable deployment identity, independent of provider identifiers and network addresses. */
  readonly hostId: string;

  private readonly mediaPolicy: MediaAccessPolicy;

  private readonly sweep: ReturnType<typeof setInterval>;

  private readonly explicitHostId: boolean;

  private boundary = new AsyncLocalStorage<boolean>();

  private states = new Map<string, { track: Track; expires: number; signal?: AbortSignal }>();

  private ttl: number;

  private capacity: number;

  /** Create a host without starting a listener.
   * @param options Transport and source settings.
   */
  constructor(options: SourcePluginHostOptions) {
    this.ttl = options.trackStateTtlMs ?? 600000;
    this.capacity = options.maxTrackStates ?? 1000;

    if (!Number.isSafeInteger(this.ttl) || this.ttl < 1 || !Number.isSafeInteger(this.capacity) || this.capacity < 1) {
      throw new RangeError('Track state limits must be positive safe integers.');
    }

    this.explicitHostId = options.hostId !== undefined;

    if (options.publicUrl !== undefined && !this.explicitHostId)
      throw new TypeError('HTTP source hosts require an explicit hostId');

    this.hostId = options.hostId ?? randomUUID();

    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(this.hostId)) throw new TypeError('Invalid hostId');

    this.mediaPolicy = { ...options.mediaPolicy };
    this.remedia = createPluginHost(options);
    this.runtime = new SourcePluginRuntime({ ...options, hostId: this.hostId });
    this.sweep = setInterval(() => this.prune(), Math.max(1000, Math.min(this.ttl, 30000)));
    this.sweep.unref();
    this.plugins = this.runtime.plugins;
    this.extractors = this.runtime.extractors;

    this.remedia.register({
      id: SOURCE_PLUGIN_ID,
      operations: {
        'metadata.execute': async (input, { signal }) => {
          const request = this.record(input);
          if (typeof request.providerId !== 'string') throw new TypeError('providerId is required');
          if (request.operation === 'search.query.resolve' || request.operation === 'search.query.match') {
            const query = this.record(request.input);
            if (typeof query.query !== 'string') throw new TypeError('query must be a string');
            const normalized = {
              query: query.query,
              options: this.searchOptions(query.options),
              ...(typeof query.protocol === 'string' ? { protocol: query.protocol } : {}),
              ...(typeof query.providerHint === 'string' ? { providerHint: query.providerHint } : {}),
            };
            if (request.operation === 'search.query.match')
              return this.plugins.execute('search.query.match', normalized, { pluginId: request.providerId, signal });
            const result = await this.plugins.execute('search.query.resolve', normalized, {
              pluginId: request.providerId,
              signal,
            });
            return result
              ? this.boundary.getStore()
                ? this.portable(result)
                : result
              : { tracks: [], playlist: null };
          }
          if (request.operation === 'track.related') {
            const track = await this.restore(this.record(request.input).track, signal);
            const result = await this.plugins.execute(
              'track.related',
              { track },
              { pluginId: request.providerId, signal },
            );
            return result
              ? this.boundary.getStore()
                ? this.portable(result)
                : result
              : { tracks: [], playlist: null };
          }
          if (request.operation === 'lyrics.search') {
            const value = this.record(request.input).input;
            const restored = typeof value === 'string' || value instanceof Track ? value : deserialize(value);
            if (!(typeof restored === 'string' || restored instanceof Track))
              throw new TypeError('Lyrics input must be a string or serialized Track');
            const groups = await this.plugins.execute(
              'lyrics.search',
              { input: restored },
              { pluginId: request.providerId, signal },
            );
            return groups.map((group) => group?.map(normalizeLyrics) ?? null);
          }
          throw new Error('Unsupported metadata operation');
        },

        'source.search': async (input, { signal }) => {
          const request = this.record(input);

          if (typeof request.query !== 'string') throw new TypeError('query must be a string');

          const hints = this.searchOptions(request.options);
          const result = await this.runtime.search(request.query, { ...hints, signal });

          return this.boundary.getStore() ? this.portable(result) : result;
        },

        'source.related': async (input, { signal }) => {
          const track = await this.restore(this.record(input).track, signal);
          const result = await this.plugins.execute(
            'track.related',
            { track },
            { pluginId: track.sourceReference?.pluginId, signal },
          );

          return result && this.boundary.getStore() ? this.portable(result) : result;
        },

        'source.stream': async (input, { signal }) => {
          if (!this.boundary.getStore()) {
            return this.plugins.resolveStream(await this.restore(this.record(input).track, signal), { signal });
          }

          const value = this.record(input).track;
          const payload = cloneJSONValue(value instanceof Track ? serializeSourceTrack(value) : value);
          const { sourceState: _state, ...entity } = this.record(payload);
          const metadata = deserialize(entity);

          if (!(metadata instanceof Track)) throw new TypeError('Expected a serialized Track');

          this.assertHost(metadata);

          const providerId = metadata.sourceReference?.pluginId;

          await this.plugins.ready();

          const registration = this.plugins.registrationSignal(providerId ?? '');

          if (
            options.mediaDelivery === 'direct-url' &&
            providerId &&
            options.directUrlProviders?.includes(providerId) &&
            !this.plugins.hasStreamTransforms(providerId)
          ) {
            try {
              const track = await this.restore(payload, signal);

              return await this.plugins.resolveStream(track, {
                signal,
                directUrlOnly: true,

                prepareSource: async (media, lifetime) => {
                  if (!('url' in media)) throw new Error('Expected a direct media URL');

                  await authorizeMediaURL(new URL(media.url), this.mediaPolicy, lifetime ?? signal);

                  if (
                    'expiresAtMs' in media &&
                    (!Number.isFinite(Number(media.expiresAtMs)) || Number(media.expiresAtMs) <= Date.now())
                  )
                    throw new Error('Media source credentials have expired');

                  return media;
                },
              });
            } catch (error) {
              if (!(error instanceof DeferredSourceRequired)) throw error;
            }
          }

          // Unknown source types and transformed URLs resolve only on grant redemption.
          return createMediaSource({
            open: async ({ signal: mediaSignal }) => {
              const lifetime = registration ? AbortSignal.any([mediaSignal, registration]) : mediaSignal;

              lifetime.throwIfAborted();

              const track = await this.restore(payload, lifetime);
              const source = await this.plugins.resolveStream(track, {
                signal: lifetime,

                prepareSource: (media, sourceSignal) => this.prepareMedia(media, sourceSignal),
              });

              if ('stream' in source) return source.stream;

              throw new Error('Expected a materialized encoded media stream');
            },
          });
        },
      },

      dispose: async () => {
        clearInterval(this.sweep);
        this.states.clear();
        await this.runtime.destroy();
      },
    });
  }

  private async prepareMedia(source: ClientMediaSource, signal?: AbortSignal): Promise<ClientMediaSource> {
    return openMedia(source, this.mediaPolicy, signal);
  }

  private record(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new TypeError('Expected an operation input object');

    return input as Record<string, unknown>;
  }

  private searchOptions(input: unknown): SearchOptions {
    if (input === undefined) return {};

    if (!this.boundary.getStore()) return this.record(input) as SearchOptions;

    const value = this.record(input);
    // Only portable hints cross the boundary. Request options and credentials never do.
    const result: SearchOptions = {};

    for (const key of ['searchEngine'] as const) {
      if (value[key] !== undefined) {
        if (typeof value[key] !== 'string') throw new TypeError(`${key} must be a string`);

        result[key] = value[key];
      }
    }

    if (value.resolveCustomProtocols !== undefined) {
      if (typeof value.resolveCustomProtocols !== 'boolean')
        throw new TypeError('resolveCustomProtocols must be a boolean');
      result.resolveCustomProtocols = value.resolveCustomProtocols;
    }

    if (value.limit !== undefined) {
      if (!Number.isSafeInteger(value.limit) || Number(value.limit) < 1) throw new TypeError('limit must be positive');

      result.limit = Number(value.limit);
    }

    if (value.requestedBy !== undefined) {
      if (typeof value.requestedBy !== 'string' && value.requestedBy !== null)
        throw new TypeError('requestedBy must be an identity string');

      result.requestedBy = value.requestedBy;
    }

    if (value.blockExtractors !== undefined) {
      if (!Array.isArray(value.blockExtractors) || !value.blockExtractors.every((id) => typeof id === 'string'))
        throw new TypeError('blockExtractors must contain strings');

      result.blockExtractors = value.blockExtractors;
    }

    return result;
  }

  private prune(): void {
    for (const [key, state] of this.states)
      if (
        state.expires <= Date.now() ||
        state.signal?.aborted ||
        !this.plugins.has(state.track.sourceReference?.pluginId ?? '')
      )
        this.states.delete(key);
  }

  private portable(result: SearchResultData): PortableSourceResult {
    this.prune();

    const tracks = result.tracks.map((track) => {
      // serialize first; never retain an invalid or unsafe response.
      if (track.sourceReference) track.sourceReference.hostId = this.hostId;

      const serialized = track.serialize();
      const stateId = randomUUID();

      this.states.set(stateId, {
        track: Object.assign(Object.create(Object.getPrototypeOf(track)), track, {
          playlist: null,
          raw: { ...track.raw, playlist: undefined, requestMetadata: undefined },
          metadataProvider: undefined,
        }),
        expires: Date.now() + this.ttl,
        signal: this.plugins.registrationSignal(track.sourceReference?.pluginId ?? ''),
      });

      while (this.states.size > this.capacity) this.states.delete(this.states.keys().next().value!);

      return { ...serialized, sourceState: stateId };
    });

    return { tracks, playlist: result.playlist?.serialize() ?? null };
  }

  private async restore(input: unknown, signal: AbortSignal): Promise<Track> {
    signal.throwIfAborted();

    if (input instanceof Track && !this.boundary.getStore()) {
      this.assertHost(input);

      // A consumer-side model has no host-local engine. Ordinary local models retain identity.
      if (input.sourceState || (this.extractors.get(input.sourceReference?.pluginId ?? '') && !input.extractor)) {
        return this.restore(serializeSourceTrack(input), signal);
      }

      return input;
    }

    const payload = this.record(input);
    const { sourceState: _state, ...entity } = payload;
    const track = deserialize(entity);

    if (!(track instanceof Track)) throw new TypeError('Expected a serialized Track');

    this.assertHost(track);
    this.prune();

    const cached = typeof payload.sourceState === 'string' ? this.states.get(payload.sourceState)?.track : undefined;

    if (
      cached &&
      cached.id === track.id &&
      cached.url === track.url &&
      cached.sourceReference?.pluginId === track.sourceReference?.pluginId
    ) {
      // Copy mutable extractor data per invocation. Opaque/non-cloneable engines are reconstructed below.
      try {
        const { requestMetadata: _callback, playlist: _playlist, ...rawData } = cached.raw;
        const engine = rawData.engine;

        if (
          engine &&
          typeof engine === 'object' &&
          !Array.isArray(engine) &&
          Object.getPrototypeOf(engine) !== Object.prototype
        )
          throw new Error('Opaque engine requires reconstruction');

        const raw = structuredClone(rawData);
        const copy = Object.assign(Object.create(Object.getPrototypeOf(cached)), cached, { raw });

        copy.sourceReference = structuredClone(cached.sourceReference);
        copy.trackMetadata = structuredClone(cached.metadata);
        copy.metadataProvider = undefined;
        copy.requestedBy = track.requestedBy;
        copy.playlist = null;
        copy.bridgedTrack = null;
        copy.bridgedExtractor = null;

        return copy;
      } catch {
        // Legacy callbacks/classes cannot be safely copied; resolve their public location again.
      }
    }

    const pluginId = track.sourceReference?.pluginId;

    if (!pluginId || !this.plugins.has(pluginId))
      throw new Error('Track source is unavailable; register its provider and search again');

    if (!this.extractors.get(pluginId)) return track;

    // Re-run legacy metadata resolution rather than guessing the meaning of raw.engine.
    const data = track.sourceReference?.data;
    const queryType = data && typeof data === 'object' && 'queryType' in data ? data.queryType : undefined;
    const result = await this.plugins.execute(
      'search.query.resolve',
      {
        query: track.url,
        providerHint: typeof queryType === 'string' ? queryType : undefined,
      },
      { pluginId, signal },
    );
    const restored = result?.tracks.find((item) => item.url === track.url);

    if (!restored) throw new Error(`Source ${pluginId} could not reconstruct expired Track state; search again`);

    restored.requestedBy = track.requestedBy;
    restored.sourceReference = track.sourceReference;

    return restored;
  }

  private assertHost(track: Track): void {
    if (track.sourceReference?.hostId !== this.hostId) {
      throw new Error('Track belongs to another source host or has no host affinity; resolve it on this host first');
    }
  }

  /** Execute directly without serialization; caller owns returned media.
   * @param request Generic Remedia request targeting discord-player.source.
   */
  handle(request: PluginRequest): Promise<ExecuteResult> {
    return this.boundary.run(false, () => this.remedia.handle(request));
  }

  /** Execute HTTP through Remedia's transport and the same operation handlers.
   * @param request Fetch request. An explicitly configured hostId is required even without publicUrl.
   */
  async fetch(request: Request): Promise<Response> {
    if (!this.explicitHostId) return Promise.reject(new TypeError('HTTP source hosts require an explicit hostId'));

    const response = await this.boundary.run(true, () => this.remedia.fetch(request));
    if (new URL(request.url).pathname !== '/.well-known/remedia' || !response.ok) return response;
    await this.plugins.ready();
    const manifest = await response.json();
    const providers = this.plugins.describe();
    const operations = new Set(providers.flatMap((provider) => provider.operations));
    for (const plugin of manifest.plugins) {
      if (plugin.id !== SOURCE_PLUGIN_ID) continue;
      plugin.operations = plugin.operations.filter((name: string) => {
        if (name === 'metadata.execute')
          return (
            operations.has('search.query.resolve') || operations.has('lyrics.search') || operations.has('track.related')
          );
        if (name === 'source.search') return operations.has('search.query.resolve');
        if (name === 'source.related') return operations.has('track.related');
        if (name === 'source.stream') return operations.has('track.stream') || operations.has('track.bridge');
        return false;
      });
    }
    return Response.json(
      { ...manifest, hostId: this.hostId, providers },
      { status: response.status, headers: response.headers },
    );
  }

  /** Identify Remedia routes for Node middleware.
   * @param path URL pathname.
   */
  matches(path: string): boolean {
    return this.remedia.matches(path);
  }

  /** Cancel media and operations, release state, and destroy sources. */
  close(): Promise<void> {
    return this.remedia.close();
  }
}

/** Create an independent source host; no HTTP server is started.
 * @param options Source and transport settings.
 * @returns Standalone runtime with direct and HTTP execution.
 */
export function createSourcePluginHost(options: SourcePluginHostOptions): SourcePluginHost {
  return new SourcePluginHost(options);
}
