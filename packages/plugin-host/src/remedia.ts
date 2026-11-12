import type { JsonValue, RemediaClient } from '@remedia/client';
import { z } from 'zod';
import { deserializeSourceResult, serializeSourceTrack, type PortableSourceResult } from './protocol.js';
import { lyricsResultSchema, type LyricsResult } from './lyrics.js';
import { Track } from './structures/track.js';
import { SearchResult } from './structures/search-result.js';
import type { SearchOptions } from './types.js';

const pluginId = 'discord-player.source';

// Remedia owns manifest caching, refresh and authorization. No bot-side host registry is needed.
async function hosts(client: RemediaClient, operation: string, signal?: AbortSignal) {
  signal?.throwIfAborted();

  if (
    !client.nodes.some(
      (node) => node.type === 'remote' && node.status === 'healthy' && node.capabilities?.pluginOperations?.forwarding,
    )
  )
    return [];

  const advertised = await client.plugins.list({ signal });
  signal?.throwIfAborted();

  return advertised.filter(
    (host) =>
      host.status === 'healthy' &&
      host.operations.some((item) => item.pluginId === pluginId && item.operation === operation),
  );
}

function sourceResult(value: JsonValue, nodeId: string, hostId: string, blocked: readonly string[]) {
  const result = deserializeSourceResult(value as unknown as PortableSourceResult);

  for (const track of result.tracks) {
    const reference = track.sourceReference;

    if (!reference?.pluginId || reference.hostId !== hostId)
      throw new Error('Remote Track has an invalid provider or host identity');

    if (blocked.includes(reference.pluginId)) throw new Error('Remote Track provider is blocked');

    reference.nodeId = nodeId;
  }

  return result;
}

/** Search authorized Remedia deployments after local sources are exhausted. @internal
 * @param client Existing Remedia client.
 * @param query Original application query.
 * @param options Portable hints and cancellation.
 */
export async function searchRemedia(
  client: RemediaClient,
  query: string,
  options: SearchOptions,
): Promise<SearchResult> {
  const blocked = options.blockExtractors ?? [];

  for (const host of await hosts(client, 'source.search', options.signal)) {
    if (options.hostId && options.hostId !== host.hostId) continue;
    if (!host.operations.some((item) => item.pluginId === pluginId && item.operation === 'source.stream')) continue;

    const response = await client.plugins.execute({
      nodeId: host.nodeId,
      hostId: host.hostId,
      pluginId,
      operation: 'source.search',
      signal: options.signal,
      input: {
        query,
        options: {
          ...(options.searchEngine ? { searchEngine: options.searchEngine } : {}),
          ...(options.limit === undefined ? {} : { limit: options.limit }),
          ...(options.resolveCustomProtocols === undefined
            ? {}
            : { resolveCustomProtocols: options.resolveCustomProtocols }),
          requestedBy:
            typeof options.requestedBy === 'object' ? (options.requestedBy?.id ?? null) : (options.requestedBy ?? null),
          blockExtractors: [...blocked],
        },
      },
    });

    options.signal?.throwIfAborted();
    if (!response.handled) continue;

    const result = sourceResult(response.result, response.nodeId, response.hostId, blocked);

    if (!result.isEmpty()) {
      for (const track of result.tracks) if (options.requestedBy !== undefined) track.requestedBy = options.requestedBy;
      return result;
    }
  }

  return SearchResult.empty();
}

/** Execute metadata on the exact deployment that produced a Track. @internal
 * @param client Existing Remedia client.
 * @param track Originating Track.
 * @param operation Authorized source operation.
 * @param signal Caller lifetime.
 * @param blocked Disabled providers.
 */
export async function relatedRemedia(
  client: RemediaClient,
  track: Track,
  operation: 'source.related',
  signal?: AbortSignal,
  blocked: readonly string[] = [],
) {
  const reference = track.sourceReference;
  if (!reference?.nodeId || !reference.hostId) throw new Error('Remote Track origin is missing');
  if (blocked.includes(reference.pluginId)) throw new Error('Track provider is blocked');

  const available = await hosts(client, operation, signal);
  if (!available.some((host) => host.nodeId === reference.nodeId && host.hostId === reference.hostId))
    throw new Error('Remote source operation is unavailable');

  const response = await client.plugins.execute({
    nodeId: reference.nodeId,
    hostId: reference.hostId,
    pluginId,
    operation,
    input: { track: serializeSourceTrack(track) },
    signal,
  });
  signal?.throwIfAborted();

  return response.handled && response.result !== null
    ? sourceResult(response.result, response.nodeId, response.hostId, blocked)
    : null;
}

/** Look up Track lyrics through its authorized source deployment. @internal
 * @param client Existing Remedia client.
 * @param input Track carrying provider and deployment identity.
 * @param signal Caller lifetime.
 */
export async function lyricsRemedia(
  client: RemediaClient,
  input: Track | string,
  signal?: AbortSignal,
): Promise<LyricsResult[]> {
  if (!(input instanceof Track)) return [];
  const reference = input.lyricsReference ?? input.sourceReference;
  if (!reference?.nodeId || !reference.hostId) return [];

  const available = await hosts(client, 'metadata.execute', signal);
  if (!available.some((host) => host.nodeId === reference.nodeId && host.hostId === reference.hostId)) return [];

  const metadata = serializeSourceTrack(input);
  delete metadata.sourceState;

  const response = await client.plugins.execute({
    nodeId: reference.nodeId,
    hostId: reference.hostId,
    pluginId,
    operation: 'metadata.execute',
    input: { providerId: reference.pluginId, operation: 'lyrics.search', input: { input: metadata } },
    signal,
  });
  signal?.throwIfAborted();

  if (!response.handled) return [];

  return z
    .array(z.array(lyricsResultSchema).nullable())
    .parse(response.result)
    .flatMap((group) => group ?? [])
    .map((result) => ({ ...result, provider: { ...reference, data: result.provider?.data ?? null } }));
}
