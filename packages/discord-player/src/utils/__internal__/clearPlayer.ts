import { Player } from '../../Player';
import { instances } from './_container';

export function clearPlayer(player: Player) {
    return instances.delete(player.id);
}
