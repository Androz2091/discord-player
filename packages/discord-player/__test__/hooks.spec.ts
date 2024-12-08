import { expect, it, describe, afterEach } from 'vitest';
import { Player, useMainPlayer } from '../src/index';
import { Client, IntentsBitField } from 'discord.js';

describe('hooks', () => {
  const client = new Client({
    intents: [IntentsBitField.Flags.GuildVoiceStates],
  });

  afterEach(() => {
    Player.clearAllPlayers();
  });

  it('should throw an error when calling useMainPlayer() before creating a player instance', () => {
    expect(() => useMainPlayer()).toThrowError();
  });

  it('should resolve to player instance', () => {
    const player = new Player(client);

    expect(useMainPlayer()).toStrictEqual(player);
  });
});
