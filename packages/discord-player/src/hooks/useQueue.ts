import { GuildQueue } from '../queue';
import { useHooksContext } from './common';

/**
 * Fetch guild queue
 * @param node Guild queue node resolvable
 */
export function useQueue<Meta = unknown>(): GuildQueue<Meta> | null {
    const { context, player } = useHooksContext('useQueue');
    const queue = player.queues.get<Meta>(context.guild.id);
    if (!queue) return null;

    return queue;
}
