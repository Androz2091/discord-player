import { StageChannel, VoiceChannel } from 'discord.js';
import { setTimeout } from 'node:timers/promises';
import { GuildQueue } from '../queue';
import { Playlist, Track, TrackSource } from '../fabric';
import { OutOfSpaceError } from '../errors';
import { randomInt } from 'node:crypto';
import {
  createFilter,
  createSpotifyFilter,
  fixTrackSuffix,
  removeLive,
  removeRemastered,
  youtube,
  removeZeroWidth,
  replaceNbsp,
  replaceSmartQuotes,
  removeCleanExplicit,
} from '@web-scrobbler/metadata-filter';

export type RuntimeType = 'node' | 'deno' | 'bun' | 'unknown';

export interface TimeData {
  /**
   * Time in days
   */
  days: number;
  /**
   * Time in hours
   */
  hours: number;
  /**
   * Time in minutes
   */
  minutes: number;
  /**
   * Time in seconds
   */
  seconds: number;
}

export interface Runtime {
  name: RuntimeType;
  version: string;
}

class Util {
  /**
   * Utils
   */
  private constructor() {} // eslint-disable-line @typescript-eslint/no-empty-function

  /**
   * Gets the runtime information
   */
  static getRuntime(): Runtime {
    const version =
      typeof navigator !== 'undefined' ? navigator.userAgent : null;

    // @ts-ignore
    if (typeof Deno !== 'undefined' && Deno.version) {
      // @ts-ignore
      return { name: 'deno', version: Deno.version.deno };
    }

    // @ts-ignore
    if (typeof Bun !== 'undefined' && Bun.version) {
      // @ts-ignore
      return { name: 'bun', version: Bun.version };
    }

    if (typeof process !== 'undefined' && process.version)
      return { name: 'node', version: process.version };

    return { name: 'unknown', version: version ?? 'unknown' };
  }

  /**
   * Creates duration string
   * @param {object} durObj The duration object
   * @returns {string}
   */
  static durationString(durObj: Record<string, number>) {
    return Object.values(durObj)
      .map((m) => (isNaN(m) ? 0 : m))
      .join(':');
  }

  /**
   * Parses milliseconds to consumable time object
   * @param {number} milliseconds The time in ms
   * @returns {TimeData}
   */
  static parseMS(milliseconds: number) {
    if (isNaN(milliseconds)) milliseconds = 0;
    const round = milliseconds > 0 ? Math.floor : Math.ceil;

    return {
      days: round(milliseconds / 86400000),
      hours: round(milliseconds / 3600000) % 24,
      minutes: round(milliseconds / 60000) % 60,
      seconds: round(milliseconds / 1000) % 60,
    } as TimeData;
  }

  /**
   * Builds time code
   * @param {TimeData} duration The duration object
   * @returns {string}
   */
  static buildTimeCode(duration: TimeData) {
    const items = Object.keys(duration);
    const required = ['days', 'hours', 'minutes', 'seconds'];

    const parsed = items
      .filter((x) => required.includes(x))
      .map((m) => duration[m as keyof TimeData]);
    const final = parsed
      .slice(parsed.findIndex((x) => x !== 0))
      .map((x) => x.toString().padStart(2, '0'))
      .join(':');

    return final.length <= 3 ? `0:${final.padStart(2, '0') || 0}` : final;
  }

  /**
   * Formats duration
   * @param {number} duration The duration in ms
   */
  static formatDuration(duration: number) {
    return this.buildTimeCode(this.parseMS(duration));
  }

  /**
   * Picks last item of the given array
   * @param {any[]} arr The array
   * @returns {any}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static last<T = any>(arr: T[]): T {
    if (!Array.isArray(arr)) return arr;
    return arr[arr.length - 1];
  }

  /**
   * Checks if the voice channel is empty
   * @param {VoiceChannel|StageChannel} channel The voice channel
   * @returns {boolean}
   */
  static isVoiceEmpty(channel: VoiceChannel | StageChannel) {
    return (
      channel && channel.members.filter((member) => !member.user.bot).size === 0
    );
  }

  /**
   * Cleans the track title
   * @param title The title
   * @param source The source
   * @returns Cleaned title
   */
  static cleanTitle(title: string, source: TrackSource) {
    try {
      const filterOpts = {
        // prettier-ignore
        track: [
                    removeRemastered,
                    removeLive,
                    fixTrackSuffix,
                    removeZeroWidth,
                    replaceNbsp,
                    replaceSmartQuotes,
                    removeCleanExplicit
                ],
      };
      const spotifyFilter = createFilter(filterOpts);
      spotifyFilter.extend(createSpotifyFilter());
      const defaultFilter = createFilter(filterOpts);

      switch (source) {
        case 'youtube':
          return youtube(title);
        case 'spotify':
          return spotifyFilter.filterField('track', title);
        default:
          return defaultFilter.filterField('track', title);
      }
    } catch {
      return title;
    }
  }

  /**
   * Safer require
   * @param {string} id Node require id
   * @returns {any}
   */
  static require(id: string) {
    try {
      return { module: require(id), error: null };
    } catch (error) {
      return { module: null, error };
    }
  }

  static async import(id: string) {
    try {
      const mod = await import(id);
      return { module: mod, error: null };
    } catch (error) {
      return { module: null, error };
    }
  }

  /**
   * Asynchronous timeout
   * @param {number} time The time in ms to wait
   * @returns {Promise<unknown>}
   */
  static wait(time: number) {
    return setTimeout(time, undefined, { ref: false });
  }

  static noop() {} // eslint-disable-line @typescript-eslint/no-empty-function

  static async getFetch() {
    if ('fetch' in globalThis) return globalThis.fetch;
    for (const lib of ['node-fetch', 'undici']) {
      try {
        return await import(lib).then(
          (res) => res.fetch || res.default?.fetch || res.default,
        );
      } catch {
        try {
          // eslint-disable-next-line
          const res = require(lib);
          if (res) return res.fetch || res.default?.fetch || res.default;
        } catch {
          // no?
        }
      }
    }
  }

  static warn(message: string, code = 'DeprecationWarning', detail?: string) {
    process.emitWarning(message, {
      code,
      detail,
    });
  }

  static randomChoice<T>(src: T[]): T {
    return src[randomInt(src.length)];
  }

  static arrayCloneShuffle<T>(src: T[]): T[] {
    const arr = src.slice();

    let m = arr.length;

    while (m) {
      const i = Math.floor(Math.random() * m--);
      [arr[m], arr[i]] = [arr[i], arr[m]];
    }

    return arr;
  }
}

export const VALIDATE_QUEUE_CAP = (
  queue: GuildQueue,
  items: Playlist | Track | Track[] | number,
) => {
  if (queue.maxSize < 1 || queue.maxSize === Infinity) return;

  const tracks =
    typeof items === 'number'
      ? items
      : (items instanceof Playlist
          ? items.tracks
          : Array.isArray(items)
          ? items
          : [items]
        ).length;

  const maxCap = queue.getCapacity();

  if (maxCap < tracks) {
    throw new OutOfSpaceError('tracks queue', maxCap, tracks);
  }
};

export { Util };
