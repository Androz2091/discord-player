import { Player } from '../Player';
import { instances } from './_container';

export function clearPlayer(player: Player) {
    delete instances[player.id];

    return !(player.id in instances);
}
