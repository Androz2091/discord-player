import type { Player } from '../Player';
import { GuildQueue, NodeResolvable } from '../queue';
import { instances } from '../utils/__internal__';
import { Exceptions } from '../errors';
import { useContext } from './context/async-context';
import { Guild } from '../clientadapter/IClientAdapter';

const preferredInstanceKey = '__discord_player_hook_instance_cache__';

export const getPlayer = () => {
    return instances.get(preferredInstanceKey) || instances.first() || null;
};

export interface HooksCtx {
    guild: Guild;
}

/**
 * @private
 */
export function useHooksContext(hookName: string) {
    const player = getPlayer();
    if (!player) throw Exceptions.ERR_ILLEGAL_HOOK_INVOCATION('discord-player', 'Player instance must be created before using hooks');

    const context = useContext(player.context);

    if (!context) throw Exceptions.ERR_ILLEGAL_HOOK_INVOCATION(hookName, `${hookName} must be called inside a player context created by <Player>.context.provide()`);

    return context;
}

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
