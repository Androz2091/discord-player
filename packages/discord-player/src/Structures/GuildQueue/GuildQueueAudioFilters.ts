import AudioFilters from '../../utils/AudioFilters';
import { GuildQueue } from './GuildQueue';
import { BiquadFilters, EqualizerBand, PCMFilters } from '@discord-player/equalizer';

type Filters = keyof typeof AudioFilters.filters;

export class FFmpegFilterer<Meta = unknown> {
    #ffmpegFilters: Filters[] = [];
    public constructor(public af: GuildQueueAudioFilters<Meta>) {}

    #setFilters(filters: Filters[]) {
        this.#ffmpegFilters = [...new Set(filters)];
        return this.af.triggerReplay(this.af.queue.node.getTimestamp()?.current.value || 0);
    }

    public setFilters(filters: Filters[] | Record<Filters, boolean> | boolean) {
        let _filters: Filters[] = [];
        if (typeof filters === 'boolean') {
            _filters = !filters ? [] : (Object.keys(AudioFilters.filters) as Filters[]);
        } else if (Array.isArray(filters)) {
            _filters = filters;
        } else {
            _filters = Object.entries(filters)
                .filter((res) => res[1] === true)
                .map((m) => m[0]) as Filters[];
        }

        return this.#setFilters(_filters);
    }

    public get filters() {
        return this.#ffmpegFilters;
    }

    public set filters(filters: Filters[]) {
        this.setFilters(filters);
    }

    public toggle(filters: Filters[] | Filters) {
        if (!Array.isArray(filters)) filters = [filters];
        const fresh: Filters[] = [];

        this.filters.forEach((f) => {
            if (this.filters.includes(f)) return;
            fresh.push(f);
        });

        return this.#setFilters(this.#ffmpegFilters.filter((r) => !filters.includes(r)).concat(fresh));
    }

    public getFiltersEnabled() {
        return this.#ffmpegFilters;
    }

    public getFiltersDisabled() {
        return AudioFilters.names.filter((f) => !this.#ffmpegFilters.includes(f));
    }

    public isEnabled<T extends Filters>(filter: T): boolean {
        return this.#ffmpegFilters.includes(filter);
    }

    public isDisabled<T extends Filters>(filter: T): boolean {
        return !this.isEnabled(filter);
    }

    public isValidFilter(filter: string) {
        return AudioFilters.has(filter as Filters);
    }
}

export interface GuildQueueAFiltersCache {
    equalizer: EqualizerBand[];
    biquad: BiquadFilters | null;
    filters: PCMFilters[];
    volume: number;
    sampleRate: number;
}

export class GuildQueueAudioFilters<Meta = unknown> {
    public graph = new AFilterGraph<Meta>(this);
    public ffmpeg = new FFmpegFilterer<Meta>(this);
    public _lastFiltersCache: GuildQueueAFiltersCache = {
        biquad: null,
        equalizer: [],
        filters: [],
        volume: 100,
        sampleRate: -1
    };
    public constructor(public queue: GuildQueue<Meta>) {
        if (typeof this.queue.options.volume === 'number') {
            this._lastFiltersCache.volume = this.queue.options.volume;
        }
    }

    public get volume() {
        return this.queue.dispatcher?.dsp?.volume || null;
    }

    public get equalizer() {
        return this.queue.dispatcher?.equalizer || null;
    }

    public get biquad() {
        return this.queue.dispatcher?.biquad || null;
    }

    public get filters() {
        return this.queue.dispatcher?.filters || null;
    }

    public get resampler() {
        return this.queue.dispatcher?.resampler || null;
    }

    public async triggerReplay(seek = 0) {
        if (!this.queue.currentTrack) return false;
        try {
            await this.queue.node.play(this.queue.currentTrack, {
                queue: false,
                seek,
                transitionMode: true
            });

            return true;
        } catch {
            return false;
        }
    }
}

export class AFilterGraph<Meta = unknown> {
    public constructor(public af: GuildQueueAudioFilters<Meta>) {}

    public get ffmpeg() {
        return this.af.ffmpeg.filters;
    }

    public get equalizer() {
        return (this.af.equalizer?.bandMultipliers || []).map((m, i) => ({
            band: i,
            gain: m
        })) as EqualizerBand[];
    }

    public get biquad() {
        return null;
        // return (this.af.biquad?.getFilterName() as Exclude<BiquadFilters, number> | null) || null;
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
            sampleRate: this.resampler?.targetSampleRate || this.resampler?.sampleRate || 48000,
            volume: this.volume?.volume ?? 100
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
