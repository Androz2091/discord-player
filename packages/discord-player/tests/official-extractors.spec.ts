import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  SoundCloudExtractor,
  SpotifyExtractor,
  AppleMusicExtractor,
  AttachmentExtractor,
  Internal,
} from '@discord-player/extractor';
import type * as PlayerAPI from '../src/index.js';
import type * as HostAPI from '@discord-player/plugin-host';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Use Node's published-package loading path throughout: mixing Vitest-transformed source
// and require() would itself create two copies of the same canonical implementation.
const { BaseExtractor, Track, Playlist, QueryType } = require('../dist/index.js') as typeof PlayerAPI;
const { createSourcePluginHost, SOURCE_PLUGIN_ID, deserializeSourceResult, serializeSourceTrack } =
  require('../../plugin-host/dist/index.js') as typeof HostAPI;
const hosts: ReturnType<typeof createSourcePluginHost>[] = [];

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((h) => h.close()));
});

function host() {
  const h = createSourcePluginHost({ name: 'Official', hostId: 'official', publicUrl: 'https://host.test' });

  hosts.push(h);

  return h;
}

async function remote(h: ReturnType<typeof host>, operation: string, input: unknown) {
  const response = await h.fetch(
    new Request('https://host.test/remedia/v1/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pluginId: SOURCE_PLUGIN_ID, operation, input }),
    }),
  );

  expect(response.status).toBe(200);

  return (await response.json()).result;
}

it('runs published 7.2 SoundCloud handle, validate, related, URL streaming and restart reconstruction against canonical models', async () => {
  expect(SoundCloudExtractor.prototype).toBeInstanceOf(BaseExtractor);

  const h = host();
  const sc = (await h.extractors.register(SoundCloudExtractor as unknown as typeof BaseExtractor)) as any;
  const info = {
    title: 'fixture',
    permalink_url: 'https://soundcloud.com/fixture/song',
    duration: 1000,
    artwork_url: '',
    playback_count: 1,
    user: { username: 'artist' },
  };

  vi.spyOn(sc.internal.tracks, 'getV2').mockResolvedValue(info);
  vi.spyOn(sc.internal.tracks, 'relatedV2').mockResolvedValue([info]);
  vi.spyOn(sc.internal.util, 'streamLink').mockResolvedValue('https://cdn.example.com/song.mp3');

  expect(await sc.validate(info.permalink_url, QueryType.SOUNDCLOUD_TRACK)).toBe(true);

  const result = await remote(h, 'source.resolve', {
    query: info.permalink_url,
    pluginId: sc.identifier,
    options: { searchEngine: QueryType.SOUNDCLOUD_TRACK },
  });
  const track = deserializeSourceResult(result).tracks[0]!;

  expect(track).toBeInstanceOf(Track);
  expect(track.sourceState).toBeDefined();
  expect(track.serialize()).not.toHaveProperty('sourceState');
  expect(
    await h.plugins.resolveStream(
      (
        await h.runtime.search(info.permalink_url, {
          pluginId: sc.identifier,
          searchEngine: QueryType.SOUNDCLOUD_TRACK,
        })
      ).tracks[0]!,
    ),
  ).toEqual({ url: 'https://cdn.example.com/song.mp3' });

  const related = await remote(h, 'source.related', { track: serializeSourceTrack(track) });

  expect(related.tracks).toHaveLength(1);

  // Persistence drops private engine state. Reconstruction must preserve the provider query type.
  const restarted = host();
  const next = (await restarted.extractors.register(SoundCloudExtractor as unknown as typeof BaseExtractor)) as any;

  vi.spyOn(next.internal.tracks, 'getV2').mockResolvedValue(info);
  vi.spyOn(next.internal.tracks, 'relatedV2').mockResolvedValue([info]);

  expect((await remote(restarted, 'source.related', { track: track.serialize() })).tracks).toHaveLength(1);
  expect(next.internal.tracks.getV2).toHaveBeenCalledWith(info.permalink_url);
});

it('runs published Spotify and Apple Music createStream and bridge paths without network activation', async () => {
  const h = host();
  // Stub only the provider SDK token call; extractor lifecycle and source methods are the published implementations.
  const probe = new (SpotifyExtractor as any)(h.extractors, {});

  vi.spyOn(Object.getPrototypeOf(probe.internal), 'isTokenExpired').mockReturnValue(false);

  const spotify = (await h.extractors.register(SpotifyExtractor as unknown as typeof BaseExtractor)) as any;

  vi.spyOn(spotify.internal, 'search').mockResolvedValue([
    { title: 'song', artist: 'artist', url: 'https://open.spotify.com/track/fixture', duration: 1000 },
  ]);

  const apple = (await h.extractors.register(AppleMusicExtractor as unknown as typeof BaseExtractor, {
    createStream: async () => Readable.from([Buffer.from('encoded')]),
  })) as any;

  vi.spyOn(Internal.AppleMusic, 'search').mockResolvedValue([
    { title: 'apple', artist: { name: 'artist' }, url: 'https://music.apple.com/song', duration: 1000, thumbnail: '' },
  ] as never);

  expect(
    (await h.runtime.search('apple', { pluginId: apple.identifier, searchEngine: QueryType.APPLE_MUSIC_SEARCH }))
      .tracks[0],
  ).toBeInstanceOf(Track);

  const sc = (await h.extractors.register(SoundCloudExtractor as unknown as typeof BaseExtractor)) as any;

  vi.spyOn(sc, 'bridge').mockResolvedValue('https://cdn.example.com/bridge.mp3');

  const tracks = (
    await h.runtime.search('song', { pluginId: spotify.identifier, searchEngine: QueryType.SPOTIFY_SEARCH })
  ).tracks;

  expect(tracks[0]).toBeInstanceOf(Track);
  expect(await h.plugins.resolveStream(tracks[0]!)).toEqual({ url: 'https://cdn.example.com/bridge.mp3' });

  const track = new Track(h.runtime, { url: 'https://music.apple.com/song' });

  track.extractor = apple;

  const source = await h.plugins.resolveStream(track);

  expect('stream' in source).toBe(true);

  if ('stream' in source) {
    for await (const chunk of source.stream) expect(chunk.toString()).toBe('encoded');
  }

  expect(new Playlist(h.runtime, { tracks }).tracks[0]).toBe(tracks[0]);

  await apple.reconfigure({ createStream: async () => 'https://cdn.example.com/apple.m4a' });

  expect(h.extractors.get(apple.identifier)).not.toBe(apple);
});

it('runs published Attachment direct URL and encoded Readable branches', async () => {
  const h = host();
  const attachment = (await h.extractors.register(AttachmentExtractor as unknown as typeof BaseExtractor)) as any;

  expect(await attachment.validate('https://example.com/audio', QueryType.ARBITRARY)).toBe(true);

  const track = new Track(h.runtime, { url: 'https://example.com/audio', engine: 'https://example.com/audio' });

  track.extractor = attachment;

  expect(await h.plugins.resolveStream(track)).toEqual({ url: track.url });
  expect((await attachment.getRelatedTracks(track)).tracks).toEqual([]);

  const dir = await mkdtemp(join(tmpdir(), 'attachment-'));

  try {
    const file = join(dir, 'tone.wav');
    const wav = Buffer.alloc(1644);

    wav.write('RIFF');
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(1600, 40);
    await writeFile(file, wav);

    const resolved = await h.runtime.search(file, { pluginId: attachment.identifier, searchEngine: QueryType.FILE });
    const local = resolved.tracks[0]!;

    expect(local.raw.engine).toBe(file);
    expect(local.raw.isFile).toBe(true);

    const source = await h.plugins.resolveStream(local);

    if (!('stream' in source)) throw new Error('Expected encoded Attachment stream');

    const chunks = [];

    for await (const chunk of source.stream) chunks.push(chunk);

    expect(Buffer.concat(chunks)).toEqual(wav);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
