import { expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  Track,
  Playlist,
  DiscordPlayer,
  BaseExtractor,
  QueryType,
  Util,
  UnsupportedRemediaCapabilityError,
  DiscordPlayerErrorCode,
} from '../src/index.js';
import { SafeEventEmitter } from '../src/utils/safe-event-emitter.js';
import { DerivedEventEmitter } from '../src/utils/derived-event-emitter.js';

it('keeps Track metadata, requesters, durations and display helpers consistent', async () => {
  const track = new Track({ title: 'Title', author: 'Author', duration: '1:02:03', url: 'https://example.test/audio' });

  expect(track.durationMS).toBe(3723000);
  expect(track.description).toBe('Title by Author');
  expect(track.toString()).toBe('Title by Author');
  expect(track.toHyperlink()).toBe('[Title](https://example.test/audio)');
  expect(new Track({ duration: 'invalid' }).durationMS).toBe(0);
  expect(new Track({ duration: 'LIVE' }).durationMS).toBe(0);
  expect(new Track().toString()).toBe('');
  expect(new Track({ title: 'Only' }).toString()).toBe('Only');

  track.requester = { id: 'requester' };

  expect(track.requester).toEqual({ id: 'requester' });
  expect(track.requestedBy).toEqual({ id: 'requester' });
  expect(track.hasMetadata).toBe(false);

  track.metadata = { value: 1 };

  expect(track.hasMetadata).toBe(true);
  expect(await track.requestMetadata()).toEqual({ value: 1 });

  track.setMetadata(null);

  expect(track.metadata).toBeNull();
  expect(track.asMetadata<{ value: number }>()).toBe(track);

  track.extractor = null;

  expect(track.extractor).toBeNull();
  expect(track.toJSON(true).playlist).toBeNull();

  const playlist = new Playlist({ title: 'List', tracks: [track] });

  track.playlist = playlist;

  expect(track.toJSON().playlist?.title).toBe('List');

  const legacy = new Track(new DiscordPlayer({ nodes: [], send() {} }), {
    title: 'legacy',

    requestMetadata: async () => ({ value: 2 }),
  });

  expect(await legacy.requestMetadata()).toEqual({ value: 2 });
});

it('creates legacy and modern playlists with normalized entries and finite duration totals', () => {
  const p = new DiscordPlayer({ nodes: [], send() {} });
  const playlist = new Playlist(p, {
    title: 'List',
    tracks: [{ title: 'one', duration: '1:00' }, new Track({ title: 'two', duration: '2:00' })],
  });

  expect(playlist.estimatedDuration).toBe(180000);
  expect([...playlist].map((track) => track.title)).toEqual(['one', 'two']);
  expect(playlist.durationFormatted).toBe('3:00');
  expect(new Playlist({ tracks: [{ duration: '1:01:01' }] }).durationFormatted).toBe('1:01:01');
  expect(playlist.toJSON(false).tracks).toEqual([]);
  expect(Playlist.deserialize(playlist.toJSON()).tracks.every((track) => track.playlist)).toBe(true);
});

it('provides safe error events, derived emitter forwarding and stable capability error codes', () => {
  const safe = new SafeEventEmitter<{ error: [Error] }>();

  expect(() => safe.emit('error', new Error('safe'))).not.toThrow();

  const Derived = DerivedEventEmitter<EventEmitter>('target');
  const derived = new Derived();

  expect(derived.emit('event', 'value')).toBe(false);

  const target = new EventEmitter();

  Object.assign(derived, { target });

  const listener = vi.fn();

  target.on('event', listener);

  expect(derived.emit('event', 'value')).toBe(true);
  expect(listener).toHaveBeenCalledWith('value');

  const error = new UnsupportedRemediaCapabilityError('missingMethod');

  expect(error.code).toBe(DiscordPlayerErrorCode.UnsupportedRemediaCapability);
  expect(error.message).toContain('missingMethod');
});

it('retains base legacy behavior and anonymous query and duration helpers', async () => {
  const p = new DiscordPlayer({ nodes: [], send() {} });
  const instance = new BaseExtractor(p.extractors);

  expect(instance.identifier).toBe(BaseExtractor.identifier);
  expect(instance.supportsDemux).toBe(false);

  await instance.activate();
  await instance.deactivate();

  expect(await instance.validate('anything')).toBe(false);
  expect(await instance.handle('query', {})).toEqual({ playlist: null, tracks: [] });

  const track = new Track({ title: 'Title', author: 'Author' });

  expect(await instance.stream(track)).toBeUndefined();
  expect(await instance.getRelatedTracks(track)).toEqual({ playlist: null, tracks: [] });
  expect(await instance.bridge(track, null)).toBeNull();
  expect(instance.createBridgeQuery(track)).toBe('Title by Author');

  const debug = vi.fn();

  p.on('debug', debug);
  instance.debug('one');
  instance.emit('debug', 'two');

  expect(debug.mock.calls).toEqual([['one'], ['two']]);
  expect(QueryType.AUTO).toBe('auto');
  expect(QueryType.ANONYMOUS_SOURCE_QUERY).toBe('anonymousSourceQuery');
  expect(Reflect.get(QueryType, 'invalid')).toBeUndefined();
  expect(Reflect.get(QueryType, Symbol.iterator)).toBeUndefined();
  expect(Util.parseMS(90061002)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1, milliseconds: 2 });
  expect(Util.buildTimeCode(Util.parseMS(90061002))).toBe('25:01:01');
  expect(Util.noop('ignored')).toBeUndefined();
});
