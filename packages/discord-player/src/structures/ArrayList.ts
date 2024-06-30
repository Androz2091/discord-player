import { randomInt } from 'crypto';

export interface ArrayListLimitOptions {
    name?: string;
    maxSize: number;
    throwOnFull: boolean;
}

export class ArrayList<T> extends Array<T> {
    private _prev: T[] = [];

    public constructor(private readonly options: ArrayListLimitOptions) {
        super();

        if (options.maxSize < 0) {
            throw new Error('Expected "maxItems" to be greater than or equal to 0.');
        }
    }

    public push(...items: T[]) {
        super.push(...items);

        // Remove the first items if the length is greater than the max items
        if (this.options.maxSize > 0 && this.length > this.options.maxSize) {
            if (this.options.throwOnFull) {
                throw new Error(`Cannot add items to ${this.options.name} as it is full`);
            }

            this.splice(0, this.length - this.options.maxSize);
        }

        return this.length;
    }

    public random() {
        return this[randomInt(this.length)];
    }

    public flush() {
        this._prev = [];
    }

    public canUnshuffle() {
        return this._prev.length > 0;
    }

    public shuffle(inPlace = true) {
        const len = this.length;

        if (inPlace) {
            this._prev = this.slice();
        } else {
            this._prev = [];
        }

        const list = inPlace ? this : this.slice();

        for (let i = 0; i < len; i++) {
            const j = Math.floor(Math.random() * len);
            [list[i], list[j]] = [list[j], list[i]];
        }
    }

    public unshuffle() {
        if (!this._prev.length) return false;

        this.splice(0, this.length, ...this._prev);
        this._prev = [];

        return true;
    }

    public clear(): void {
        this.flush();
        this.length = 0;
    }
}
