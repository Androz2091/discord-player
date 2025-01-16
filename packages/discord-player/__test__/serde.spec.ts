import { describe, expect, it } from 'vitest';
import { Client, IntentsBitField } from 'discord.js';
import {
  decode,
  deserialize,
  encode,
  Player,
  Playlist,
  serialize,
  SerializedType,
  Track,
} from '../src';

describe('serde', () => {
  const client = new Client({
    intents: [IntentsBitField.Flags.GuildVoiceStates],
  });

  const player = new Player(client);

  const dummyData = {
    track: new Track(player, {
      title: 'test',
      description: 'test',
      author: 'test',
      duration: '02:00',
      queryType: 'AUTO',
      url: 'https://example.com',
      views: 0,
      source: 'arbitrary',
      thumbnail: 'https://example.com',
    }),
    playlist: new Playlist(player, {
      title: 'test',
      description: 'test',
      author: {
        name: 'test',
        url: 'https://example.com',
      },
      id: 'test',
      source: 'arbitrary',
      thumbnail: 'https://example.com',
      tracks: Array.from(
        { length: 10 },
        () =>
          new Track(player, {
            title: 'test',
            description: 'test',
            author: 'test',
            duration: '02:00',
            queryType: 'AUTO',
            url: 'https://example.com',
            views: 0,
            source: 'arbitrary',
            thumbnail: 'https://example.com',
          }),
      ),
      type: 'album',
      url: 'https://example.com',
    }),
  };

  it('should serialize and deserialize track', async () => {
    const serialized = serialize(dummyData.track);

    expect(serialized.$type).toBe(SerializedType.Track);

    const track2 = deserialize(player, serialized);

    expect(track2).toBeInstanceOf(Track);
    expect(track2.title).toBe(serialized.title);
  });

  it('should encode and decode track', async () => {
    const serialized = serialize(dummyData.track);
    const encoded = encode(serialized);
    const decoded = decode(encoded);

    expect(encoded).toBeTypeOf('string');
    expect(decoded).toStrictEqual(serialized);
  });

  it('should serialize and deserialize playlist', async () => {
    const serialized = serialize(dummyData.playlist);

    expect(serialized.$type).toBe(SerializedType.Playlist);

    const list = deserialize(player, serialized);

    expect(list).toBeInstanceOf(Playlist);
    expect(list.title).toBe(serialized.title);
  });

  it('should encode and decode playlist', async () => {
    const serialized = serialize(dummyData.track);
    const encoded = encode(serialized);
    const decoded = decode(encoded);

    expect(encoded).toBeTypeOf('string');
    expect(decoded).toStrictEqual(serialized);
  });
});
