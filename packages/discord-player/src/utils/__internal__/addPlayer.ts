import { Player } from '../../Player';
import { instances } from './_container';

export function addPlayer(player: Player) {
    if (instances.has(player.id)) return true;

    instances.set(player.id, player);

    return instances.has(player.id);
}
