import type { IAdapter } from './adapter';
import { setPlayerAdapterContext } from './context';

export class Player<T> {
    public readonly adapter: IAdapter<T>;
    public constructor(adapter: PlayerAdapterInterface<T>) {
        this.adapter = setPlayerAdapterContext(this, adapter);
    }
}

export type PlayerAdapterInterface<T> = () => IAdapter<T>;

export function createPlayer<T>(adapter: PlayerAdapterInterface<IAdapter<T>>) {
    return new Player(adapter);
}
