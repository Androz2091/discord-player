import { NodeResolvable } from '../queue';
import { TypeUtil } from '../utils/TypeUtil';
import { getQueue, useHooksContext } from './common';

export type SetterFN<T, P> = (previous: P) => T;
export type MetadataDispatch<T> = readonly [() => T, (metadata: T | SetterFN<T, T>) => void];

/**
 * Fetch or manipulate guild queue metadata
 * @param node Guild queue node resolvable
 */
export function useMetadata<T = unknown>(): MetadataDispatch<T>;
export function useMetadata<T = unknown>(node: NodeResolvable): MetadataDispatch<T>;
export function useMetadata<T = unknown>(node?: NodeResolvable): MetadataDispatch<T> {
    const _node = node ?? useHooksContext('useMetadata').guild.id;
    const queue = getQueue<T>(_node);
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
