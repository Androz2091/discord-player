import { ArrayList } from './ArrayList';

export class Stack<T> extends ArrayList<T> {
    public add(...items: T[]): void {
        this.unshift(...items);
    }

    public next(): T | undefined {
        return this.pop();
    }

    public peek(): T | undefined {
        return this[0];
    }
}
