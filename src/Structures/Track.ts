import { Message } from 'discord.js';
import { Player } from '../Player';

export class Track {
    readonly player: Player;
    readonly message: Message;
    
    constructor(player: Player, data: any) {
        Object.defineProperty(this, 'player', { value: player, enumerable: false });
    }
}

export default Track;
