import { Guild } from 'discord.js';
import { Player } from '../Player';
import { Exceptions } from '../errors';
import { createContext, useContext } from './context/async-context';
import { getGlobalRegistry } from '../utils/__internal__';

export interface HooksCtx {
    guild: Guild;
}

export const SUPER_CONTEXT = createContext<Player>();

const getFallbackContext = () => {
    return getGlobalRegistry().get('@[player]') as Player | undefined;
};

/**
 * @private
 */
export function useHooksContext(hookName: string, mainOnly = false) {
    let isFallback = false;

    let player: Player | undefined;

    if (!(player = SUPER_CONTEXT.consume())) {
        player = getFallbackContext();
        isFallback = true;
    }

    if (!player)
        throw Exceptions.ERR_ILLEGAL_HOOK_INVOCATION(
            'discord-player',
            'Player context is not available, is it being called inside <Player>.context.provide()?',
        );

    if (mainOnly) return { player, context: {} as HooksCtx, isFallback };

    const context = useContext(player.context);
    if (!context)
        throw Exceptions.ERR_ILLEGAL_HOOK_INVOCATION(
            hookName,
            `${hookName} must be called inside a player context created by <Player>.context.provide()`,
        );

    return { context, player, isFallback };
}
