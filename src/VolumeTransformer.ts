// prism's volume transformer with smooth volume support

import { Transform, TransformOptions } from "stream";

export interface VolumeTransformerOptions extends TransformOptions {
    type?: "s16le" | "s16be" | "s32le" | "s32be";
    smoothness?: number;
    volume?: number;
}

export class VolumeTransformer extends Transform {
    private _bits: number;
    private _smoothing: number;
    private _bytes: number;
    private _extremum: number;
    private _chunk: Buffer;
    public volume: number;
    private _targetVolume: number;
    constructor(options: VolumeTransformerOptions = {}) {
        super(options);
        switch (options.type) {
            case "s16le":
                this._readInt = (buffer, index) => buffer.readInt16LE(index);
                this._writeInt = (buffer, int, index) => buffer.writeInt16LE(int, index);
                this._bits = 16;
                break;
            case "s16be":
                this._readInt = (buffer, index) => buffer.readInt16BE(index);
                this._writeInt = (buffer, int, index) => buffer.writeInt16BE(int, index);
                this._bits = 16;
                break;
            case "s32le":
                this._readInt = (buffer, index) => buffer.readInt32LE(index);
                this._writeInt = (buffer, int, index) => buffer.writeInt32LE(int, index);
                this._bits = 32;
                break;
            case "s32be":
                this._readInt = (buffer, index) => buffer.readInt32BE(index);
                this._writeInt = (buffer, int, index) => buffer.writeInt32BE(int, index);
                this._bits = 32;
                break;
            default:
                throw new Error("VolumeTransformer type should be one of s16le, s16be, s32le, s32be");
        }
        this._bytes = this._bits / 8;
        this._extremum = Math.pow(2, this._bits - 1);
        this.volume = typeof options.volume === "undefined" ? 1 : options.volume;
        this._targetVolume = this.volume;
        this._chunk = Buffer.alloc(0);
        this._smoothing = options.smoothness || 0;
    }

    _readInt(buffer: Buffer, index: number) {
        return index;
    }
    _writeInt(buffer: Buffer, int: number, index: number) {
        return index;
    }

    _transform(chunk: Buffer, encoding: BufferEncoding, done: () => unknown) {
        if (this._smoothing > 0 && this.volume !== this._targetVolume) {
            if (this.volume < this._targetVolume) {
                this.volume = this.volume + this._smoothing >= this._targetVolume ? this._targetVolume : this.volume + this._smoothing;
            } else if (this.volume > this._targetVolume) {
                this.volume = this.volume - this._smoothing <= this._targetVolume ? this._targetVolume : this.volume - this._smoothing;
            }
        }

        if (this.volume === 1) {
            this.push(chunk);
            return done();
        }

        const { _bytes, _extremum } = this;

        chunk = this._chunk = Buffer.concat([this._chunk, chunk]);
        if (chunk.length < _bytes) return done();

        const complete = Math.floor(chunk.length / _bytes) * _bytes;

        for (let i = 0; i < complete; i += _bytes) {
            const int = Math.min(_extremum - 1, Math.max(-_extremum, Math.floor(this.volume * this._readInt(chunk, i))));
            this._writeInt(chunk, int, i);
        }

        this._chunk = chunk.slice(complete);
        this.push(chunk.slice(0, complete));
        return done();
    }

    _destroy(err: Error, cb: (error: Error) => void) {
        super._destroy(err, cb);
        this._chunk = null;
    }

    setVolume(volume: number) {
        this._targetVolume = volume;
        if (this._smoothing <= 0) this.volume = volume;
    }

    setVolumeDecibels(db: number) {
        this.setVolume(Math.pow(10, db / 20));
    }

    setVolumeLogarithmic(value: number) {
        this.setVolume(Math.pow(value, 1.660964));
    }

    get volumeDecibels() {
        return Math.log10(this.volume) * 20;
    }

    get volumeLogarithmic() {
        return Math.pow(this.volume, 1 / 1.660964);
    }
}
