import { Guild } from 'discord.js';
import { Player } from '../Player';
import { IllegalHookInvocationError } from '../errors';
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
    throw new IllegalHookInvocationError(
      'discord-player',
      `Player context is not available, ${
        isFallback
          ? 'did you forget to initialize the player with `new Player(client)`?'
          : 'is it being called inside <Player>.context.provide()?'
      }`,
    );

  if (mainOnly) return { player, context: {} as HooksCtx, isFallback };

  let context: HooksCtx | undefined;

  if (!isFallback) {
    context = useContext(player.context);
    if (!context)
      throw new IllegalHookInvocationError(
        hookName,
        `${hookName} must be called inside a player context created by <Player>.context.provide()`,
      );
  } else {
    context = {
      get guild() {
        throw new IllegalHookInvocationError(
          hookName,
          `${hookName} must be called with an explicit guild argument when not inside a player context`,
        );
      },
    } as unknown as HooksCtx;
  }

  return { context, player, isFallback };
}
