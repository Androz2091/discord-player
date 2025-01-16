import { NodeResolvable } from '../queue';
import { TypeUtil } from '../utils/TypeUtil';
import { useHooksContext } from './common';

type SetterFN = (previous: number) => number;
type VolumeDispatch = readonly [
  () => number,
  (volume: number | SetterFN) => boolean | undefined,
];

/**
 * Fetch or manipulate player volume
 * @param node Guild queue node resolvable
 */
export function useVolume(): VolumeDispatch;
export function useVolume(node: NodeResolvable): VolumeDispatch;
export function useVolume(node?: NodeResolvable): VolumeDispatch {
  const { context, player } = useHooksContext('useVolume');
  const queue = player.queues.get(node ?? context.guild.id);
  const setter = (volume: number | SetterFN) => {
    if (queue) {
      if (TypeUtil.isFunction(volume))
        return queue.node.setVolume(volume(queue.node.volume));
      return queue.node.setVolume(volume);
    }
  };

  const getter = () => {
    return queue?.node.volume as number;
  };

  return [getter, setter] as const;
}
