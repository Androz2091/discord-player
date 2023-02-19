export type QueueStrategy = 'LIFO' | 'FIFO';

export type QueueItemFilter<T, R = boolean> = (value: T, idx: number, array: T[]) => R;

export class Queue<T = unknown> {
    public store: T[];
    public constructor(public strategy: QueueStrategy = 'FIFO', initializer: T[] = []) {
        if (!['FIFO', 'LIFO'].includes(strategy)) throw new TypeError(`Invalid queue strategy "${strategy}"!`);
        this.store = Array.isArray(initializer) ? initializer : [];

        Object.defineProperty(this, 'store', {
            writable: true,
            configurable: true,
            enumerable: false
        });
    }

    public static from<T>(data: T[], strategy: QueueStrategy = 'FIFO') {
        return new Queue<T>(strategy, data);
    }

    public isFIFO() {
        return this.strategy === 'FIFO';
    }

    public isLIFO() {
        return this.strategy === 'LIFO';
    }

    public add(item: T | T[]) {
        if (this.strategy === 'FIFO') {
            if (Array.isArray(item)) {
                this.store.push(...item);
            } else {
                this.store.push(item);
            }
        } else {
            if (Array.isArray(item)) {
                this.store.unshift(...item);
            } else {
                this.store.unshift(item);
            }
        }
    }

    public clear() {
        this.store = [];
    }

    public shuffle() {
        for (let i = this.store.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.store[i], this.store[j]] = [this.store[j], this.store[i]];
        }
    }

    public remove(itemFilter: QueueItemFilter<T>) {
        const items = this.store.filter(itemFilter);
        if (items.length) this.store = this.store.filter((res) => !items.includes(res));
    }

    public removeOne(itemFilter: QueueItemFilter<T>) {
        const item = this.store.find(itemFilter);
        if (item) this.store = this.store.filter((res) => res !== item);
    }

    public find(itemFilter: QueueItemFilter<T>) {
        return this.store.find(itemFilter);
    }

    public filter(itemFilter: QueueItemFilter<T>) {
        return this.store.filter(itemFilter);
    }

    public some(itemFilter: QueueItemFilter<T>) {
        return this.store.some(itemFilter);
    }

    public every(itemFilter: QueueItemFilter<T>) {
        return this.store.every(itemFilter);
    }

    public map<R = T>(itemFilter: QueueItemFilter<T, R>) {
        const arr = this.toArray();
        return arr.map(itemFilter);
    }

    public at(idx: number) {
        const arr = this.toArray();
        return typeof Array.prototype.at === 'function' ? arr.at(idx) : arr[idx];
    }

    public dispatch() {
        const dispatchBeginning = this.strategy === 'FIFO';
        return dispatchBeginning ? this.store.shift() : this.store.pop();
    }

    public clone() {
        return new Queue(this.strategy, this.store.slice());
    }

    public get size() {
        return this.store.length;
    }

    public toString() {
        return `Queue<${this.store.length} items>`;
    }

    public toArray() {
        return this.strategy === 'FIFO' ? this.store.slice() : this.store.slice().reverse();
    }

    public toJSON() {
        return this.store;
    }
}
