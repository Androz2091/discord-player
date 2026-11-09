import type { MediaSource as ClientMediaSource } from '@remedia/client';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { PortableSourceResult } from './protocol.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
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
import { cloneJSONValue } from './utils/serialization.js';
import type { SearchOptions } from './types.js';

/** Stable aggregate protocol registration identifier. */
export const SOURCE_PLUGIN_ID = 'discord-player.source';

/** Standalone source host configuration. */
export interface SourcePluginHostOptions extends PluginHostOptions, Omit<SourcePluginRuntimeOptions, 'player'> {
  /** Maximum retained process-local Track references; default 10000. */
  maxTrackStates?: number;
  /** State lifetime in milliseconds; default one hour. Expired tracks are reconstructed by URL. */
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
  private boundary = new AsyncLocalStorage<boolean>();
  private states = new Map<string, { track: Track; expires: number; signal?: AbortSignal }>();
  private ttl: number;
  private capacity: number;

  /** Create a host without starting a listener.
   * @param options Transport and source settings.
   */
  constructor(options: SourcePluginHostOptions) {
    this.ttl = options.trackStateTtlMs ?? 3600000;
    this.capacity = options.maxTrackStates ?? 10000;
    if (!Number.isSafeInteger(this.ttl) || this.ttl < 1 || !Number.isSafeInteger(this.capacity) || this.capacity < 1) {
      throw new RangeError('Track state limits must be positive safe integers.');
    }
    this.runtime = new SourcePluginRuntime(options);
    this.plugins = this.runtime.plugins;
    this.extractors = this.runtime.extractors;
    this.remedia = createPluginHost(options);
    this.remedia.register({
      id: SOURCE_PLUGIN_ID,
      operations: {
        'source.search': async (input, { signal }) => {
          const request = this.record(input);
          if (typeof request.query !== 'string') throw new TypeError('query must be a string');
          const hints = this.searchOptions(request.options);
          const result = await this.runtime.search(request.query, { ...hints, signal });
          return this.boundary.getStore() ? this.portable(result) : result;
        },
        'source.resolve': async (input, { signal }) => {
          const request = this.record(input);
          if (typeof request.query !== 'string' || typeof request.pluginId !== 'string')
            throw new TypeError('query and pluginId are required');
          const result = await this.runtime.search(request.query, {
            ...this.searchOptions(request.options),
            pluginId: request.pluginId,
            signal,
          });
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
          // Resolve only when the media grant is redeemed: queued tracks do not hold live streams.
          const payload = cloneJSONValue(this.record(input).track);
          return createMediaSource({
            open: async ({ signal: mediaSignal }) => {
              const track = await this.restore(payload, mediaSignal);
              const source = await this.plugins.resolveStream(track, {
                signal: mediaSignal,
                prepareSource: (media, lifetime) => this.prepareMedia(media, lifetime),
              });
              if ('stream' in source) return source.stream;
              throw new Error('Expected a materialized encoded media stream');
            },
          });
        },
      },
      dispose: async () => {
        this.states.clear();
        await this.runtime.destroy();
      },
    });
  }

  private async prepareMedia(source: ClientMediaSource, signal?: AbortSignal): Promise<ClientMediaSource> {
    if ('stream' in source) return source;
    if ('buffer' in source) return { stream: Readable.from([source.buffer]) };
    if ('file' in source)
      return {
        stream: createReadStream(source.file.startsWith('file:') ? new URL(source.file) : source.file, { signal }),
      };
    const url = new URL(source.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Expected a public HTTP(S) media URL');
    const response = await fetch(url, { signal });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(`Media upstream returned ${response.status}`);
    }
    return { stream: Readable.fromWeb(response.body as NodeReadableStream) };
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
    for (const key of ['pluginId', 'searchEngine', 'source'] as const) {
      if (value[key] !== undefined) {
        if (typeof value[key] !== 'string') throw new TypeError(`${key} must be a string`);
        result[key] = value[key];
      }
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
      const serialized = track.serialize();
      const stateId = randomUUID();
      this.states.set(stateId, {
        track,
        expires: Date.now() + this.ttl,
        signal: this.plugins.registrationSignal(track.sourceReference?.pluginId ?? ''),
      });
      while (this.states.size > this.capacity) this.states.delete(this.states.keys().next().value!);
      return { ...serialized, sourceState: stateId };
    });
    return { tracks, playlist: result.playlist?.serialize() ?? null };
  }

  private async restore(input: unknown, signal: AbortSignal): Promise<Track> {
    if (input instanceof Track && !this.boundary.getStore()) return input;
    const payload = this.record(input);
    const { sourceState: _state, ...entity } = payload;
    const track = deserialize(entity);
    if (!(track instanceof Track)) throw new TypeError('Expected a serialized Track');
    this.prune();
    const cached = typeof payload.sourceState === 'string' ? this.states.get(payload.sourceState)?.track : undefined;
    if (
      cached &&
      cached.id === track.id &&
      cached.url === track.url &&
      cached.sourceReference?.pluginId === track.sourceReference?.pluginId
    )
      return cached;
    const pluginId = track.sourceReference?.pluginId;
    if (!pluginId || !this.plugins.has(pluginId))
      throw new Error('Track source is unavailable; register its provider and search again');
    if (!this.extractors.get(pluginId)) return track;
    // Re-run legacy metadata resolution rather than guessing the meaning of raw.engine.
    const result = await this.runtime.search(track.url, { pluginId, signal });
    const restored = result.tracks.find((item) => item.url === track.url);
    if (!restored) throw new Error(`Source ${pluginId} could not reconstruct expired Track state; search again`);
    restored.requestedBy = track.requestedBy;
    return restored;
  }

  /** Execute directly without serialization; caller owns returned media.
   * @param request Generic Remedia request targeting discord-player.source.
   */
  handle(request: PluginRequest): Promise<ExecuteResult> {
    return this.remedia.handle(request);
  }

  /** Execute HTTP through Remedia's transport and the same operation handlers.
   * @param request Fetch request.
   */
  fetch(request: Request): Promise<Response> {
    return this.boundary.run(true, () => this.remedia.fetch(request));
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
