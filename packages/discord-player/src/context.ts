import { AsyncLocalStorage } from 'node:async_hooks';
import type { Player, PlayerAdapterInterface } from './player';
import { unsafe } from './common/types';

const PlayerAdapterContext = new AsyncLocalStorage<Player<unsafe>>();

export function getPlayerAdapterContext<T>(): Player<T> {
    const ctx = PlayerAdapterContext.getStore();

    if (!ctx) throw new Error('No player adapter context found');

    return ctx;
}

export function setPlayerAdapterContext<T>(player: Player<T>, adapterInterface: PlayerAdapterInterface<T>) {
    return PlayerAdapterContext.run(player, adapterInterface);
}
