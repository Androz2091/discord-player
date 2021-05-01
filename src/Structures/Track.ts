import { Player } from '../Player';

export class Track {
    public readonly player: Player;

    constructor(player: Player, data: any) {
        Object.defineProperty(this, 'player', { value: player, enumerable: false });
    }
}

export default Track;
