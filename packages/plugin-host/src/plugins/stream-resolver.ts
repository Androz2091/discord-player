import { Readable } from 'node:stream';
import type { MediaSource } from '@remedia/client';
import type { Track } from '../structures/track.js';
import { PluginError } from './plugin-error.js';
import type { StreamResolutionOptions } from './execution-options.js';
import type { OperationRunner } from './registry-internals.js';

/** Transport must defer this resolution until its media grant is redeemed. @internal */
export class DeferredSourceRequired extends Error {}

/** Resolve, transform and own playable media for a selected Remedia node.
 * @internal
 * @param track Track metadata and source reference.
 * @param options Selected node mode and playback lifetime.
 * @param run Shared operation runner.
 * @param hasTransforms Inspect applicable transformations for the resolved owner.
 * @returns Normalized playable media source.
 */
export async function resolveTrackStream(
  track: Track,
  options: StreamResolutionOptions,
  run: OperationRunner,
  hasTransforms: (owner?: string) => boolean,
): Promise<MediaSource> {
  const pluginId = track.sourceReference?.pluginId;
  let owner = pluginId;
  let lifetime: AbortSignal | undefined;
  const handled = (id: string, signal: AbortSignal) => {
    owner = id;
    lifetime = signal;
  };
  let result = await run('track.stream', { track }, { ...options, pluginId }, handled);

  if (result === undefined) {
    if (options.directUrlOnly) throw new DeferredSourceRequired();

    result = await run('track.bridge', { track, sourcePluginId: pluginId }, options, handled);
  }

  if (result === undefined) {
    throw new Error(`No source plugin handled track.stream for ${pluginId ?? track.id}`);
  }

  let source: MediaSource =
    typeof result === 'string'
      ? /^https?:\/\//i.test(result)
        ? { url: result }
        : { file: result }
      : result instanceof Readable
        ? { stream: result }
        : result;

  if (options.directUrlOnly) {
    if (!('url' in source)) {
      if ('stream' in source) source.stream.destroy();

      throw new Error('A directUrlProviders entry must return only URLs; remove it to use lazy media grants');
    }

    if (hasTransforms(owner)) throw new DeferredSourceRequired();
  }

  const signal =
    options.signal && lifetime ? AbortSignal.any([options.signal, lifetime]) : (options.signal ?? lifetime);

  if (options.prepareSource) {
    try {
      source = await options.prepareSource(source, signal);
    } catch (error) {
      if ('stream' in source) source.stream.destroy();

      throw error;
    }
  }

  const streams = new Set<Readable>();

  if ('stream' in source) {
    streams.add(source.stream);
  }

  const dispose = () => {
    for (const stream of streams) {
      stream.destroy();
    }
  };

  try {
    signal?.throwIfAborted();

    if (options.directUrlOnly && hasTransforms(owner)) throw new DeferredSourceRequired();

    if (options.remote && ('stream' in source || 'buffer' in source)) {
      throw new PluginError(
        owner ?? 'unknown',
        'track.stream',
        new Error(
          'Remote Remedia requires a server-accessible URL or file; client Readables and buffers are unsupported.',
        ),
      );
    }

    if ('stream' in source) {
      const transformed = await run(
        'stream.transform',
        { track, stream: source.stream },
        { ...options, pluginId: owner },
      );

      if (transformed) {
        source = { ...source, stream: transformed.stream };
        streams.add(transformed.stream);
      }
    }

    await run('track.stream.resolved', { track }, { ...options, pluginId: owner });
    signal?.throwIfAborted();

    if (streams.size && signal) {
      signal.addEventListener('abort', dispose, { once: true });

      const output = 'stream' in source ? source.stream : undefined;

      output?.once('close', () => {
        signal.removeEventListener('abort', dispose);
        dispose();
      });
    }
  } catch (error) {
    dispose();

    throw error;
  }

  return source;
}
