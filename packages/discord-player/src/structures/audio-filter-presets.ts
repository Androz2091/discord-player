/** Fixed v7-compatible FFmpeg filtergraph presets. Native validation remains owned by Remedia. */
export const AudioFilterPresets = {
  /** Low bass boost. */
  bassboost_low: 'bass=g=15:f=110:w=0.3',

  /** bassboost FFmpeg preset. */
  bassboost: 'bass=g=20:f=110:w=0.3',

  /** bassboost_high FFmpeg preset. */
  bassboost_high: 'bass=g=30:f=110:w=0.3',

  /** 8D FFmpeg preset. */
  '8D': 'apulsator=hz=0.09',

  /** vaporwave FFmpeg preset. */
  vaporwave: 'aresample=48000,asetrate=48000*0.8',

  /** nightcore FFmpeg preset. */
  nightcore: 'aresample=48000,asetrate=48000*1.25',

  /** lofi FFmpeg preset. */
  lofi: 'aresample=48000,asetrate=48000*0.9,extrastereo=m=2.5:c=disabled',

  /** phaser FFmpeg preset. */
  phaser: 'aphaser=in_gain=0.4',

  /** tremolo FFmpeg preset. */
  tremolo: 'tremolo',

  /** vibrato FFmpeg preset. */
  vibrato: 'vibrato=f=6.5',

  /** reverse FFmpeg preset. */
  reverse: 'areverse',

  /** treble FFmpeg preset. */
  treble: 'treble=g=5',

  /** normalizer2 FFmpeg preset. */
  normalizer2: 'dynaudnorm=g=101',

  /** normalizer FFmpeg preset. */
  normalizer: 'acompressor',

  /** surrounding FFmpeg preset. */
  surrounding: 'surround',

  /** pulsator FFmpeg preset. */
  pulsator: 'apulsator=hz=1',

  /** subboost FFmpeg preset. */
  subboost: 'asubboost',

  /** karaoke FFmpeg preset. */
  karaoke: 'stereotools=mlev=0.03',

  /** flanger FFmpeg preset. */
  flanger: 'flanger',

  /** gate FFmpeg preset. */
  gate: 'agate',

  /** haas FFmpeg preset. */
  haas: 'haas',

  /** mcompand FFmpeg preset. */
  mcompand: 'mcompand',

  /** mono FFmpeg preset. */
  mono: 'pan=mono|c0=.5*c0+.5*c1',

  /** mstlr FFmpeg preset. */
  mstlr: 'stereotools=mode=ms>lr',

  /** mstrr FFmpeg preset. */
  mstrr: 'stereotools=mode=ms>rr',

  /** compressor FFmpeg preset. */
  compressor: 'compand=points=-80/-105|-62/-80|-15.4/-15.4|0/-12|20/-7.6',

  /** expander FFmpeg preset. */
  expander: 'compand=attacks=0:points=-80/-169|-54/-80|-49.5/-64.6|-41.1/-41.1|-25.8/-15|-10.8/-4.5|0/0|20/8.3',

  /** softlimiter FFmpeg preset. */
  softlimiter: 'compand=attacks=0:points=-80/-80|-12.4/-12.4|-6/-8|0/-6.8|20/-2.8',

  /** chorus FFmpeg preset. */
  chorus: 'chorus=0.7:0.9:55:0.4:0.25:2',

  /** chorus2d FFmpeg preset. */
  chorus2d: 'chorus=0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|1.3',

  /** chorus3d FFmpeg preset. */
  chorus3d: 'chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3',

  /** fadein FFmpeg preset. */
  fadein: 'afade=t=in:ss=0:d=10',

  /** dim FFmpeg preset. */
  dim: `afftfilt="'real=re * (1-clip((b/nb)*b,0,1))':imag='im * (1-clip((b/nb)*b,0,1))'"`,

  /** earrape FFmpeg preset. */
  earrape: 'channelsplit,sidechaingate=level_in=64',

  /** silenceremove FFmpeg preset. */
  silenceremove: 'silenceremove=1:0:-50dB',
};

/** Canonical built-in audio filter preset names. */
export type AudioFilterPresetName = keyof typeof AudioFilterPresets;

/** Accepted preset names, including a lowercase alias for the legacy spatial preset. */
export type AudioFilterName = AudioFilterPresetName | '8d';

export const AudioFilter = {
  /**
   * Define an audio filter
   * @param name The name to reference the filter by
   * @param filterString The FFmpeg filter string to be associated with the name
   */
  define(name: string, filterString: string) {
    AudioFilterPresets[name as AudioFilterPresetName] = filterString;
  },

  /**
   * Bulk define audio filters
   * @param filters Array of filters containing the filter name and ffmpeg filter strings
   */
  defineBulk(filters: { name: string; value: string }[]) {
    for (const filter of filters) {
      this.define(filter.name, filter.value);
    }
  },
} as const;
