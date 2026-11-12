import { expect, it } from 'vitest';
import { Track, Playlist, serialize, deserialize, encode, decode, SerializationError } from '../src/index.js';
import { cloneJSONValue } from '../src/utils/serialization.js';

it('rejects data properties that cannot survive JSON without silently losing information', () => {
  const symbolKey = { [Symbol('hidden')]: 1 };
  const hidden = Object.defineProperty({}, 'hidden', { value: 1, enumerable: false });
  const getterArray = Object.defineProperty([1], 0, {
    get() {
      throw new Error('getter executed');
    },

    enumerable: true,
  });
  const sparse = Array(2);
  const extra = Object.assign([1], { extra: 2 });

  for (const value of [symbolKey, hidden, getterArray, sparse, extra, new Map(), undefined, Infinity]) {
    expect(() => cloneJSONValue(value)).toThrow(SerializationError);
  }

  const nullPrototype = Object.assign(Object.create(null), { value: 1 });

  expect(cloneJSONValue(nullPrototype)).toEqual({ value: 1 });

  const shared = { value: 1 };

  expect(cloneJSONValue({ one: shared, two: shared })).toEqual({ one: { value: 1 }, two: { value: 1 } });

  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('broken reflection');
      },
    },
  );

  expect(() => cloneJSONValue(proxy)).toThrow(SerializationError);
});

it('wraps arbitrary encoder and structural serializer failures in stable serialization errors', () => {
  expect(() => decode('not-json')).toThrow(SerializationError);
  expect(() => encode({ ...new Track().serialize(), data: undefined } as never)).toThrow(SerializationError);
  expect(() =>
    serialize({
      serialize() {
        throw new Error('custom failed');
      },
    }),
  ).toThrow(SerializationError);
  expect(() =>
    serialize({
      serialize() {
        throw new SerializationError('already wrapped');
      },
    }),
  ).toThrow('already wrapped');

  const metadata = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('reflection failed');
      },
    },
  );

  expect(() =>
    encode({ ...new Track().serialize(), data: { ...new Track().serialize().data, metadata } } as never),
  ).toThrow(SerializationError);
});

it('validates nested entities, supported versions and strict metadata fields', () => {
  const track = new Track().serialize();
  const playlist = new Playlist({ tracks: [new Track()] }).serialize();
  const invalid: unknown[] = [
    null,
    [],
    { ...track, version: 2 },
    { ...playlist, version: 2 },
    { ...playlist, data: { ...playlist.data, tracks: [playlist] } },
    { ...playlist, data: { ...playlist.data, author: { name: 'only' } } },
    { ...track, data: { ...track.data, live: 'false' } },
    { ...track, data: { ...track.data, metadata: { missing: undefined } } },
  ];

  for (const value of invalid) expect(() => deserialize(value)).toThrow(SerializationError);
});

it('migrates supported legacy variants and rejects incomplete or non-finite durations', () => {
  const base = {
    $type: 'track',
    title: 'Legacy',
    author: 'Artist',
    description: '',
    url: '',
    views: 0,
    extractor: 'org.example.legacy',
    requestedBy: 'user',
  };

  expect((deserialize({ ...base, id: 'kept', durationMS: 1250 }) as Track).durationMS).toBe(1250);
  expect((deserialize({ ...base, duration: 'LIVE' }) as Track).live).toBe(true);
  expect((deserialize({ ...base, duration: '' }) as Track).durationMS).toBe(0);
  expect((deserialize({ ...base, duration: '1:02.5' }) as Track).durationMS).toBe(62500);

  for (const change of [
    { duration: '1:2:3:4' },
    { duration: 'invalid' },
    { duration: '9'.repeat(400) },
    {},
    { durationMS: -1 },
    { duration: '1', extractor: undefined },
  ]) {
    expect(() => deserialize({ ...base, ...change })).toThrow(SerializationError);
  }

  const legacyPlaylist = {
    $type: 'playlist',
    id: 'p',
    title: 'List',
    description: '',
    url: '',
    type: 'playlist',
    source: 'raw',
    author: { name: 'Artist', url: '' },
    tracks: [new Track().serialize()],
  };

  expect((deserialize(legacyPlaylist) as Playlist).tracks).toHaveLength(1);
});
