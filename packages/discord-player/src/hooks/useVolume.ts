import { TypeUtil } from '../utils/TypeUtil';
import { NodeResolvable } from '../manager';
import { getQueue } from './common';

type SetterFN = (previous: number) => number;

/**
 * Fetch or manipulate player volume
 * @param node Guild queue node resolvable
 */
export function useVolume(node: NodeResolvable) {
    const queue = getQueue(node);
    const setter = (volume: number | SetterFN) => {
        if (queue) {
            if (TypeUtil.isFunction(volume)) return queue.node.setVolume(volume(queue.node.volume));
            return queue.node.setVolume(volume);
        }
    };

    const getter = () => {
        return queue?.node.volume as number;
    };

    return [getter, setter] as const;
}
