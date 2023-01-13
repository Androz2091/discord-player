import { Equalizer } from './Equalizer';

export type ReadIntCallback = (buffer: Buffer, index: number) => number;
export type WriteIntCallback = (buffer: Buffer, int: number, index: number) => number;

export class ChannelProcessor {
    public history: number[];
    public bandMultipliers: number[];
    public current: number;
    public m1: number;
    public m2: number;

    public constructor(bandMultipliers: number[]) {
        this.history = new Array(Equalizer.BAND_COUNT * 6).fill(0);
        this.bandMultipliers = bandMultipliers;
        this.current = 0;
        this.m1 = 2;
        this.m2 = 1;
    }

    public process(samples: Buffer, extremum = 131072, bytes = 2, readInt?: ReadIntCallback, writeInt?: WriteIntCallback) {
        const endIndex = Math.floor(samples.length / 2) * 2;
        for (let sampleIndex = 0; sampleIndex < endIndex; sampleIndex += bytes) {
            const sample = readInt?.(samples, sampleIndex) ?? samples.readInt16LE(sampleIndex);
            let result = sample * 0.25;

            for (let bandIndex = 0; bandIndex < Equalizer.BAND_COUNT; bandIndex++) {
                const x = bandIndex * 6;
                const y = x + 3;

                const coefficients = Equalizer.Coefficients48000[bandIndex];

                const bandResult = coefficients.alpha * (sample - this.history[x + this.m2]) + coefficients.gamma * this.history[y + this.m1] - coefficients.beta * this.history[y + this.m2];

                this.history[x + this.current] = sample;
                this.history[y + this.current] = bandResult;

                result += bandResult * this.bandMultipliers[bandIndex];
            }

            const val = Math.min(extremum - 1, Math.max(-extremum, result * 4.0));
            writeInt?.(samples, val, sampleIndex) ?? samples.writeInt16LE(val, sampleIndex);

            if (++this.current === 3) {
                this.current = 0;
            }

            if (++this.m1 === 3) {
                this.m1 = 0;
            }

            if (++this.m2 === 3) {
                this.m2 = 0;
            }
        }

        return samples;
    }

    public reset() {
        this.history.fill(0.0);
    }
}
