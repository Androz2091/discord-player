import { AudioResource, StreamType } from '@discordjs/voice';
import { Readable } from 'stream';
import { PlayerProgressbarOptions, SearchQueryType } from '../types/types';
import { createFFmpegStream } from '../utils/FFmpegStream';
import { QueryResolver } from '../utils/QueryResolver';
import { Util } from '../utils/Util';
import { Track, TrackResolvable } from './Track';
import { GuildQueue } from './GuildQueue';
import { setTimeout as waitFor } from 'timers/promises';

export const FFMPEG_SRATE_REGEX = /asetrate=\d+\*(\d(\.\d)?)/;

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

export class GuildQueuePlayerNode<Meta = unknown> {
    #progress = 0;
    public constructor(public queue: GuildQueue<Meta>) {}

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

    public get streamTime() {
        return this.queue.dispatcher?.streamTime ?? 0;
    }

    public get playbackTime() {
        const dur = this.#progress + this.streamTime;

        return dur;
    }

    public getDurationMultiplier() {
        const srateFilters = this.queue.filters.ffmpeg.toArray().filter((ff) => FFMPEG_SRATE_REGEX.test(ff));
        const multipliers = srateFilters
            .map((m) => {
                return parseFloat(FFMPEG_SRATE_REGEX.exec(m)?.[1] as string);
            })
            .filter((f) => !isNaN(f));

        return !multipliers.length ? 1 : multipliers.reduce((accumulator, current) => current + accumulator);
    }

    public get estimatedPlaybackTime() {
        const dur = this.playbackTime;
        return Math.round(this.getDurationMultiplier() * dur);
    }

    public get estimatedDuration() {
        const dur = this.queue.currentTrack?.durationMS ?? 0;

        return Math.round(dur / this.getDurationMultiplier());
    }

    public getTimestamp(ignoreFilters = false): PlayerTimestamp | null {
        if (!this.queue.currentTrack) return null;

        const current = ignoreFilters ? this.playbackTime : this.estimatedPlaybackTime;
        const total = ignoreFilters ? this.queue.currentTrack.durationMS : this.estimatedDuration;

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
                return `${timestamp.current.label} ┃ ${indicator}${line.repeat(length - 1)} ┃ ${timestamp.total.label}`;
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
        const res = this.queue.dispatcher.setVolume(vol);
        if (res) this.queue.filters._lastFiltersCache.volume = vol;
        return res;
    }

    public setBitrate(rate: number | 'auto') {
        this.queue.dispatcher?.audioResource?.encoder?.setBitrate(rate === 'auto' ? this.queue.channel?.bitrate ?? 64000 : rate);
    }

    public setPaused(state: boolean) {
        if (state) return this.queue.dispatcher?.pause(true) || false;
        return this.queue.dispatcher?.resume() || false;
    }

    public pause() {
        return this.setPaused(true);
    }

    public resume() {
        return this.setPaused(false);
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

        this.queue.debug(`Received play request from guild ${this.queue.guild.name} (ID: ${this.queue.guild.id})`);

        options = Object.assign(
            {},
            {
                queue: this.queue.currentTrack != null,
                transitionMode: false,
                seek: 0
            } as ResourcePlayOptions,
            options
        )!;

        if (res && options.queue) {
            this.queue.debug('Requested option requires to queue the track, adding the given track to queue instead...');
            return this.queue.tracks.add(res);
        }

        const track = res || this.queue.tracks.dispatch();
        if (!track) {
            throw new Error('Play request received but track was not provided');
        }

        this.queue.debug('Requested option requires to play the track, initializing...');
        this.queue.initializing = true;

        try {
            this.queue.debug(`Initiating stream extraction process...`);
            const qt: SearchQueryType = track.queryType || (track.raw.source === 'spotify' ? 'spotifySong' : track.raw.source === 'apple_music' ? 'appleMusicSong' : track.raw.source) || 'arbitrary';
            this.queue.debug(`Executing onBeforeCreateStream hook (QueryType: ${qt})...`);
            let stream = await this.queue.onBeforeCreateStream?.(track, qt, this.queue).catch(() => null);

            if (!stream) {
                this.queue.debug('Failed to get stream from onBeforeCreateStream!');
                stream = (await this.#createGenericStream(track).catch(() => null)) as Readable;
            }

            if (!stream) {
                const error = new Error('Could not extract stream for this track');
                this.queue.initializing = false;
                if (this.queue.options.skipOnNoStream) {
                    this.queue.player.events.emit('playerSkip', this.queue, track);
                    this.queue.player.events.emit('playerError', this.queue, error, track);
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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cookies = track.source === 'youtube' ? (<any>this.queue.player.options.ytdlOptions?.requestOptions)?.headers?.cookie : undefined;
            const pcmStream = this.#createFFmpegStream(stream, track, options.seek ?? 0, cookies);

            const finalStream = (await this.queue.onAfterCreateStream?.(pcmStream).catch(() => pcmStream)) || pcmStream;

            if (options.transitionMode) {
                this.queue.debug(`Transition mode detected, player will wait for buffering timeout to expire (Timeout: ${this.queue.options.bufferingTimeout}ms)`);
                await waitFor(this.queue.options.bufferingTimeout);
                this.queue.debug('Buffering timeout has expired!');
            }

            this.queue.debug(
                `Creating audio resource from processed stream, config: ${JSON.stringify(
                    {
                        disableBiquad: this.queue.options.biquad === false,
                        disableEqualizer: this.queue.options.equalizer === false,
                        disableVolume: this.queue.options.volume === false,
                        disableFilters: this.queue.options.filterer === false,
                        disableResampler: this.queue.options.resampler === false,
                        sampleRate: typeof this.queue.options.resampler === 'number' && this.queue.options.resampler > 0 ? this.queue.options.resampler : undefined,
                        biquadFilter: this.queue.filters._lastFiltersCache.biquad || undefined,
                        eq: this.queue.filters._lastFiltersCache.equalizer,
                        defaultFilters: this.queue.filters._lastFiltersCache.filters,
                        volume: this.queue.filters._lastFiltersCache.volume,
                        transitionMode: !!options.transitionMode,
                        ffmpegFilters: this.queue.filters.ffmpeg.toString(),
                        seek: options.seek
                    },
                    null,
                    2
                )}`
            );

            const resource = this.queue.dispatcher.createStream(finalStream, {
                disableBiquad: this.queue.options.biquad === false,
                disableEqualizer: this.queue.options.equalizer === false,
                disableVolume: this.queue.options.volume === false,
                disableFilters: this.queue.options.filterer === false,
                disableResampler: this.queue.options.resampler === false,
                sampleRate: typeof this.queue.options.resampler === 'number' && this.queue.options.resampler > 0 ? this.queue.options.resampler : undefined,
                biquadFilter: this.queue.filters._lastFiltersCache.biquad || undefined,
                eq: this.queue.filters._lastFiltersCache.equalizer,
                defaultFilters: this.queue.filters._lastFiltersCache.filters,
                volume: this.queue.filters._lastFiltersCache.volume,
                data: track,
                type: StreamType.Raw
            });

            this.queue.setTransitioning(!!options.transitionMode);

            await this.#performPlay(resource);
        } catch (e) {
            this.queue.debug(`Failed to initialize audio player: ${e}`);
            this.queue.initializing = false;
            throw e;
        }
    }

    async #performPlay(resource: AudioResource<Track>) {
        this.queue.debug('Initializing audio player...');
        await this.queue.dispatcher!.playStream(resource);
        this.queue.debug('Dispatching audio...');
    }

    async #createGenericStream(track: Track) {
        this.queue.debug(`Attempting to extract stream for Track { title: ${track.title}, url: ${track.url} } using registered extractors`);
        const streamInfo = await this.queue.player.extractors.run(async (extractor) => {
            if (this.queue.player.options.blockStreamFrom?.some((ext) => ext === extractor.identifier)) return false;
            const canStream = await extractor.validate(track.url, track.queryType || QueryResolver.resolve(track.url));
            if (!canStream) return false;
            return await extractor.stream(track);
        }, false);
        if (!streamInfo || !streamInfo.result) {
            this.queue.debug(`Failed to extract stream for Track { title: ${track.title}, url: ${track.url} } using registered extractors`);
            return null;
        }

        this.queue.debug(`Stream extraction was successful for Track { title: ${track.title}, url: ${track.url} } (Extractor: ${streamInfo.extractor.identifier})`);

        const stream = streamInfo.result;
        return stream;
    }

    #createFFmpegStream(stream: Readable | string, track: Track, seek = 0, cookies?: string) {
        const ffmpegStream = createFFmpegStream(stream, {
            encoderArgs: this.queue.filters.ffmpeg.filters.length ? ['-af', this.queue.filters.ffmpeg.toString()] : [],
            seek: seek / 1000,
            fmt: 's16le',
            cookies
        }).on('error', (err) => {
            const m = `${err}`.toLowerCase();

            this.queue.debug(`Stream closed due to an error from FFmpeg stream: ${err.stack || err.message || err}`);

            if (m.includes('premature close') || m.includes('epipe')) return;

            this.queue.player.events.emit('playerError', this.queue, err, track);
        });

        return ffmpegStream;
    }
}
