import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  decode,
  deserialize,
  DiscordPlayerErrorCode,
  encode,
  Playlist,
  SerializationError,
  serialize,
  SourceUnavailableError,
  Track,
  type Serializable,
  type SerializedEntityUnion,
  type SerializedTrack,
} from '../src/index.js';

function makeTrack(overrides: ConstructorParameters<typeof Track>[0] = {}): Track {
  return new Track({
    id: 'track-1',
    title: 'Example',
    author: 'Artist',
    description: 'Example by Artist',
    url: 'https://example.test/track',
    thumbnail: 'https://example.test/track.png',
    duration: '3:00',
    durationMS: 180_000,
    views: 42,
    requestedBy: 'user-1',
    source: 'example-source',
    metadata: { album: 'Record', flags: ['clean', 'explicit'] },
    ...overrides,
  });
}

describe('versioned serialization', () => {
  it('round-trips a Track through actual JSON and Base64 with stable public data', () => {
    const track = makeTrack({ requestedBy: { id: 'user-42', username: 'Listener' } });
    const serialized = track.serialize();

    expect(serialized).toEqual({
      type: 'track',
      version: 1,
      data: {
        id: 'track-1',
        title: 'Example',
        author: 'Artist',
        description: 'Example by Artist',
        url: 'https://example.test/track',
        thumbnail: 'https://example.test/track.png',
        durationMS: 180_000,
        views: 42,
        requestedBy: 'user-42',
        source: 'example-source',
        live: false,
        metadata: { album: 'Record', flags: ['clean', 'explicit'] },
      },
    });

    const jsonRoundTrip: unknown = JSON.parse(JSON.stringify(serialized));
    const restored = deserialize(decode(encode(serialized)));
    expect(restored).toBeInstanceOf(Track);
    if (!(restored instanceof Track)) throw new Error('Expected a Track instance.');
    expect(restored.id).toBe(track.id);
    expect(restored.durationMS).toBe(track.durationMS);
    expect(restored.requestedBy).toBe('user-42');
    expect(restored.metadata).toEqual(track.metadata);
    expect(deserialize(jsonRoundTrip)).toBeInstanceOf(Track);
    expect(encode(serialized)).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('round-trips Playlist ordering, Track instances, and parent relationships', () => {
    const first = makeTrack({ id: 'first', title: 'First' });
    const second = makeTrack({ id: 'second', title: 'Second' });
    const playlist = new Playlist({
      id: 'playlist-1',
      url: 'https://example.test/playlist',
      title: 'Set',
      description: 'A set',
      thumbnail: 'https://example.test/list.png',
      type: 'album',
      source: 'example-source',
      author: { name: 'Artist', url: 'https://example.test/artist' },
      tracks: [first, second],
    });

    const serialized = playlist.serialize();
    expect(serialized.data.tracks.map((track) => track.data.id)).toEqual(['first', 'second']);
    expect('playlist' in serialized.data.tracks[0]!.data).toBe(false);
    const restored = deserialize(JSON.parse(JSON.stringify(serialized)));

    expect(restored).toBeInstanceOf(Playlist);
    if (!(restored instanceof Playlist)) throw new Error('Expected a Playlist instance.');
    expect(restored.id).toBe('playlist-1');
    expect(restored.tracks.map((track) => track.id)).toEqual(['first', 'second']);
    expect(restored.tracks.every((track) => track instanceof Track)).toBe(true);
    expect(restored.tracks.every((track) => track.playlist === restored)).toBe(true);
  });

  it('keeps empty values, null requester and metadata, and separates toJSON from persistence', () => {
    const track = new Track({ id: 'empty', requestedBy: null, metadata: null });
    const serialized = track.serialize();

    expect(serialized.data).toMatchObject({
      id: 'empty',
      title: '',
      author: '',
      description: '',
      url: '',
      thumbnail: '',
      durationMS: 0,
      requestedBy: null,
      metadata: null,
    });
    expect(serialized.data).not.toHaveProperty('duration');
    expect(serialized.data).not.toHaveProperty('playlist');
    expect(track.toJSON()).toHaveProperty('duration', '');
    const restoredTrack = deserialize(serialized);
    expect(restoredTrack).toBeInstanceOf(Track);
    if (!(restoredTrack instanceof Track)) throw new Error('Expected a Track instance.');
    expect(restoredTrack.duration).toBe('');
    const liveTrack = deserialize(new Track({ duration: 'LIVE' }).serialize());
    expect(liveTrack).toBeInstanceOf(Track);
    if (!(liveTrack instanceof Track)) throw new Error('Expected a Track instance.');
    expect(liveTrack.live).toBe(true);
    expect(liveTrack.duration).toBe('LIVE');

    const emptyPlaylist = new Playlist();
    expect(emptyPlaylist.serialize().data.tracks).toEqual([]);
    expect(emptyPlaylist.toJSON().tracks).toEqual([]);
  });

  it('accepts structural Serializable implementations without concrete-class dispatch', () => {
    const payload = makeTrack().serialize();
    const structural: Serializable<SerializedTrack> = { serialize: () => payload };

    expect(serialize(structural)).toEqual(payload);
  });

  it('rejects unknown entity types, unsupported versions, and malformed required fields', () => {
    expect(() => deserialize({ type: 'episode', version: 1, data: {} })).toThrow(/Unknown serialized entity type/);
    expect(() => deserialize({ type: 'track', version: 2, data: {} })).toThrow(
      /Unsupported track serialization schema version/,
    );
    expect(() => deserialize({ type: 'track', version: 1, data: {} })).toThrow(/is required/);
    expect(() =>
      deserialize({
        type: 'playlist',
        version: 1,
        data: { type: 'playlist', id: 'p', author: { name: '', url: '' }, tracks: [] },
      }),
    ).toThrow(/\.url is required/);
    expect(() => deserialize({ version: 1, data: {} })).toThrow(/type is required/);
  });

  it('rejects metadata that JSON.stringify would silently lose or corrupt', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const invalidMetadata: unknown[] = [
      () => 'function',
      1n,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      { omitted: undefined },
      circular,
      new Date(0),
      Symbol('metadata'),
    ];

    for (const metadata of invalidMetadata) {
      expect(() => new Track({ metadata }).serialize()).toThrow(SerializationError);
    }
    expect(() => new Track({ requestedBy: { username: 'missing-id' } }).serialize()).toThrow(SerializationError);
    expect(() => new Track({ metadata: 1n }).serialize()).toThrowError(
      expect.objectContaining({ code: DiscordPlayerErrorCode.Serialization }),
    );
  });

  it('migrates v7 Track and nested Playlist payloads at the decoder boundary', async () => {
    const legacyTrack = {
      title: 'Legacy Track',
      description: 'Legacy description',
      author: 'Legacy Artist',
      url: 'https://example.test/legacy',
      thumbnail: 'https://example.test/legacy.png',
      duration: '02:30',
      views: 12,
      requested_by: { id: 'legacy-user', username: 'Old User' },
      source: 'legacy-source',
      live: false,
      query_type: 'AUTO',
      extractor: 'legacy-extractor',
      metadata: { externalId: 'source-track-5' },
      $type: 'track',
      $encoder_version: '7.0.0',
    };
    const legacyPlaylist = {
      id: 'legacy-playlist',
      url: 'https://example.test/legacy-playlist',
      title: 'Legacy Set',
      description: 'Legacy set description',
      thumbnail: null,
      type: 'playlist',
      source: 'legacy-source',
      author: { name: 'Legacy Artist', url: 'https://example.test/artist' },
      tracks: [legacyTrack, { ...legacyTrack, title: 'Second Legacy Track', url: 'https://example.test/second' }],
      $type: 'playlist',
      $encoder_version: '7.0.0',
    };

    const restoredTrack = deserialize(legacyTrack);
    const restoredPlaylist = deserialize(JSON.parse(JSON.stringify(legacyPlaylist)));
    expect(restoredTrack).toBeInstanceOf(Track);
    expect(restoredPlaylist).toBeInstanceOf(Playlist);
    if (!(restoredTrack instanceof Track) || !(restoredPlaylist instanceof Playlist)) {
      throw new Error('Expected legacy data to reconstruct framework models.');
    }
    expect(restoredTrack.id).toBeTruthy(); // v7 did not persist Track IDs.
    expect(restoredTrack.durationMS).toBe(150_000);
    expect(restoredTrack.requestedBy).toBe('legacy-user');
    expect(restoredTrack.source).toBe('legacy-source');
    expect(restoredPlaylist.tracks.map((track) => track.title)).toEqual(['Legacy Track', 'Second Legacy Track']);
    expect(restoredPlaylist.tracks[0]?.playlist).toBe(restoredPlaylist);
    expect(restoredPlaylist.serialize()).not.toHaveProperty('$encoder_version');
    expect(restoredPlaylist.serialize().data.tracks[0]!.data).not.toHaveProperty('extractor');
    await expect(restoredTrack.getStreamableSource()).rejects.toBeInstanceOf(SourceUnavailableError);
  });

  it('rejects unsupported legacy entity types and requester records without identity', () => {
    expect(() => deserialize({ $type: 'search-result' })).toThrow(/Unknown legacy serialized entity type/);
    expect(() =>
      deserialize({
        $type: 'track',
        title: 'No requester ID',
        description: '',
        author: '',
        url: '',
        duration: '0:10',
        views: 0,
        requested_by: { username: 'unknown' },
        source: 'legacy',
      }),
    ).toThrow(/string id/);
  });

  it('infers reconstructed model types from the serialized discriminator', () => {
    const track = makeTrack();
    const playlist = new Playlist({ tracks: [track] });
    const trackResult = deserialize(track.serialize());
    const playlistResult = deserialize(playlist.serialize());
    const eitherResult = deserialize(playlist.serialize() as SerializedEntityUnion);

    expectTypeOf(trackResult).toEqualTypeOf<Track>();
    expectTypeOf(playlistResult).toEqualTypeOf<Playlist>();
    expectTypeOf(eitherResult).toEqualTypeOf<Track | Playlist>();
  });

  it('keeps reconstructed metadata JSON-compatible', () => {
    const result = deserialize(makeTrack({ metadata: { values: [1, true, null, 'x'] } }).serialize());
    if (!(result instanceof Track)) throw new Error('Expected a Track instance.');
    expect(result.metadata).toEqual({ values: [1, true, null, 'x'] });
  });
});
