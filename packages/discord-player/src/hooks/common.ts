import { GuildQueue, NodeResolvable } from '../Structures';
import { getPlayers } from '../utils/__internal__';

export const getPlayer = () => {
    return getPlayers()[0];
};

export const getQueue = <T = unknown>(node: NodeResolvable) => {
    const player = getPlayer();
    if (!player) return null;

    return (player.nodes.resolve(node) as GuildQueue<T>) || null;
};
