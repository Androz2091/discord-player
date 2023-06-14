import { NodeResolvable } from '../manager';
import { getQueue } from './common';

/**
 * Fetch guild queue history
 * @param node guild queue node resolvable
 */
export function useHistory<Meta = unknown>(node: NodeResolvable) {
    const queue = getQueue<Meta>(node);
    if (!queue) return null;

    return queue.history;
}
