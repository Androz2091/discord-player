import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { RemediaClient } from '@remedia/client';
import { DiscordPlayer, Track, Playlist, SearchResult, definePlugin } from '../src/index.js';
import { createRemediaMock } from './mocks/remedia.js';
import { setup, TestTrack } from './mocks/queue.js';
import { settle } from './mocks/async.js';

it('reports the version from the package manifest for the current release build', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  expect(DiscordPlayer.version).toBe(packageJson.version);
});

it('initializes sources before Remedia and keeps host options out of the client SDK', async () => {
  const backend = createRemediaMock();
  const create = vi.spyOn(RemediaClient, 'create').mockResolvedValue(backend.asClient());
  const sequence: string[] = [];
  const p = new DiscordPlayer({
    nodes: [],
    send() {},
    blockExtractors: ['blocked'],
    plugins: [
      definePlugin({
        id: 'source',
        kind: 'source',
        async setup() {
          await settle();
          sequence.push('setup');
        },
      })(),
    ],
  });
  expect(p.getRemedia(false)).toBeNull();
  expect(p.nodeSnapshots).toBeNull();
  expect(() => p.getRemedia()).toThrow('initialize');
  expect(() => p.getClientId()).toThrow('initialize');
  await p.initialize('bot');
  expect(sequence).toEqual(['setup']);
  expect(p.getClientId()).toBe('bot');
  expect(p.getRemedia()).toBe(backend.asClient());
  expect(p.nodeSnapshots).toBe(backend.client.nodes);
  expect(create.mock.calls[0]![0]).not.toHaveProperty('plugins');
  expect(create.mock.calls[0]![0]).not.toHaveProperty('blockExtractors');
  expect(p.version).toBe(DiscordPlayer.version);
  expect(p.id).toBeTypeOf('string');
  const debug = vi.fn();
  p.on('debug', debug);
  p.debug('message');
  expect(debug).toHaveBeenCalledWith('message');
  p.receive({ t: 'OTHER' });
  p.receive({});
  p.receive({ t: 'VOICE_STATE_UPDATE', d: {} });
  p.receive({ t: 'VOICE_SERVER_UPDATE', d: {} });
  expect(backend.client.receive).toHaveBeenCalledTimes(2);
  const select = create.mock.calls[0]![0].selectNode!;
  await expect(select(backend.client.nodes, { guildId: 'missing' } as never)).rejects.toThrow('No guild queue');
  await p.createQueue('guild');
  expect(await select(backend.client.nodes, { guildId: 'guild' } as never)).toBe('fake-node');
  await expect(select([], { guildId: 'guild' } as never)).rejects.toThrow('No Remedia nodes');
  const custom = await p.createQueue('custom', { selectNode: () => 'chosen' });
  expect(await select(backend.client.nodes, { guildId: custom.id } as never)).toBe('chosen');
  await p.destroy();
});

it('cleans source resources when Remedia initialization fails and retains both failures if cleanup fails', async () => {
  vi.spyOn(RemediaClient, 'create').mockRejectedValue(new Error('client failed'));
  const cleanup = vi.fn();
  const p = new DiscordPlayer({
    nodes: [],
    send() {},
    plugins: [
      definePlugin({
        id: 'source',
        kind: 'source',
        setup(ctx) {
          ctx.onCleanup(cleanup);
        },
      })(),
    ],
  });
  await expect(p.initialize('bot')).rejects.toThrow('client failed');
  expect(cleanup).toHaveBeenCalledOnce();
  expect(() => p.getClientId()).toThrow('initialize');
  const broken = new DiscordPlayer({
    nodes: [],
    send() {},
    plugins: [
      definePlugin({
        id: 'source',
        kind: 'source',
        setup() {},
        destroy() {
          throw new Error('cleanup failed');
        },
      })(),
    ],
  });
  await expect(broken.initialize('bot')).rejects.toBeInstanceOf(AggregateError);
});

it('wraps in-memory media values and handles missing providers and cancelled searches', async () => {
  const p = new DiscordPlayer({ nodes: [], send() {} });
  p.receive({ t: 'VOICE_STATE_UPDATE' });
  const track = new Track({ title: 'one' });
  const playlist = new Playlist({ tracks: [track] });
  const result = new SearchResult({ playlist: null, tracks: [track] });
  expect(await p.search(result)).toBe(result);
  expect((await p.search(track)).tracks).toEqual([track]);
  expect((await p.search([track])).tracks).toEqual([track]);
  expect((await p.search(playlist)).playlist).toBe(playlist);
  expect((await p.search('query')).isEmpty()).toBe(true);
  await expect(p.search('query', { signal: AbortSignal.abort('cancel') })).rejects.toBe('cancel');
  expect(await p.deleteQueue('missing')).toBe(false);
  await p.destroy();
});

it('orchestrates channel resolution, queue defaults and managed playback', async () => {
  const { player, queue, session } = await setup();
  const track = new TestTrack('first');
  const result = await player.play({ id: 'voice-one', guild: { id: queue.id } }, track, {
    queueOptions: { metadata: 'retained' },
    customMetadata: 'one',
  });
  expect(result.queue).toBe(queue);
  expect(result.track).toBe(track);
  expect(session.playCalls).toBe(1);
  expect(player.statistics).toEqual({ queues: 1, upcomingTracks: 0, activeQueues: 1 });
  expect(player.getQueue(queue.id)).toBe(queue);
  expect(player.nodes).toBe(player.queues);
  await expect(player.play('voice', track)).rejects.toThrow('guildId');
  const empty = await player.play({ guildId: queue.id, channelId: 'voice-one' }, 'unhandled');
  expect(empty.track).toBeNull();
  expect(empty.playerResult).toBeNull();
  await queue.stop();
  await player.play('voice-one', new TestTrack('second'), { guildId: queue.id });
  expect(session.playCalls).toBe(2);
  expect(await player.deleteQueue(queue.id)).toBe(true);
  expect(player.statistics.queues).toBe(0);
});
