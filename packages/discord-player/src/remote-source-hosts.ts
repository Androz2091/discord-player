import {
  deserializeSourceResult,
  SOURCE_PLUGIN_ID,
  type PortableSourceResult,
  type SearchOptions,
  type SearchResult,
} from '@discord-player/plugin-host';

/** A standalone source deployment, distinct from a local provider registration or audio node. */
export interface RemoteSourceHostOptions {
  /** Stable deployment ID matching Remedia's pluginHosts configuration. */
  hostId: string;

  /** HTTP(S) origin of the standalone host. Credentials and query strings are rejected. */
  url: string;

  /** Optional bearer token, retained only in the transport configuration. */
  token?: string;

  /** Deadline for discovery and execution together; defaults to 15000 milliseconds. */
  timeoutMs?: number;
}

/** Player-owned HTTP metadata transport. @internal */
export class RemoteSourceHosts {
  private readonly hosts = new Map<string, RemoteSourceHostOptions>();

  private readonly lifetime = new AbortController();

  /** Validate and snapshot deployment settings.
   * @param hosts Deployments in deterministic fallback order, after local sources.
   */
  constructor(hosts: readonly RemoteSourceHostOptions[]) {
    for (const host of hosts) {
      const url = new URL(host.url);

      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(host.hostId) || this.hosts.has(host.hostId))
        throw new TypeError('Source host IDs must be valid and unique');

      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        throw new TypeError('Source host URL must be an HTTP(S) origin without credentials');

      if (!Number.isSafeInteger(host.timeoutMs ?? 15000) || (host.timeoutMs ?? 15000) < 1)
        throw new RangeError('Source host timeout must be a positive safe integer');

      this.hosts.set(host.hostId, { ...host, url: url.origin });
    }
  }

  /** Verify a queued deployment is still configured.
   * @param hostId Stable deployment identity.
   */
  assert(hostId: string): void {
    if (!this.hosts.has(hostId)) throw new Error(`Source host ${hostId} is not configured`);

    this.lifetime.signal.throwIfAborted();
  }

  /** Abort all outstanding metadata requests. */
  destroy(): void {
    this.lifetime.abort();
  }

  /** Search registered deployments without retrying failed requests.
   * @param query Portable search string.
   * @param options Search hints and cancellation; local request options are excluded.
   * @param blocked Player-level provider exclusions.
   * @returns First nonempty result, or null when every deployment declines.
   */
  async search(query: string, options: SearchOptions, blocked: readonly string[]): Promise<SearchResult | null> {
    if (options.hostId) this.assert(options.hostId);

    for (const host of this.hosts.values()) {
      if (options.hostId && options.hostId !== host.hostId) continue;

      const signal = AbortSignal.any([
        this.lifetime.signal,
        AbortSignal.timeout(host.timeoutMs ?? 15000),
        ...(options.signal ? [options.signal] : []),
      ]);

      const request = async (path: string, body?: unknown): Promise<any> => {
        let response: Response | undefined;

        try {
          response = await fetch(`${host.url}${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            redirect: 'error',
            signal,
            headers: {
              'content-type': 'application/json',
              ...(host.token ? { authorization: `Bearer ${host.token}` } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          return await response.json();
        } catch {
          signal.throwIfAborted();

          throw new Error(
            `Source host ${host.hostId}: ${path === '/.well-known/remedia' ? 'discovery' : 'search'} request failed${response ? ` (HTTP ${response.status})` : ''}`,
          );
        }
      };

      // Discover on every call so restarts and changed registrations do not leave stale manifests.
      const manifest = await request('/.well-known/remedia');
      if (
        manifest?.protocolVersion !== 1 ||
        !Array.isArray(manifest.plugins) ||
        !manifest.plugins.some((p: any) => p.id === SOURCE_PLUGIN_ID && p.operations?.includes('source.search'))
      )
        throw new Error(`Source host ${host.hostId}: incompatible source manifest`);

      const hints: Record<string, unknown> = { blockExtractors: [...blocked, ...(options.blockExtractors ?? [])] };

      for (const key of ['pluginId', 'searchEngine', 'source', 'limit'] as const)
        if (options[key] !== undefined) hints[key] = options[key];

      const requester = typeof options.requestedBy === 'object' ? options.requestedBy?.id : options.requestedBy;
      if (requester !== undefined) hints.requestedBy = requester;

      const provider =
        options.pluginId ?? (options.searchEngine?.startsWith('ext:') ? options.searchEngine.slice(4) : undefined);
      const envelope = await request('/remedia/v1/execute', {
        pluginId: SOURCE_PLUGIN_ID,
        operation: provider ? 'source.resolve' : 'source.search',
        input: { query, ...(provider ? { pluginId: provider } : {}), options: hints },
      });
      if (envelope?.handled === false) continue;

      let result: SearchResult;

      try {
        if (envelope?.handled !== true) throw new Error();
        result = deserializeSourceResult(envelope.result as PortableSourceResult);

        const target =
          options.pluginId ?? (options.searchEngine?.startsWith('ext:') ? options.searchEngine.slice(4) : undefined);

        for (const track of result.tracks) {
          const ref = track.sourceReference;

          if (
            !ref?.pluginId ||
            ref.hostId !== host.hostId ||
            (hints.blockExtractors instanceof Array && hints.blockExtractors.includes(ref.pluginId)) ||
            (target && target !== ref.pluginId)
          )
            throw new Error();

          if (options.requestedBy !== undefined) track.requestedBy = options.requestedBy;
        }
      } catch {
        throw new Error(`Source host ${host.hostId}: invalid Track identity or metadata`);
      }

      signal.throwIfAborted();
      if (!result.isEmpty()) return result;
    }

    return null;
  }
}
