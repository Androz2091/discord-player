import { afterEach, describe, expect, it } from 'vitest';
import { Player, SearchResult } from '..';
import { Client, IntentsBitField } from 'discord.js';

describe('Player', () => {
    afterEach(() => {
        // instance cleanup
        Player.clearAllPlayers();
    });

    const client = new Client({
        intents: [IntentsBitField.Flags.GuildVoiceStates]
    });

    it('should create player', () => {
        const player = new Player(client, { autoRegisterExtractor: false });

        expect(player).toBeInstanceOf(Player);
    });

    it('should create player singleton', () => {
        const player1 = new Player(client, { autoRegisterExtractor: false });
        const player2 = new Player(client, { autoRegisterExtractor: false });

        expect(player1.id).toBe(player2.id);
    });

    it('should not create player singleton', () => {
        const player1 = new Player(client, { ignoreInstance: true, autoRegisterExtractor: false });
        const player2 = new Player(client, { ignoreInstance: true, autoRegisterExtractor: false });

        expect(player1.id).not.toBe(player2.id);
    });

    it('should return search result', async () => {
        const player = new Player(client, { autoRegisterExtractor: false });
        const response = await player.search('search query');

        expect(response).toBeInstanceOf(SearchResult);
    });
});
