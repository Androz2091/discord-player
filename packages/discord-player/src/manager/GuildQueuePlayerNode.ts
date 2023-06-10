import { AudioResource, StreamType } from '@discordjs/voice';
import { Readable } from 'stream';
import { PlayerProgressbarOptions, SearchQueryType } from '../types/types';
import { QueryResolver } from '../utils/QueryResolver';
import { Util, VALIDATE_QUEUE_CAP } from '../utils/Util';
import { Track, TrackResolvable } from '../fabric/Track';
import { GuildQueue } from './GuildQueue';
import { setTimeout as waitFor } from 'timers/promises';
import { AsyncQueue } from '../utils/AsyncQueue';
import { Exceptions } from '../errors';

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
    public tasksQueue = new AsyncQueue();
    public constructor(public queue: GuildQueue<Meta>) {}

    /**
     * If the player is currently in idle mode
     */
    public isIdle() {
        return !!this.queue.dispatcher?.isIdle();
    }

    /**
     * If the player is currently buffering the track
     */
    public isBuffering() {
        return !!this.queue.dispatcher?.isBuffering();
    }

    /**
     * If the player is currently playing a track
     */
    public isPlaying() {
        return !!this.queue.dispatcher?.isPlaying();
    }

    /**
     * If the player is currently paused
     */
    public isPaused() {
        return !!this.queue.dispatcher?.isPaused();
    }

    /**
     * Reset progress history
     */
    public resetProgress() {
        this.#progress = 0;
    }

    /**
     * Set player progress
     */
    public setProgress(progress: number) {
        this.#progress = progress;
    }

    /**
     * The stream time for current session
     */
    public get streamTime() {
        return this.queue.dispatcher?.streamTime ?? 0;
    }

    /**
     * Current playback duration with history included
     */
    public get playbackTime() {
        const dur = this.#progress + this.streamTime;

        return dur;
    }

    /**
     * Get duration multiplier
     */
    public getDurationMultiplier() {
        const srateFilters = this.queue.filters.ffmpeg.toArray().filter((ff) => FFMPEG_SRATE_REGEX.test(ff));
        const multipliers = srateFilters
            .map((m) => {
                return parseFloat(FFMPEG_SRATE_REGEX.exec(m)?.[1] as string);
            })
            .filter((f) => !isNaN(f));

        return !multipliers.length ? 1 : multipliers.reduce((accumulator, current) => current + accumulator);
    }

    /**
     * Estimated progress of the player
     */
    public get estimatedPlaybackTime() {
        const dur = this.playbackTime;
        return Math.round(this.getDurationMultiplier() * dur);
    }

    /**
     * Estimated total duration of the player
     */
    public get estimatedDuration() {
        const dur = this.queue.currentTrack?.durationMS ?? 0;

        return Math.round(dur / this.getDurationMultiplier());
    }

    /**
     * Get stream progress
     * @param ignoreFilters Ignore filters
     */
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

    /**
     * Create progress bar for current progress
     * @param options Progress bar options
     */
    public createProgressBar(options?: PlayerProgressbarOptions) {
        const timestamp = this.getTimestamp();
        if (!timestamp) return null;

        const { indicator = '🔘', length = 15, line = '▬', timecodes = true } = options || {};

        if (isNaN(length) || length < 0 || !Number.isFinite(length)) {
            throw Exceptions.ERR_OUT_OF_RANGE('[PlayerProgressBarOptions.length]', String(length), '0', 'Finite Number');
        }
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

    /**
     * Seek the player
     * @param duration The duration to seek to
     */
    public async seek(duration: number) {
        if (!this.queue.currentTrack) return false;
        return await this.queue.filters.triggerReplay(duration);
    }

    /**
     * Current volume
     */
    public get volume() {
        return this.queue.dispatcher?.volume ?? 100;
    }

    /**
     * Set volume
     * @param vol Volume amount to set
     */
    public setVolume(vol: number) {
        if (!this.queue.dispatcher) return false;
        const res = this.queue.dispatcher.setVolume(vol);
        if (res) this.queue.filters._lastFiltersCache.volume = vol;
        return res;
    }

    /**
     * Set bit rate
     * @param rate The bit rate to set
     */
    public setBitrate(rate: number | 'auto') {
        this.queue.dispatcher?.audioResource?.encoder?.setBitrate(rate === 'auto' ? this.queue.channel?.bitrate ?? 64000 : rate);
    }

    /**
     * Set paused state
     * @param state The state
     */
    public setPaused(state: boolean) {
        if (state) return this.queue.dispatcher?.pause(true) || false;
        return this.queue.dispatcher?.resume() || false;
    }

    /**
     * Pause the playback
     */
    public pause() {
        return this.setPaused(true);
    }

    /**
     * Resume the playback
     */
    public resume() {
        return this.setPaused(false);
    }

    /**
     * Skip current track
     */
    public skip() {
        if (!this.queue.dispatcher) return false;
        this.queue.setTransitioning(false);
        this.queue.dispatcher.end();
        return true;
    }

    /**
     * Remove the given track from queue
     * @param track The track to remove
     */
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

        this.queue.player.events.emit('audioTrackRemove', this.queue, foundTrack);

        return foundTrack;
    }

    /**
     * Jump to specific track on the queue
     * @param track The track to jump to without removing other tracks
     */
    public jump(track: TrackResolvable) {
        const removed = this.remove(track);
        if (!removed) return false;
        this.queue.tracks.store.unshift(removed);
        return this.skip();
    }

    /**
     * Get track position
     * @param track The track
     */
    public getTrackPosition(track: TrackResolvable): number {
        return this.queue.tracks.toArray().findIndex((t, idx) => {
            if (track instanceof Track || typeof track === 'string') {
                return (typeof track === 'string' ? track : track.id) === t.id;
            }
            if (typeof track === 'string') return track === t.id;
            return idx === track;
        });
    }

    /**
     * Skip to the given track, removing others on the way
     * @param track The track to skip to
     */
    public skipTo(track: TrackResolvable) {
        const idx = this.getTrackPosition(track);
        if (idx < 0) return false;
        const removed = this.remove(idx);
        if (!removed) return false;
        const toRemove = this.queue.tracks.store.filter((_, i) => i <= idx);
        this.queue.tracks.store.splice(0, idx, removed);
        this.queue.player.events.emit('audioTracksRemove', this.queue, toRemove);
        return this.skip();
    }

    /**
     * Insert a track on the given position in queue
     * @param track The track to insert
     * @param index The position to insert to, defaults to 0.
     */
    public insert(track: Track, index = 0) {
        if (!(track instanceof Track)) throw Exceptions.ERR_INVALID_ARG_TYPE('track value', 'instance of Track', String(track));
        VALIDATE_QUEUE_CAP(this.queue, track);
        this.queue.tracks.store.splice(index, 0, track);
        if (!this.queue.options.noEmitInsert) this.queue.player.events.emit('audioTrackAdd', this.queue, track);
    }

    /**
     * Moves a track in the queue
     * @param from The track to move
     * @param to The position to move to
     */
    public move(from: TrackResolvable, to: number) {
        const removed = this.remove(from);
        if (!removed) {
            throw Exceptions.ERR_NO_RESULT('invalid track to move');
        }
        this.insert(removed, to);
    }

    /**
     * Copy a track in the queue
     * @param from The track to clone
     * @param to The position to clone at
     */
    public copy(from: TrackResolvable, to: number) {
        const src = this.queue.tracks.at(this.getTrackPosition(from));
        if (!src) {
            throw Exceptions.ERR_NO_RESULT('invalid track to copy');
        }
        this.insert(src, to);
    }

    /**
     * Swap two tracks in the queue
     * @param first The first track to swap
     * @param second The second track to swap
     */
    public swap(first: TrackResolvable, second: TrackResolvable) {
        const src = this.getTrackPosition(first);
        if (src < 0) throw Exceptions.ERR_NO_RESULT('invalid src track to swap');

        const dest = this.getTrackPosition(second);
        if (dest < 0) throw Exceptions.ERR_NO_RESULT('invalid dest track to swap');

        const srcT = this.queue.tracks.store[src];
        const destT = this.queue.tracks.store[dest];

        this.queue.tracks.store[src] = destT;
        this.queue.tracks.store[dest] = srcT;
    }

    /**
     * Stop the playback
     * @param force Whether or not to forcefully stop the playback
     */
    public stop(force = false) {
        this.queue.tracks.clear();
        this.queue.history.clear();
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

    /**
     * Play raw audio resource
     * @param resource The audio resource to play
     */
    public async playRaw(resource: AudioResource) {
        await this.queue.dispatcher?.playStream(resource as AudioResource<Track>);
    }

    /**
     * Play the given track
     * @param res The track to play
     * @param options Options for playing the track
     */
    public async play(res?: Track | null, options?: ResourcePlayOptions) {
        if (!this.queue.dispatcher?.voiceConnection) {
            throw Exceptions.ERR_NO_VOICE_CONNECTION();
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
            return this.queue.addTrack(res);
        }

        const track = res || this.queue.tracks.dispatch();
        if (!track) {
            if (this.queue.options.skipOnNoStream) return;
            throw Exceptions.ERR_NO_RESULT('Play request received but track was not provided');
        }

        this.queue.debug('Requested option requires to play the track, initializing...');

        try {
            this.queue.debug(`Initiating stream extraction process...`);
            const src = track.raw?.source || track.source;
            const qt: SearchQueryType = track.queryType || (src === 'spotify' ? 'spotifySong' : src === 'apple_music' ? 'appleMusicSong' : src);
            this.queue.debug(`Executing onBeforeCreateStream hook (QueryType: ${qt})...`);

            const streamSrc = {
                error: null as Error | null,
                stream: null as Readable | null
            };

            await this.queue.onBeforeCreateStream?.(track, qt || 'arbitrary', this.queue).then(
                (s) => {
                    if (s) {
                        streamSrc.stream = s;
                    }
                },
                (e: Error) => (streamSrc.error = e)
            );

            // throw if 'onBeforeCreateStream' panics
            if (!streamSrc.stream && streamSrc.error) return this.#throw(track, streamSrc.error);

            // default behavior when 'onBeforeCreateStream' did not panic
            if (!streamSrc.stream) {
                this.queue.debug('Failed to get stream from onBeforeCreateStream!');
                await this.#createGenericStream(track).then(
                    (r) => {
                        if (r?.result) {
                            streamSrc.stream = <Readable>r.result;
                            return;
                        }

                        if (r?.error) {
                            streamSrc.error = r.error;
                            return;
                        }

                        streamSrc.stream = streamSrc.error = null;
                    },
                    (e: Error) => (streamSrc.error = e)
                );
            }

            if (!streamSrc.stream) return this.#throw(track, streamSrc.error);

            if (typeof options.seek === 'number' && options.seek >= 0) {
                this.#progress = options.seek;
            } else {
                this.#progress = 0;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cookies = track.raw?.source === 'youtube' ? (<any>this.queue.player.options.ytdlOptions?.requestOptions)?.headers?.cookie : undefined;
            const pcmStream = this.#createFFmpegStream(streamSrc.stream, track, options.seek ?? 0, cookies);

            if (options.transitionMode) {
                this.queue.debug(`Transition mode detected, player will wait for buffering timeout to expire (Timeout: ${this.queue.options.bufferingTimeout}ms)`);
                await waitFor(this.queue.options.bufferingTimeout);
                this.queue.debug('Buffering timeout has expired!');
            }

            this.queue.debug(
                `Preparing final stream config: ${JSON.stringify(
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

            const resource = await this.queue.dispatcher.createStream(pcmStream, {
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
            throw e;
        }
    }

    #throw(track: Track, error?: Error | null) {
        // prettier-ignore
        const streamDefinitelyFailedMyDearT_TPleaseTrustMeItsNotMyFault = (
            Exceptions.ERR_NO_RESULT(`Could not extract stream for this track${error ? `\n\n${error.stack || error}` : ''}`)
        );

        if (this.queue.options.skipOnNoStream) {
            this.queue.player.events.emit('playerSkip', this.queue, track);
            this.queue.player.events.emit('playerError', this.queue, streamDefinitelyFailedMyDearT_TPleaseTrustMeItsNotMyFault, track);
            const nextTrack = this.queue.tracks.dispatch();
            if (nextTrack) this.play(nextTrack, { queue: false });
            return;
        }

        throw streamDefinitelyFailedMyDearT_TPleaseTrustMeItsNotMyFault;
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
            return streamInfo || null;
        }

        this.queue.debug(`Stream extraction was successful for Track { title: ${track.title}, url: ${track.url} } (Extractor: ${streamInfo.extractor?.identifier || 'N/A'})`);

        return streamInfo;
    }

    #createFFmpegStream(stream: Readable | string, track: Track, seek = 0, cookies?: string) {
        const ffmpegStream = this.queue.filters.ffmpeg
            .createStream(stream, {
                encoderArgs: this.queue.filters.ffmpeg.filters.length ? ['-af', this.queue.filters.ffmpeg.toString()] : [],
                seek: seek / 1000,
                fmt: 's16le',
                cookies,
                useLegacyFFmpeg: !!this.queue.player.options.useLegacyFFmpeg
            })
            .on('error', (err) => {
                const m = `${err}`.toLowerCase();

                this.queue.debug(`Stream closed due to an error from FFmpeg stream: ${err.stack || err.message || err}`);

                if (m.includes('premature close') || m.includes('epipe')) return;

                this.queue.player.events.emit('playerError', this.queue, err, track);
            });

        return ffmpegStream;
    }
}
