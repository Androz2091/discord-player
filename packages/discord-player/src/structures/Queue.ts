import { ArrayList } from './ArrayList';

export class Queue<T> extends ArrayList<T> {
    public add(...items: T[]): void {
        this.push(...items);
    }

    public next(): T | undefined {
        return this.shift();
    }

    public peek(): T | undefined {
        return this[0];
    }
}
