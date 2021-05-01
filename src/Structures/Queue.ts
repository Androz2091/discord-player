import { Player } from '../Player';

export class Queue {
    public readonly player: Player;

    constructor(player: Player, data: any) {
        Object.defineProperty(this, 'player', { value: player, enumerable: false });
    }
}

export default Queue;
