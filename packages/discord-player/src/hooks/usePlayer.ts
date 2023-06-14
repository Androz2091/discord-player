import { NodeResolvable } from '../manager';
import { getQueue } from './common';

/**
 * Fetch guild queue player node
 * @param node Guild queue node resolvable
 */
export function usePlayer<Meta = unknown>(node: NodeResolvable) {
    const queue = getQueue<Meta>(node);
    if (!queue) return null;

    return queue.node;
}
