import type { Readable } from 'node:stream';
import { expect, it, vi } from 'vitest';
import * as host from '@discord-player/plugin-host';
import { BaseExtractor, Track, Playlist, SearchResult, DiscordPlayer } from '../src/index.js';
import { RemediaClient } from '@remedia/client';

import { LegacyFixture } from '../../plugin-host/tests/fixtures/legacy.js';
it('shares every runtime class across package paths and retains actual Player compatibility', async () => {
  expect(BaseExtractor).toBe(host.BaseExtractor);
  expect(Track).toBe(host.Track);
  expect(Playlist).toBe(host.Playlist);
  expect(SearchResult).toBe(host.SearchResult);
  const player = new DiscordPlayer({ nodes: [], send() {} });
  const debug = vi.fn();
  player.on('debug', debug);
  const extractor = await player.extractors.register(LegacyFixture);
  expect(extractor.context.player).toBe(player);
  const result = await player.search('fixture');
  expect(result.tracks[0]).toBeInstanceOf(host.Track);
  const source = await player.plugins.resolveStream(result.tracks[0]!);
  if (!('stream' in source)) throw new Error('Expected stream');
  let data = '';
  for await (const chunk of source.stream) data += chunk.toString();
  expect(data).toBe('encoded fixture');
  expect(debug).toHaveBeenCalledWith('Resolving source');
  expect(RemediaClient.create).not.toHaveBeenCalled();
  await player.destroy();
});

it('keeps remote state and affinity through queue and history while rejecting local execution', async () => {
  const source = host.createSourcePluginHost({ name: 'Remote', hostId: 'remote-a', publicUrl: 'https://host.test' });
  const player = new DiscordPlayer({ nodes: [], send() {} });
  try {
    await source.extractors.register(LegacyFixture);
    const response = await source.fetch(
      new Request('https://host.test/remedia/v1/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pluginId: host.SOURCE_PLUGIN_ID,
          operation: 'source.search',
          input: { query: 'fixture' },
        }),
      }),
    );
    const result = host.deserializeSourceResult((await response.json()).result);
    const track = result.tracks[0]!;
    const queue = await player.queues.create('remote-guild');
    queue.addTrack(track);
    expect(queue.tracks.peek()).toBe(track);
    queue.history.push(track);
    expect(queue.history.previousTrack?.sourceState).toBe(track.sourceState);
    expect(queue.history.previousTrack?.sourceReference?.hostId).toBe('remote-a');
    await expect(player.plugins.resolveStream(queue.tracks.peek()!)).rejects.toThrow(
      'execute this Track on its owning source host',
    );
    const media = await source.handle({
      pluginId: host.SOURCE_PLUGIN_ID,
      operation: 'source.stream',
      input: { track: host.serializeSourceTrack(queue.tracks.peek()!) },
    });
    expect(media.handled).toBe(true);
    if (media.handled) {
      const stream = (media.result as { stream: Readable }).stream;
      let bytes = '';
      for await (const chunk of stream) bytes += chunk.toString();
      expect(bytes).toBe('encoded fixture');
    }
  } finally {
    await source.close();
    await player.destroy();
  }
});
