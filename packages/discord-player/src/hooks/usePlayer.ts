import { GuildQueuePlayerNode, NodeResolvable } from '../queue';
import { useHooksContext } from './common';

/**
 * Fetch guild queue player node
 * @param node Guild queue node resolvable
 */
export function usePlayer<Meta = unknown>(): GuildQueuePlayerNode<Meta> | null;
export function usePlayer<Meta = unknown>(
  node: NodeResolvable,
): GuildQueuePlayerNode<Meta> | null;
export function usePlayer<Meta = unknown>(
  node?: NodeResolvable,
): GuildQueuePlayerNode<Meta> | null {
  const { context, player } = useHooksContext('usePlayer');
  const queue = player.queues.get<Meta>(node ?? context.guild.id);
  if (!queue) return null;

  return queue.node;
}
