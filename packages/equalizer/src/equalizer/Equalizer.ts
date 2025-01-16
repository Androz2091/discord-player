import {
  ChannelProcessor,
  ReadIntCallback,
  WriteIntCallback,
} from './ChannelProcessor';
import { EqualizerCoefficients } from './Coefficients';
import { EqualizerConfiguration } from './EqualizerConfiguration';

export interface ChannelProcessorInput {
  data: Buffer;
  readInt?: ReadIntCallback;
  writeInt?: WriteIntCallback;
  extremum?: number;
  bytes?: number;
}

export class Equalizer extends EqualizerConfiguration {
  public static BAND_COUNT = 15 as const;
  public static SAMPLE_RATE = 48000 as const;
  public static Coefficients48000 = [
    new EqualizerCoefficients(9.9847546664e-1, 7.6226668143e-4, 1.9984647656),
    new EqualizerCoefficients(9.9756184654e-1, 1.2190767289e-3, 1.9975344645),
    new EqualizerCoefficients(9.9616261379e-1, 1.9186931041e-3, 1.9960947369),
    new EqualizerCoefficients(9.9391578543e-1, 3.0421072865e-3, 1.9937449618),
    new EqualizerCoefficients(9.9028307215e-1, 4.8584639242e-3, 1.9898465702),
    new EqualizerCoefficients(9.8485897264e-1, 7.5705136795e-3, 1.9837962543),
    new EqualizerCoefficients(9.7588512657e-1, 1.2057436715e-2, 1.9731772447),
    new EqualizerCoefficients(9.6228521814e-1, 1.8857390928e-2, 1.9556164694),
    new EqualizerCoefficients(9.4080933132e-1, 2.9595334338e-2, 1.9242054384),
    new EqualizerCoefficients(9.0702059196e-1, 4.6489704022e-2, 1.8653476166),
    new EqualizerCoefficients(8.5868004289e-1, 7.0659978553e-2, 1.7600401337),
    new EqualizerCoefficients(7.8409610788e-1, 1.0795194606e-1, 1.5450725522),
    new EqualizerCoefficients(6.8332861002e-1, 1.5833569499e-1, 1.1426447155),
    new EqualizerCoefficients(
      5.5267518228e-1,
      2.2366240886e-1,
      4.0186190803e-1,
    ),
    new EqualizerCoefficients(
      4.1811888447e-1,
      2.9094055777e-1,
      -7.0905944223e-1,
    ),
  ];
  public channels: ChannelProcessor[] = [];
  public channelCount: number;

  public constructor(channelCount: number, bandMultipliers: number[]) {
    super(bandMultipliers);
    this.channelCount = channelCount;
    this.channels = this.createChannelProcessor();
  }

  public createChannelProcessor() {
    return Array.from({ length: this.channelCount }, () => {
      return new ChannelProcessor(this.bandMultipliers);
    });
  }

  public process(input: ChannelProcessorInput[]) {
    return this.channels.map((c, i) => {
      const { data, extremum, readInt, writeInt, bytes } = input[i];

      return c.process(data, extremum, bytes, readInt, writeInt);
    });
  }
}
