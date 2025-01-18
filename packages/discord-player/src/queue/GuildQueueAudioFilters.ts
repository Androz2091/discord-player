import { Readable } from 'stream';
import { AudioFilters, FiltersName, QueueFilters } from '../utils/AudioFilters';
import { GuildQueue, GuildQueueEvent } from './GuildQueue';
import {
  BiquadFilters,
  Equalizer,
  EqualizerBand,
  PCMFilters,
} from '@discord-player/equalizer';
import { FFmpegStreamOptions, createFFmpegStream } from '../utils/FFmpegStream';
import { InvalidArgTypeError } from '../errors';
import { StreamConfig } from './GuildQueuePlayerNode';

type Filters = keyof typeof AudioFilters.filters;

const makeBands = (arr: number[]) => {
  return Array.from(
    {
      length: Equalizer.BAND_COUNT,
    },
    (_, i) => ({
      band: i,
      gain: arr[i] ? arr[i] / 30 : 0,
    }),
  ) as EqualizerBand[];
};

type EQPreset = {
  Flat: EqualizerBand[];
  Classical: EqualizerBand[];
  Club: EqualizerBand[];
  Dance: EqualizerBand[];
  FullBass: EqualizerBand[];
  FullBassTreble: EqualizerBand[];
  FullTreble: EqualizerBand[];
  Headphones: EqualizerBand[];
  LargeHall: EqualizerBand[];
  Live: EqualizerBand[];
  Party: EqualizerBand[];
  Pop: EqualizerBand[];
  Reggae: EqualizerBand[];
  Rock: EqualizerBand[];
  Ska: EqualizerBand[];
  Soft: EqualizerBand[];
  SoftRock: EqualizerBand[];
  Techno: EqualizerBand[];
};

export const EqualizerConfigurationPreset: Readonly<EQPreset> = Object.freeze({
  Flat: makeBands([]),
  Classical: makeBands([
    -1.11022e-15, -1.11022e-15, -1.11022e-15, -1.11022e-15, -1.11022e-15,
    -1.11022e-15, -7.2, -7.2, -7.2, -9.6,
  ]),
  Club: makeBands([
    -1.11022e-15, -1.11022e-15, 8.0, 5.6, 5.6, 5.6, 3.2, -1.11022e-15,
    -1.11022e-15, -1.11022e-15,
  ]),
  Dance: makeBands([
    9.6, 7.2, 2.4, -1.11022e-15, -1.11022e-15, -5.6, -7.2, -7.2, -1.11022e-15,
    -1.11022e-15,
  ]),
  FullBass: makeBands([
    -8.0, 9.6, 9.6, 5.6, 1.6, -4.0, -8.0, -10.4, -11.2, -11.2,
  ]),
  FullBassTreble: makeBands([
    7.2, 5.6, -1.11022e-15, -7.2, -4.8, 1.6, 8.0, 11.2, 12.0, 12.0,
  ]),
  FullTreble: makeBands([
    -9.6, -9.6, -9.6, -4.0, 2.4, 11.2, 16.0, 16.0, 16.0, 16.8,
  ]),
  Headphones: makeBands([
    4.8, 11.2, 5.6, -3.2, -2.4, 1.6, 4.8, 9.6, 12.8, 14.4,
  ]),
  LargeHall: makeBands([
    10.4, 10.4, 5.6, 5.6, -1.11022e-15, -4.8, -4.8, -4.8, -1.11022e-15,
    -1.11022e-15,
  ]),
  Live: makeBands([-4.8, -1.11022e-15, 4.0, 5.6, 5.6, 5.6, 4.0, 2.4, 2.4, 2.4]),
  Party: makeBands([
    7.2, 7.2, -1.11022e-15, -1.11022e-15, -1.11022e-15, -1.11022e-15,
    -1.11022e-15, -1.11022e-15, 7.2, 7.2,
  ]),
  Pop: makeBands([
    -1.6, 4.8, 7.2, 8.0, 5.6, -1.11022e-15, -2.4, -2.4, -1.6, -1.6,
  ]),
  Reggae: makeBands([
    -1.11022e-15, -1.11022e-15, -1.11022e-15, -5.6, -1.11022e-15, 6.4, 6.4,
    -1.11022e-15, -1.11022e-15, -1.11022e-15,
  ]),
  Rock: makeBands([8.0, 4.8, -5.6, -8.0, -3.2, 4.0, 8.8, 11.2, 11.2, 11.2]),
  Ska: makeBands([
    -2.4, -4.8, -4.0, -1.11022e-15, 4.0, 5.6, 8.8, 9.6, 11.2, 9.6,
  ]),
  Soft: makeBands([
    4.8, 1.6, -1.11022e-15, -2.4, -1.11022e-15, 4.0, 8.0, 9.6, 11.2, 12.0,
  ]),
  SoftRock: makeBands([
    4.0, 4.0, 2.4, -1.11022e-15, -4.0, -5.6, -3.2, -1.11022e-15, 2.4, 8.8,
  ]),
  Techno: makeBands([
    8.0, 5.6, -1.11022e-15, -5.6, -4.8, -1.11022e-15, 8.0, 9.6, 9.6, 8.8,
  ]),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FFmpegFilterer<Meta = any> {
  #ffmpegFilters: Filters[] = [];
  #inputArgs: string[] = [];

  public constructor(public af: GuildQueueAudioFilters<Meta>) {}

  /**
   * Indicates whether ffmpeg may be skipped
   */
  public get skippable() {
    return !!this.af.queue.player.options.skipFFmpeg;
  }

  #setFilters(filters: Filters[]) {
    const { queue } = this.af;
    // skip if filters are the same
    if (
      filters.every((f) => this.#ffmpegFilters.includes(f)) &&
      this.#ffmpegFilters.every((f) => filters.includes(f))
    )
      return Promise.resolve(false);
    const ignoreFilters =
      this.filters.some((ff) => ff === 'nightcore' || ff === 'vaporwave') &&
      !filters.some((ff) => ff === 'nightcore' || ff === 'vaporwave');
    const seekTime = queue.node.getTimestamp(ignoreFilters)?.current.value || 0;
    const prev = this.#ffmpegFilters.slice();
    this.#ffmpegFilters = [...new Set(filters)];

    return this.af.triggerReplay(seekTime).then((t) => {
      queue.emit(
        GuildQueueEvent.AudioFiltersUpdate,
        queue,
        prev,
        this.#ffmpegFilters.slice(),
      );
      return t;
    });
  }

  /**
   * Set input args for FFmpeg
   */
  public setInputArgs(args: string[]) {
    if (!args.every((arg) => typeof arg === 'string'))
      throw new InvalidArgTypeError('args', 'Array<string>', 'invalid item(s)');
    this.#inputArgs = args;
  }

  /**
   * Get input args
   */
  public get inputArgs() {
    return this.#inputArgs;
  }

  /**
   * Get encoder args
   */
  public get encoderArgs() {
    if (!this.filters.length) return [];

    return ['-af', this.toString()];
  }

  /**
   * Get final ffmpeg args
   */
  public get args() {
    return this.inputArgs.concat(this.encoderArgs);
  }

  /**
   * Create ffmpeg stream
   * @param source The stream source
   * @param options The stream options
   */
  public createStream(source: string | Readable, options: FFmpegStreamOptions) {
    if (this.#inputArgs.length)
      options.encoderArgs = [
        ...this.#inputArgs,
        ...(options.encoderArgs || []),
      ];

    const stream = createFFmpegStream(source, options);

    return stream;
  }

  /**
   * Set ffmpeg filters
   * @param filters The filters
   */
  public setFilters(
    filters: Filters[] | Record<Filters, boolean> | string[] | boolean,
  ) {
    let _filters: Filters[] = [];
    if (typeof filters === 'boolean') {
      _filters = !filters
        ? []
        : (Object.keys(AudioFilters.filters) as Filters[]);
    } else if (Array.isArray(filters)) {
      _filters = filters as Filters[];
    } else {
      _filters = Object.entries(filters)
        .filter((res) => res[1] === true)
        .map((m) => m[0]) as Filters[];
    }

    return this.#setFilters(_filters);
  }

  /**
   * Currently active ffmpeg filters
   */
  public get filters() {
    return this.#ffmpegFilters;
  }

  public set filters(filters: Filters[]) {
    this.setFilters(filters);
  }

  /**
   * Toggle given ffmpeg filter(s)
   * @param filters The filter(s)
   */
  public toggle(filters: Filters[] | Filters) {
    if (!Array.isArray(filters)) filters = [filters];
    const fresh: Filters[] = [];

    filters.forEach((f) => {
      if (this.filters.includes(f)) return;
      fresh.push(f);
    });

    return this.#setFilters(
      this.#ffmpegFilters.filter((r) => !filters.includes(r)).concat(fresh),
    );
  }

  /**
   * Set default filters
   * @param ff Filters list
   */
  public setDefaults(ff: Filters[]) {
    this.#ffmpegFilters = ff;
  }

  /**
   * Get list of enabled filters
   */
  public getFiltersEnabled() {
    return this.#ffmpegFilters;
  }

  /**
   * Get list of disabled filters
   */
  public getFiltersDisabled() {
    return AudioFilters.names.filter((f) => !this.#ffmpegFilters.includes(f));
  }

  /**
   * Check if the given filter is enabled
   * @param filter The filter
   */
  public isEnabled<T extends Filters>(filter: T): boolean {
    return this.#ffmpegFilters.includes(filter);
  }

  /**
   * Check if the given filter is disabled
   * @param filter The filter
   */
  public isDisabled<T extends Filters>(filter: T): boolean {
    return !this.isEnabled(filter);
  }

  /**
   * Check if the given filter is a valid filter
   * @param filter The filter to test
   */
  public isValidFilter(filter: string): filter is FiltersName {
    return AudioFilters.has(filter as Filters);
  }

  /**
   * Convert current filters to array
   */
  public toArray() {
    return this.filters.map((filter) => AudioFilters.get(filter));
  }

  /**
   * Convert current filters to JSON object
   */
  public toJSON() {
    const obj = {} as Record<keyof QueueFilters, string>;

    this.filters.forEach((filter) => (obj[filter] = AudioFilters.get(filter)));

    return obj;
  }

  /**
   * String representation of current filters
   */
  public toString() {
    return AudioFilters.create(this.filters);
  }
}

export interface GuildQueueAFiltersCache {
  equalizer: EqualizerBand[];
  biquad: BiquadFilters | null;
  filters: PCMFilters[];
  volume: number;
  sampleRate: number;
  sampleRateFilter:
    | StreamConfig['dispatcherConfig']['sampleRateFilters']
    | null;
  compressor: StreamConfig['dispatcherConfig']['compressor'] | null;
  reverb: StreamConfig['dispatcherConfig']['reverb'] | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class GuildQueueAudioFilters<Meta = any> {
  public graph = new AFilterGraph<Meta>(this);
  public ffmpeg = new FFmpegFilterer<Meta>(this);
  public equalizerPresets = EqualizerConfigurationPreset;
  public _lastFiltersCache: GuildQueueAFiltersCache = {
    biquad: null,
    equalizer: [],
    filters: [],
    volume: 100,
    sampleRate: -1,
    compressor: null,
    reverb: null,
    sampleRateFilter: null,
  };
  public constructor(public queue: GuildQueue<Meta>) {
    if (typeof this.queue.options.volume === 'number') {
      this._lastFiltersCache.volume = this.queue.options.volume;
    }
  }

  // TODO: enable this in the future
  // public get ffmpeg(): FFmpegFilterer<Meta> | null {
  //     if (this.queue.player.options.skipFFmpeg) {
  //         if (this.#ffmpeg) this.#ffmpeg = null;
  //         return null;
  //     }

  //     if (!this.#ffmpeg) {
  //         this.#ffmpeg = new FFmpegFilterer<Meta>(this);
  //     }

  //     return this.#ffmpeg;
  // }

  /**
   * Volume transformer
   */
  public get volume() {
    return this.queue.dispatcher?.dsp?.volume || null;
  }

  /**
   * 15 Band Equalizer
   */
  public get equalizer() {
    return this.queue.dispatcher?.equalizer || null;
  }

  /**
   * Digital biquad filters
   */
  public get biquad() {
    return this.queue.dispatcher?.biquad || null;
  }

  /**
   * DSP filters
   */
  public get filters() {
    return this.queue.dispatcher?.filters || null;
  }

  /**
   * Audio resampler
   */
  public get resampler() {
    return this.queue.dispatcher?.resampler || null;
  }

  /**
   * Compressor transformer
   */
  public get compressor() {
    return this.queue.dispatcher?.compressor || null;
  }

  /**
   * Reverb transformer
   */
  public get reverb() {
    return this.queue.dispatcher?.reverb || null;
  }

  /**
   * PCM Seeker transformer
   */
  public get seeker() {
    return this.queue.dispatcher?.seeker || null;
  }

  /**
   * Replay current track in transition mode
   * @param seek The duration to seek to
   */
  public async triggerReplay(seek = 0) {
    if (!this.queue.currentTrack) return false;
    const entry = this.queue.node.tasksQueue.acquire();
    try {
      await entry.getTask();
      await this.queue.node.play(this.queue.currentTrack, {
        queue: false,
        seek,
        transitionMode: true,
      });
      this.queue.node.tasksQueue.release();
      return true;
    } catch {
      this.queue.node.tasksQueue.release();
      return false;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class AFilterGraph<Meta = any> {
  public constructor(public af: GuildQueueAudioFilters<Meta>) {}

  public get ffmpeg() {
    return this.af.ffmpeg?.filters ?? [];
  }

  public get equalizer() {
    return (this.af.equalizer?.bandMultipliers || []).map((m, i) => ({
      band: i,
      gain: m,
    })) as EqualizerBand[];
  }

  public get biquad() {
    return (
      (this.af.biquad?.getFilterName() as Exclude<
        BiquadFilters,
        number
      > | null) || null
    );
  }

  public get filters() {
    return this.af.filters?.filters || [];
  }

  public get volume() {
    return this.af.volume;
  }

  public get resampler() {
    return this.af.resampler;
  }

  public dump(): FilterGraph {
    return {
      ffmpeg: this.ffmpeg,
      equalizer: this.equalizer,
      biquad: this.biquad,
      filters: this.filters,
      sampleRate: this.resampler?.sampleRate || 48000,
      volume: this.volume?.volume ?? 100,
    };
  }
}

export interface FilterGraph {
  ffmpeg: Filters[];
  equalizer: EqualizerBand[];
  biquad: Exclude<BiquadFilters, number> | null;
  filters: PCMFilters[];
  volume: number;
  sampleRate: number;
}
