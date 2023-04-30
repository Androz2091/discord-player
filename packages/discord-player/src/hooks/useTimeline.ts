import { NodeResolvable } from '../Structures';
import { getQueue } from './common';

export interface TimelineDispatcherOptions {
    ignoreFilters: boolean;
}

export function useTimeline(node: NodeResolvable, options?: Partial<TimelineDispatcherOptions>) {
    const queue = getQueue(node);
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
