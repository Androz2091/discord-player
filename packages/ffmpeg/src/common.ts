export type FFmpegLib =
  | 'ffmpeg'
  | './ffmpeg'
  | 'avconv'
  | './avconv'
  | 'ffmpeg-static'
  | '@ffmpeg-installer/ffmpeg'
  | '@node-ffmpeg/node-ffmpeg-installer'
  | 'ffmpeg-binaries';

export type FFmpegCallback<Args extends Array<unknown>> = (
  ...args: Args
) => unknown;

/**
 * FFmpeg source configuration
 */
export interface FFmpegSource {
  /** Name or path of the FFmpeg executable */
  name: FFmpegLib;
  /** Whether this source is a Node.js module */
  module: boolean;
}

export interface ResolvedFFmpegSource extends FFmpegSource {
  path: string;
  version: string;
  command: string;
  result: string;
}

/**
 * Compares and updates FFmpeg flags as needed
 * @param oldFlags The old flags
 * @param newFlags The new flags
 * @returns The updated flags
 */
export function changeFFmpegFlags(oldFlags: string[], newFlags: string[]) {
  const updatedFlags = [...oldFlags];

  for (let i = 0; i < newFlags.length; i++) {
    const key = newFlags[i];
    const value = newFlags[i + 1];

    const oldIndex = updatedFlags.indexOf(key);

    if (oldIndex !== -1) {
      if (value && !value.startsWith('-')) {
        updatedFlags[oldIndex + 1] = value;
        i++;
      } else {
        updatedFlags.splice(oldIndex, 1);
      }
    } else {
      if (value && !value.startsWith('-')) {
        updatedFlags.push(key, value);
        i++;
      } else {
        updatedFlags.push(key);
      }
    }
  }

  return updatedFlags;
}
