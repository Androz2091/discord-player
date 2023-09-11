import { GuildQueue, NodeResolvable } from '../manager';
import { instances } from '../utils/__internal__';

export const getPlayer = () => {
    return instances.first() || null;
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
