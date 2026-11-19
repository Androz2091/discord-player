import type { Operation } from '@discord-player/plugin-host';
import { afterEach, expect, it, vi } from 'vitest';
import { definePlugin, QueueRepeatMode, SourcePluginRuntime, type OperationContext, type Track } from '../src/index.js';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred, settle } from './mocks/async.js';

declare module '@discord-player/plugin-host' {
  interface OperationMap {
    'fixture.guild': Operation<{ guildId?: string }, string, 'first'>;
    'fixture.sync': Operation<Record<string, never>, string, 'first'>;
  }
  interface SynchronousOperationMap {
    'fixture.sync': true;
  }
}

const players: Awaited<ReturnType<typeof setup>>['player'][] = [];

async function fixture(guildId = 'one') {
  const value = await setup({ guildId });
  players.push(value.player);
  return value;
}

afterEach(async () => {
  await Promise.all(players.splice(0).map((player) => player.destroy()));
});

it('exposes the actual full Player during setup and synchronous lifecycle dispatch', async () => {
  const { player, queue } = await fixture();
  const calls = vi.fn();
  await player.plugins.register(
    definePlugin({
      id: 'context.lifecycle',
      setup(ctx) {
        expect(ctx.player.isPartial()).toBe(false);
        expect(ctx.player).toBe(player);
        if (ctx.player.isPartial()) throw new Error('Expected full Player');
        expect(ctx.player.nodes.get('one')).toBe(queue);
        ctx.on(
          'queue.beforeAdd',
          (_, context) => {
            calls(context);
            expect(context.queue).toBe(queue);
            expect(context.guildId).toBe('one');
          },
          { guildIds: ['one'] },
        );
        ctx.on(
          'queue.changed',
          (_, context) => {
            expect(context.queue).toBe(queue);
            expect(context.guildId).toBe('one');
          },
          { guildIds: ['one'] },
        );
      },
    })(),
  );
  queue.addTrack(new TestTrack('one'));
  expect(calls).toHaveBeenCalledOnce();
});

it('routes custom sync and async operations explicitly, ignoring spoofed payload guilds', async () => {
  const { player, queue } = await fixture();
  player.plugins.defineOperation('fixture.guild', 'first');
  player.plugins.defineOperation('fixture.sync', 'first', true);
  await player.plugins.register(
    definePlugin({
      id: 'context.custom',
      setup(ctx) {
        ctx.on(
          'fixture.guild',
          (_, context) => {
            expect(context.queue).toBe(queue);
            expect(context.guildId).toBe('one');
            return 'scoped';
          },
          { guildIds: ['one'], priority: 10 },
        );
        ctx.on('fixture.guild', (_, context) => {
          expect(context.queue).toBeNull();
          return context.guildId ?? 'unscoped';
        });
        ctx.on(
          'fixture.sync',
          (_, context) => {
            expect(context.queue).toBe(queue);
            return 'sync';
          },
          { guildIds: ['one'] },
        );
      },
    })(),
  );
  expect(await player.plugins.execute('fixture.guild', { guildId: 'one' })).toBe('unscoped');
  expect(await player.plugins.execute('fixture.guild', {}, { guildId: 'one' })).toBe('scoped');
  expect(await player.plugins.execute('fixture.guild', { guildId: 'one' }, { guildId: 'missing' })).toBe('missing');
  expect(player.plugins.executeSync('fixture.sync', {}, { guildId: 'one' })).toBe('sync');
  expect(player.plugins.executeSync('fixture.sync', {})).toBeUndefined();
});

it('keeps concurrent guild source invocations isolated and preserves related lookup context', async () => {
  const { player, queue, session } = await fixture();
  const second = await player.nodes.create('two');
  await second.connect({ channelId: 'voice-two' });
  const entered = deferred<void>();
  const release = deferred<void>();
  const contexts: OperationContext[] = [];
  const related = vi.fn();
  await player.plugins.unregister('fixture');
  await player.plugins.register(
    definePlugin({
      id: 'fixture',
      setup(ctx) {
        const stream = async ({ track }: { track: Track }, context: OperationContext) => {
          contexts.push(context);
          if (contexts.length === 2) entered.resolve();
          await release.promise;
          expect(context.queue?.guildId).toBe(context.guildId);
          expect(context.queue?.currentTrack).toBe(track);
          return { url: track.url };
        };
        ctx.on('track.stream', stream, { guildIds: ['one'], priority: 10 });
        ctx.on('track.stream', stream, { guildIds: ['two'] });
        ctx.on(
          'track.related',
          ({ track }, context) => {
            related(context);
            return { tracks: [new TestTrack(`related:${track.title}`)], playlist: null };
          },
          { guildIds: ['one'] },
        );
      },
    })(),
  );
  const firstPlay = queue.play(new TestTrack('A'));
  const secondPlay = second.play(new TestTrack('other'));
  await entered.promise;
  expect(contexts.map((context) => context.guildId).sort()).toEqual(['one', 'two']);
  expect(contexts.find((context) => context.guildId === 'one')?.queue).toBe(queue);
  expect(contexts.find((context) => context.guildId === 'two')?.queue).toBe(second);
  release.resolve();
  await Promise.all([firstPlay, secondPlay]);
  queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
  session.complete();
  await settle();
  expect(related).toHaveBeenCalledOnce();
  expect(related.mock.calls[0]?.[0]).toMatchObject({ guildId: 'one', queue });
  expect(queue.currentTrack?.title).toBe('related:A');
  expect(second.currentTrack?.title).toBe('other');
});

it('uses the owning Player for identical guild IDs and guild-scoped search', async () => {
  const first = await fixture('shared');
  const second = await fixture('shared');
  for (const { player, queue } of [first, second]) {
    await player.plugins.register(
      definePlugin({
        id: 'context.search',
        setup(ctx) {
          ctx.on(
            'search.query.match',
            (_, context) => {
              expect(context.queue).toBe(queue);
              return { score: 100 };
            },
            { guildIds: ['shared'] },
          );
          ctx.on(
            'search.query.resolve',
            (_, context) => {
              expect(context.queue).toBe(queue);
              return { tracks: [new TestTrack('found')], playlist: null };
            },
            { guildIds: ['shared'] },
          );
        },
      })(),
    );
  }
  const results = await Promise.all([first, second].map(({ player }) => player.search('query', { guildId: 'shared' })));
  expect(results.map((result) => result.tracks[0]?.title)).toEqual(['found', 'found']);
  expect((await first.player.search('query')).isEmpty()).toBe(true);
});

it('keeps standalone runtime context partial and never selects guild-restricted handlers', async () => {
  const runtime = new SourcePluginRuntime();
  const restricted = vi.fn(() => 'restricted');
  runtime.plugins.defineOperation('fixture.guild', 'first');
  try {
    await runtime.plugins.register(
      definePlugin({
        id: 'context.partial',
        setup(ctx) {
          expect(ctx.player.isPartial()).toBe(true);
          expect(ctx.player).toBe(runtime);
          ctx.on('fixture.guild', restricted, { guildIds: ['one'], priority: 10 });
          ctx.on('fixture.guild', (_, context) => {
            expect(context.queue).toBeNull();
            expect(context.guildId).toBeNull();
            return 'partial';
          });
        },
      })(),
    );
    expect(await runtime.plugins.execute('fixture.guild', { guildId: 'one' }, { guildId: 'one' })).toBe('partial');
    expect(restricted).not.toHaveBeenCalled();
  } finally {
    await runtime.destroy();
  }
});
