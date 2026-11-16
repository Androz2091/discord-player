import { RemediaClient } from '@remedia/client';
import { createSourcePluginHost, BaseExtractor, Track } from '@discord-player/plugin-host';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { expect, it, vi } from 'vitest';
import { QueueRepeatMode } from '../src/index.js';
import { setup } from './mocks/queue.js';
import { deferred, settle } from './mocks/async.js';

// Opt in with REMEDIA_BINARY=/path/to/remedia; no Discord credentials or public media needed.
it.skipIf(!process.env.REMEDIA_BINARY).each(['off', 'early', 'late', 'cancel'] as const)(
  'AutoPlay over real Remedia RPC and HTTP host after cache eviction (transition %s)',
  async (transition) => {
    const crossfade = transition !== 'off';
    const entered = deferred<void>();
    const release = deferred<void>();
    vi.mocked(RemediaClient.create).mockRestore();
    const directory = await mkdtemp(join(tmpdir(), 'player-autoplay-'));
    let host: ReturnType<typeof createSourcePluginHost>;

    class Provider extends BaseExtractor {
      static override identifier = 'fixture.rpc';

      override async validate() {
        return true;
      }

      override async handle(query: string) {
        return this.createResponse(null, [
          new Track(this.context.player, {
            title: query,
            url: `https://fixture.test/${query}`,
            raw: { engine: { private: true } },
          }),
        ]);
      }

      override async stream() {
        return 'https://fixture.test/audio';
      }

      override async getRelatedTracks(track: Track) {
        entered.resolve();
        await release.promise;

        return this.createResponse(null, [
          new Track({ title: `next:${track.title}`, url: `https://fixture.test/next/${track.title}` }),
        ]);
      }
    }

    const server = createServer(async (req, res) => {
      const controller = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) controller.abort();
      });
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const response = await host.fetch(
          new Request(`http://127.0.0.1${req.url}`, {
            method: req.method,
            headers: { 'content-type': 'application/json' },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
            signal: controller.signal,
          }),
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        res.writeHead(500).end();
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');
    host = createSourcePluginHost({
      name: 'RPC fixture',
      hostId: 'rpc-host',
      maxTrackStates: 1,
      publicUrl: `http://127.0.0.1:${address.port}`,
    });
    const provider = await host.extractors.register(Provider);
    const portProbe = createServer();
    portProbe.listen(0, '127.0.0.1');
    await once(portProbe, 'listening');
    const rpcAddress = portProbe.address();
    if (!rpcAddress || typeof rpcAddress === 'string') throw new Error('Expected RPC TCP address');
    await new Promise<void>((resolve) => portProbe.close(() => resolve()));
    const config = join(directory, 'remedia.json');
    await writeFile(
      config,
      JSON.stringify({
        listen: `127.0.0.1:${rpcAddress.port}`,
        auth: { password: 'fixture-only-password' },
        pluginHosts: [
          {
            id: 'rpc-host',
            enabled: true,
            url: `http://127.0.0.1:${address.port}`,
            allowHttp: true,
            operations: ['source.search', 'source.related', 'source.stream'].map((operation) => ({
              pluginId: 'discord-player.source',
              operation,
              replaySafe: operation === 'source.stream',
            })),
          },
        ],
      }),
    );
    const processHandle = spawn(
      process.env.REMEDIA_BINARY ?? 'remedia',
      ['--config', config, '--shutdown-on-stdin-close'],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    let client: RemediaClient | undefined;
    let fixture: Awaited<ReturnType<typeof setup>> | undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        let diagnostic = '';
        processHandle.once('error', reject);
        processHandle.once('exit', () => reject(new Error(`Remedia exited before listening: ${diagnostic}`)));
        processHandle.stdout.on('data', (data: Buffer) => {
          if (data.toString().includes('listening on')) resolve();
        });
        processHandle.stderr.on('data', (data: Buffer) => {
          diagnostic += data.toString();
          if (data.toString().includes('listening on')) resolve();
        });
      });
      client = await RemediaClient.create({
        nodes: [
          {
            type: 'remote',
            id: 'fake-node',
            url: `ws://127.0.0.1:${rpcAddress.port}/v1/ws`,
            auth: { username: 'remedia', password: 'fixture-only-password' },
          },
        ],
        botUserId: '123456789012345678',
        send() {},
      });
      if (!client.nodes.some((node) => node.status === 'healthy'))
        await once(client, 'nodeConnected', { signal: AbortSignal.timeout(3000) });
      fixture = await setup({
        nodeType: 'remote',
        crossfadeAvailable: true,
        queueOptions: {
          repeatMode: QueueRepeatMode.AUTOPLAY,
          crossfade: crossfade ? { enabled: true, curve: 'adaptive' } : false,
        },
      });
      const { player, queue, session, backend } = fixture;
      backend.client.nodes[0]!.capabilities.pluginOperations = {
        available: true,
        forwarding: true,
        hosts: ['rpc-host'],
      };
      Object.assign(backend.client, { plugins: client.plugins });
      const track = (await player.search('first', { signal: AbortSignal.timeout(1000) })).tracks[0]!;
      await player.search('evict');
      const metadata = vi.spyOn(provider, 'handle').mockRejectedValue(new Error('Unexpected reconstruction'));
      const related = vi.spyOn(provider, 'getRelatedTracks');
      await queue.play(track);
      const ready = new Promise<void>((resolve, reject) => {
        player.events.once('error', (_, error) => reject(error));
        player.events.once(transition === 'early' ? 'stageReady' : 'playerStart', () => resolve());
      });
      // Attach a rejection handler before cancellation so a late diagnostic cannot leak.
      void ready.catch(() => undefined);

      if (crossfade) session.requestPreparation();
      else session.complete();
      await entered.promise;

      if (transition === 'late') session.complete();
      if (transition === 'cancel') await queue.stop();
      release.resolve();

      if (transition === 'cancel') {
        await settle();
        expect(queue.currentTrack).toBeNull();
        expect(session.playCalls).toBe(1);
        expect(related).toHaveBeenCalledOnce();

        return;
      }

      await ready;
      if (transition === 'early') session.promote()();
      expect(queue.currentTrack?.title).toBe('next:first');
      expect(queue.currentTrack?.sourceReference).toMatchObject({
        nodeId: 'fake-node',
        hostId: 'rpc-host',
        pluginId: Provider.identifier,
      });
      expect(related).toHaveBeenCalledOnce();
      expect(metadata).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      await fixture?.player.destroy();
      await client?.close();
      processHandle.stdin.end();
      if (processHandle.exitCode === null) await once(processHandle, 'exit');
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await host.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
  15000,
);
