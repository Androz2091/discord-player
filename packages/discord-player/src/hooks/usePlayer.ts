import { NodeResolvable } from '../Structures';
import { getQueue } from './common';

export function usePlayer(node: NodeResolvable) {
    const queue = getQueue(node);
    if (!queue) return null;

    return queue.node;
}
