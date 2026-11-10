import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { createNodeMiddleware } from '@remedia/plugin-host/node';
import { openMedia } from '../src/media.js';
import {
  createSourcePluginHost,
  definePlugin,
  Track,
  SOURCE_PLUGIN_ID,
  deserializeSourceResult,
  serializeSourceTrack,
} from '../src/index.js';

const exec = promisify(execFile);

async function collect(stream: Readable) {
  const chunks = [];

  for await (const chunk of stream) chunks.push(chunk);

  return chunks;
}

async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

it('pins DNS, rejects private targets and redirects, permits explicit private deployments', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { location: 'http://localhost/private' });
      res.end();
    } else res.end('encoded');
  });
  const origin = await listen(server);

  try {
    await expect(openMedia({ url: origin }, {})).rejects.toThrow('destination denied');

    await expect(
      openMedia({ url: `${origin}/redirect` }, { allowPrivateNetworks: true, allowedHosts: ['127.0.0.1'] }),
    ).rejects.toThrow('hostname denied');

    const result = await openMedia({ url: origin }, { allowPrivateNetworks: true });

    expect('stream' in result && (await collect(result.stream)).join('')).toBe('encoded');
  } finally {
    await close(server);
  }
});

it('denies files and expired credentials and bounds concurrent, large and slow responses', async () => {
  await expect(openMedia({ file: import.meta.filename }, {})).rejects.toThrow('allowed roots');

  await expect(openMedia({ url: 'https://example.com', expiresAtMs: Date.now() - 1 } as never, {})).rejects.toThrow(
    'expired',
  );

  const policy = { maxConcurrent: 1, maxBytes: 16, timeoutMs: 1000 };
  const input = new Readable({ read() {} });
  const result = await openMedia({ stream: input }, policy);

  await expect(openMedia({ buffer: Buffer.from('a') }, policy)).rejects.toThrow('concurrency');

  if (!('stream' in result)) throw new Error('Missing stream');

  const ended = once(result.stream, 'close');

  result.stream.destroy();
  await ended;

  expect(input.destroyed).toBe(true);

  const large = await openMedia({ buffer: Buffer.alloc(32) }, policy);

  if (!('stream' in large)) throw new Error('Missing stream');

  await expect(collect(large.stream)).rejects.toThrow('byte limit');

  const slow = await openMedia({ stream: new Readable({ read() {} }) }, { timeoutMs: 10 });

  if (!('stream' in slow)) throw new Error('Missing stream');

  await expect(collect(slow.stream)).rejects.toThrow();
});

it('decodes real MP3, Ogg/Opus and faststart M4A through a real HTTP host with FFmpeg', async () => {
  // FFmpeg is an explicit CI prerequisite; absence is a failure, never a mock-only pass.
  const dir = await mkdtemp(join(tmpdir(), 'source-media-'));
  let host: ReturnType<typeof createSourcePluginHost> | undefined;
  const server = createServer((req, res) => {
    void createNodeMiddleware(host!)(req, res);
  });
  const origin = await listen(server);

  try {
    host = createSourcePluginHost({
      name: 'FFmpeg',
      hostId: 'ffmpeg-host',
      publicUrl: origin,
      mediaPolicy: { allowedFileRoots: [dir] },
    });

    let file = '';

    await host.plugins.register(
      definePlugin({
        id: 'encoded',
        kind: 'source',

        setup(ctx) {
          ctx.on('search.query.resolve', () => ({
            tracks: [new Track({ url: 'https://example.com/audio' })],
            playlist: null,
          }));

          ctx.on('track.stream', () => ({ file }));
        },
      })(),
    );

    const operation = async (operationName: string, input: unknown) => {
      const response = await fetch(`${origin}/remedia/v1/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pluginId: SOURCE_PLUGIN_ID, operation: operationName, input }),
      });

      expect(response.status).toBe(200);

      return (await response.json()).result;
    };

    for (const [extension, codec] of [
      ['mp3', 'libmp3lame'],
      ['ogg', 'libopus'],
      ['m4a', 'aac'],
    ]) {
      file = join(dir, `tone.${extension}`);

      await exec('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=0.2',
        '-c:a',
        codec!,
        '-movflags',
        '+faststart',
        '-y',
        file,
      ]);

      const track = deserializeSourceResult(await operation('source.resolve', { query: 'audio', pluginId: 'encoded' }))
        .tracks[0]!;
      const media = await operation('source.stream', { track: serializeSourceTrack(track) });

      // FFmpeg sends Range even for initial probing. Published host rejects it with 416.
      await expect(exec('ffmpeg', ['-v', 'error', '-i', media.url, '-f', 'null', '-'])).rejects.toThrow();

      const sequential = await operation('source.stream', { track: serializeSourceTrack(track) });
      const decoded = await exec(
        'ffmpeg',
        ['-v', 'error', '-seekable', '0', '-i', sequential.url, '-f', 's16le', '-ac', '1', '-ar', '48000', 'pipe:1'],
        { encoding: 'buffer' },
      );

      expect(decoded.stdout.length).toBeGreaterThan(10000);
      expect((await fetch(sequential.url)).status).toBe(404); // grants really are single-use
    }
  } finally {
    await host?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);

it('closes upstream sockets on real client disconnect and standalone shutdown', async () => {
  let disconnected!: () => void;
  const upstreamClosed = new Promise<void>((resolve) => {
    disconnected = resolve;
  });
  const upstream = createServer((_req, res) => {
    res.writeHead(200);
    res.write(Buffer.alloc(1024));

    const timer = setInterval(() => res.write(Buffer.alloc(1024)), 10);

    res.once('close', () => {
      clearInterval(timer);
      disconnected();
    });
  });
  const upstreamUrl = await listen(upstream);
  let h: ReturnType<typeof createSourcePluginHost>;
  const server = createServer((req, res) => {
    void createNodeMiddleware(h)(req, res);
  });
  const origin = await listen(server);

  h = createSourcePluginHost({
    name: 'Disconnect',
    hostId: 'disconnect',
    publicUrl: origin,
    mediaPolicy: { allowPrivateNetworks: true },
  });

  try {
    await h.plugins.register(
      definePlugin({
        id: 'slow',
        kind: 'source',

        setup(ctx) {
          ctx.on('search.query.resolve', () => ({
            tracks: [new Track({ url: 'https://example.com/slow' })],
            playlist: null,
          }));

          ctx.on('track.stream', () => ({ url: upstreamUrl }));
        },
      })(),
    );

    const call = async (operation: string, input: unknown) =>
      (
        await (
          await fetch(`${origin}/remedia/v1/execute`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ pluginId: SOURCE_PLUGIN_ID, operation, input }),
          })
        ).json()
      ).result;
    const search = await call('source.resolve', { pluginId: 'slow', query: 'slow' });
    const grant = await call('source.stream', { track: search.tracks[0] });
    const response = await fetch(grant.url);
    const reader = response.body!.getReader();

    await reader.read();
    await reader.cancel();
    await upstreamClosed;

    const next = await call('source.stream', { track: search.tracks[0] });
    const second = await fetch(next.url);
    const activeReader = second.body!.getReader();

    await activeReader.read();
    await h.close();
    await activeReader.cancel().catch(() => {});
  } finally {
    await h.close();
    await close(server);
    await close(upstream);
  }
});

it('returns accessible direct URLs with expiration without proxying bytes when explicitly configured', async () => {
  let requests = 0;
  const server = createServer((_req, res) => {
    requests++;
    res.end('bytes');
  });
  const origin = await listen(server);
  const h = createSourcePluginHost({
    name: 'Direct',
    hostId: 'direct',
    mediaDelivery: 'direct-url',
    directUrlProviders: ['url'],
    mediaPolicy: { allowPrivateNetworks: true },
  });
  const expiresAtMs = Date.now() + 10000;

  try {
    await h.plugins.register(
      definePlugin({
        id: 'url',
        kind: 'source',

        setup(ctx) {
          ctx.on('search.query.resolve', () => ({
            tracks: [new Track({ url: 'https://example.com/audio' })],
            playlist: null,
          }));

          ctx.on('track.stream', () => ({ url: origin, expiresAtMs }));
        },
      })(),
    );

    const invoke = async (operation: string, input: unknown) =>
      (
        await (
          await h.fetch(
            new Request('https://host.test/remedia/v1/execute', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ pluginId: SOURCE_PLUGIN_ID, operation, input }),
            }),
          )
        ).json()
      ).result;
    const search = await invoke('source.resolve', { query: 'url', pluginId: 'url' });

    expect(await invoke('source.stream', { track: search.tracks[0] })).toEqual({ url: origin, expiresAtMs });
    expect(requests).toBe(0);
  } finally {
    await h.close();
    await close(server);
  }
});
