export type FiltersName = keyof QueueFilters;

/**
 * Represents FFmpeg filters
 */
export interface QueueFilters {
  bassboost_low?: boolean;
  bassboost?: boolean;
  bassboost_high?: boolean;
  '8D'?: boolean;
  vaporwave?: boolean;
  nightcore?: boolean;
  phaser?: boolean;
  tremolo?: boolean;
  vibrato?: boolean;
  reverse?: boolean;
  treble?: boolean;
  normalizer?: boolean;
  normalizer2?: boolean;
  surrounding?: boolean;
  pulsator?: boolean;
  subboost?: boolean;
  karaoke?: boolean;
  flanger?: boolean;
  gate?: boolean;
  haas?: boolean;
  mcompand?: boolean;
  mono?: boolean;
  mstlr?: boolean;
  mstrr?: boolean;
  compressor?: boolean;
  expander?: boolean;
  softlimiter?: boolean;
  chorus?: boolean;
  chorus2d?: boolean;
  chorus3d?: boolean;
  fadein?: boolean;
  dim?: boolean;
  earrape?: boolean;
  lofi?: boolean;
  silenceremove?: boolean;
}

const bass = (g: number) => `bass=g=${g}:f=110:w=0.3`;

export class AudioFilters {
  public constructor() {
    return AudioFilters;
  }

  public static filters: Record<FiltersName, string> = {
    bassboost_low: bass(15),
    bassboost: bass(20),
    bassboost_high: bass(30),
    '8D': 'apulsator=hz=0.09',
    vaporwave: 'aresample=48000,asetrate=48000*0.8',
    nightcore: 'aresample=48000,asetrate=48000*1.25',
    lofi: 'aresample=48000,asetrate=48000*0.9,extrastereo=m=2.5:c=disabled',
    phaser: 'aphaser=in_gain=0.4',
    tremolo: 'tremolo',
    vibrato: 'vibrato=f=6.5',
    reverse: 'areverse',
    treble: 'treble=g=5',
    normalizer2: 'dynaudnorm=g=101',
    normalizer: 'acompressor',
    surrounding: 'surround',
    pulsator: 'apulsator=hz=1',
    subboost: 'asubboost',
    karaoke: 'stereotools=mlev=0.03',
    flanger: 'flanger',
    gate: 'agate',
    haas: 'haas',
    mcompand: 'mcompand',
    mono: 'pan=mono|c0=.5*c0+.5*c1',
    mstlr: 'stereotools=mode=ms>lr',
    mstrr: 'stereotools=mode=ms>rr',
    compressor: 'compand=points=-80/-105|-62/-80|-15.4/-15.4|0/-12|20/-7.6',
    expander:
      'compand=attacks=0:points=-80/-169|-54/-80|-49.5/-64.6|-41.1/-41.1|-25.8/-15|-10.8/-4.5|0/0|20/8.3',
    softlimiter:
      'compand=attacks=0:points=-80/-80|-12.4/-12.4|-6/-8|0/-6.8|20/-2.8',
    chorus: 'chorus=0.7:0.9:55:0.4:0.25:2',
    chorus2d: 'chorus=0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|1.3',
    chorus3d: 'chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3',
    fadein: 'afade=t=in:ss=0:d=10',
    dim: `afftfilt="'real=re * (1-clip((b/nb)*b,0,1))':imag='im * (1-clip((b/nb)*b,0,1))'"`,
    earrape: 'channelsplit,sidechaingate=level_in=64',
    silenceremove: 'silenceremove=1:0:-50dB',
  };

  public static get<K extends FiltersName>(name: K) {
    return this.filters[name] ?? name;
  }

  public static has<K extends FiltersName>(name: K) {
    return name in this.filters;
  }

  public static *[Symbol.iterator](): IterableIterator<{
    name: FiltersName;
    value: string;
  }> {
    for (const [k, v] of Object.entries(this.filters)) {
      yield { name: k as FiltersName, value: v as string };
    }
  }

  public static get names() {
    return Object.keys(this.filters) as FiltersName[];
  }

  // @ts-ignore
  public static get length() {
    return this.names.length;
  }

  public static toString() {
    return this.names.map((m) => (this as any)[m]).join(','); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  /**
   * Create ffmpeg args from the specified filters name
   * @param filter The filter name
   * @returns
   */
  public static create<K extends FiltersName>(filters?: (K | string)[]) {
    if (!filters || !Array.isArray(filters)) return this.toString();
    return filters
      .filter((predicate) => typeof predicate === 'string')
      .map((m) => this.get(m as K))
      .join(',');
  }

  /**
   * Defines audio filter
   * @param filterName The name of the filter
   * @param value The ffmpeg args
   */
  public static define(filterName: string, value: string) {
    this.filters[filterName as FiltersName] = value;
  }

  /**
   * Defines multiple audio filters
   * @param filtersArray Array of filters containing the filter name and ffmpeg args
   */
  public static defineBulk(filtersArray: { name: string; value: string }[]) {
    filtersArray.forEach((arr) => this.define(arr.name, arr.value));
  }
}
