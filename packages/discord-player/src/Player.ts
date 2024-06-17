import type { Adapter } from './Adapter';

export class Player<T> {
    public constructor(public readonly adapter: Adapter<T>) {
        this.adapter = adapter;
        this.adapter.setPlayer(this);
    }
}

export function createPlayer<T>(adapter: Adapter<T>) {
    return new Player(adapter);
}
