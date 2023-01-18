import AudioFilters from '../../utils/AudioFilters';
import { GuildQueue } from './GuildQueue';
import { BiquadFilters, EqualizerBand } from '@discord-player/equalizer';

type Filters = keyof typeof AudioFilters.filters;

export class GuildQueueAudioFilters {
    #ffmpegFilters: Filters[] = [];
    public constructor(public queue: GuildQueue) {}

    public get ffmpeg() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        return {
            setFilters(filters: Filters[] | Record<Filters, boolean> | boolean) {
                if (typeof filters === 'boolean') {
                    if (!filters) self.#ffmpegFilters = [];
                } else if (Array.isArray(filters)) {
                    self.#ffmpegFilters = filters;
                } else {
                    self.#ffmpegFilters = Object.entries(filters)
                        .filter((res) => res[1] === true)
                        .map((m) => m[0]) as Filters[];
                }

                return self.#ffmpegFilters;
            },
            get filters() {
                return self.#ffmpegFilters;
            }
        };
    }

    public get equalizer() {
        return this.queue.dispatcher?.equalizer || null;
    }

    public get biquad() {
        return this.queue.dispatcher?.biquad || null;
    }

    public get filters() {
        return this.queue.dispatcher?.audioFilters || null;
    }

    public dump() {
        return {
            ffmpeg: this.#ffmpegFilters,
            equalizer: (this.equalizer?.bandMultipliers || []).map((m, i) => ({
                band: i,
                gain: m
            })) as EqualizerBand[],
            biquad: (this.biquad?.getFilterName() as Exclude<BiquadFilters, number> | null) || null,
            filters: this.filters?.filters || null
        };
    }
}
