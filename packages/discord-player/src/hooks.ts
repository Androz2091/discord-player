import { Readable } from 'node:stream';
import type { MediaSource } from '@remedia/client';
import type { Track } from './structures/track.js';
import type { GuildQueue } from './structures/guild-queue.js';
import type { SourceStream } from './plugins/types.js';

/** Source interception before normal provider resolution.
 * @param track Selected canonical Track.
 * @param queryType Legacy query hint, or auto.
 * @param queue Owning queue.
 * @param signal Preparation cancellation.
 * @returns Replacement encoded resource, or null to use provider resolution.
 */
export type OnBeforeCreateStreamHandler = (
  track: Track,
  queryType: string,
  queue: GuildQueue,
  signal: AbortSignal,
) => SourceStream | null | Promise<SourceStream | null>;

/** Result accepted from a local encoded-stream hook.
 * @remarks Remedia owns decoding, so only `stream` is consumed. `type` is accepted for v7 source
 * compatibility and is otherwise ignored.
 */
export interface PostProcessedResult {
  /** Replacement encoded Node.js Readable. */
  stream: Readable;

  /** Legacy v7 stream type hint; ignored by Remedia. */
  type?: string | number;
}

/** Descriptor interception after provider resolution.
 * @param source Resolved encoded resource or native descriptor.
 * @param track Canonical Track.
 * @param queue Owning queue.
 * @param signal Preparation cancellation.
 * @returns Resource to submit to Remedia, or nullish to keep the resolved source.
 */
export type OnStreamExtractedHandler = (
  source: SourceStream,
  track: Track,
  queue: GuildQueue,
  signal: AbortSignal,
) => SourceStream | null | undefined | Promise<SourceStream | null | undefined>;

/** Local encoded-byte hook; unavailable when Remedia owns the bytes.
 * @param stream Encoded Node.js Readable, before Remedia decoding.
 * @param queue Owning queue.
 * @param track Canonical Track.
 * @param signal Preparation cancellation.
 * @returns Replacement stream descriptor, or null to retain the input.
 */
export type OnAfterCreateStreamHandler = (
  stream: Readable,
  queue: GuildQueue,
  track: Track,
  signal: AbortSignal,
) => PostProcessedResult | null | Promise<PostProcessedResult | null>;

/** Optional resource interception callbacks; queue overrides Player overrides global. */
export interface StreamHooks {
  /** Source override, run once during ordinary or crossfade source preparation. */
  onBeforeCreateStream?: OnBeforeCreateStreamHandler;
  /** Descriptor interception, including URL resources for remote execution. */
  onStreamExtracted?: OnStreamExtractedHandler;
  /** Local encoded bytes only; never a decoded audio interceptor. */
  onAfterCreateStream?: OnAfterCreateStreamHandler;
}

const globalHooks: StreamHooks = {};

function register<Name extends keyof StreamHooks>(name: Name, handler: StreamHooks[Name]): () => void {
  globalHooks[name] = handler;
  return () => {
    if (globalHooks[name] === handler) delete globalHooks[name];
  };
}

/** Register a global source override; returns an ownership-aware removal function.
 * @param handler Callback used when no scoped override exists.
 */
export function onBeforeCreateStream(handler: OnBeforeCreateStreamHandler): () => void {
  return register('onBeforeCreateStream', handler);
}

/** Register global descriptor interception; returns a removal function.
 * @param handler Descriptor callback.
 */
export function onStreamExtracted(handler: OnStreamExtractedHandler): () => void {
  return register('onStreamExtracted', handler);
}

/** Register a global local-byte callback; returns a removal function.
 * @param handler Encoded-byte callback.
 */
export function onAfterCreateStream(handler: OnAfterCreateStreamHandler): () => void {
  return register('onAfterCreateStream', handler);
}

/** Prepare and validate a resource in its owning async context.
 * @internal
 * @param queue Queue providing context and scoped hooks.
 * @param track Track being prepared.
 * @param signal Preparation cancellation.
 * @param remote Whether the assigned node is remote.
 * @param resolve Normal provider source resolution.
 * @returns Prepared source for Remedia, without changing guild assignment.
 */
export async function prepareResource(
  queue: GuildQueue,
  track: Track,
  signal: AbortSignal,
  remote: boolean,
  resolve: () => Promise<MediaSource>,
): Promise<MediaSource> {
  const player = queue.manager.player;
  const hooks = {
    onBeforeCreateStream:
      queue.onBeforeCreateStream ?? player.options.onBeforeCreateStream ?? globalHooks.onBeforeCreateStream,
    onStreamExtracted: queue.onStreamExtracted ?? player.options.onStreamExtracted ?? globalHooks.onStreamExtracted,
    onAfterCreateStream:
      queue.onAfterCreateStream ?? player.options.onAfterCreateStream ?? globalHooks.onAfterCreateStream,
  };

  return player.context.provide({ queue, guildId: queue.guildId }, async () => {
    let source: SourceStream | undefined;
    const streams = new Set<Readable>();
    const remember = (resource: SourceStream | undefined) => {
      if (resource instanceof Readable) streams.add(resource);
      else if (resource && typeof resource === 'object' && 'stream' in resource) streams.add(resource.stream);
    };
    const dispose = () => {
      for (const stream of streams) stream.destroy();
    };
    try {
      signal.throwIfAborted();
      // v7 used `arbitrary` when a Track had no query hint.
      source = (await hooks.onBeforeCreateStream?.(track, track.queryType ?? 'arbitrary', queue, signal)) ?? undefined;
      remember(source);
      signal.throwIfAborted();

      if (!source) {
        source = await resolve();
        remember(source);
        signal.throwIfAborted();

        if (hooks.onStreamExtracted) {
          const extracted = await hooks.onStreamExtracted(source, track, queue, signal);

          if (extracted != null) {
            source = extracted;
            remember(source);
          }
        }

        signal.throwIfAborted();
      }

      let normalized: MediaSource =
        typeof source === 'string'
          ? /^https?:\/\//i.test(source)
            ? { url: source }
            : { file: source }
          : source instanceof Readable
            ? { stream: source }
            : source instanceof Uint8Array
              ? { buffer: source }
              : source;

      if (remote && ('stream' in normalized || 'buffer' in normalized))
        throw new Error(
          'Stream hooks returned local bytes for a remote Remedia node. Return a server-accessible URL/file or use an embedded node.',
        );
      if (hooks.onAfterCreateStream) {
        if ('buffer' in normalized && !remote) {
          normalized = { stream: Readable.from(normalized.buffer) };
          remember(normalized);
        }
        if (!('stream' in normalized) || remote)
          throw new Error(
            'onAfterCreateStream requires an encoded Readable on an embedded node. Use onStreamExtracted for source descriptors.',
          );
        const replacement = await hooks.onAfterCreateStream(normalized.stream, queue, track, signal);

        if (replacement) {
          remember(replacement.stream);
          normalized = { stream: replacement.stream };
        }
      }
      source = normalized;
      remember(source);
      signal.throwIfAborted();
      if ('stream' in normalized) {
        const stream = normalized.stream;
        const abort = dispose;
        signal.addEventListener('abort', abort, { once: true });
        stream.once('close', () => {
          signal.removeEventListener('abort', abort);
          dispose();
        });
      }
      return normalized;
    } catch (error) {
      remember(source);
      dispose();
      throw error;
    }
  });
}
