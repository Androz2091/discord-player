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
