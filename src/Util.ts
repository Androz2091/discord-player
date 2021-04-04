import { PlayerOptions } from "./types/Player";
import { FFmpeg } from "prism-media";

export default class Util {

    constructor() {
        throw new Error(`The ${this.constructor.name} class is static and cannot be instantiated!`);
    }

    static get DefaultPlayerOptions() {
        return {
            leaveOnEnd: true,
            leaveOnStop: true,
            leaveOnEmpty: true,
            leaveOnEmptyCooldown: 0,
            autoSelfDeaf: true,
            enableLive: false,
            ytdlDownloadOptions: {}
        } as PlayerOptions;
    }

    static checkFFmpeg(force?: boolean) {
        try {
            FFmpeg.getInfo(Boolean(force));

            return true;
        } catch {
            return false;
        }
    }

    static alertFFmpeg() {
        const hasFFmpeg = Util.checkFFmpeg();

        if (!hasFFmpeg) console.warn("[Discord Player] FFmpeg/Avconv not found! Install via \"npm install ffmpeg-static\" or download from https://ffmpeg.org/download.html");
    }

}