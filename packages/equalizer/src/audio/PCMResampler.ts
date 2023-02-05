import { TransformCallback } from 'stream';
import { PCMTransformer, PCMTransformerOptions } from '../utils';
import { resamplePCM } from './transformers/resampler';

export interface PCMResamplerOptions extends PCMTransformerOptions {
    targetSampleRate?: number;
}

export class PCMResampler extends PCMTransformer {
    public targetSampleRate = this.sampleRate;

    public constructor(options?: PCMResamplerOptions) {
        super(options);
        if (options?.targetSampleRate) this.targetSampleRate = options.targetSampleRate;
    }

    public get AF_NIGHTCORE() {
        return 64000;
    }

    public get AF_VAPORWAVE() {
        return 32000;
    }

    public setTargetSampleRate(rate: number | 'NIGHTCORE' | 'VAPORWAVE') {
        if (rate === 'NIGHTCORE' || rate === 'VAPORWAVE') rate = this[`AF_${rate}`];
        if (typeof rate !== 'number') return false;
        this.targetSampleRate = rate;
        this.onUpdate?.();
        return true;
    }

    // TODO: enable this
    _transform(chunk: Buffer, _: BufferEncoding, cb: TransformCallback): void {
        // act like pass-through if this transformer is disabled or source sample rate is equal to target sample rate
        if (this.disabled || this.sampleRate === this.targetSampleRate) {
            this.push(chunk);
            return cb();
        }

        // const samples = resamplePCM(chunk, {
        //     bits: this.bits,
        //     readInt: this._readInt.bind(this),
        //     writeInt: this._writeInt.bind(this),
        //     sourceSampleRate: this.sampleRate,
        //     targetSampleRate: this.targetSampleRate
        // });

        // this.push(samples);

        this.push(chunk);
        cb();
    }
}
