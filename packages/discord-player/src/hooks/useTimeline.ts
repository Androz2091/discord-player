import { NodeResolvable } from '../manager';
import { getQueue, useHooksContext } from './common';

export interface TimelineDispatcherOptions {
    ignoreFilters: boolean;
}

/**
 * Fetch or manipulate current track
 * @param node Guild queue node resolvable
 * @param options Options for timeline dispatcher
 */
export function useTimeline(node?: NodeResolvable, options?: Partial<TimelineDispatcherOptions>) {
    const _node = node ?? useHooksContext('useTimeline').guild;
    const queue = getQueue(_node);
    if (!queue) return null;

    return Object.preventExtensions({
        get timestamp() {
            return queue.node.getTimestamp(options?.ignoreFilters)!;
        },
        get volume() {
            return queue.node.volume;
        },
        get paused() {
            return queue.node.isPaused();
        },
        get track() {
            return queue.currentTrack;
        },
        pause() {
            return queue.node.pause();
        },
        resume() {
            return queue.node.resume();
        },
        setVolume(vol: number) {
            return queue.node.setVolume(vol);
        },
        async setPosition(time: number) {
            return queue.node.seek(time);
        }
    });
}
