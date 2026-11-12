import type { CrossfadeCurve, RemediaClient } from '@remedia/client';
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

  override async getRelatedTracks(track: Track) {
    return this.handle(`related:${track.title}`);
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

  await expect(queue.play([first, second], { channelId: 'voice' })).rejects.toThrow(
    'No healthy Remedia node can access required source hosts',
  );

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

async function forwarded(curve: CrossfadeCurve = 'equalPower') {
  const host = await deployment('discovered');
  const fixture = await setup({
    nodeType: 'remote',
    crossfadeAvailable: true,
    queueOptions: { crossfade: { enabled: true, curve } },
  });
  cleanup.push(() => fixture.player.destroy());
  const node = fixture.backend.client.nodes[0]!;
  node.capabilities.pluginOperations = { available: true, forwarding: true, hosts: [host.hostId] };
  const list = vi.fn<RemediaClient['plugins']['list']>(async ({ signal } = {}) => {
    signal?.throwIfAborted();
    const response = await host.host.fetch(new Request(`${host.url}/.well-known/remedia`, { signal }));
    const manifest = await response.json();
    return [
      {
        nodeId: node.id,
        hostId: host.hostId,
        status: 'healthy',
        operations: manifest.plugins.flatMap((plugin: { id: string; operations: string[] }) =>
          plugin.operations.map((operation) => ({ pluginId: plugin.id, operation })),
        ),
      },
    ];
  });
  const execute = vi.fn<RemediaClient['plugins']['execute']>(async (options) => {
    options.signal?.throwIfAborted();
    const response = await host.host.fetch(
      new Request(`${host.url}/remedia/v1/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: options.signal,
        body: JSON.stringify({ pluginId: options.pluginId, operation: options.operation, input: options.input }),
      }),
    );
    if (!response.ok) throw new Error(`Forwarding failed: ${response.status}`);
    return {
      ...(await response.json()),
      nodeId: options.nodeId!,
      hostId: options.hostId,
      pluginId: options.pluginId,
      operation: options.operation,
    };
  });
  Object.assign(fixture.backend.client, { plugins: { list, execute } });
  return { ...fixture, host, list, execute };
}

it('automatically discovers sources through Remedia, preserves portable state and plays without host registration', async () => {
  const { player: bot, session, execute } = await forwarded();
  const result = await bot.search('automatic', { requestedBy: { id: 'requester' } });
  const track = result.tracks[0]!;
  expect(bot.plugins.hasHost('discovered')).toBe(false);
  expect(track.sourceReference).toMatchObject({
    nodeId: 'fake-node',
    hostId: 'discovered',
    pluginId: RemoteExtractor.identifier,
  });
  expect(track.sourceState).toBeTypeOf('string');
  expect((deserialize(track.serialize()) as Track).sourceReference).toEqual(track.sourceReference);
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 'fake-node', operation: 'source.search' }));
  const play = vi.spyOn(session, 'play');
  await bot.play({ guildId: 'guild-one', channelId: 'voice-one' }, result);
  expect(play).toHaveBeenCalledWith(
    expect.objectContaining({ hostId: 'discovered', operation: 'source.stream' }),
    expect.anything(),
  );
  await expect(bot.resolvePlaybackSource(track, 'another-node', new AbortController().signal)).rejects.toThrow(
    'originating',
  );
});

it('prefers local results and forwards portable targeting, blocked providers and cancellation', async () => {
  const { player: bot, execute } = await forwarded();
  await bot.plugins.register(
    definePlugin({
      id: 'local',
      setup(ctx) {
        ctx.on('search.query.match', () => ({ score: 1 }));
        ctx.on('search.query.resolve', () => ({ tracks: [new Track({ title: 'local' })], playlist: null }));
      },
    })(),
  );
  expect((await bot.search('local')).tracks[0]?.title).toBe('local');
  expect(execute).not.toHaveBeenCalled();
  const result = await bot.search('remote', {
    searchEngine: RemoteExtractor.identifier,
    blockExtractors: ['local'],
    requestOptions: { headers: { authorization: 'private' } },
  });
  expect(result.tracks).toHaveLength(1);
  expect(JSON.stringify(execute.mock.calls)).not.toContain('private');
  expect((await bot.search('blocked', { blockExtractors: ['local', RemoteExtractor.identifier] })).isEmpty()).toBe(
    true,
  );
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await expect(bot.search('cancelled', { signal: controller.signal })).rejects.toThrow('cancelled');
});

it('keeps failures distinct from empty results and refreshes discovery on subsequent requests', async () => {
  const { player: bot, list, execute } = await forwarded();
  execute.mockResolvedValueOnce({
    handled: false,
    nodeId: 'fake-node',
    hostId: 'discovered',
    pluginId: SOURCE_PLUGIN_ID,
    operation: 'source.search',
  });
  expect((await bot.search('declined')).isEmpty()).toBe(true);
  execute.mockRejectedValueOnce(new Error('host unavailable'));
  await expect(bot.search('failure')).rejects.toThrow('host unavailable');
  list.mockResolvedValueOnce([]);
  expect((await bot.search('removed')).isEmpty()).toBe(true);
  expect((await bot.search('reconnected')).tracks).toHaveLength(1);
});

it('rejects conflicting placements including duplicate host IDs and sticky guild assignments', async () => {
  const { player: bot, queue, backend } = await forwarded();
  const first = (await bot.search('first')).tracks[0]!;
  const second = deserialize(first.serialize()) as Track;
  second.sourceReference!.nodeId = 'other-deployment';
  await expect(queue.play([first, second], { channelId: 'voice-one' })).rejects.toThrow('conflicting Remedia nodes');
  await expect(queue.play(second, { channelId: 'voice-one' })).rejects.toThrow();
  await queue.node.destroySession();
  backend.client.getAssignment.mockReturnValue({
    guildId: queue.guildId,
    nodeId: 'other-deployment',
    nodeType: 'remote',
    status: 'assigned',
  });
  await expect(queue.play(first, { channelId: 'voice-one' })).rejects.toThrow('sticky guild assignment');
});

it.each(['equalPower', 'adaptive'] as const)(
  'preserves discovered source affinity through %s crossfade and history',
  async (curve) => {
    const { player: bot, queue, session, execute } = await forwarded(curve);
    expect(session.crossfade).toEqual({ enabled: true, curve });
    const first = (await bot.search('first')).tracks[0]!;
    const related = await bot.plugins.execute('track.related', { track: first });
    const second = related!.tracks[0]!;
    expect(second.title).toBe('related:first');
    expect(second.sourceReference).toMatchObject({
      nodeId: 'fake-node',
      hostId: 'discovered',
      pluginId: RemoteExtractor.identifier,
    });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 'fake-node', operation: 'source.related' }));
    const stage = vi.spyOn(session, 'stageNext');
    await queue.play([first, second]);
    session.requestPreparation();
    await settle();
    expect(stage).toHaveBeenCalledWith(
      expect.objectContaining({ hostId: 'discovered', operation: 'source.stream' }),
      expect.anything(),
    );
    session.promote()();
    await settle();
    expect(queue.currentTrack).toBe(second);
    expect(queue.history.tracks.toArray()[0]?.sourceReference?.nodeId).toBe('fake-node');
    await queue.stop();
    expect(session.stage).toBeNull();
  },
);

it('forwards authorized Track lyrics through metadata.execute without forwarding lifecycle hooks', async () => {
  const { player: bot, host, execute } = await forwarded();
  const track = (await bot.search('lyrics')).tracks[0]!;
  await host.host.plugins.register(
    definePlugin({
      id: 'lyrics-provider',
      setup(ctx) {
        ctx.on('lyrics.search', () => [{ plain: { available: true, text: 'A lyric' }, synced: { available: false } }]);
      },
    })(),
  );
  track.lyricsReference = { ...track.sourceReference!, pluginId: 'lyrics-provider' };
  const lyrics = await bot.lyrics.search(track);
  expect(lyrics[0]?.plain).toEqual({ available: true, text: 'A lyric' });
  expect(lyrics[0]?.provider).toMatchObject({ nodeId: 'fake-node', hostId: 'discovered', pluginId: 'lyrics-provider' });
  expect(execute).toHaveBeenLastCalledWith(
    expect.objectContaining({ operation: 'metadata.execute', nodeId: 'fake-node' }),
  );
  expect(bot.plugins.hasCapability('player.destroying')).toBe(false);
});

it('tries multiple deployments with duplicate host IDs and pins a new session to the successful node', async () => {
  const { player: bot, queue, backend, list, execute } = await forwarded();
  const original = (await list())[0]!;
  list.mockResolvedValue([original, { ...original, nodeId: 'second-node' }]);
  backend.client.nodes.push({ ...backend.client.nodes[0]!, id: 'second-node' });
  execute.mockResolvedValueOnce({
    handled: true,
    result: { tracks: [], playlist: null },
    nodeId: 'fake-node',
    hostId: 'discovered',
    pluginId: SOURCE_PLUGIN_ID,
    operation: 'source.search',
  });
  const track = (await bot.search('second deployment')).tracks[0]!;
  expect(track.sourceReference?.nodeId).toBe('second-node');
  await queue.node.destroySession();
  await queue.play(track, { channelId: 'voice-one' });
  expect(backend.client.createDiscordSession).toHaveBeenLastCalledWith(
    expect.objectContaining({ nodeId: 'second-node' }),
  );
});

it('cancels in-flight forwarding and skips unsupported servers without polling', async () => {
  const { player: bot, backend, list, execute } = await forwarded();
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  execute.mockImplementationOnce(async ({ signal }) => {
    entered();
    await new Promise<void>((resolve) => signal!.addEventListener('abort', () => resolve(), { once: true }));
    signal!.throwIfAborted();
    throw new Error('Unreachable');
  });
  const controller = new AbortController();
  const pending = bot.search('pending', { signal: controller.signal });
  await started;
  controller.abort(new Error('cancel forwarding'));
  await expect(pending).rejects.toThrow('cancel forwarding');
  list.mockClear();
  backend.client.nodes[0]!.capabilities.pluginOperations.forwarding = false;
  expect((await bot.search('unsupported')).isEmpty()).toBe(true);
  expect(list).not.toHaveBeenCalled();
});

it('rejects an unsupported adaptive curve on a discovered source node without moving its playback', async () => {
  const { player: bot, queue, session, backend } = await forwarded('adaptive');
  const track = (await bot.search('affinity')).tracks[0]!;

  await queue.node.destroySession();
  backend.client.nodes[0]!.capabilities.crossfade.curves = ['equalPower'];
  backend.client.createDiscordSession.mockClear();

  await expect(queue.play(track, { channelId: 'voice-one' })).rejects.toThrow(
    'does not support the adaptive crossfade curve',
  );

  expect(backend.client.createDiscordSession).not.toHaveBeenCalled();
  expect(queue.node.session).toBeNull();
  expect(session.connectionState).toBe('disconnected');
  expect(track.sourceReference?.nodeId).toBe('fake-node');
});
