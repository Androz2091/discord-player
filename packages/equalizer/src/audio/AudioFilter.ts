import { TransformCallback } from 'stream';
import { PCMTransformer, PCMTransformerOptions } from '../utils';

export const AudioFilters = {
    '8D': '8D',
    Tremolo: 'Tremolo'
} as const;

export type PCMFilters = keyof typeof AudioFilters;

export interface PCMFiltererOptions extends PCMTransformerOptions {
    filters?: PCMFilters[];
}

// based on lavadsp
export class AudioFilter extends PCMTransformer {
    public filters: PCMFilters[] = [];
    private _pulsatorConfig = {
        hz: 0.03,
        x: 0,
        dI: 0.000003926990816987241
    };
    private _tremoloConfig = {
        phase: 0,
        depth: 0.5,
        frequency: 2.0
    };

    public constructor(options?: PCMFiltererOptions) {
        super(options);

        if (options && Array.isArray(options.filters)) {
            this.setFilters(options.filters);
        }
    }

    public setPulsator(hz: number) {
        this._pulsatorConfig.hz = hz;
        const samplesPerCycle = this.sampleRate / (hz * 2 * Math.PI);
        this._pulsatorConfig.dI = hz === 0 ? 0 : 1 / samplesPerCycle;
    }

    public get pulsator() {
        return this._pulsatorConfig.hz;
    }

    public setTremolo({ depth = this._tremoloConfig.depth, frequency = this._tremoloConfig.frequency, phase = this._tremoloConfig.phase }: { phase?: number; depth?: number; frequency?: number }) {
        if (typeof depth === 'number') this._tremoloConfig.depth = depth;
        if (typeof frequency === 'number') this._tremoloConfig.frequency = frequency;
        if (typeof phase === 'number') this._tremoloConfig.phase = phase;
    }

    public get tremolo() {
        return this._tremoloConfig;
    }

    public setFilters(filters: PCMFilters[]) {
        if (!Array.isArray(filters) || !filters.every((r) => r in AudioFilters)) {
            throw new TypeError('Invalid or unknown filter');
        }

        this.filters = filters;

        this.onUpdate?.();
    }

    public _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        if (this.disabled || !this.filters.length) {
            return callback(null, chunk);
        }

        const len = Math.floor(chunk.length / 2) * 2;
        const { bytes } = this;
        let j = 0;

        for (let i = 0; i < len; i += bytes) {
            const int = this._readInt(chunk, i);
            const value = this.applyFilters(int, j++);
            this._writeInt(chunk, this.clamp(value), i);
        }

        this.push(chunk);

        return callback();
    }

    public applyFilters(byte: number, idx: number) {
        if (!this.filters.length) return byte;

        for (const filter of this.filters) {
            if (filter === '8D') byte = this.applyRotation(byte, idx);
            if (filter === 'Tremolo') byte = this.applyTremolo(byte);
        }

        return byte;
    }

    public applyRotation(int: number, idx: number) {
        const sin = Math.sin(this._pulsatorConfig.x);
        const res = (int * ((idx % 2 === 0 ? sin : -sin) + 1.0)) / 2.0;
        this._pulsatorConfig.x += this._pulsatorConfig.dI;
        return res;
    }

    public applyTremolo(int: number) {
        const fOffset = 1.0 - this._tremoloConfig.depth;
        const modSignal = fOffset + this._tremoloConfig.depth * Math.sin(this._tremoloConfig.phase);
        this._tremoloConfig.phase += ((2 * Math.PI) / this.sampleRate) * this._tremoloConfig.frequency;
        return modSignal * int;
    }
}
