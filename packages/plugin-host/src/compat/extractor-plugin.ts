import { Readable } from 'node:stream';
import { definePlugin, type PluginFactory } from '../plugins/types.js';
import { BaseExtractor } from './base-extractor.js';
import type { ExtractorExecutionContext } from './extractor-execution-context.js';
import type { ExtractorInfo, ExtractorStreamable, NextFunction } from './extractor-types.js';

function checkLegacyStream(result: ExtractorStreamable | undefined): ExtractorStreamable | undefined {
  if (result && typeof result === 'object' && '$fmt' in result && /^(?:pcm|opus)$/i.test(result.$fmt)) {
    result.stream.destroy();

    throw new Error(`Legacy raw ${result.$fmt} streams require migration to an encoded Remedia source.`);
  }

  return result;
}

/** Adapt a legacy instance to the shared source operation host.
 * @internal
 * @param instance Owned legacy instance.
 * @param context Local compatibility context.
 * @param getBridgeAttempts Read bridge attempts in the current async scope.
 * @param onActivate Publish the activated instance.
 * @param onDeactivate Remove the deactivated instance.
 * @returns A reusable source registration factory for this owned instance.
 */
export function createExtractorPlugin(
  instance: BaseExtractor<any>,
  context: ExtractorExecutionContext,
  getBridgeAttempts: () => Set<string> | undefined,
  onActivate: () => void,
  onDeactivate: () => void,
): PluginFactory<Record<string, never>> {
  const stamp = (response: ExtractorInfo): ExtractorInfo => {
    for (const track of response.tracks) {
      track.extractor = instance;

      track.sourceReference = {
        pluginId: instance.identifier,
        data: { url: track.url, queryType: track.queryType ?? null },
      };
    }

    return response;
  };

  return definePlugin({
    id: instance.identifier,

    setup: async (ctx) => {
      await instance.activate();
      onActivate();

      if (instance.resolveLyrics) {
        ctx.on(
          'lyrics.search',
          async ({ input }) => {
            const result = await instance.resolveLyrics?.(input);

            return result == null ? null : Array.isArray(result) ? result : [result];
          },
          { priority: instance.priority },
        );
      }

      const metadata = { priority: instance.priority, protocols: instance.protocols };

      if (
        instance.handle !== BaseExtractor.prototype.handle &&
        (instance.validate !== BaseExtractor.prototype.validate || instance.protocols.length > 0)
      ) {
        ctx.on(
          'search.query.match',
          async ({ query, protocol, providerHint }) => {
            if (protocol) {
              return instance.protocols.includes(protocol) ? { score: 100 } : null;
            }

            return (await instance.validate(
              query,
              providerHint ?? (/^https?:\/\//i.test(query) ? 'arbitrary' : 'auto'),
            ))
              ? { score: 0 }
              : null;
          },
          metadata,
        );
      }

      if (instance.handle !== BaseExtractor.prototype.handle) {
        ctx.on(
          'search.query.resolve',
          async ({ query, options, protocol, providerHint }) => {
            const result = stamp(
              await instance.handle(query, {
                type: providerHint ?? (/^https?:\/\//i.test(query) ? 'arbitrary' : 'auto'),
                requestedBy: options?.requestedBy,
                requestOptions: options?.requestOptions,
                protocol,
              }),
            );
            for (const track of result.tracks) {
              track.queryType ??= providerHint ?? (/^https?:\/\//i.test(query) ? 'arbitrary' : 'auto');
              if (
                track.sourceReference &&
                track.sourceReference.data &&
                typeof track.sourceReference.data === 'object' &&
                !Array.isArray(track.sourceReference.data)
              )
                track.sourceReference.data.queryType = track.queryType ?? null;
            }
            return result;
          },
          metadata,
        );
      }

      if (instance.stream !== BaseExtractor.prototype.stream) {
        ctx.on(
          'track.stream',
          async ({ track }) => {
            // Restored tracks reconstruct only the public legacy location fields.
            if (!track.raw.engine) {
              track.raw.engine = track.url;
            }

            track.queryType ??=
              typeof track.sourceReference?.data === 'object' &&
              track.sourceReference.data &&
              'queryType' in track.sourceReference.data
                ? String(track.sourceReference.data.queryType ?? '')
                : undefined;

            return checkLegacyStream(await instance.stream(track));
          },
          metadata,
        );
      }

      if (instance.getRelatedTracks !== BaseExtractor.prototype.getRelatedTracks) {
        ctx.on(
          'track.related',
          async ({ track, history }) => stamp(await instance.getRelatedTracks(track, history ?? { tracks: [] })),
          metadata,
        );
      }

      if (instance.bridge !== BaseExtractor.prototype.bridge) {
        ctx.on(
          'track.bridge',
          async ({ track, sourcePluginId }) => {
            const attempts = getBridgeAttempts();

            if (sourcePluginId === instance.identifier || attempts?.has(instance.identifier)) {
              return undefined;
            }

            attempts?.add(instance.identifier);

            const result = checkLegacyStream(
              (await instance.bridge(track, context.get(sourcePluginId ?? '') ?? null)) ?? undefined,
            );

            if (result === undefined) {
              return undefined;
            }

            track.bridgedExtractor = instance;

            // Object identity retains bridge ownership through nested legacy stream calls.
            return typeof result === 'string'
              ? /^https?:\/\//i.test(result)
                ? { url: result }
                : { file: result }
              : result instanceof Readable
                ? { stream: result }
                : result;
          },
          metadata,
        );
      }

      if (instance.handlePostStream !== BaseExtractor.prototype.handlePostStream) {
        ctx.on(
          'stream.transform',
          async ({ track, stream }, { signal }) => ({
            track,
            stream: await new Promise<Readable>((resolve, reject) => {
              signal.throwIfAborted();

              const abort = () => {
                stream.destroy();
                reject(signal.reason);
              };

              signal.addEventListener('abort', abort, { once: true });

              const next: NextFunction = (error, result) => {
                signal.removeEventListener('abort', abort);

                if (signal.aborted) {
                  result?.destroy();
                  reject(signal.reason);

                  return;
                }

                if (error) {
                  reject(error);
                } else {
                  resolve(result ?? stream);
                }
              };

              try {
                (track.bridgedExtractor ?? instance).handlePostStream(stream, next);
              } catch (error) {
                signal.removeEventListener('abort', abort);
                reject(error);
              }
            }),
          }),
          metadata,
        );
      }
    },

    destroy: async () => {
      try {
        await instance.deactivate();
      } finally {
        onDeactivate();
      }
    },
  });
}
