import { TypeUtil } from '../utils/TypeUtil';
import { NodeResolvable } from '../manager';
import { getQueue } from './common';

type SetterFN<T, P> = (previous: P) => T;

/**
 * Fetch or manipulate guild queue metadata
 * @param node Guild queue node resolvable
 */
export function useMetadata<T = unknown>(node: NodeResolvable) {
    const queue = getQueue<T>(node);
    const setter = (metadata: T | SetterFN<T, T>) => {
        if (queue) {
            if (TypeUtil.isFunction(metadata)) return queue.setMetadata(metadata(queue.metadata));
            return queue.setMetadata(metadata);
        }
    };

    const getter = () => {
        return queue?.metadata as T;
    };

    return [getter, setter] as const;
}
