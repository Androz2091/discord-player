import { AudioResource, StreamType } from 'discord-voip';
import { Readable } from 'stream';
import { QueryResolver, SearchQueryType } from '../utils/QueryResolver';
import { Util, VALIDATE_QUEUE_CAP } from '../utils/Util';
import { Track, TrackResolvable } from '../fabric/Track';
import { GuildQueue, GuildQueueEvent, TrackSkipReason } from './GuildQueue';
import { setTimeout as waitFor } from 'timers/promises';
import { AsyncQueue } from '../utils/AsyncQueue';
import {
  InvalidArgTypeError,
  NoResultError,
  NoVoiceConnectionError,
  OutOfRangeError,
} from '../errors';
import { TypeUtil } from '../utils/TypeUtil';
import { CreateStreamOps } from '../stream/StreamDispatcher';
import { ExtractorStreamable } from '../extractors/BaseExtractor';
import { OggDemuxer, OpusDecoder, WebmDemuxer } from '@discord-player/opus';
import { SeekEvent } from '@discord-player/equalizer';

export const FFMPEG_SRATE_REGEX = /asetrate=\d+\*(\d(\.\d)?)/;

export interface PlayerProgressbarOptions {
  /**
   * If it should render time codes
   */
  timecodes?: boolean;
  /**
   * If it should create progress bar for the whole queue
   */
  length?: number;
  /**
   * The bar length
   */
  leftChar?: string;
  /**
   * The elapsed time track
   */
  rightChar?: string;
  /**
   * The remaining time track
   */
  separator?: string;
  /**
   * The separation between timestamp and line
   */
  indicator?: string;
  /**
   * The indicator
   */
  queue?: boolean;
}

export interface ResourcePlayOptions {
  queue?: boolean;
  seek?: number;
  transitionMode?: boolean;
}

export interface SkipOptions {
  reason: TrackSkipReason;
  description: string;
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

export interface StreamConfig {
  dispatcherConfig: CreateStreamOps;
  playerConfig: ResourcePlayOptions;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class GuildQueuePlayerNode<Meta = any> {
  #progress = 0;
  #hasFFmpegOptimization = false;
  public tasksQueue = new AsyncQueue();
  public constructor(public queue: GuildQueue<Meta>) {
    this.#hasFFmpegOptimization = /libopus: (yes|true)/.test(
      this.queue.player.scanDeps(),
    );
  }

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
    if (this.queue.filters.seeker) {
      const pos = this.queue.filters.seeker.getPosition();
      if (pos > 0) return pos;
    }

    const dur = this.#progress + this.streamTime;

    return dur;
  }

  /**
   * Get duration multiplier
   */
  public getDurationMultiplier() {
    const srateFilters = this.queue.filters.ffmpeg
      .toArray()
      .filter((ff) => FFMPEG_SRATE_REGEX.test(ff));
    const multipliers = srateFilters
      .map((m) => {
        return parseFloat(FFMPEG_SRATE_REGEX.exec(m)?.[1] as string);
      })
      .filter((f) => !isNaN(f));

    return !multipliers.length
      ? 1
      : multipliers.reduce((accumulator, current) => current + accumulator);
  }

  /**
   * Estimated progress of the player
   */
  public get estimatedPlaybackTime() {
    const dur = this.playbackTime;
    const val = this.getDurationMultiplier() * dur;

    return val;
  }

  /**
   * Estimated total duration of the player
   */
  public get estimatedDuration() {
    const dur = this.totalDuration;

    // duration multiplier checks ffmpeg filters that may affect the duration
    const val = Math.round(dur / this.getDurationMultiplier());

    // we also need to check if we have a native resampler filter as it may also affect the duration
    if (this.queue.filters.resampler) {
      // get the resampler ratio if we have one
      const ratio = this.queue.filters.resampler.getRatio();
      if (ratio <= 0) return val;

      return Math.round(val / ratio);
    }

    return val;
  }

  /**
   * Total duration of the current audio track
   */
  public get totalDuration() {
    const prefersBridgedMetadata = this.queue.options.preferBridgedMetadata;
    const track = this.queue.currentTrack;

    if (prefersBridgedMetadata) {
      const trackHasLegacyMetadata =
        track?.metadata != null &&
        typeof track.metadata === 'object' &&
        'bridge' in track.metadata &&
        track.metadata.bridge != null;
      const trackHasMetadata = track?.bridgedTrack != null;

      if (trackHasLegacyMetadata || trackHasMetadata) {
        const duration =
          track.bridgedTrack?.durationMS ??
          (
            track as Track<{
              bridge: {
                duration: number;
              };
            }>
          ).metadata?.bridge.duration;

        if (TypeUtil.isNumber(duration)) return duration;
      }
    }

    return track?.durationMS ?? 0;
  }

  /**
   * Get stream progress
   * @param ignoreFilters Ignore filters
   */
  public getTimestamp(ignoreFilters = false): PlayerTimestamp | null {
    if (!this.queue.currentTrack) return null;

    const current = ignoreFilters
      ? this.playbackTime
      : this.estimatedPlaybackTime;
    const total = ignoreFilters ? this.totalDuration : this.estimatedDuration;

    return {
      current: {
        label: Util.buildTimeCode(Util.parseMS(current)),
        value: current,
      },
      total: {
        label: Util.buildTimeCode(Util.parseMS(total)),
        value: total,
      },
      progress: Math.round((current / total) * 100),
    };
  }

  /**
   * Create progress bar for current progress
   * @param options Progress bar options
   */
  public createProgressBar(options?: PlayerProgressbarOptions) {
    const timestamp = this.getTimestamp();
    if (!timestamp) return null;
    const {
      indicator = '\u{1F518}',
      leftChar = '\u25AC',
      rightChar = '\u25AC',
      length = 15,
      timecodes = true,
      separator = '\u2503',
    } = options || {};
    if (isNaN(length) || length < 0 || !Number.isFinite(length)) {
      throw new OutOfRangeError(
        '[PlayerProgressBarOptions.length]',
        String(length),
        '0',
        'Finite Number',
      );
    }
    const index = Math.round(
      (timestamp.current.value / timestamp.total.value) * length,
    );
    if (index >= 1 && index <= length) {
      const bar = leftChar.repeat(index - 1).split('');
      bar.push(indicator);
      bar.push(rightChar.repeat(length - index));
      if (timecodes) {
        return `${timestamp.current.label} ${separator} ${bar.join(
          '',
        )} ${separator} ${timestamp.total.label}`;
      } else {
        return `${bar.join('')}`;
      }
    } else {
      if (timecodes) {
        return `${
          timestamp.current.label
        } ${separator} ${indicator}${rightChar.repeat(
          length - 1,
        )} ${separator} ${timestamp.total.label}`;
      } else {
        return `${indicator}${rightChar.repeat(length - 1)}`;
      }
    }
  }

  /**
   * Seek the player
   * @param duration The duration to seek to
   */
  public async seek(duration: number) {
    if (!this.queue.currentTrack) return false;
    if (duration === this.estimatedPlaybackTime) return true;
    if (duration > this.totalDuration) {
      return this.skip({
        reason: TrackSkipReason.SEEK_OVER_THRESHOLD,
        description: new OutOfRangeError(
          '[duration]',
          String(duration),
          '0',
          String(this.totalDuration),
        ).message,
      });
    }
    if (duration < 0) duration = 0;

    const seeker = this.queue.filters.seeker;

    if (seeker) {
      seeker.seek(duration);
      return true;
    }

    return this.queue.filters.triggerReplay(duration).then((v) => {
      if (v) {
        this.queue.emit(GuildQueueEvent.PlayerSeek, this.queue, {
          currentPosition: this.estimatedPlaybackTime,
          seekTarget: duration,
          totalDuration: this.estimatedDuration,
        });
      }

      return v;
    });
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
    this.queue.dispatcher?.audioResource?.encoder?.setBitrate(
      rate === 'auto' ? this.queue.channel?.bitrate ?? 64000 : rate,
    );
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
  public skip(options?: SkipOptions) {
    if (!this.queue.dispatcher) return false;
    const track = this.queue.currentTrack;
    if (!track) return false;
    this.queue.setTransitioning(false);
    this.queue.dispatcher.end();
    const { reason, description } = options || {
      reason: TrackSkipReason.Manual,
      description: 'The track was skipped manually',
    };
    this.queue.emit(
      GuildQueueEvent.PlayerSkip,
      this.queue,
      track,
      reason,
      description,
    );
    return true;
  }

  /**
   * Remove the given track from queue
   * @param track The track to remove
   * @param emitEvent Whether or not to emit the event @defaultValue true
   */
  public remove(track: TrackResolvable, emitEvent = true) {
    const foundTrack = this.queue.tracks.find((t, idx) => {
      if (track instanceof Track || typeof track === 'string') {
        return (typeof track === 'string' ? track : track.id) === t.id;
      }
      if (typeof track === 'string') return track === t.id;
      return idx === track;
    });
    if (!foundTrack) return null;

    this.queue.tracks.removeOne((t) => t.id === foundTrack.id);

    if (emitEvent)
      this.queue.emit(GuildQueueEvent.AudioTrackRemove, this.queue, foundTrack);

    return foundTrack;
  }

  /**
   * Jump to specific track on the queue
   * @param track The track to jump to without removing other tracks
   */
  public jump(track: TrackResolvable) {
    const removed = this.remove(track, false);
    if (!removed) return false;
    this.queue.tracks.store.unshift(removed);
    return this.skip({
      reason: TrackSkipReason.Jump,
      description: 'The track was jumped to manually',
    });
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
    this.queue.emit(GuildQueueEvent.AudioTracksRemove, this.queue, toRemove);
    return this.skip({
      reason: TrackSkipReason.SkipTo,
      description: 'The player was skipped to another track manually',
    });
  }

  /**
   * Insert a track on the given position in queue
   * @param track The track to insert
   * @param index The position to insert to, defaults to 0.
   */
  public insert(track: Track, index = 0) {
    if (!(track instanceof Track))
      throw new InvalidArgTypeError(
        'track value',
        'instance of Track',
        String(track),
      );
    VALIDATE_QUEUE_CAP(this.queue, track);
    this.queue.tracks.store.splice(index, 0, track);
    if (!this.queue.options.noEmitInsert) {
      this.queue.emit(GuildQueueEvent.AudioTrackAdd, this.queue, track);
    }
  }

  /**
   * Moves a track in the queue
   * @param from The track to move
   * @param to The position to move to
   */
  public move(from: TrackResolvable, to: number) {
    const removed = this.remove(from);
    if (!removed) {
      throw new NoResultError('invalid track to move');
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
      throw new NoResultError('invalid track to copy');
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
    if (src < 0) throw new NoResultError('invalid src track to swap');

    const dest = this.getTrackPosition(second);
    if (dest < 0) throw new NoResultError('invalid dest track to swap');

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
      this.queue.dispatcher.destroy();
      return true;
    }
    if (this.queue.options.leaveOnStop) {
      const tm: NodeJS.Timeout = setTimeout(() => {
        if (this.isPlaying() || this.queue.tracks.size) return clearTimeout(tm);
        this.queue.dispatcher?.destroy();
      }, this.queue.options.leaveOnStopCooldown).unref();
    }
    return true;
  }

  /**
   * Request the source to seek
   * @param data The seek parameters
   */
  public async requestSeek(data: SeekEvent) {
    const track = this.queue.currentTrack;
    if (!track) return false;

    if (track.seekable) {
      return track.seek(data);
    }

    return this.queue.filters.triggerReplay(data.position);
  }

  /**
   * Play the given track
   * @param res The track to play
   * @param options Options for playing the track
   */
  public async play(res?: Track | null, options?: ResourcePlayOptions) {
    if (!this.queue.dispatcher?.voiceConnection) {
      throw new NoVoiceConnectionError();
    }

    if (this.queue.hasDebugger)
      this.queue.debug(
        `Received play request from guild ${this.queue.guild.name} (ID: ${this.queue.guild.id})`,
      );

    options = Object.assign(
      {},
      {
        queue: this.queue.currentTrack != null,
        transitionMode: false,
        seek: 0,
      } as ResourcePlayOptions,
      options,
    )!;

    if (res && options.queue) {
      if (this.queue.hasDebugger)
        this.queue.debug(
          'Requested option requires to queue the track, adding the given track to queue instead...',
        );
      return this.queue.addTrack(res);
    }

    const track = res || this.queue.tracks.dispatch();
    if (!track) {
      const error = new NoResultError(
        'Play request received but track was not provided',
      );
      this.queue.emit(GuildQueueEvent.Error, this.queue, error);
      return;
    }

    if (this.queue.hasDebugger)
      this.queue.debug(
        'Requested option requires to play the track, initializing...',
      );

    try {
      const assignedResource = track.resource;

      if (assignedResource) {
        if (this.queue.hasDebugger)
          this.queue.debug(
            'Track has an audio resource assigned, player will now play the resource directly...',
          );

        this.queue.setTransitioning(!!options.transitionMode);

        return this.#performPlay(assignedResource);
      }

      if (this.queue.hasDebugger)
        this.queue.debug(`Initiating stream extraction process...`);
      const src = track.raw?.source || track.source;
      const qt: SearchQueryType =
        track.queryType ||
        (src === 'spotify'
          ? 'spotifySong'
          : src === 'apple_music'
          ? 'appleMusicSong'
          : src);
      if (this.queue.hasDebugger)
        this.queue.debug(
          `Executing onBeforeCreateStream hook (QueryType: ${qt})...`,
        );

      const streamSrc = {
        error: null as Error | null,
        stream: null as ExtractorStreamable | null,
      };

      await this.queue
        .onBeforeCreateStream?.(track, qt || 'arbitrary', this.queue)
        .then(
          (s) => {
            if (s) {
              streamSrc.stream = s;
            }
          },
          (e: Error) => (streamSrc.error = e),
        );

      // throw if 'onBeforeCreateStream' panics
      if (!streamSrc.stream && streamSrc.error)
        return this.#throw(track, streamSrc.error);

      // default behavior when 'onBeforeCreateStream' did not panic
      if (!streamSrc.stream) {
        if (this.queue.hasDebugger)
          this.queue.debug(
            'Failed to get stream from onBeforeCreateStream, attempting to extract stream using extractors...',
          );
        await this.queue.player.extractors.context.provide(
          {
            id: crypto.randomUUID(),
            attemptedExtractors: new Set<string>(),
            bridgeAttemptedExtractors: new Set<string>(),
          },
          () =>
            this.#createGenericStream(track)
              .then(async (r) => {
                if (r?.result) {
                  streamSrc.stream =
                    <Readable>(
                      await this.queue.onStreamExtracted?.(
                        r.result,
                        track,
                        this.queue,
                      )
                    ) ?? r.result;
                  return;
                }

                if (r?.error) {
                  streamSrc.error = r.error;
                  return;
                }

                streamSrc.stream = streamSrc.error = null;
              })
              .catch((e: Error) => (streamSrc.error = e)),
        );
      }

      if (!streamSrc.stream) return this.#throw(track, streamSrc.error);

      if (typeof options.seek === 'number' && options.seek >= 0) {
        this.#progress = options.seek;
      } else {
        this.#progress = 0;
      }

      const trackStreamConfig: StreamConfig = {
        dispatcherConfig: {
          disableBiquad: this.queue.options.disableBiquad,
          disableEqualizer: this.queue.options.disableEqualizer,
          disableVolume: this.queue.options.disableVolume,
          disableFilters: this.queue.options.disableFilterer,
          disableResampler: this.queue.options.disableResampler,
          disableCompressor: this.queue.options.disableCompressor,
          disableReverb: this.queue.options.disableReverb,
          disableSeeker: this.queue.options.disableSeeker,
          compressor:
            this.queue.filters._lastFiltersCache.compressor ?? undefined,
          reverb: this.queue.filters._lastFiltersCache.reverb ?? undefined,
          seeker: {
            seekTarget:
              options.transitionMode && options.seek != null
                ? options.seek
                : null,
            totalDuration: track.durationMS ?? 0,
          },
          sampleRate:
            this.queue.filters._lastFiltersCache.sampleRate ??
            (typeof this.queue.options.resampler === 'number' &&
            this.queue.options.resampler > 0
              ? this.queue.options.resampler
              : undefined),
          biquadFilter:
            this.queue.filters._lastFiltersCache.biquad || undefined,
          eq: this.queue.filters._lastFiltersCache.equalizer,
          defaultFilters: this.queue.filters._lastFiltersCache.filters,
          volume: this.queue.filters._lastFiltersCache.volume,
          data: track,
          type: StreamType.Raw,
          skipFFmpeg: this.queue.player.options.skipFFmpeg,
        },
        playerConfig: options,
      };

      let resolver: () => void = Util.noop;
      const donePromise = new Promise<void>((resolve) => (resolver = resolve));

      const success = this.queue.emit(
        GuildQueueEvent.WillPlayTrack,
        this.queue,
        track,
        trackStreamConfig,
        resolver!,
      );

      // prevent dangling promise
      if (!success) resolver();

      if (this.queue.hasDebugger)
        this.queue.debug('Waiting for willPlayTrack event to resolve...');

      await donePromise;

      const daspDisabled = [
        trackStreamConfig.dispatcherConfig.disableBiquad,
        trackStreamConfig.dispatcherConfig.disableEqualizer,
        trackStreamConfig.dispatcherConfig.disableFilters,
        trackStreamConfig.dispatcherConfig.disableResampler,
        trackStreamConfig.dispatcherConfig.disableVolume,
        trackStreamConfig.dispatcherConfig.disableCompressor,
        trackStreamConfig.dispatcherConfig.disableReverb,
        trackStreamConfig.dispatcherConfig.disableSeeker,
      ].every((e) => !!e === true);

      const needsFilters =
        !!trackStreamConfig.playerConfig.seek ||
        !!this.queue.filters.ffmpeg.args.length;
      const shouldSkipFFmpeg =
        !!trackStreamConfig.dispatcherConfig.skipFFmpeg && !needsFilters;

      let finalStream: Readable;

      const demuxable = (fmt: string) =>
        [
          StreamType.Opus,
          StreamType.WebmOpus,
          StreamType.OggOpus,
          StreamType.Raw,
          'pcm',
        ].includes(fmt as StreamType);

      // skip ffmpeg when possible
      if (
        shouldSkipFFmpeg &&
        !(streamSrc.stream instanceof Readable) &&
        typeof streamSrc.stream !== 'string' &&
        demuxable(streamSrc.stream.$fmt)
      ) {
        const { $fmt, stream } = streamSrc.stream;
        const shouldPCM = !daspDisabled;

        if (this.queue.hasDebugger)
          this.queue.debug(
            `skipFFmpeg is set to true and stream is demuxable, creating stream with type ${
              shouldPCM ? 'pcm' : 'opus'
            }`,
          );

        const isRaw = $fmt === 'pcm' || $fmt === StreamType.Raw;

        // prettier-ignore
        const opusStream =
          isRaw || $fmt === StreamType.Opus
            ? stream
            : $fmt === StreamType.OggOpus
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              stream.pipe(new OggDemuxer() as any)
            : // eslint-disable-next-line @typescript-eslint/no-explicit-any
              stream.pipe(new WebmDemuxer() as any);

        if (shouldPCM) {
          if (isRaw) {
            finalStream = opusStream;
          } else {
            // if we have any filters enabled, we need to decode the opus stream to pcm
            finalStream = opusStream.pipe(
              new OpusDecoder({
                channels: 2,
                frameSize: 960,
                rate: 48000,
              }),
            );
            trackStreamConfig.dispatcherConfig.type = StreamType.Raw;
          }
        } else {
          finalStream = opusStream;
          trackStreamConfig.dispatcherConfig.type = StreamType.Opus;
        }
      } else {
        // const opus = daspDisabled && this.#hasFFmpegOptimization;
        // if (opus && this.queue.hasDebugger) this.queue.debug('Disabling PCM output since all filters are disabled and opus encoding is supported...');

        finalStream = this.#createFFmpegStream(
          streamSrc.stream instanceof Readable ||
            typeof streamSrc.stream === 'string'
            ? streamSrc.stream
            : streamSrc.stream.stream,
          track,
          options.seek ?? 0,
          // opus
        );
        trackStreamConfig.dispatcherConfig.type = StreamType.Raw;
        // FIXME: OggOpus results in static noise
        // trackStreamConfig.dispatcherConfig.type = opus ? StreamType.OggOpus : StreamType.Raw;
      }

      if (options.transitionMode) {
        if (this.queue.hasDebugger)
          this.queue.debug(
            `Transition mode detected, player will wait for buffering timeout to expire (Timeout: ${this.queue.options.bufferingTimeout}ms)`,
          );
        await waitFor(this.queue.options.bufferingTimeout);
        if (this.queue.hasDebugger)
          this.queue.debug('Buffering timeout has expired!');
      }

      if (this.queue.hasDebugger)
        this.queue.debug(
          `Preparing final stream config: ${JSON.stringify(
            trackStreamConfig,
            null,
            2,
          )}`,
        );

      const dispatcher = this.queue.dispatcher;

      if (!dispatcher) {
        if (this.queue.hasDebugger) {
          this.queue.debug(
            'Dispatcher is not available, this is most likely due to the queue being deleted in the middle of operation. Cancelling the stream...',
          );
        }

        finalStream.destroy();
      } else {
        const resource = await dispatcher.createStream(
          finalStream,
          trackStreamConfig.dispatcherConfig,
        );

        this.queue.setTransitioning(!!options.transitionMode);

        await this.#performPlay(resource);
      }
    } catch (e) {
      if (this.queue.hasDebugger)
        this.queue.debug(`Failed to initialize audio player: ${e}`);
      throw e;
    }
  }

  #throw(track: Track, error?: Error | null): void {
    // prettier-ignore
    const streamDefinitelyFailedMyDearT_TPleaseTrustMeItsNotMyFault = (
            new NoResultError(`Could not extract stream for this track${error ? `\n\n${error.stack || error}` : ''}`)
        );

    this.queue.emit(
      GuildQueueEvent.PlayerSkip,
      this.queue,
      track,
      TrackSkipReason.NoStream,
      streamDefinitelyFailedMyDearT_TPleaseTrustMeItsNotMyFault.message,
    );
    this.queue.emit(
      GuildQueueEvent.PlayerError,
      this.queue,
      streamDefinitelyFailedMyDearT_TPleaseTrustMeItsNotMyFault,
      track,
    );
    const nextTrack = this.queue.tracks.dispatch();
    if (nextTrack) return void this.play(nextTrack, { queue: false });
    // @ts-expect-error should be resolved
    this.queue.dispatcher?.emit('finish', null);
  }

  async #performPlay(resource: AudioResource<Track>) {
    if (!this.queue.dispatcher) {
      if (this.queue.hasDebugger) {
        this.queue.debug(
          'Dispatcher is not available, this is most likely due to the queue being deleted in the middle of operation. Cancelling the stream...',
        );
      }
    } else {
      if (this.queue.hasDebugger)
        this.queue.debug('Initializing audio player...');
      await this.queue.dispatcher.playStream(resource);
      if (this.queue.hasDebugger) this.queue.debug('Dispatching audio...');
    }
  }

  async #createGenericStream(track: Track) {
    if (this.queue.hasDebugger)
      this.queue.debug(
        `Attempting to extract stream for Track { title: ${track.title}, url: ${track.url} } using registered extractors`,
      );

    const attemptedExtractors =
      this.queue.player.extractors.getContext()?.attemptedExtractors ||
      new Set<string>();

    const streamInfo = await this.queue.player.extractors.run(
      async (extractor) => {
        if (
          this.queue.player.options.blockStreamFrom?.some(
            (ext) => ext === extractor.identifier,
          )
        )
          return false;
        if (attemptedExtractors.has(extractor.identifier)) return false;
        attemptedExtractors.add(extractor.identifier);
        const canStream = await extractor.validate(
          track.url,
          track.queryType || QueryResolver.resolve(track.url).type,
        );
        if (!canStream) return false;
        return await extractor.stream(track);
      },
      false,
    );

    if (!streamInfo || !streamInfo.result) {
      if (this.queue.hasDebugger) {
        this.queue.debug(
          `Failed to extract stream for Track { title: ${track.title}, url: ${track.url} } using registered extractors`,
        );
      }

      if (!this.queue.options.disableFallbackStream) {
        if (this.queue.hasDebugger)
          this.queue.debug(
            `Generic stream extraction failed and fallback stream extraction is enabled`,
          );
        return this.#createFallbackStream(track);
      }

      return streamInfo || null;
    }

    if (this.queue.hasDebugger)
      this.queue.debug(
        `Stream extraction was successful for Track { title: ${
          track.title
        }, url: ${track.url} } (Extractor: ${
          streamInfo.extractor?.identifier || 'N/A'
        })`,
      );

    return streamInfo;
  }

  async #createFallbackStream(track: Track) {
    if (this.queue.hasDebugger)
      this.queue.debug(
        `Attempting to extract stream for Track { title: ${track.title}, url: ${track.url} } using fallback streaming method...`,
      );

    const verifyFallbackStream = this.queue.options.verifyFallbackStream;

    const fallbackStream = await this.queue.player.extractors.run(
      async (extractor) => {
        if (extractor.identifier === track.extractor?.identifier) return false;
        if (
          this.queue.player.options.blockStreamFrom?.some(
            (ext) => ext === extractor.identifier,
          )
        ) {
          return false;
        }

        const query = `${track.title} ${track.author}`;

        if (verifyFallbackStream) {
          if (this.queue.hasDebugger) {
            this.queue.debug(
              `Fallback stream verification is enabled, validating query for Track { title: ${track.title}, url: ${track.url} } using ${extractor.identifier}...`,
            );
          }

          const shouldProceed = await extractor.validate(
            query,
            track.queryType || track.source,
          );

          if (!shouldProceed) {
            if (this.queue.hasDebugger)
              this.queue.debug(
                `Failed to validate query for Track { title: ${track.title}, url: ${track.url} } using ${extractor.identifier}`,
              );
            return false;
          } else {
            if (this.queue.hasDebugger)
              this.queue.debug(
                `Query for Track { title: ${track.title}, url: ${track.url} } was validated using ${extractor.identifier}. Proceeding with extraction...`,
              );
          }
        }

        const fallbackTracks = await extractor.handle(query, {
          requestedBy: track.requestedBy,
        });

        const fallbackTrack = fallbackTracks.tracks[0];

        if (!fallbackTrack) return false;

        const stream = await extractor.stream(fallbackTrack);

        if (!stream) return false;

        track.bridgedTrack = fallbackTrack;

        return stream;
      },
      true,
    );

    if (!fallbackStream || !fallbackStream.result) {
      if (this.queue.hasDebugger)
        this.queue.debug(
          `Failed to extract stream for Track { title: ${track.title}, url: ${track.url} } using fallback streaming method`,
        );
      return fallbackStream || null;
    }

    track.bridgedExtractor = fallbackStream.extractor;

    return fallbackStream;
  }

  #createFFmpegStream(
    stream: Readable | string,
    track: Track,
    seek = 0,
    opus?: boolean,
  ) {
    const ffmpegStream = this.queue.filters.ffmpeg
      .createStream(stream, {
        encoderArgs: this.queue.filters.ffmpeg.args,
        seek: seek / 1000,
        fmt: opus ? 'opus' : 's16le',
      })
      .on('error', (err) => {
        const m = `${err}`.toLowerCase();

        if (this.queue.hasDebugger)
          this.queue.debug(
            `Stream closed due to an error from FFmpeg stream: ${
              err.stack || err.message || err
            }`,
          );

        if (m.includes('premature close') || m.includes('epipe')) return;

        this.queue.emit(GuildQueueEvent.PlayerError, this.queue, err, track);
      });

    return ffmpegStream;
  }
}
