import { GuildQueuePlayerNode, NodeResolvable } from '../manager';
import { getQueue, useHooksContext } from './common';

/**
 * Fetch guild queue player node
 * @param node Guild queue node resolvable
 */
export function usePlayer<Meta = unknown>(): GuildQueuePlayerNode<Meta> | null;
export function usePlayer<Meta = unknown>(node: NodeResolvable): GuildQueuePlayerNode<Meta> | null;
export function usePlayer<Meta = unknown>(node?: NodeResolvable): GuildQueuePlayerNode<Meta> | null {
    const _node = node ?? useHooksContext().guild;
    const queue = getQueue<Meta>(_node);
    if (!queue) return null;

    return queue.node;
}
