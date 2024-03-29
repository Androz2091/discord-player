import { GuildQueueHistory, NodeResolvable } from '../manager';
import { getQueue, useHooksContext } from './common';

/**
 * Fetch guild queue history
 * @param node guild queue node resolvable
 */
export function useHistory<Meta = unknown>(): GuildQueueHistory<Meta> | null;
export function useHistory<Meta = unknown>(node: NodeResolvable): GuildQueueHistory<Meta> | null;
export function useHistory<Meta = unknown>(node?: NodeResolvable): GuildQueueHistory<Meta> | null {
    const _node = node ?? useHooksContext().guild;

    const queue = getQueue<Meta>(_node);
    if (!queue) return null;

    return queue.history;
}
