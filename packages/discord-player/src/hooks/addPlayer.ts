import { Player } from '../Player';
import { instances } from './_container';

export function addPlayer(player: Player) {
    if (player.id in instances) return true;

    instances[player.id] = player;

    return player.id in instances;
}
