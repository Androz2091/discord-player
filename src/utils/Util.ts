import { StageChannel, VoiceChannel } from "discord.js";
import { TimeData } from "../types/types";

class Util {
    /**
     * Utils
     */
    private constructor() {} // eslint-disable-line @typescript-eslint/no-empty-function

    /**
     * Creates duration string
     * @param {object} durObj The duration object
     * @returns {string}
     */
    static durationString(durObj: Record<string, number>) {
        return Object.values(durObj)
            .map((m) => (isNaN(m) ? 0 : m))
            .join(":");
    }

    /**
     * Parses milliseconds to consumable time object
     * @param {number} milliseconds The time in ms
     * @returns {TimeData}
     */
    static parseMS(milliseconds: number) {
        const round = milliseconds > 0 ? Math.floor : Math.ceil;

        return {
            days: round(milliseconds / 86400000),
            hours: round(milliseconds / 3600000) % 24,
            minutes: round(milliseconds / 60000) % 60,
            seconds: round(milliseconds / 1000) % 60
        } as TimeData;
    }

    /**
     * Builds time code
     * @param {TimeData} duration The duration object
     * @returns {string}
     */
    static buildTimeCode(duration: TimeData) {
        const items = Object.keys(duration);
        const required = ["days", "hours", "minutes", "seconds"];

        const parsed = items.filter((x) => required.includes(x)).map((m) => duration[m as keyof TimeData]);
        const final = parsed
            .slice(parsed.findIndex((x) => x !== 0))
            .map((x) => x.toString().padStart(2, "0"))
            .join(":");

        return final.length <= 3 ? `0:${final.padStart(2, "0") || 0}` : final;
    }

    /**
     * Picks last item of the given array
     * @param {any[]} arr The array
     * @returns {any}
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static last<T = any>(arr: T[]): T {
        if (!Array.isArray(arr)) return;
        return arr[arr.length - 1];
    }

    /**
     * Checks if the voice channel is empty
     * @param {VoiceChannel|StageChannel} channel The voice channel
     * @returns {boolean}
     */
    static isVoiceEmpty(channel: VoiceChannel | StageChannel) {
        return channel.members.filter((member) => !member.user.bot).size === 0;
    }

    /**
     * Safer require
     * @param {string} id Node require id
     * @returns {any}
     */
    static require(id: string) {
        try {
            return require(id);
        } catch {
            return null;
        }
    }

    /**
     * Asynchronous timeout
     * @param {number} time The time in ms to wait
     * @returns {Promise<unknown>}
     */
    static wait(time: number) {
        return new Promise((r) => setTimeout(r, time).unref());
    }

    static noop() {} // eslint-disable-line @typescript-eslint/no-empty-function
}

export { Util };
