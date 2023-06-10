import { NodeResolvable } from '../manager';
import { getQueue } from './common';

export function useHistory<Meta = unknown>(node: NodeResolvable) {
    const queue = getQueue<Meta>(node);
    if (!queue) return null;

    return queue.history;
}
