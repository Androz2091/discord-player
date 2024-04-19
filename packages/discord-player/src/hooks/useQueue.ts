import { GuildQueue, NodeResolvable } from '../queue';
import { getQueue, useHooksContext } from './common';

/**
 * Fetch guild queue
 * @param node Guild queue node resolvable
 */
export function useQueue<Meta = unknown>(): GuildQueue<Meta> | null;
export function useQueue<Meta = unknown>(node: NodeResolvable): GuildQueue<Meta> | null;
export function useQueue<Meta = unknown>(node?: NodeResolvable): GuildQueue<Meta> | null {
    const _node = node ?? useHooksContext('useQueue').guild;
    const queue = getQueue<Meta>(_node);
    if (!queue) return null;

    return queue;
}
