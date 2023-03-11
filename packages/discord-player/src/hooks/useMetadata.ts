import { NodeResolvable } from '../Structures';
import { getQueue } from './common';

export function useMetadata<T = unknown>(node: NodeResolvable) {
    const queue = getQueue(node);
    const setter = (metadata: T | null) => {
        if (queue) {
            queue.setMetadata(metadata);
        }
    };

    const getter = () => {
        return queue?.metadata as T;
    };

    return [getter, setter] as const;
}
