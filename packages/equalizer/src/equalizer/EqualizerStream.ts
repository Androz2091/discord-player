import { Transform, TransformCallback, TransformOptions } from 'stream';
import { Equalizer } from './Equalizer';

interface EqualizerStreamOptions extends TransformOptions {
    bandMultiplier?: EqualizerBand[];
    disabled?: boolean;
    channels?: number;
}

export interface EqualizerBand {
    band: number;
    gain: number;
}

export class EqualizerStream extends Transform {
    public disabled = false;
    public bandMultipliers: number[] = new Array(Equalizer.BAND_COUNT).fill(0);
    public equalizer: Equalizer;
    public constructor(options?: EqualizerStreamOptions) {
        super(options);

        options = Object.assign(
            {},
            {
                bandMultiplier: [],
                channels: 1,
                disabled: false
            },
            options || {}
        );

        if (options.disabled) this.disabled = !!options.disabled;
        this.equalizer = new Equalizer(options.channels || 1, this.bandMultipliers);
        if (Array.isArray(options.bandMultiplier)) this._processBands(options.bandMultiplier);
    }

    public _processBands(multiplier: EqualizerBand[]) {
        for (const mul of multiplier) {
            if (mul.band > Equalizer.BAND_COUNT - 1 || mul.band < 0) throw new RangeError(`Band value out of range. Expected >0 & <${Equalizer.BAND_COUNT - 1}, received "${mul.band}"`);
            this.equalizer.setGain(mul.band, mul.gain);
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

    public _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        if (this.disabled) {
            this.push(chunk);
            return callback();
        }

        this.equalizer.process([chunk]);
        this.push(chunk);

        return callback();
    }

    public getEQ() {
        return this.bandMultipliers.map((m, i) => ({
            band: i,
            gain: m
        })) as EqualizerBand[];
    }

    public setEQ(bands: EqualizerBand[]) {
        this._processBands(bands);
    }

    public resetEQ() {
        this._processBands(
            Array.from(
                {
                    length: Equalizer.BAND_COUNT
                },
                (_, i) => ({
                    band: i,
                    gain: 0
                })
            )
        );
    }
}
