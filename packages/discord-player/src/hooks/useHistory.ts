import { NodeResolvable } from '../Structures';
import { getQueue } from './common';

export function useHistory(node: NodeResolvable) {
    const queue = getQueue(node);
    if (!queue) return null;

    return queue.history;
}
