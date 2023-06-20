import { NodeResolvable } from '../manager';
import { getQueue } from './common';

/**
 * Fetch guild queue
 * @param node Guild queue node resolvable
 */
export function useQueue<Meta = unknown>(node: NodeResolvable) {
    const queue = getQueue<Meta>(node);
    if (!queue) return null;

    return queue;
}
