import { StreamType } from '@discordjs/voice';
import { Readable } from 'stream';
import { PlayerProgressbarOptions, SearchQueryType } from '../../types/types';
import AudioFilters from '../../utils/AudioFilters';
import { createFFmpegStream } from '../../utils/FFmpegStream';
import { QueryResolver } from '../../utils/QueryResolver';
import { Util } from '../../utils/Util';
import Track, { TrackResolvable } from '../Track';
import { GuildQueue } from './GuildQueue';

export interface ResourcePlayOptions {
    queue?: boolean;
    seek?: number;
    transitionMode?: boolean;
}

export interface PlayerTimestamp {
    current: {
        label: string;
        value: number;
    };
    total: {
        label: string;
        value: number;
    };
    progress: number;
}

export class GuildQueuePlayerNode {
    #progress = 0;
    public constructor(public queue: GuildQueue) {}

    public isIdle() {
        return !!this.queue.dispatcher?.isIdle();
    }

    public isBuffering() {
        return !!this.queue.dispatcher?.isBuffering();
    }

    public isPlaying() {
        return !!this.queue.dispatcher?.isPlaying();
    }

    public isPaused() {
        return !!this.queue.dispatcher?.isPaused();
    }

    public resetProgress() {
        this.#progress = 0;
    }

    public get playbackTime() {
        if (this.queue.dispatcher?.streamTime == null) return 0;
        const dur = this.#progress + this.queue.dispatcher.streamTime;
        const hasNightcore = this.queue.filters.ffmpeg.filters.includes('nightcore');
        const hasVwave = this.queue.filters.ffmpeg.filters.includes('vaporwave');

        if (hasNightcore && hasVwave) return dur * (1.25 + 0.8);
        return hasNightcore ? dur * 1.25 : hasVwave ? dur * 0.8 : dur;
    }

    public getTimestamp(): PlayerTimestamp | null {
        if (!this.queue.currentTrack) return null;

        const current = this.playbackTime;
        const total = this.queue.currentTrack.durationMS;

        return {
            current: {
                label: Util.buildTimeCode(Util.parseMS(current)),
                value: current
            },
            total: {
                label: Util.buildTimeCode(Util.parseMS(total)),
                value: total
            },
            progress: Math.round((current / total) * 100)
        };
    }

    public createProgressBar(options?: PlayerProgressbarOptions) {
        const timestamp = this.getTimestamp();
        if (!timestamp) return null;

        const { indicator = '🔘', length = 15, line = '▬', timecodes = true } = options || {};

        if (isNaN(length) || length < 0 || !Number.isFinite(length)) throw new Error('invalid progressbar length');
        const index = Math.round((timestamp.current.value / timestamp.total.value) * length);

        if (index >= 1 && index <= length) {
            const bar = line.repeat(length - 1).split('');
            bar.splice(index, 0, indicator);
            if (timecodes) {
                return `${timestamp.current.label} ┃ ${bar.join('')} ┃ ${timestamp.total.label}`;
            } else {
                return `${bar.join('')}`;
            }
        } else {
            if (timecodes) {
                return `${timestamp.current.label} ┃ ${indicator}${line.repeat(length - 1)} ┃ ${timestamp.current.label}`;
            } else {
                return `${indicator}${line.repeat(length - 1)}`;
            }
        }
    }

    public async seek(duration: number) {
        if (!this.queue.currentTrack) return false;
        await this.play(this.queue.currentTrack, {
            seek: duration,
            transitionMode: true
        });
        return true;
    }

    public get volume() {
        return this.queue.dispatcher?.volume ?? 100;
    }

    public setVolume(vol: number) {
        if (!this.queue.dispatcher) return false;
        return this.queue.dispatcher.setVolume(vol);
    }

    public setBitrate(rate: number | 'auto') {
        this.queue.dispatcher?.audioResource?.encoder?.setBitrate(rate === 'auto' ? this.queue.channel?.bitrate ?? 64000 : rate);
    }

    public pause() {
        return this.queue.dispatcher?.pause(true) || false;
    }

    public resume() {
        return this.queue.dispatcher?.resume() || false;
    }

    public skip() {
        if (!this.queue.dispatcher) return false;
        this.queue.setTransitioning(false);
        this.queue.dispatcher.end();
        return true;
    }

    public remove(track: TrackResolvable) {
        const foundTrack = this.queue.tracks.find((t, idx) => {
            if (track instanceof Track || typeof track === 'string') {
                return (typeof track === 'string' ? track : track.id) === t.id;
            }
            if (typeof track === 'string') return track === t.id;
            return idx === track;
        });
        if (!foundTrack) return null;

        this.queue.tracks.removeOne((t) => t.id === foundTrack.id);

        return foundTrack;
    }

    public jump(track: TrackResolvable) {
        const removed = this.remove(track);
        if (!removed) return false;
        this.queue.tracks.store.unshift(removed);
        return this.skip();
    }

    public getTrackPosition(track: TrackResolvable) {
        return this.queue.tracks.toArray().findIndex((t, idx) => {
            if (track instanceof Track || typeof track === 'string') {
                return (typeof track === 'string' ? track : track.id) === t.id;
            }
            if (typeof track === 'string') return track === t.id;
            return idx === track;
        });
    }

    public skipTo(track: TrackResolvable) {
        const idx = this.getTrackPosition(track);
        if (idx < 0) return false;
        const removed = this.remove(idx);
        if (!removed) return false;
        this.queue.tracks.store.splice(0, idx, removed);
        return this.skip();
    }

    public insert(track: Track, index = 0) {
        if (!(track instanceof Track)) throw new Error('invalid track');
        this.queue.tracks.store.splice(index, 0, track);
    }

    public stop(force = false) {
        if (!this.queue.dispatcher) return false;
        this.queue.dispatcher.end();
        if (force) {
            this.queue.dispatcher.disconnect();
            return true;
        }
        if (this.queue.options.leaveOnStop) {
            const tm: NodeJS.Timeout = setTimeout(() => {
                if (this.isPlaying() || this.queue.tracks.size) return clearTimeout(tm);
                this.queue.dispatcher?.disconnect();
            }, this.queue.options.leaveOnStopCooldown).unref();
        }
        return true;
    }

    public async play(res?: Track, options?: ResourcePlayOptions) {
        if (!this.queue.dispatcher?.voiceConnection) {
            throw new Error('No voice connection available');
        }
        options = Object.assign(
            {},
            {
                queue: true,
                transitionMode: false,
                seek: 0
            } as ResourcePlayOptions,
            options
        )!;

        const track = res || this.queue.tracks.dispatch();
        if (!track) {
            throw new Error('Play request received but track was not provided');
        }

        if (res && options.queue) {
            return this.queue.tracks.add(res);
        }

        const qt: SearchQueryType = track.queryType || (track.raw.source === 'spotify' ? 'spotifySong' : track.raw.source === 'apple_music' ? 'appleMusicSong' : track.raw.source) || 'arbitrary';
        const stream = (await this.queue.onBeforeCreateStream?.(track, qt, this.queue).catch(() => null)) || (await this.#createGenericStream(track).catch(() => null));
        if (!stream) {
            const error = new Error('Could not extract stream for this track');

            if (this.queue.options.skipOnNoStream) {
                this.queue.emit('playerSkip', track);
                this.queue.emit('playerError', error, track);
                this.play(this.queue.tracks.dispatch());
                return;
            }

            throw error;
        }

        if (typeof options.seek === 'number' && options.seek >= 0) {
            this.#progress = options.seek;
        } else {
            this.#progress = 0;
        }

        const pcmStream = this.#createFFmpegStream(stream, track, options.seek ?? 0);
        const resource = this.queue.dispatcher.createStream(pcmStream, {
            disableBiquad: this.queue.options.biquad === false,
            disableEqualizer: this.queue.options.equalizer === false,
            disableVolume: this.queue.options.volume === false,
            disableFilters: this.queue.options.filterer === false,
            biquadFilter: typeof this.queue.options.biquad === 'string' ? this.queue.options.biquad : undefined,
            eq: Array.isArray(this.queue.options.equalizer) ? this.queue.options.equalizer : [],
            defaultFilters: Array.isArray(this.queue.options.filterer) ? this.queue.options.filterer : [],
            data: track,
            type: StreamType.Raw
        });

        if (typeof this.queue.options.volume === 'number' && resource.volume) {
            resource.volume.setVolume(Math.pow(this.queue.options.volume / 100, 1.660964));
        }

        this.queue.setTransitioning(!!options.transitionMode);

        await this.queue.dispatcher.playStream(resource);
    }

    async #createGenericStream(track: Track) {
        const streamInfo = await this.queue.player.extractors.run(async (extractor) => {
            const canStream = await extractor.validate(track.url, track.queryType || QueryResolver.resolve(track.url));
            if (!canStream) return false;
            return await extractor.stream(track);
        });
        if (!streamInfo || !streamInfo.result) {
            return null;
        }

        const stream = streamInfo.result;
        return stream;
    }

    #createFFmpegStream(stream: Readable | string, track: Track, seek = 0) {
        const ffmpegStream = createFFmpegStream(stream, {
            encoderArgs: this.queue.filters.ffmpeg.filters.length ? ['-af', AudioFilters.create(this.queue.filters.ffmpeg.filters)] : [],
            seek: seek / 1000,
            fmt: 's16le'
        }).on('error', (err) => {
            if (!`${err}`.toLowerCase().includes('premature close')) this.queue.emit('playerError', err, track);
        });

        return ffmpegStream;
    }
}
