import type { MediaSource } from '@remedia/client';
import { lookup } from 'node:dns/promises';
import type { IncomingMessage } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { open, realpath } from 'node:fs/promises';
import { relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Transform, addAbortSignal, pipeline } from 'node:stream';

/** Access limits for remote media materialization. Providers execute trusted code; this is not a plugin sandbox. */
export interface MediaAccessPolicy {
  /** Permit private and loopback destinations, including redirects. Default false. */
  allowPrivateNetworks?: boolean;

  /** Optional exact hostname allowlist, also applied to redirects. */
  allowedHosts?: readonly string[];

  /** Authorized file roots. Default empty; roots and their parents must be administrator-owned. */
  allowedFileRoots?: readonly string[];

  /** Maximum encoded bytes per response. Default 512 MiB. */
  maxBytes?: number;

  /** Maximum simultaneous streams per host. Default 32. */
  maxConcurrent?: number;

  /** Whole-stream deadline in milliseconds, including DNS and connection. Default 30 minutes. */
  timeoutMs?: number;
}

const active = new WeakMap<MediaAccessPolicy, number>();
const denied = new BlockList();
const deniedV6 = new BlockList();

deniedV6.addSubnet('2001::', 23, 'ipv6');
deniedV6.addSubnet('2001:db8::', 32, 'ipv6');
deniedV6.addSubnet('2002::', 16, 'ipv6');
deniedV6.addSubnet('3fff::', 20, 'ipv6');

for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  denied.addSubnet(address, prefix);

function publicAddress(address: string): boolean {
  if (isIP(address) === 4) return !denied.check(address, 'ipv4');

  // Only global unicast IPv6; reject transition/mapped forms and documentation ranges.
  return /^[23][0-9a-f]{3}:/i.test(address) && !deniedV6.check(address, 'ipv6');
}

function positive(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('Invalid media resource limit');

  return value;
}

/** Validate URL policy and resolve the exact address used for a connection.
 * @internal
 * @param url Provider URL.
 * @param policy Host access policy.
 * @param signal Caller lifetime.
 * @returns Validated destination; callers opening sockets must pin this address.
 */
export async function authorizeMediaURL(url: URL, policy: MediaAccessPolicy, signal: AbortSignal) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Media requires an HTTP(S) URL without user credentials');

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  if (policy.allowedHosts && !policy.allowedHosts.includes(hostname)) throw new Error('Media hostname denied');

  signal.throwIfAborted();

  const addresses = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
    const abort = () => reject(signal.reason);

    signal.addEventListener('abort', abort, { once: true });

    lookup(hostname, { all: true })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });

  signal.throwIfAborted();

  if (!addresses.length || (!policy.allowPrivateNetworks && addresses.some(({ address }) => !publicAddress(address))))
    throw new Error('Media destination denied');

  const selected = addresses[0]!;

  return selected;
}

async function remote(url: URL, policy: MediaAccessPolicy, signal: AbortSignal, redirects = 0): Promise<Readable> {
  const selected = await authorizeMediaURL(url, policy, signal);
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        signal,

        // Pin the checked address; keep the original Host and TLS server name. No second DNS lookup.
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [selected]);
          else callback(null, selected.address, selected.family);
        },

        headers: { 'accept-encoding': 'identity' },
      },
      resolve,
    );

    req.once('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Media upstream idle timeout')));
    req.end();
  });

  if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
    const location = response.headers.location;

    response.destroy();

    if (!location || redirects >= 5) throw new Error('Invalid media redirect');

    const target = new URL(location, url);

    if (url.protocol === 'https:' && target.protocol !== 'https:') throw new Error('Media TLS downgrade denied');

    return remote(target, policy, signal, redirects + 1);
  }

  if (response.statusCode !== 200) {
    response.destroy();

    throw new Error(`Media upstream returned ${response.statusCode}`);
  }

  return response;
}

/** Open bounded encoded media under a host policy. No whole-response buffering occurs.
 * @internal
 * @param source Trusted provider result, potentially containing an untrusted location.
 * @param policy Host authorization and resource limits.
 * @param signal Resolution/consumer lifetime.
 * @returns Owned stream; close, abort, errors and deadlines release upstream resources.
 */
export async function openMedia(
  source: MediaSource,
  policy: MediaAccessPolicy,
  signal?: AbortSignal,
): Promise<MediaSource> {
  const maxBytes = positive(policy.maxBytes ?? 512 * 1024 * 1024);
  const maxConcurrent = positive(policy.maxConcurrent ?? 32);
  const timeout = positive(policy.timeoutMs ?? 1800000);
  const expiration = 'expiresAtMs' in source ? Number(source.expiresAtMs) : undefined;

  if (expiration !== undefined && (!Number.isFinite(expiration) || expiration <= Date.now())) {
    if ('stream' in source) source.stream.destroy();

    throw new Error('Media source credentials have expired; resolve the source again');
  }

  if ((active.get(policy) ?? 0) >= maxConcurrent) {
    if ('stream' in source) source.stream.destroy();

    throw new Error('Media concurrency limit reached');
  }

  active.set(policy, (active.get(policy) ?? 0) + 1);

  const controller = new AbortController();
  const lifetime = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(new Error('Media deadline exceeded')), timeout);

  timer.unref();

  let input: Readable | undefined;
  let released = false;
  const release = () => {
    if (released) return;

    released = true;
    clearTimeout(timer);
    active.set(policy, (active.get(policy) ?? 1) - 1);
    input?.destroy();
  };

  try {
    lifetime.throwIfAborted();

    if ('stream' in source) input = source.stream;
    else if ('buffer' in source) input = Readable.from([source.buffer]);
    else if ('file' in source) {
      const path = await realpath(source.file.startsWith('file:') ? fileURLToPath(source.file) : source.file);
      const roots = await Promise.all((policy.allowedFileRoots ?? []).map((root) => realpath(root)));

      if (
        !roots.some((root) => {
          const rel = relative(root, path);

          return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
        })
      )
        throw new Error('Media file outside allowed roots');

      const file = await open(path, 'r');

      try {
        if (!(await file.stat()).isFile()) throw new Error('Media path is not a regular file');

        input = file.createReadStream();
      } catch (error) {
        await file.close();

        throw error;
      }
    } else if ('url' in source) input = await remote(new URL(source.url), policy, lifetime);
    else throw new Error('A source host cannot materialize another operation source');

    lifetime.throwIfAborted();

    let bytes = 0;
    const output = new Transform({
      destroy(error, callback) {
        release();
        callback(error);
      },

      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        callback(bytes > maxBytes ? new Error('Media byte limit exceeded') : null, chunk);
      },
    });

    output.once('close', release);
    addAbortSignal(lifetime, output);
    pipeline(input, output, () => {});

    return { stream: output, ...(expiration === undefined ? {} : { expiresAtMs: expiration }) };
  } catch (error) {
    controller.abort();
    release();

    throw error;
  }
}
