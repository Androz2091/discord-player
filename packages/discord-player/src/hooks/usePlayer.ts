import { NodeResolvable } from '../manager';
import { getQueue } from './common';

export function usePlayer<Meta = unknown>(node: NodeResolvable) {
    const queue = getQueue<Meta>(node);
    if (!queue) return null;

    return queue.node;
}
