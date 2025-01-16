import { GuildQueue, NodeResolvable } from '../queue';
import { useHooksContext } from './common';

/**
 * Fetch guild queue.
 * @param node Guild queue node resolvable. Defaults to inferred guild from context.
 */
export function useQueue<Meta = unknown>(): GuildQueue<Meta> | null;
export function useQueue<Meta = unknown>(
  node: NodeResolvable,
): GuildQueue<Meta> | null;
export function useQueue<Meta = unknown>(
  node?: NodeResolvable,
): GuildQueue<Meta> | null {
  const { context, player } = useHooksContext('useQueue');
  const queue = player.queues.resolve<Meta>(node ?? context.guild.id);
  if (!queue) return null;

  return queue;
}
