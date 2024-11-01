import { GuildQueuePlayerNode } from '../queue';
import { useHooksContext } from './common';

/**
 * Fetch guild queue player node
 * @param node Guild queue node resolvable
 */
export function usePlayer<Meta = unknown>(): GuildQueuePlayerNode<Meta> | null {
    const { context, player } = useHooksContext('usePlayer');
    const queue = player.queues.get<Meta>(context.guild.id);
    if (!queue) return null;

    return queue.node;
}
