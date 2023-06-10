import { GuildQueue, NodeResolvable } from '../manager';
import { instances } from '../utils/__internal__';

export const getPlayer = () => {
    return instances.first() || null;
};

export const getQueue = <T = unknown>(node: NodeResolvable) => {
    const player = getPlayer();
    if (!player) return null;

    return (player.nodes.resolve(node) as GuildQueue<T>) || null;
};
