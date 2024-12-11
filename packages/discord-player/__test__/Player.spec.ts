import { afterEach, describe, expect, it, test } from 'vitest';
import { Player, SearchResult } from '../src/index';
import { Client, IntentsBitField } from 'discord.js';

describe('Player', () => {
  afterEach(() => {
    // instance cleanup
    Player.clearAllPlayers();
  });

  const client = new Client({
    intents: [IntentsBitField.Flags.GuildVoiceStates],
  });

  it('should create player', () => {
    const player = new Player(client);

    expect(player).toBeInstanceOf(Player);
  });

  it('should create player singleton', () => {
    const player1 = new Player(client);
    const player2 = new Player(client);

    expect(player1.id).toBe(player2.id);
  });

  it('should not create player singleton', () => {
    const player1 = new Player(client, { ignoreInstance: true });
    const player2 = new Player(client, { ignoreInstance: true });

    expect(player1.id).not.toBe(player2.id);
  });

  it('should return search result', async () => {
    const player = new Player(client);
    const response = await player.search('search query');

    expect(response).toBeInstanceOf(SearchResult);
  });

  test('should set process.env.FFMPEG_PATH to given path', () => {
    // not actual ffmpeg path. just dummy
    new Player(client, {
      ffmpegPath: './packages/ffmpeg',
      ignoreInstance: true,
    });

    expect(process.env.FFMPEG_PATH).toBe('./packages/ffmpeg');
  });
});
