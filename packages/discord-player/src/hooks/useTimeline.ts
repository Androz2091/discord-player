import { Track } from '../fabric';
import { NodeResolvable, PlayerTimestamp } from '../queue';
import { useHooksContext } from './common';

export interface TimelineDispatcherOptions {
  ignoreFilters: boolean;
  node: NodeResolvable;
}

export interface GuildQueueTimeline {
  readonly timestamp: PlayerTimestamp;
  readonly volume: number;
  readonly paused: boolean;
  readonly track: Track<unknown> | null;
  pause(): boolean;
  resume(): boolean;
  setVolume(vol: number): boolean;
  setPosition(time: number): Promise<boolean>;
}

/**
 * Fetch or manipulate current track
 * @param options Options for timeline dispatcher
 */
export function useTimeline(): GuildQueueTimeline | null;
export function useTimeline(
  options: Partial<TimelineDispatcherOptions>,
): GuildQueueTimeline | null;
export function useTimeline(
  options?: Partial<TimelineDispatcherOptions>,
): GuildQueueTimeline | null {
  const { context, player } = useHooksContext('useTimeline');
  const queue = player.queues.get(options?.node ?? context.guild.id);
  if (!queue) return null;

  const timeline = Object.preventExtensions({
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
    },
  } satisfies GuildQueueTimeline);

  return timeline;
}
