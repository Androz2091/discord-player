import { TransformCallback } from 'stream';
import { PCMTransformer, PCMTransformerOptions } from '../utils';
import { BiquadFilter } from './Biquad';
import { Coefficients, FilterType, Q_BUTTERWORTH } from './Coefficients';

export interface BiquadStreamOptions extends PCMTransformerOptions {
    disabled?: boolean;
    filter?: FilterType;
    Q?: number;
    sample?: number;
    cutoff?: number;
    gain?: number;
}

export interface BiquadFilterUpdateData {
    filter?: FilterType;
    Q?: number;
    sample?: number;
    cutoff?: number;
    gain?: number;
}

export class BiquadStream extends PCMTransformer {
    public disabled = false;
    public biquad!: BiquadFilter;
    public sample = 48000;
    public cutoff = 80;
    public gain = 0;
    public filter!: FilterType;
    public Q = Q_BUTTERWORTH;
    public constructor(options: BiquadStreamOptions = {}) {
        super(options);

        this.disabled = !!options.disabled;

        if ('sample' in options) this.sample = options.sample!;
        if ('cutoff' in options) this.cutoff = options.cutoff!;
        if ('gain' in options) this.gain = options.gain!;
        if ('Q' in options) this.Q = options.Q!;
        if ('filter' in options) {
            this.filter = options.filter!;
            this.biquad = new BiquadFilter(Coefficients.from(this.filter, this.sample, this.cutoff, this.Q, this.gain));
        }
    }

    public disable() {
        this.disabled = true;
    }

    public enable() {
        this.disabled = false;
    }

    public toggle() {
        this.disabled = !this.disabled;
    }

    public update(options: BiquadFilterUpdateData) {
        if ('sample' in options) this.sample = options.sample!;
        if ('cutoff' in options) this.cutoff = options.cutoff!;
        if ('gain' in options) this.gain = options.gain!;
        if ('Q' in options) this.Q = options.Q!;
        if ('filter' in options) this.filter = options.filter!;

        this.biquad = new BiquadFilter(Coefficients.from(this.filter, this.sample, this.cutoff, this.Q, this.gain));
    }

    public setFilter(filter: FilterType) {
        this.update({ filter });
    }

    public setQ(Q: number) {
        this.update({ Q });
    }

    public setSample(fs: number) {
        this.update({ sample: fs });
    }

    public setCutoff(f0: number) {
        this.update({ cutoff: f0 });
    }

    public setGain(dB: number) {
        this.update({ gain: dB });
    }

    public _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
        if (this.disabled || !this.biquad) {
            this.push(chunk);
            return callback();
        }

        const endIndex = Math.floor(chunk.length / 2) * 2;
        const { bytes, extremum } = this;

        for (let sampleIndex = 0; sampleIndex < endIndex; sampleIndex += bytes) {
            const int = this._readInt(chunk, sampleIndex);
            const result = this.biquad.run(int);
            const val = Math.min(extremum - 1, Math.max(-extremum, result * 4.0));
            this._writeInt(chunk, val, sampleIndex);
        }

        this.push(chunk);
        return callback();
    }
}
