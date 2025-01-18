import { type Readable, pipeline } from 'stream';
import { EqualizerStream, EqualizerStreamOptions } from './equalizer';
import {
  AudioFilter,
  CompressorOptions,
  CompressorTransformer,
  PCMFiltererOptions,
  PCMResampler,
  PCMResamplerOptions,
  PCMSeekerOptions,
  PCMSeekerTransformer,
  ReverbOptions,
  ReverbTransformer,
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
  compressor?: CompressorOptions;
  seeker?: PCMSeekerOptions;
  reverb?: ReverbOptions;
}

export class FiltersChain {
  public equalizer: EqualizerStream | null = null;
  public filters: AudioFilter | null = null;
  public biquad: BiquadStream | null = null;
  public volume: VolumeTransformer | null = null;
  public resampler: PCMResampler | null = null;
  public compressor: CompressorTransformer | null = null;
  public seeker: PCMSeekerTransformer | null = null;
  public reverb: ReverbTransformer | null = null;
  public destination: Readable | null = null;
  public source: Readable | null = null;
  public onUpdate: () => unknown = () => null;
  public onError: (err: Error) => unknown = () => null;

  public constructor(public presets: DSPFiltersPreset = {}) {}

  public create(src: Readable, presets: DSPFiltersPreset = this.presets) {
    this.destroy();

    this.source = src;

    const resampler = !presets.resampler?.disabled
      ? new PCMResampler(presets.resampler)
      : null;

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

    const compressor = !presets.compressor?.disabled
      ? new CompressorTransformer(presets.compressor)
      : null;

    const seeker = !presets.seeker?.disabled
      ? new PCMSeekerTransformer(presets.seeker)
      : null;

    const reverb = !presets.reverb?.disabled
      ? new ReverbTransformer(presets.reverb)
      : null;

    this.resampler = resampler;
    this.equalizer = equalizerStream;
    this.filters = dspStream;
    this.biquad = biquadStream;
    this.volume = volumeTransformer;
    this.compressor = compressor;
    this.seeker = seeker;
    this.reverb = reverb;

    // update listeners
    if (resampler) resampler.onUpdate = this.onUpdate;
    if (equalizerStream) equalizerStream.onUpdate = this.onUpdate;
    if (dspStream) dspStream.onUpdate = this.onUpdate;
    if (biquadStream) biquadStream.onUpdate = this.onUpdate;
    if (volumeTransformer) volumeTransformer.onUpdate = this.onUpdate;
    if (compressor) compressor.onUpdate = this.onUpdate;
    if (seeker) seeker.onUpdate = this.onUpdate;
    if (reverb) reverb.onUpdate = this.onUpdate;

    const chains = [
      src,
      resampler,
      equalizerStream,
      reverb,
      dspStream,
      biquadStream,
      compressor,
      volumeTransformer,
      seeker,
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
    this.resampler?.destroy();
    this.equalizer?.destroy();
    this.biquad?.destroy();
    this.filters?.destroy();
    this.volume?.destroy();
    this.compressor?.destroy();
    this.seeker?.destroy();
    this.reverb?.destroy();
    this.destination?.destroy();
    this.source?.destroy();

    // remove events
    this.resampler?.removeAllListeners();
    this.equalizer?.removeAllListeners();
    this.biquad?.removeAllListeners();
    this.filters?.removeAllListeners();
    this.volume?.removeAllListeners();
    this.compressor?.removeAllListeners();
    this.seeker?.removeAllListeners();
    this.reverb?.removeAllListeners();
    this.destination?.removeAllListeners();
    this.source?.removeAllListeners();

    // unref
    this.resampler = null;
    this.equalizer = null;
    this.biquad = null;
    this.filters = null;
    this.volume = null;
    this.compressor = null;
    this.seeker = null;
    this.reverb = null;
    this.destination = null;
    this.source = null;
  }
}
