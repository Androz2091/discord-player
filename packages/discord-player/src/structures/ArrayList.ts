import { randomInt } from 'crypto';

export class ArrayList<T> extends Array<T> {
    private _prev: T[] = [];

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
