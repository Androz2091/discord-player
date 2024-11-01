import { GuildQueueHistory } from '../queue';
import { useHooksContext } from './common';

/**
 * Fetch guild queue history
 * @param node guild queue node resolvable
 */
export function useHistory<Meta = unknown>(): GuildQueueHistory<Meta> | null {
    const { context, player } = useHooksContext('useHistory');

    const queue = player.queues.get<Meta>(context.guild.id);
    if (!queue) return null;

    return queue.history;
}
