import { Guild } from 'discord.js';
import { Player } from '../Player';
import { Exceptions } from '../errors';
import { createContext, useContext } from './context/async-context';

export interface HooksCtx {
    guild: Guild;
}

export const SUPER_CONTEXT = createContext<Player>();

/**
 * @private
 */
export function useHooksContext(hookName: string, mainOnly = false) {
    const player = SUPER_CONTEXT.consume();
    if (!player) throw Exceptions.ERR_ILLEGAL_HOOK_INVOCATION('discord-player', 'Player context is not available, is it being called inside <Player>.context.provide()?');

    if (mainOnly) return { player, context: {} as HooksCtx };

    const context = useContext(player.context);
    if (!context) throw Exceptions.ERR_ILLEGAL_HOOK_INVOCATION(hookName, `${hookName} must be called inside a player context created by <Player>.context.provide()`);

    return { context, player };
}
