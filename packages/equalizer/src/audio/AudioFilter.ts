import { TransformCallback } from 'stream';
import { PCMTransformer, PCMTransformerOptions } from '../utils';
import { BiquadFilter, BiquadFilterUpdateData, BiquadFilters, Coefficients, Q_BUTTERWORTH } from '../biquad';
import { AFBiquadConfig, AFPulsatorConfig, AFTremoloConfig, AFVibratoConfig, LR, applyPulsator, applyTremolo } from './transformers';
import { Equalizer, EqualizerBand } from '../equalizer';
import { resamplePCM } from './transformers/resampler';

export const AudioFilters = {
    '8D': '8D',
    Tremolo: 'Tremolo',
    Vibrato: 'Vibrato',
    Nightcore: 'Nightcore',
    Vaporwave: 'Vaporwave',
    BassBoost: 'BassBoost'
} as const;

export type PCMFilters = keyof typeof AudioFilters;

export interface PCMFiltererOptions extends PCMTransformerOptions {
    filters?: PCMFilters[];
    equalizer?: EqualizerBand[];
    biquad?: BiquadFilterUpdateData;
    volume?: number;
}

export const AF_NIGHTCORE_RATE = 1.3 as const;
export const AF_VAPORWAVE_RATE = 0.8 as const;

// based on lavadsp
export class AudioFilter extends PCMTransformer {
    public filters: PCMFilters[] = [];
    public equalizer = new Equalizer(2, []);
    private _volume = 100;
    public targetSampleRate = this.sampleRate;
    public totalSamples = 0;
    private _seekPos = 0;
    private _processedSamples = 0;
    public pulsatorConfig: AFPulsatorConfig = {
        hz: 0.02,
        x: 0,
        dI: 0.000003926990816987241
    };
    public tremoloConfig: AFTremoloConfig = {
        phase: 0,
        depth: 0.5,
        frequency: 5.0
    };
    public vibratoConfig: AFVibratoConfig = {
        phase: 0,
        depth: 0.5,
        frequency: 5.0
    };
    public biquadConfig: Omit<AFBiquadConfig, 'sample'> = {
        biquad: null as unknown as BiquadFilter,
        cutoff: 80,
        gain: 0,
        filter: null as unknown as BiquadFilters,
        coefficient: null as unknown as Coefficients,
        Q: Q_BUTTERWORTH
    };

    public constructor(options?: PCMFiltererOptions) {
        super(options);

        if (options) {
            if (typeof options.volume === 'number' && Number.isSafeInteger(options.volume)) {
                this.setVolume(options.volume);
            }
            if (Array.isArray(options.filters)) {
                this.setFilters(options.filters);
            }
            if (Array.isArray(options.equalizer)) {
                options.equalizer.forEach((eq) => {
                    this.equalizer.setGain(eq.band, eq.gain);
                });
            }
            Object.assign(this.biquadConfig, options.biquad);
            if (options.biquad?.filter) {
                const { Q, cutoff, gain } = this.biquadConfig;
                const coefficients = Coefficients.from(options.biquad.filter, this.targetSampleRate, cutoff, Q, gain);
                this.biquadConfig.biquad = new BiquadFilter(coefficients);
            }
        }

        this.onUpdate?.();
    }

    public setTargetSampleRate(rate: number) {
        this.targetSampleRate = rate || this.sampleRate;
        return;
    }

    public setBiquad(update: Partial<BiquadFilterUpdateData>) {
        if (typeof update.Q === 'number') this.biquadConfig.Q = update.Q;
        if (typeof update.cutoff === 'number') this.biquadConfig.cutoff = update.cutoff;
        if (typeof update.filter === 'number') this.biquadConfig.filter = update.filter;
        if (typeof update.gain === 'number') this.biquadConfig.gain = update.gain;

        if (this.biquadConfig.biquad && typeof this.biquadConfig.filter === 'number') {
            const { filter, Q, cutoff, gain } = this.biquadConfig;
            this.biquadConfig.coefficient = Coefficients.from(filter, this.targetSampleRate, cutoff, Q, gain);
            this.biquadConfig.biquad.update(this.biquadConfig.coefficient);
        }

        this.onUpdate?.();
    }

    public setPulsator(hz: number) {
        hz /= 4; // match ffmpeg
        this.pulsatorConfig.hz = hz;
        const samplesPerCycle = this.targetSampleRate / (hz * 2 * Math.PI);
        this.pulsatorConfig.dI = hz === 0 ? 0 : 1 / samplesPerCycle;

        this.onUpdate?.();
    }

    public get pulsator() {
        return this.pulsatorConfig.hz;
    }

    public setTremolo({ depth = this.tremoloConfig.depth, frequency = this.tremoloConfig.frequency, phase = this.tremoloConfig.phase }: Partial<AFTremoloConfig>) {
        if (typeof depth === 'number') this.tremoloConfig.depth = depth;
        if (typeof frequency === 'number') this.tremoloConfig.frequency = frequency;
        if (typeof phase === 'number') this.tremoloConfig.phase = phase;

        this.onUpdate?.();
    }

    public setVibrato({ depth = this.vibratoConfig.depth, frequency = this.vibratoConfig.frequency, phase = this.vibratoConfig.phase }: Partial<AFVibratoConfig>) {
        if (typeof depth === 'number') this.vibratoConfig.depth = depth;
        if (typeof frequency === 'number') this.vibratoConfig.frequency = frequency;
        if (typeof phase === 'number') this.vibratoConfig.phase = phase;

        this.onUpdate?.();
    }

    public get tremolo() {
        return this.tremoloConfig;
    }

    public get volume() {
        if (typeof this._volume !== 'number' || Number.isNaN(this._volume)) return 100;
        return this._volume * 100;
    }

    public setVolume(volume: number) {
        if (typeof volume !== 'number' || Number.isNaN(volume) || !Number.isFinite(volume)) return false;
        if (volume < 0) volume = 0;

        this._volume = volume / 100;

        this.onUpdate?.();

        return true;
    }

    public setFilters(filters: PCMFilters[]) {
        if (!Array.isArray(filters) || !filters.every((r) => r in AudioFilters)) {
            return false;
        }

        if (filters.some((f) => f === 'Vaporwave')) {
            this.pause();
            this.setTargetSampleRate(this.sampleRate * AF_VAPORWAVE_RATE);
        }

        if (filters.some((f) => f === 'Nightcore')) {
            this.pause();
            this.setTargetSampleRate(this.sampleRate * AF_NIGHTCORE_RATE);
        }

        if (!filters.includes('Vaporwave') && !filters.includes('Nightcore')) {
            this.pause();
            this.setTargetSampleRate(this.sampleRate);
        }

        this.filters = filters;

        if (this.isPaused()) this.resume();

        this.onUpdate?.();

        return true;
    }

    // TODO
    public seek(duration: number) {
        // determines the sample to seek to
        this._seekPos = (duration / 1000) * this.targetSampleRate;

        throw new Error('Not Implemented');

        // this method has not been implemented as of right now
        // Since we can only move forward in the stream,
        // we would have to buffer the entire stream in order to implement backwards seek
    }

    public _transform(_chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        const { samples, applied } = resamplePCM(_chunk, {
            bits: this.bits,
            readInt: (c, i) => this._readInt(c, i),
            writeInt: (c, d, i) => this._writeInt(c, d, i),
            volume: this.volume,
            sourceSampleRate: this.sampleRate,
            targetSampleRate: this.targetSampleRate
        });

        this._processedSamples++;
        this.totalSamples += samples.length / this.bits;

        if (this.disabled || !this.filters.length) {
            return callback(null, samples);
        }

        const len = Math.floor(samples.length / 2) * 2;
        const { bytes } = this;

        // left-right channel
        let L = false;

        for (let i = 0; i < len; i += bytes) {
            const int = this._readInt(samples, i);
            const value = this.applyFilters(int, +(L = !L) as LR);
            this._writeInt(samples, this.clamp(!applied ? value : value * this._volume), i);
        }

        this.push(samples);

        return callback();
    }

    public get estimatedDuration() {
        // this wont be accurate (for example, livestream), but can be used as a fallback
        return (this.totalSamples / this.targetSampleRate) * 1000;
    }

    public get currentDuration() {
        // this may not be accurate
        return (this._processedSamples * 1000) / this.targetSampleRate;
    }

    public applyFilters(byte: number, channel: LR) {
        if (!this.filters.length) return this.biquadConfig.biquad ? this.biquadConfig.biquad.run(byte) : byte;

        for (const filter of this.filters) {
            if (filter === '8D') {
                byte = applyPulsator(this.pulsatorConfig, byte, channel);
            }
            if (filter === 'Tremolo') {
                byte = applyTremolo(this.tremoloConfig, byte, this.targetSampleRate);
            }
        }

        return this.biquadConfig.biquad ? this.biquadConfig.biquad.run(byte) : byte;
    }

    public getEQ() {
        return this.equalizer.bandMultipliers.map((m, i) => ({
            band: i,
            gain: m
        })) as EqualizerBand[];
    }

    public setEQ(bands: EqualizerBand[]) {
        for (const band of bands) {
            if (band.band > Equalizer.BAND_COUNT - 1 || band.band < 0) throw new RangeError(`Band value out of range. Expected >0 & <${Equalizer.BAND_COUNT - 1}, received "${band.band}"`);
            this.equalizer.setGain(band.band, band.gain);
        }

        this.onUpdate?.();
    }

    public resetEQ() {
        this.setEQ(
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
