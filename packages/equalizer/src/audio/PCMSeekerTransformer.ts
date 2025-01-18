import { PCMTransformer, PCMTransformerOptions } from '../utils';
import { EventEmitter } from 'events';

export interface PCMSeekerOptions extends PCMTransformerOptions {
  totalDuration: number;
  channels: number;
  seekTarget?: number | null;
}

export interface SeekerParameters {
  currentPosition: number;
  seekTarget: number | null;
  totalDuration: number;
}

export interface SeekEvent {
  position: number;
  sample: number;
  bytePosition: number;
}

export class PCMSeekerTransformer extends PCMTransformer {
  private totalDuration: number;
  private readonly channels: number;
  private bytesPerFrame!: number;
  private currentPosition = 0;
  private seekTarget: number | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  public readonly events = new EventEmitter();

  public constructor(
    options: PCMSeekerOptions = {
      channels: 2,
      totalDuration: 0,
    },
  ) {
    super(options);

    if (options.totalDuration == null || options.totalDuration < 0) {
      throw new Error('totalDuration must be a positive number');
    }

    if (!options.channels || options.channels <= 0) {
      throw new Error('channels must be a positive number');
    }

    this.totalDuration = options.totalDuration;
    this.channels = options.channels;

    if (typeof options.seekTarget === 'number' && options.seekTarget > 0) {
      this.seekTarget = options.seekTarget;
    }

    this.updateDependentValues();
  }

  public getParameters(): SeekerParameters {
    return {
      currentPosition: this.currentPosition,
      seekTarget: this.seekTarget,
      totalDuration: this.totalDuration,
    };
  }

  private updateDependentValues(): void {
    this.bytesPerFrame = this.bytes * this.channels;

    if (this.currentPosition > 0) {
      const currentMs = this.currentPosition / (this.sampleRate / 1000);
      this.currentPosition = Math.floor((currentMs / 1000) * this.sampleRate);
    }

    if (this.seekTarget !== null) {
      const seekMs = this.seekTarget / (this.sampleRate / 1000);
      this.seekTarget = Math.floor((seekMs / 1000) * this.sampleRate);
    }
  }

  /**
   * Calculate byte position from sample position
   * @param samplePosition Position in samples
   * @returns Position in bytes
   */
  private sampleToBytePosition(samplePosition: number): number {
    return samplePosition * this.bytesPerFrame;
  }

  public setTotalDuration(duration: number): void {
    if (duration <= 0) {
      throw new Error('totalDuration must be a positive number');
    }

    this.totalDuration = duration;
    this.updateDependentValues();
    this.onUpdate();
  }

  public override setSampleRate(rate: number): void {
    super.setSampleRate(rate);
    this.updateDependentValues();
    this.onUpdate();
  }

  /**
   * Seek to a specific position in milliseconds
   * @param ms Position in milliseconds (negative values seek from end)
   * @returns Actual position in milliseconds after seeking
   */
  public seek(ms: number): number {
    if (this.totalDuration === 0) return 0;

    if (ms < 0) {
      ms = Math.max(0, this.totalDuration + ms);
    }

    ms = Math.max(0, Math.min(this.totalDuration, ms));
    const targetSample = Math.floor((ms / 1000) * this.sampleRate);

    if (targetSample < this.currentPosition) {
      this.buffer = Buffer.alloc(0);

      const bytePosition = this.sampleToBytePosition(targetSample);

      this.events.emit('seek', {
        position: ms,
        sample: targetSample,
        bytePosition: bytePosition,
      } as SeekEvent);
    }

    this.seekTarget = targetSample;
    return (targetSample / this.sampleRate) * 1000;
  }

  public getPosition(): number {
    return (this.currentPosition / this.sampleRate) * 1000;
  }

  private handleSeek(chunk: Buffer): Buffer {
    if (this.seekTarget === null) return chunk;

    const chunkStartSample = this.currentPosition;
    const chunkSamples = Math.floor(chunk.length / this.bytesPerFrame);
    const chunkEndSample = chunkStartSample + chunkSamples;

    if (this.seekTarget >= chunkEndSample) {
      this.currentPosition += chunkSamples;
      return Buffer.alloc(0);
    }

    if (this.seekTarget >= chunkStartSample) {
      const offsetSamples = this.seekTarget - chunkStartSample;
      const offsetBytes = offsetSamples * this.bytesPerFrame;
      this.currentPosition = this.seekTarget;
      this.seekTarget = null;
      return chunk.subarray(offsetBytes);
    }

    this.currentPosition = this.seekTarget;
    this.seekTarget = null;
    return chunk;
  }

  public override _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer) => void,
  ): void {
    try {
      if (this.disabled || this.totalDuration === 0) {
        callback(null, chunk);
        return;
      }

      const combinedBuffer = Buffer.concat([this.buffer, chunk]);
      const frameCount = Math.floor(combinedBuffer.length / this.bytesPerFrame);
      const processableBytes = frameCount * this.bytesPerFrame;

      this.buffer = combinedBuffer.subarray(processableBytes);

      let processBuffer = combinedBuffer.subarray(0, processableBytes);

      if (this.seekTarget !== null) {
        processBuffer = this.handleSeek(processBuffer);
      } else {
        this.currentPosition += frameCount;
      }

      callback(null, processBuffer);
    } catch (error) {
      callback(error as Error);
    }
  }

  public override _flush(
    callback: (error?: Error | null, data?: Buffer) => void,
  ): void {
    if (this.buffer.length >= this.bytesPerFrame) {
      const frameCount = Math.floor(this.buffer.length / this.bytesPerFrame);
      const processableBytes = frameCount * this.bytesPerFrame;
      callback(null, this.buffer.subarray(0, processableBytes));
    }

    callback();
  }
}
