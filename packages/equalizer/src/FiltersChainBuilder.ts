import { type Readable, pipeline } from 'stream';
import { EqualizerStream, EqualizerStreamOptions } from './equalizer';
import {
  AudioFilter,
  PCMFiltererOptions,
  PCMResampler,
  PCMResamplerOptions,
} from './audio';
import { BiquadStream, BiquadStreamOptions } from './biquad';
import {
  VolumeTransformer,
  VolumeTransformerOptions,
} from './audio/VolumeTransformer';

export interface DSPFiltersPreset {
  equalizer?: EqualizerStreamOptions;
  dsp?: PCMFiltererOptions;
  biquad?: BiquadStreamOptions;
  volume?: VolumeTransformerOptions;
  resampler?: PCMResamplerOptions;
}

export class FiltersChain {
  public equalizer: EqualizerStream | null = null;
  public filters: AudioFilter | null = null;
  public biquad: BiquadStream | null = null;
  public volume: VolumeTransformer | null = null;
  public resampler: PCMResampler | null = null;
  public destination: Readable | null = null;
  public source: Readable | null = null;
  public onUpdate: () => unknown = () => null;
  public onError: (err: Error) => unknown = () => null;

  public constructor(public presets: DSPFiltersPreset = {}) {}

  public create(src: Readable, presets: DSPFiltersPreset = this.presets) {
    this.destroy();

    this.source = src;

    // const resampler = new PCMResampler(presets.resampler);
    const equalizerStream = !presets.equalizer?.disabled
      ? new EqualizerStream(presets.equalizer)
      : null;
    const dspStream = !presets.dsp?.disabled
      ? new AudioFilter(presets.dsp)
      : null;
    const biquadStream = !presets.biquad?.disabled
      ? new BiquadStream(presets.biquad)
      : null;
    const volumeTransformer = !presets.volume?.disabled
      ? new VolumeTransformer(presets.volume)
      : null;

    // this.resampler = resampler;
    this.equalizer = equalizerStream;
    this.filters = dspStream;
    this.biquad = biquadStream;
    this.volume = volumeTransformer;

    // update listeners
    // resampler.onUpdate = this.onUpdate;
    if (equalizerStream) equalizerStream.onUpdate = this.onUpdate;
    if (dspStream) dspStream.onUpdate = this.onUpdate;
    if (biquadStream) biquadStream.onUpdate = this.onUpdate;
    if (volumeTransformer) volumeTransformer.onUpdate = this.onUpdate;

    const chains = [
      src,
      equalizerStream,
      dspStream,
      biquadStream,
      volumeTransformer,
    ].filter(Boolean) as Readonly<Readable[]>;

    if (!chains.length) return src;

    // @ts-ignore
    this.destination = pipeline(...chains, (err: Error | null) => {
      if (err) {
        this.destroy();
        if (!err.message.includes('ERR_STREAM_PREMATURE_CLOSE'))
          this.onError(err);
      }
    });

    this.destination!.once('close', this.destroy.bind(this));

    return this.destination as Readable;
  }

  public destroy() {
    // cleanup
    // this.resampler?.destroy();
    this.equalizer?.destroy();
    this.biquad?.destroy();
    this.filters?.destroy();
    this.volume?.destroy();
    this.destination?.destroy();
    this.source?.destroy();

    // remove events
    // this.resampler?.removeAllListeners();
    this.equalizer?.removeAllListeners();
    this.biquad?.removeAllListeners();
    this.filters?.removeAllListeners();
    this.volume?.removeAllListeners();
    this.destination?.removeAllListeners();
    this.source?.removeAllListeners();

    // unref
    // this.resampler = null;
    this.equalizer = null;
    this.biquad = null;
    this.filters = null;
    this.volume = null;
    this.destination = null;
    this.source = null;
  }
}
