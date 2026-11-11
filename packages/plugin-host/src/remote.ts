import { z } from 'zod';
import { lyricsResultSchema } from './lyrics.js';
import {
  deserializeSourceResult,
  serializeSourceTrack,
  type PortableSourceResult,
  type MetadataRequest,
  type PortableSourceQuery,
} from './protocol.js';
import { Track } from './structures/track.js';
import type { PluginContext, OperationName, SourceQuery } from './plugins/types.js';

/** Existing standalone HTTP deployment. Authentication stays outside Track metadata. */
export interface RemotePluginHostOptions {
  /** Stable deployment identity matching the audio node's configured host. */
  hostId: string;
  /** HTTP(S) origin without embedded credentials. */
  url: string;
  /** Optional bearer credential. */
  token?: string;
  /** Bounded discovery and execution deadline, default 15000ms. */
  timeoutMs?: number;
}

/** Advertised provider capabilities from a standalone host. */
export interface RemoteProvider {
  /** Actual provider identity, separate from deployment identity. */
  id: string;
  /** Implemented operation names. */
  operations: OperationName[];
  /** Registered source protocols. */
  protocols: string[];
  /** Advertised operation priorities, applied unless the client descriptor overrides them. */
  priorities?: Partial<Record<OperationName, number>>;
}

/** Fetch one authenticated metadata response through the current HTTP boundary.
 * @internal
 * @param host Existing deployment.
 * @param path Discovery or execution path.
 * @param signal Request cancellation.
 * @param body Optional serialized execution request.
 * @returns Parsed metadata; operational failures reject.
 */
export async function remoteMetadata(
  host: RemotePluginHostOptions,
  path: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<unknown> {
  const url = new URL(host.url);
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(host.hostId) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new TypeError('Source host requires a stable ID and an HTTP(S) origin without credentials');
  if (!Number.isSafeInteger(host.timeoutMs ?? 15000) || (host.timeoutMs ?? 15000) < 1)
    throw new RangeError('Source host timeout must be a positive safe integer');
  const response = await fetch(`${url.origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(host.timeoutMs ?? 15000)]),
    headers: { 'content-type': 'application/json', ...(host.token ? { authorization: `Bearer ${host.token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Source host ${host.hostId}: metadata request failed (HTTP ${response.status})`);
  return response.json();
}

/** Validate live advertised capabilities; no plugin is installed on the remote server.
 * @param host Existing standalone deployment.
 * @param signal Registration lifetime.
 * @returns Actual remote provider declarations.
 */
export async function discoverRemote(host: RemotePluginHostOptions, signal: AbortSignal): Promise<RemoteProvider[]> {
  const manifest = await remoteMetadata(host, '/.well-known/remedia', signal);
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    !('protocolVersion' in manifest) ||
    manifest.protocolVersion !== 1 ||
    !('providers' in manifest) ||
    !Array.isArray(manifest.providers)
  )
    throw new Error(`Source host ${host.hostId}: incompatible metadata manifest`);
  if (!('hostId' in manifest) || manifest.hostId !== host.hostId)
    throw new Error(`Source host ${host.hostId}: deployment identity does not match advertised host`);
  return manifest.providers.map((provider: RemoteProvider) => {
    if (
      !provider ||
      typeof provider.id !== 'string' ||
      !Array.isArray(provider.operations) ||
      !provider.operations.every((name) => typeof name === 'string') ||
      !Array.isArray(provider.protocols) ||
      !provider.protocols.every((name) => typeof name === 'string')
    )
      throw new TypeError('Invalid remote provider manifest');
    if (provider.priorities !== undefined) z.record(z.string(), z.number()).parse(provider.priorities);
    return provider;
  });
}

/** Register remote metadata operations into the ordinary capability registry.
 * @internal
 * @param ctx Registration owner.
 * @param providerId Actual remote provider ID.
 * @param host Existing deployment configuration.
 * @param advertised Already validated discovery for a bulk host registration.
 */
export async function registerRemote(
  ctx: PluginContext<unknown>,
  providerId: string,
  host: RemotePluginHostOptions,
  advertised?: RemoteProvider[],
): Promise<void> {
  const provider = (advertised ?? (await discoverRemote(host, ctx.signal))).find((item) => item.id === providerId);
  if (!provider) throw new Error(`Source host ${host.hostId}: provider ${providerId} is not advertised`);
  const execute = async (request: MetadataRequest, signal: AbortSignal) => {
    const envelope = await remoteMetadata(host, '/remedia/v1/execute', signal, {
      pluginId: 'discord-player.source',
      operation: 'metadata.execute',
      input: request,
    });
    if (
      !envelope ||
      typeof envelope !== 'object' ||
      !('handled' in envelope) ||
      envelope.handled !== true ||
      !('result' in envelope)
    )
      throw new Error(`Source host ${host.hostId}: invalid metadata response`);
    return envelope.result;
  };
  const portableQuery = (input: SourceQuery): PortableSourceQuery => {
    const original = input.options ?? {};
    return {
      ...input,
      options: {
        limit: original.limit,
        blockExtractors: original.blockExtractors,
        requestedBy: typeof original.requestedBy === 'object' ? original.requestedBy?.id : original.requestedBy,
      },
    };
  };
  if (provider.operations.includes('search.query.match')) {
    ctx.on(
      'search.query.match',
      async (input, { signal }) => {
        const result = await execute(
          { providerId, operation: 'search.query.match', input: portableQuery(input) },
          signal,
        );
        const matches = z
          .array(z.object({ score: z.number(), pluginId: z.string().optional() }).nullable())
          .parse(result);
        return matches.find((match) => match !== null && match.score >= 0) ?? null;
      },
      { protocols: provider.protocols, priority: provider.priorities?.['search.query.match'] },
    );
  }
  if (provider.operations.includes('search.query.resolve')) {
    ctx.on(
      'search.query.resolve',
      async (input, { signal }) => {
        const result = deserializeSourceResult(
          (await execute(
            { providerId, operation: 'search.query.resolve', input: portableQuery(input) },
            signal,
          )) as PortableSourceResult,
        );
        for (const track of result.tracks)
          if (track.sourceReference?.pluginId !== providerId || track.sourceReference.hostId !== host.hostId)
            throw new Error('Remote Track provider or deployment identity does not match its registration');
        return result;
      },
      { protocols: provider.protocols, priority: provider.priorities?.['search.query.resolve'] },
    );
  }
  if (provider.operations.includes('track.related')) {
    ctx.on(
      'track.related',
      async ({ track }, { signal }) => {
        const result = await execute(
          { providerId, operation: 'track.related', input: { track: serializeSourceTrack(track) } },
          signal,
        );
        return deserializeSourceResult(result as PortableSourceResult);
      },
      { priority: provider.priorities?.['track.related'] },
    );
  }
  if (provider.operations.includes('lyrics.search')) {
    ctx.on(
      'lyrics.search',
      async ({ input }, { signal }) => {
        const result = await execute(
          {
            providerId,
            operation: 'lyrics.search',
            input: { input: input instanceof Track ? input.serialize() : input },
          },
          signal,
        );
        const groups = z.array(z.array(lyricsResultSchema).nullable()).parse(result);
        return groups
          .flatMap((group) => group ?? [])
          .map((record) => ({
            ...record,
            provider: { pluginId: providerId, hostId: host.hostId, data: record.provider?.data ?? null },
          }));
      },
      { priority: provider.priorities?.['lyrics.search'] },
    );
  }
}
