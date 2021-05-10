import { Guild, Message, VoiceConnection } from 'discord.js';
import { Player } from '../Player';
import { PlayerOptions } from '../types/types';
import Track from './Track';
import { PlayerError } from '../utils/PlayerError';

export class Queue {
    player: Player;
    guild: Guild;
    firstMessage: Message;
    options: PlayerOptions = {};
    tracks: Track[] = [];
    voiceConnection: VoiceConnection = null;

    constructor(player: Player, guild: Guild) {
        Object.defineProperty(this, 'player', { value: player, enumerable: false });

        this.guild = guild;
    }

    get playing() {
        return this.tracks[0];
    }

    async play(message: Message, query: string | Track, firstResult?: boolean) {
        return await this.player.play(message, query, firstResult);
    }

    addTrack(track: Track) {
        if (!track || !(track instanceof Track)) throw new PlayerError('No track specified to add to the queue');
        this.tracks.push(track);
        return this;
    }

    addTracks(tracks: Track[]) {
        this.tracks.push(...tracks);

        return this;
    }
}

export default Queue;
