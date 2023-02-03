import { Readable, pipeline } from 'stream';
import { EqualizerStream, EqualizerStreamOptions } from './equalizer';
import { AudioFilter, PCMFiltererOptions } from './audio';
import { BiquadStream, BiquadStreamOptions } from './biquad';
import { VolumeTransformer, VolumeTransformerOptions } from './audio/VolumeTransformer';

export interface DSPFiltersPreset {
    equalizer?: EqualizerStreamOptions;
    dsp?: PCMFiltererOptions;
    biquad?: BiquadStreamOptions;
    volume?: VolumeTransformerOptions;
}

export class FiltersChain {
    public equalizer: EqualizerStream | null = null;
    public filters: AudioFilter | null = null;
    public biquad: BiquadStream | null = null;
    public volume: VolumeTransformer | null = null;
    public destination: Readable | null = null;
    public source: Readable | null = null;
    public onUpdate: () => unknown = () => null;
    public onError: (err: Error) => unknown = () => null;

    public constructor(public presets: DSPFiltersPreset = {}) {}

    public create(src: Readable, presets: DSPFiltersPreset = this.presets) {
        this.destroy();

        this.source = src;

        const equalizerStream = new EqualizerStream(presets.equalizer);
        const dspStream = new AudioFilter(presets.dsp);
        const biquadStream = new BiquadStream(presets.biquad);
        const volumeTransformer = new VolumeTransformer(presets.volume);

        this.equalizer = equalizerStream;
        this.filters = dspStream;
        this.biquad = biquadStream;
        this.volume = volumeTransformer;

        // update listeners
        equalizerStream.onUpdate = this.onUpdate;
        dspStream.onUpdate = this.onUpdate;
        biquadStream.onUpdate = this.onUpdate;
        volumeTransformer.onUpdate = this.onUpdate;

        this.destination = pipeline(src, equalizerStream, dspStream, biquadStream, volumeTransformer, (err) => {
            if (err) {
                this.destroy();
                this.onError(err);
            }
        });

        return this.destination;
    }

    public destroy() {
        // cleanup
        this.equalizer?.destroy();
        this.biquad?.destroy();
        this.filters?.destroy();
        this.volume?.destroy();
        this.destination?.destroy();
        this.source?.destroy();

        // unref
        this.equalizer = null;
        this.biquad = null;
        this.filters = null;
        this.volume = null;
        this.destination = null;
        this.source = null;
    }
}
