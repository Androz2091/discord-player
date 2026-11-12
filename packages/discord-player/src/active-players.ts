import type { DiscordPlayer } from './player.js';

const players = new Set<DiscordPlayer>();

/** Register a constructed Player in fallback order.
 * @internal
 * @param player Constructed Player.
 */
export function registerPlayer(player: DiscordPlayer): void {
  players.add(player);
}

/** Release fallback ownership when destruction begins.
 * @internal
 * @param player Player being destroyed.
 */
export function unregisterPlayer(player: DiscordPlayer): void {
  players.delete(player);
}

/** Read the earliest registered Player that has not begun destruction.
 * @internal
 * @returns The fallback Player, or undefined when none remains.
 */
export function firstActivePlayer(): DiscordPlayer | undefined {
  return players.values().next().value;
}
