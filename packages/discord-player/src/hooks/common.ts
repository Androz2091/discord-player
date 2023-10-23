import type { Player } from '../Player';
import { GuildQueue, NodeResolvable } from '../manager';
import { instances } from '../utils/__internal__';

const preferredInstanceKey = '__discord_player_hook_instance_cache__';

export const getPlayer = () => {
    return instances.get(preferredInstanceKey) || instances.first() || null;
};

/**
 * Bind a player instance to the hook system, defaults to the first instance.
 */
export const bindHook = (player: Player) => {
    instances.set(preferredInstanceKey, player);
};

export const getQueue = <T = unknown>(node: NodeResolvable) => {
    const player = getPlayer();
    if (!player) return null;

    return (player.nodes.resolve(node) as GuildQueue<T>) || null;
};

export interface HookDeclarationContext {
    getQueue: typeof getQueue;
    getPlayer: typeof getPlayer;
    instances: typeof instances;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type HookDeclaration<T extends (...args: any[]) => any> = (context: HookDeclarationContext) => T;

export function createHook<T extends HookDeclaration<(...args: any[]) => any>>(hook: T): ReturnType<T> {
    return hook({
        getQueue,
        getPlayer,
        instances
    }) as ReturnType<T>;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
