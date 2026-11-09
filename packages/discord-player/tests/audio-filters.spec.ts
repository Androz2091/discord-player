import { expect, it, vi } from 'vitest';
import {
  AudioFilter,
  type AudioFilterPresetName,
  AudioFilterPresets,
  DiscordPlayer,
  GuildQueuePlayerAudioFilters,
  type AudioFilterName,
} from '../src/index.js';
import { setup } from './mocks/queue.js';
import { deferred, settle } from './mocks/async.js';

it('exposes the fixed legacy presets', () => {
  expect(Object.keys(AudioFilterPresets)).toHaveLength(35);
  expect(AudioFilterPresets['8D']).toBe('apulsator=hz=0.09');
  expect(AudioFilterPresets.nightcore).toBe('aresample=48000,asetrate=48000*1.25');
  expect(AudioFilterPresets.mono).toBe('pan=mono|c0=.5*c0+.5*c1');
});

it('replaces named filters, deduplicates aliases, and removes individual or multiple presets', async () => {
  const { player, queue, session } = await setup();
  const filters = queue.node.filters;
  expect(filters).toBeInstanceOf(GuildQueuePlayerAudioFilters);
  expect(filters.get()).toBeNull();
  expect(filters.enabled).toEqual([]);

  await filters.set(['8d', 'nightcore', '8D']);
  expect(filters.enabled).toEqual(['8D', 'nightcore']);
  expect(filters.get('8d')).toBe(true);
  expect(filters.get('8D')).toBe(true);
  expect(filters.get('vaporwave')).toBe(false);
  expect(session.filters.graph).toBe(`${AudioFilterPresets['8D']},${AudioFilterPresets.nightcore}`);

  const detached = filters.enabled as AudioFilterName[];
  detached.pop();
  expect(filters.enabled).toHaveLength(2);

  await filters.remove('8d');
  expect(filters.enabled).toEqual(['nightcore']);
  await filters.remove(['nightcore', 'vaporwave']);
  expect(filters.graph).toBeNull();
  await filters.set('bassboost');
  expect(filters.enabled).toEqual(['bassboost']);
  await filters.set([]);
  expect(filters.graph).toBeNull();
  await player.destroy();
});

it('toggles presets independently and preserves order when an explicit state is unchanged', async () => {
  const { player, queue, session } = await setup();
  const filters = queue.node.filters;
  const set = vi.spyOn(session.filters, 'set');

  expect(await filters.toggle('nightcore')).toBe(true);
  expect(await filters.toggle('8d')).toBe(true);
  const graph = filters.graph;
  const calls = set.mock.calls.length;
  expect(await filters.toggle('nightcore', true)).toBe(true);
  expect(filters.graph).toBe(graph);
  expect(set).toHaveBeenCalledTimes(calls);
  expect(await filters.toggle('nightcore')).toBe(false);
  expect(filters.enabled).toEqual(['8D']);
  expect(await filters.toggle('nightcore', false)).toBe(false);
  expect(await filters.toggle('8D', false)).toBe(false);
  expect(filters.graph).toBeNull();
  await player.destroy();
});

it('treats raw graphs as opaque and preserves them across named toggles and removals', async () => {
  const { player, queue } = await setup();
  const filters = queue.node.filters;
  const raw = "volume=0.5,aeval=exprs='val(0),val(1)'";

  await filters.set(raw);
  expect(filters.enabled).toEqual([]);
  expect(filters.get()).toBe(raw);
  await filters.toggle('nightcore');
  expect(filters.graph).toBe(`${raw},${AudioFilterPresets.nightcore}`);
  await filters.remove('nightcore');
  expect(filters.graph).toBe(raw);
  await filters.setRaw('tremolo');
  expect(filters.enabled).toEqual([]);
  await filters.toggle('8d');
  expect(filters.graph).toBe(`tremolo,${AudioFilterPresets['8D']}`);
  await filters.set('vaporwave');
  expect(filters.graph).toBe(AudioFilterPresets.vaporwave);
  await filters.set(null);
  expect(filters.graph).toBeNull();
  await player.destroy();
});

it('configures filters before connection and retains them through moves and reconnects', async () => {
  const { player, queue, backend } = await setup();
  const filters = queue.node.filters;
  await queue.node.destroySession();

  await filters.set('nightcore');
  expect(queue.options.filterGraph).toBe(AudioFilterPresets.nightcore);
  expect(filters.graph).toBe(AudioFilterPresets.nightcore);
  const session = backend.asSession(await queue.connect({ channelId: 'new' }));
  expect(session.filters.graph).toBe(AudioFilterPresets.nightcore);
  await queue.connect({ channelId: 'moved' });
  expect(queue.node.filters).toBe(filters);
  expect(filters.enabled).toEqual(['nightcore']);
  await queue.node.destroySession();
  await queue.connect({ channelId: 'reconnected' });
  expect(filters.get('nightcore')).toBe(true);
  await player.destroy();
  await expect(filters.clear()).rejects.toThrow('destroyed');
});

it('reads configured defaults without a session and synchronizes changes made through raw Remedia controls', async () => {
  const player = new DiscordPlayer({ nodes: [], send() {} });
  const initial = await player.createQueue('defaults', { filterGraph: AudioFilterPresets.nightcore });
  expect(initial.node.filters.graph).toBe(AudioFilterPresets.nightcore);
  expect(initial.node.filters.enabled).toEqual(['nightcore']);
  await player.destroy();

  const { player: connected, queue, session } = await setup();
  const filters = queue.node.filters;
  await filters.set('nightcore');
  await session.filters.set('volume=0.25');
  expect(filters.get('nightcore')).toBe(false);
  await filters.toggle('8D');
  expect(filters.graph).toBe(`volume=0.25,${AudioFilterPresets['8D']}`);
  await session.filters.clear();
  expect(filters.graph).toBeNull();
  expect(filters.enabled).toEqual([]);
  await session.filters.set(AudioFilterPresets.vaporwave);
  expect(filters.enabled).toEqual(['vaporwave']);
  await connected.destroy();
});

it('commits state only after Remedia accepts the graph and leaves rejected updates unchanged', async () => {
  const { player, queue, session } = await setup();
  const filters = queue.node.filters;
  await filters.set('nightcore');
  const graph = filters.graph;
  vi.spyOn(session.filters, 'set').mockRejectedValueOnce(new Error('unsupported filter'));

  await expect(filters.toggle('8D')).rejects.toThrow('unsupported filter');
  expect(filters.graph).toBe(graph);
  expect(filters.enabled).toEqual(['nightcore']);
  expect(queue.options.filterGraph).toBe(graph);
  vi.spyOn(session.filters, 'clear').mockRejectedValueOnce(new Error('clear failed'));
  await expect(filters.clear()).rejects.toThrow('clear failed');
  expect(filters.get('nightcore')).toBe(true);
  await filters.clear();
  expect(filters.graph).toBeNull();
  await player.destroy();
});

it('serializes concurrent toggles with session moves and retains every successful mutation', async () => {
  const { player, queue, session } = await setup();
  const first = deferred<void>();
  const set = session.filters.set.bind(session.filters);
  vi.spyOn(session.filters, 'set').mockImplementationOnce(async (graph) => {
    await first.promise;
    await set(graph);
  });

  const one = queue.node.filters.toggle('nightcore');
  await settle();
  const two = queue.node.filters.toggle('8d');
  const move = queue.connect({ channelId: 'moved' });
  expect(queue.node.filters.enabled).toEqual([]);
  first.resolve();
  await Promise.all([one, two, move]);
  expect(queue.node.filters.enabled).toEqual(['nightcore', '8D']);
  expect(session.channelId).toBe('moved');
  expect(queue.options.filterGraph).toBe(`${AudioFilterPresets.nightcore},${AudioFilterPresets['8D']}`);
  await player.destroy();
});

it('rejects empty graphs and unknown named filters without changing configuration', async () => {
  const { player, queue, session } = await setup();
  const filters = queue.node.filters;
  const set = vi.spyOn(session.filters, 'set');

  for (const raw of ['', '   ']) {
    await expect(filters.set(raw)).rejects.toThrow(RangeError);
    await expect(filters.setRaw(raw)).rejects.toThrow(RangeError);
  }
  await expect(filters.set(['missing' as never])).rejects.toThrow(RangeError);
  await expect(filters.remove('missing' as never)).rejects.toThrow(RangeError);
  await expect(filters.toggle('missing' as never)).rejects.toThrow(RangeError);
  expect(() => filters.get('missing' as never)).toThrow(RangeError);
  expect(set).not.toHaveBeenCalled();
  expect(filters.graph).toBeNull();
  await player.destroy();
});

it('should define new filters', async () => {
  const { player, queue } = await setup();
  const filters = queue.node.filters;

  AudioFilter.define('underwater', 'lowpass=f=600,aecho=0.8:0.7:40:0.5');

  expect(Object.keys(AudioFilterPresets)).includes('underwater');
  expect(await filters.toggle('underwater' as AudioFilterPresetName)).toBe(true);
  expect(filters.enabled).toEqual(['underwater']);

  const newFilters = [
    {
      name: 'true8d',
      value: 'apulsator=mode=sine:hz=0.125:amount=0.6,crossfeed=strength=0.4,aecho=0.9:0.9:40|70:0.15|0.1',
    },
    {
      name: 'reverb',
      value: 'aecho=0.8:0.7:40:0.5',
    },
  ];

  AudioFilter.defineBulk(newFilters);

  expect(Object.keys(AudioFilterPresets)).includes('reverb');
  expect(Object.keys(AudioFilterPresets)).includes('true8d');
  expect(await filters.toggle('true8d' as AudioFilterPresetName)).toBe(true);
  expect(await filters.toggle('reverb' as AudioFilterPresetName)).toBe(true);
  expect(filters.enabled).toEqual(['underwater', 'true8d', 'reverb']);

  await player.destroy();
});
