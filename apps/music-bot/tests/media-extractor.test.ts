import type * as Filesystem from 'node:fs/promises';
import { deferred } from './mocks/async.ts';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, writeFile, rm, readdir, realpath, stat, symlink, unlink } from 'node:fs/promises';
import { expect, afterEach, beforeEach, test, vi } from 'vitest';
import { DiscordPlayer, Track, deserialize } from 'discord-player';
import { rawHTTPExtractor } from '../src/lib/raw-http-extractor.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof Filesystem>();

  return {
    ...actual,
    readdir: vi.fn(actual.readdir),
    realpath: vi.fn(actual.realpath),
    stat: vi.fn(actual.stat),
  };
});

const actualFS = await vi.importActual<typeof Filesystem>('node:fs/promises');
let directory: string;
let player: DiscordPlayer;

beforeEach(async () => {
  vi.mocked(readdir).mockReset().mockImplementation(actualFS.readdir);
  vi.mocked(realpath).mockReset().mockImplementation(actualFS.realpath);
  vi.mocked(stat).mockReset().mockImplementation(actualFS.stat);
  directory = await mkdtemp(join(tmpdir(), 'music-library-'));
  vi.stubEnv('MUSIC_DIRECTORY', directory);
  player = new DiscordPlayer({ nodes: [], send() {}, plugins: [rawHTTPExtractor()] });
});

afterEach(async () => {
  await player.destroy();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

test('searches nested relative filenames without case sensitivity and streams normal Tracks', async () => {
  await mkdir(join(directory, 'album'));
  await writeFile(join(directory, 'album', 'Evening Song.flac'), 'audio');
  await writeFile(join(directory, 'Morning SONG.mp3'), 'audio');
  await writeFile(join(directory, 'other.ogg'), 'audio');
  await mkdir(join(directory, 'song-directory'));

  const result = await player.search('sOnG', { requestedBy: 'listener' });

  expect(result.tracks.map((track) => track.title)).toEqual(['Evening Song.flac', 'Morning SONG.mp3']);

  for (const track of result.tracks) {
    expect(track.constructor).toBe(Track);
    expect(track.requestedBy).toBe('listener');

    const source = await player.plugins.resolveStream(track);

    if (!('file' in source)) throw new Error('Expected a local file source');

    const data = track.sourceReference?.data;

    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.file !== 'string')
      throw new Error('Expected a file reference');

    const location = data.file;

    expect(source).toEqual({ file: await actualFS.realpath(join(directory, location)) });
    expect(
      relative(await actualFS.realpath(directory), source.file)
        .split(sep)
        .join('/'),
    ).toBe(location);
  }

  expect((await player.search('album/Evening')).tracks.length).toBe(1);
  expect((await player.search('does-not-match')).isEmpty()).toBe(true);
  expect((await player.search('')).tracks.length).toBe(3);
});

test('returns empty results for unconfigured, missing, non-directory and unreadable roots', async () => {
  const file = join(directory, 'not-a-directory');

  await writeFile(file, 'file');

  for (const root of [undefined, '', '   ', join(directory, 'missing'), file, 'invalid\0directory']) {
    vi.stubEnv('MUSIC_DIRECTORY', root);

    expect((await player.search('song')).isEmpty()).toBe(true);
  }

  vi.stubEnv('MUSIC_DIRECTORY', directory);
  vi.mocked(readdir).mockRejectedValueOnce(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));

  expect((await player.search('song')).isEmpty()).toBe(true);
});

test('retains raw HTTP extraction when the local directory is missing or invalid', async () => {
  vi.stubEnv('MUSIC_DIRECTORY', join(directory, 'missing'));

  const result = await player.search('https://example.test/audio.mp3', { requestedBy: 'listener' });

  expect(result.tracks[0]!.constructor).toBe(Track);
  expect(result.tracks[0]!.requestedBy).toBe('listener');
  expect(await player.plugins.resolveStream(result.tracks[0]!)).toEqual({ url: 'https://example.test/audio.mp3' });
  expect(readdir).toHaveBeenCalledTimes(0);
});

test('uses portable file references after serialization and a library location change', async () => {
  await writeFile(join(directory, 'song.mp3'), 'original');

  const original = (await player.search('song')).tracks[0]!;
  const restored = deserialize(JSON.parse(JSON.stringify(original.serialize())));

  if (!(restored instanceof Track)) throw new Error('Expected a restored Track');

  const moved = join(directory, 'moved');

  await mkdir(moved);
  await writeFile(join(moved, 'song.mp3'), 'replacement');
  vi.stubEnv('MUSIC_DIRECTORY', moved);

  expect(await player.plugins.resolveStream(restored)).toEqual({
    file: await actualFS.realpath(join(moved, 'song.mp3')),
  });
});

test('revalidates deleted files and configured roots before streaming', async () => {
  await writeFile(join(directory, 'song.mp3'), 'audio');

  const track = (await player.search('song')).tracks[0]!;

  await unlink(join(directory, 'song.mp3'));
  await expect(player.plugins.resolveStream(track)).rejects.toThrow(/local music file is unavailable/);

  vi.stubEnv('MUSIC_DIRECTORY', undefined);
  await expect(player.plugins.resolveStream(track)).rejects.toThrow(/local music file is unavailable/);
});

test('skips symlinks during search and rejects escaped, absolute or non-file references', async () => {
  await mkdir(join(directory, 'library'));

  const library = join(directory, 'library');
  const outside = join(directory, 'outside.mp3');

  await writeFile(outside, 'outside');
  await writeFile(join(library, 'inside.mp3'), 'inside');
  await mkdir(join(library, 'folder'));
  await symlink(outside, join(library, 'linked.mp3'));
  vi.stubEnv('MUSIC_DIRECTORY', library);

  expect((await player.search('')).tracks.map((track) => track.title)).toEqual(['inside.mp3']);

  for (const file of ['../outside.mp3', outside, 'folder', '']) {
    const track = new Track({ sourceReference: { pluginId: 'org.example.raw-http', data: { file } } });

    await expect(player.plugins.resolveStream(track)).rejects.toThrow(/local music file is unavailable/);
  }

  const track = (await player.search('inside')).tracks[0]!;

  await unlink(join(library, 'inside.mp3'));
  await symlink(outside, join(library, 'inside.mp3'));
  await expect(player.plugins.resolveStream(track)).rejects.toThrow(/local music file is unavailable/);
});

test('propagates cancellation promptly while directory enumeration remains pending', async () => {
  const started = deferred<void>();
  const pending = deferred<Awaited<ReturnType<typeof readdir>>>();

  vi.mocked(readdir).mockImplementationOnce(() => {
    started.resolve();

    return pending.promise;
  });

  const controller = new AbortController();
  const reason = new Error('search cancelled');
  const searching = player.search('song', { signal: controller.signal });
  const rejected = expect(searching).rejects.toBe(reason);

  await started.promise;
  controller.abort(reason);
  await rejected;

  // A late filesystem failure remains observed after the caller has stopped waiting.
  pending.reject(new Error('late filesystem error'));
});

test('propagates cancellation while resolving a local stream path', async () => {
  await writeFile(join(directory, 'song.mp3'), 'audio');

  const track = (await player.search('song')).tracks[0]!;
  const started = deferred<void>();
  const pending = deferred<string>();

  vi.mocked(realpath).mockImplementationOnce(() => {
    started.resolve();

    return pending.promise;
  });

  const controller = new AbortController();
  const reason = new Error('stream cancelled');
  const streaming = player.plugins.resolveStream(track, { signal: controller.signal });
  const rejected = expect(streaming).rejects.toBe(reason);

  await started.promise;
  controller.abort(reason);
  await rejected;
  pending.resolve(directory);
});

test('removing the source plugin aborts pending filesystem work and drains its handlers', async () => {
  const started = deferred<void>();
  const pending = deferred<Awaited<ReturnType<typeof readdir>>>();

  vi.mocked(readdir).mockImplementationOnce(() => {
    started.resolve();

    return pending.promise;
  });

  const searching = player.search('song');
  const rejected = expect(searching).rejects.toMatchObject({ name: 'AbortError' });

  await started.promise;

  expect(await player.plugins.unregister('org.example.raw-http')).toBe(true);

  await rejected;
  pending.resolve([]);
});

test('normalizes punctuation, symbols, spacing and accents while retaining original file metadata', async () => {
  const name = 'Artist: Café___Night—Drive! (Live) 🎵.mp3';

  await writeFile(join(directory, name), 'audio');

  for (const query of ['cafe night drive', 'CAFÉ-NIGHT_drive', 'artist cafe', 'nightdrive live']) {
    const result = await player.search(query);

    expect(result.tracks.map((track) => track.title)).toEqual([name]);
    expect(await player.plugins.resolveStream(result.tracks[0]!)).toEqual({
      file: await actualFS.realpath(join(directory, name)),
    });
  }

  expect((await player.search(name)).tracks).toHaveLength(1);
});

test('resolves an exact autocomplete path independently of normalized filename collisions', async () => {
  await writeFile(join(directory, 'Song--Name.mp3'), 'one');
  await writeFile(join(directory, 'Song__Name.mp3'), 'two');

  expect((await player.search('song name')).tracks).toHaveLength(2);

  const selected = await player.search('Song__Name.mp3');

  expect(selected.tracks.map((track) => track.title)).toEqual(['Song__Name.mp3']);
});
