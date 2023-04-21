import childProcess from 'child_process';
import { Util } from './Util';

export interface FFmpegInfo {
    command: string | null;
    metadata: string | null;
    isStatic: boolean;
}

const ffmpegInfo: FFmpegInfo = {
    command: null,
    metadata: null,
    isStatic: false
};
const FFmpegPossibleLocations = [
    'ffmpeg',
    'avconv',
    './ffmpeg',
    './avconv',
    () => {
        // @ts-expect-error no-module-found
        return import('ffmpeg-static').then((mod) => <string>(mod.default?.path || mod.path || mod)).catch(() => null);
    }
];

export class FFmpeg {
    public static async locate(force = false) {
        if (ffmpegInfo.command && !force) return ffmpegInfo;

        for (const locator of FFmpegPossibleLocations) {
            try {
                const command = typeof locator === 'function' ? await locator() : locator;
                if (!command) continue;

                const { error, output } = childProcess.spawnSync(command, ['-h'], {
                    windowsHide: true
                });

                if (error) continue;

                ffmpegInfo.command = command;
                ffmpegInfo.metadata = Buffer.concat(output.filter(Boolean) as Buffer[]).toString('utf-8');
                ffmpegInfo.isStatic = typeof locator === 'function';

                if (ffmpegInfo.isStatic) {
                    Util.warn('Found ffmpeg-static which is known to be unstable.', 'FFmpegStaticWarning');
                }

                return ffmpegInfo;
            } catch {
                //
            }

            throw new Error(['Could not locate ffmpeg. Tried:\n', ...FFmpegPossibleLocations.filter((f) => typeof f === 'string').map((m) => `- spawn ${m}`), '- ffmpeg-static'].join('\n'));
        }
    }
}
