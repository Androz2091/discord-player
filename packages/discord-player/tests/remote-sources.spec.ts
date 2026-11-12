import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSourcePluginHost, SOURCE_PLUGIN_ID, serializeSourceTrack } from '@discord-player/plugin-host';
import { BaseExtractor, DiscordPlayer, Track, definePlugin, deserialize } from '../src/index.js';
import { setup } from './mocks/queue.js';
import { settle } from './mocks/async.js';

const nativeFetch = globalThis.fetch;
const cleanup: (() => Promise<unknown>)[] = [];

beforeEach(() => vi.stubGlobal('fetch', nativeFetch));

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

class RemoteExtractor extends BaseExtractor {
  static override identifier = 'overlapping-provider';

  override async validate() {
    return true;
  }

  override async handle(query: string) {
    if (query === 'provider-failure') throw new Error('Provider failed with private credentials');

    return this.createResponse(null, [
      new Track(this.context.player, {
        title: query,
        url: 'https://fixture.test/audio',
        raw: { engine: { private: true } },
      }),
    ]);
  }

  override async stream(track: Track) {
    if (!(track.raw.engine as { private?: boolean })?.private) throw new Error('Missing host state');

    return Readable.from(['encoded bytes']);
  }
}

async function deployment(hostId = 'sources-1', token?: string) {
  let host: ReturnType<typeof createSourcePluginHost>;
  const requests: { path: string; body: any }[] = [];
  const server = createServer(async (req, res) => {
    const controller = new AbortController();

    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    const chunks: Buffer[] = [];

    for await (const chunk of req) chunks.push(chunk);

    const body = Buffer.concat(chunks).toString();

    requests.push({ path: req.url!, body: body ? JSON.parse(body) : undefined });

    const response = await host.fetch(
      new Request(`${url}${req.url}`, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        signal: controller.signal,
        ...(body ? { body } : {}),
      }),
    );

    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  host = createSourcePluginHost({
    name: 'Sources',
    hostId,
    publicUrl: url,
    token,
    maxTrackStates: 1,

    onError: () => {},
  });

  await host.extractors.register(RemoteExtractor);

  cleanup.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await host.close();
  });

  return {
    host,
    url,
    requests,
    hostId,
    token,

    async restart() {
      await host.close();

      host = createSourcePluginHost({ name: 'Sources', hostId, publicUrl: url, token });

      await host.extractors.register(RemoteExtractor);
    },
  };
}

function player(
  sourceHosts: { hostId: string; url: string; token?: string; timeoutMs?: number }[],
  providerId = RemoteExtractor.identifier,
) {
  const instance = new DiscordPlayer({
    nodes: [],
    send() {},
    plugins: sourceHosts.map((remoteHost) => definePlugin({ id: providerId, remoteHost })()),
  });

  cleanup.push(() => instance.destroy());

  return instance;
}

it('searches real HTTP, reconstructs canonical models and retains only durable identity on persistence', async () => {
  const host = await deployment('sources-1', 'secret-token-at-least-16');
  const bot = player([host]);
  const requester = { id: '123', private: 'Discord object' };
  const result = await bot.search('music', {
    requestedBy: requester,
    requestOptions: { headers: { authorization: 'local credential' } },
  });

  const track = result.tracks[0]!;

  expect(track).toBeInstanceOf(Track);
  expect(track.requestedBy).toBe(requester);
  expect(track.sourceReference).toMatchObject({ hostId: host.hostId, pluginId: RemoteExtractor.identifier });
  expect(track.sourceState).toBeTypeOf('string');

  const restored = deserialize(track.serialize()) as Track;

  expect(restored.sourceReference).toEqual(track.sourceReference);
  expect(restored.sourceState).toBeUndefined();
  expect(JSON.stringify(host.requests)).not.toMatch(/local credential|Discord object|secret/);
  expect(host.requests.map((r) => r.path)).toEqual([
    '/.well-known/remedia',
    '/remedia/v1/execute',
    '/remedia/v1/execute',
  ]);
});

it('routes overlapping provider IDs by deployment with shared priority and registration order', async () => {
  const a = await deployment('a');
  const b = await deployment('b');
  const bot = player([a, b]);

  expect((await bot.search('one')).tracks[0]?.sourceReference?.hostId).toBe('a');
  expect(
    (await bot.search('two', { hostId: 'b', searchEngine: RemoteExtractor.identifier })).tracks[0]?.sourceReference
      ?.hostId,
  ).toBe('b');

  await bot.extractors.register(RemoteExtractor);
  expect((await bot.search('tie')).tracks[0]?.sourceReference?.hostId).toBe('a');
  await bot.extractors.unregister(RemoteExtractor.identifier);
  class PreferredLocal extends RemoteExtractor {
    override priority = 2;
  }
  await bot.extractors.register(PreferredLocal);

  expect((await bot.search('local')).tracks[0]?.sourceReference?.hostId).toBeUndefined();
  expect((await bot.search('blocked', { blockExtractors: [RemoteExtractor.identifier] })).isEmpty()).toBe(true);

  await expect(bot.search('missing', { hostId: 'missing' })).rejects.toThrow('not configured');
});

it('never retries authentication failures on another host', async () => {
  const a = await deployment('a', 'correct-token-at-least-16');
  const b = await deployment('b');

  const bot = player([{ ...a, token: 'incorrect' }, b]);

  await expect(bot.search('music')).rejects.toThrow('HTTP 401');

  expect(b.requests.some((request) => request.body?.input?.operation === 'search.query.resolve')).toBe(false);
  expect(a.requests).toHaveLength(2);
});

it.each(['caller', 'timeout', 'destroy'] as const)('aborts real HTTP metadata requests on %s', async (mode) => {
  const host = await deployment();
  let enter!: () => void;
  const entered = new Promise<void>((r) => {
    enter = r;
  });
  let abort!: () => void;
  const aborted = new Promise<void>((r) => {
    abort = r;
  });

  await host.host.plugins.unregister(RemoteExtractor.identifier);

  await host.host.plugins.register(
    definePlugin({
      id: 'slow',

      setup(ctx) {
        ctx.on('search.query.match', () => ({ score: 1 }));

        ctx.on('search.query.resolve', async (_, { signal }) => {
          enter();

          await new Promise<void>((r) =>
            signal.addEventListener(
              'abort',
              () => {
                abort();
                r();
              },
              { once: true },
            ),
          );

          signal.throwIfAborted();

          return undefined;
        });
      },
    })(),
  );

  const bot = player([{ ...host, timeoutMs: mode === 'timeout' ? 500 : 5000 }], 'slow');
  const controller = new AbortController();
  const pending = bot.search('slow', { signal: controller.signal });
  const rejected = expect(pending).rejects.toThrow();

  await entered;

  if (mode === 'caller') controller.abort();

  if (mode === 'destroy') await bot.destroy();

  await rejected;
  await aborted;
});

it('queues and stages operation descriptors without local extraction or a bot media request', async () => {
  const host = await deployment();
  const {
    player: bot,
    queue,
    session,
    backend,
  } = await setup({
    nodeType: 'remote',
    crossfadeAvailable: true,
    queueOptions: { crossfade: { enabled: true } },
    playerOptions: {
      plugins: [host].map((remoteHost) => definePlugin({ id: RemoteExtractor.identifier, remoteHost })()),
    },
  });

  cleanup.push(() => bot.destroy());
  backend.client.nodes[0]!.capabilities.pluginOperations = { available: true, hosts: [host.hostId], forwarding: false };

  const a = (await bot.search('a')).tracks[0]!;
  const b = (await bot.search('b')).tracks[0]!;
  const local = vi.spyOn(bot.plugins, 'resolveStream');
  const play = vi.spyOn(session, 'play');
  const stage = vi.spyOn(session, 'stageNext');

  await queue.play([a, b]);

  expect(play.mock.calls[0]?.[0]).toEqual({
    hostId: host.hostId,
    pluginId: SOURCE_PLUGIN_ID,
    operation: 'source.stream',
    input: { track: serializeSourceTrack(a) },
  });

  session.requestPreparation();
  await settle();

  expect(stage.mock.calls[0]?.[0]).toMatchObject({ hostId: host.hostId, operation: 'source.stream' });
  expect(local).not.toHaveBeenCalled();
  expect(host.requests.every((r) => r.body?.operation !== 'source.stream')).toBe(true);

  session.promote()();
  await settle();

  expect(queue.currentTrack).toBe(b);
  expect(queue.history.tracks.toArray()[0]?.sourceState).toBe(a.sourceState);
  expect(session.playCalls).toBe(1);

  await queue.stop();

  expect(session.stage).toBeNull();
});

it.each(['embedded', 'remote'] as const)(
  'rejects a %s node lacking host access without local fallback',
  async (nodeType) => {
    const host = await deployment();
    const { player: bot, queue } = await setup({
      nodeType,
      playerOptions: {
        plugins: [host].map((remoteHost) => definePlugin({ id: RemoteExtractor.identifier, remoteHost })()),
      },
    });

    cleanup.push(() => bot.destroy());

    const track = (await bot.search('audio')).tracks[0]!;
    const local = vi.spyOn(bot.plugins, 'resolveStream');

    await expect(queue.play(track)).rejects.toThrow('cannot access source host');

    expect(local).not.toHaveBeenCalled();
  },
);

it('carries all queued host requirements into session creation and fences custom selectors', async () => {
  const a = await deployment('a');
  const b = await deployment('b');
  const selectNode = vi.fn((_nodes: readonly unknown[]) => 'fake-node');
  const {
    player: bot,
    queue,
    backend,
  } = await setup({
    nodeType: 'remote',
    crossfadeAvailable: true,
    queueOptions: { crossfade: { enabled: true }, selectNode },
    playerOptions: {
      plugins: [a, b].map((remoteHost) => definePlugin({ id: RemoteExtractor.identifier, remoteHost })()),
    },
  });

  cleanup.push(() => bot.destroy());

  const first = (await bot.search('a', { hostId: 'a' })).tracks[0]!;
  const second = (await bot.search('b', { hostId: 'b' })).tracks[0]!;

  await queue.node.destroySession();
  backend.client.nodes[0]!.capabilities.pluginOperations = { available: true, hosts: ['a', 'b'], forwarding: false };

  await queue.play([first, second], { channelId: 'voice' });

  expect(backend.client.createDiscordSession.mock.lastCall?.[0].pluginHosts).toEqual(['a', 'b']);
  expect(selectNode.mock.lastCall?.[0]).toHaveLength(1);

  await queue.stop();
  await queue.node.destroySession();
  backend.client.nodes[0]!.capabilities.pluginOperations.hosts = ['a'];

  const selections = selectNode.mock.calls.length;

  await expect(queue.play([first, second], { channelId: 'voice' })).rejects.toThrow('cannot access source host b');

  // Like Remedia, a selector is never offered an empty candidate pool.
  expect(selectNode).toHaveBeenCalledTimes(selections);
});

it('rejects an unavailable deployment registration and accepts recovery at the configured endpoint', async () => {
  const host = await deployment();
  const bot = new DiscordPlayer({ nodes: [], send() {} });
  cleanup.push(() => bot.destroy());
  const registration = definePlugin({ id: RemoteExtractor.identifier, remoteHost: host });
  await host.host.close();
  await expect(bot.plugins.register(registration())).rejects.toThrow('Source host sources-1');
  await host.restart();
  await bot.plugins.register(registration());
  expect((await bot.search('recovered')).tracks[0]?.sourceReference?.hostId).toBe(host.hostId);
});

it.each(['skip', 'stop', 'delete'] as const)('cancels pending native operation playback on %s', async (control) => {
  const host = await deployment();
  const {
    player: bot,
    queue,
    session,
    backend,
  } = await setup({
    nodeType: 'remote',
    playerOptions: {
      plugins: [host].map((remoteHost) => definePlugin({ id: RemoteExtractor.identifier, remoteHost })()),
    },
  });

  cleanup.push(() => bot.destroy());
  backend.client.nodes[0]!.capabilities.pluginOperations = { available: true, hosts: [host.hostId], forwarding: false };

  const track = (await bot.search('pending')).tracks[0]!;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let signal: AbortSignal | undefined;

  vi.spyOn(session, 'play').mockImplementationOnce(async (_, options) => {
    signal = options?.signal;
    entered();
    await new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve(), { once: true }));
    signal?.throwIfAborted();

    throw new Error('Expected native operation cancellation');
  });

  const pending = queue.play(track);

  await started;
  await queue[control]();

  expect(signal?.aborted).toBe(true);
  expect((await pending).playerResult).toBeNull();
  expect(queue.currentTrack).toBeNull();
  expect(queue.stats.tracksFailed).toBe(0);
});

it('clears a pending native stage before waiting for its preparation lock', async () => {
  const host = await deployment();
  const {
    player: bot,
    queue,
    session,
    backend,
  } = await setup({
    nodeType: 'remote',
    crossfadeAvailable: true,
    queueOptions: { crossfade: { enabled: true } },
    playerOptions: {
      plugins: [host].map((remoteHost) => definePlugin({ id: RemoteExtractor.identifier, remoteHost })()),
    },
  });

  cleanup.push(() => bot.destroy());
  backend.client.nodes[0]!.capabilities.pluginOperations = { available: true, hosts: [host.hostId], forwarding: false };

  const a = (await bot.search('a')).tracks[0]!;
  const b = (await bot.search('b')).tracks[0]!;

  await queue.play([a, b]);

  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let cleared!: () => void;
  const cancelled = new Promise<void>((resolve) => {
    cleared = resolve;
  });

  vi.spyOn(session, 'stageNext').mockImplementationOnce(async () => {
    entered();
    await cancelled;

    throw new Error('Native stage cancelled');
  });

  const clear = vi.spyOn(session, 'clearStage').mockImplementation(async () => {
    cleared();
    session.stage = null;
  });

  session.requestPreparation();
  await started;
  await queue.stop();
  await settle();

  expect(clear).toHaveBeenCalled();
  expect(queue.currentTrack).toBeNull();
  expect(queue.tracks.toArray()).toEqual([b]);
  expect(queue.history.tracks.toArray()).not.toContain(b);
});

it('rejects provider failures and mismatched deployment identity without retrying', async () => {
  const a = await deployment('a');
  const b = await deployment('b');
  const bot = player([a, b]);

  await expect(bot.search('provider-failure')).rejects.toThrow('HTTP 502');

  expect(b.requests.some((request) => request.body?.input?.operation === 'search.query.resolve')).toBe(false);

  const incorrect = player([{ ...a, hostId: 'wrong-deployment' }, b]);

  await expect(incorrect.search('music')).rejects.toThrow('identity does not match');

  expect(b.requests.some((request) => request.body?.input?.operation === 'search.query.resolve')).toBe(false);
});
