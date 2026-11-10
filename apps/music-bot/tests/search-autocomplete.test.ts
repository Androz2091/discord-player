import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SearchResult, Track } from 'discord-player';
import { player } from '../src/lib/discord-player.ts';
import { autocomplete, command } from '../src/app/commands/play.ts';
import { autocompleteInteraction, runAutocomplete } from './mocks/discord.ts';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'music-autocomplete-'));
  vi.stubEnv('MUSIC_DIRECTORY', directory);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

test('declares query autocomplete and suggests normalized local matches through the plugin host', async () => {
  expect(command.options).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'query', autocomplete: true })]),
  );

  await mkdir(join(directory, 'album'));
  await writeFile(join(directory, 'album', 'Café--Night_Drive.mp3'), 'audio');

  const search = vi.spyOn(player, 'search');
  const request = autocompleteInteraction('cafe night drive');

  await runAutocomplete(autocomplete, request);

  expect(request.options.getString).toHaveBeenCalledWith('query', false);
  expect(search).toHaveBeenCalledWith('cafe night drive', {
    requestedBy: 'requester',
    signal: expect.any(AbortSignal),
  });
  expect(request.respond).toHaveBeenCalledExactlyOnceWith([
    { name: 'album/Café--Night_Drive.mp3', value: 'album/Café--Night_Drive.mp3' },
  ]);

  const value = request.respond.mock.calls[0]![0][0]!.value;

  expect((await player.search(value)).tracks.map((track) => track.title)).toEqual(['Café--Night_Drive.mp3']);
});

test('returns initial suggestions for empty input and caps responses at 25 choices', async () => {
  await Promise.all(
    Array.from({ length: 30 }, (_, index) =>
      writeFile(join(directory, `song-${String(index).padStart(2, '0')}.mp3`), 'audio'),
    ),
  );

  const request = autocompleteInteraction();

  await runAutocomplete(autocomplete, request);

  const choices = request.respond.mock.calls[0]![0];

  expect(choices).toHaveLength(25);
  expect(choices[0]).toEqual({ name: 'song-00.mp3', value: 'song-00.mp3' });
  expect(choices[24]).toEqual({ name: 'song-24.mp3', value: 'song-24.mp3' });
});

test('returns no choices for missing libraries or unmatched filenames', async () => {
  const unmatched = autocompleteInteraction('unknown');

  await runAutocomplete(autocomplete, unmatched);

  expect(unmatched.respond).toHaveBeenCalledExactlyOnceWith([]);

  vi.stubEnv('MUSIC_DIRECTORY', join(directory, 'missing'));

  const missing = autocompleteInteraction();

  await runAutocomplete(autocomplete, missing);

  expect(missing.respond).toHaveBeenCalledExactlyOnceWith([]);
});

test('offers direct HTTP media URLs without requiring a local library', async () => {
  vi.stubEnv('MUSIC_DIRECTORY', undefined);

  const request = autocompleteInteraction('https://example.test/audio.mp3');

  await runAutocomplete(autocomplete, request);

  expect(request.respond).toHaveBeenCalledExactlyOnceWith([
    { name: 'audio.mp3', value: 'https://example.test/audio.mp3' },
  ]);
});

test('keeps choice values intact, omits oversized values, deduplicates and truncates labels safely', async () => {
  const url = 'https://example.test/short';

  vi.spyOn(player, 'search').mockResolvedValue(
    new SearchResult({
      playlist: null,
      tracks: [
        new Track({ title: 'Oversized', url: 'https://example.test/' + 'a'.repeat(100) }),
        new Track({ title: '🎵'.repeat(150), url }),
        new Track({ title: 'Duplicate', url }),
        new Track({ title: 'Missing value' }),
      ],
    }),
  );

  const request = autocompleteInteraction('query');

  await runAutocomplete(autocomplete, request);

  const choices = request.respond.mock.calls[0]![0];

  expect(choices).toHaveLength(1);
  expect(choices[0]!.value).toBe(url);
  expect(choices[0]!.name).toBe('🎵'.repeat(50));
  expect(choices[0]!.name).toHaveLength(100);
});

test('responds once with no choices when the source search fails', async () => {
  vi.spyOn(player, 'search').mockRejectedValue(new Error('source failed'));

  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const request = autocompleteInteraction('query');

  await runAutocomplete(autocomplete, request);

  expect(request.respond).toHaveBeenCalledExactlyOnceWith([]);
  expect(log).toHaveBeenCalledOnce();
});

test('propagates the autocomplete time budget into search and responds after cancellation', async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);

  vi.spyOn(player, 'search').mockImplementation(
    async (_query, options) =>
      new Promise((_resolve, reject) => {
        options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
      }),
  );

  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const request = autocompleteInteraction('query');
  const response = runAutocomplete(autocomplete, request);

  expect(timeout).toHaveBeenCalledWith(2000);

  controller.abort(new Error('deadline'));
  await response;

  expect(request.respond).toHaveBeenCalledExactlyOnceWith([]);
  expect(log).not.toHaveBeenCalled();
});
