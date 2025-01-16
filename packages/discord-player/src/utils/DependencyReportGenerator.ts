import { resolve, dirname } from 'node:path';
import { FFmpeg, FFmpegLib } from '@discord-player/ffmpeg';
import { version } from '../version';

export interface PackageJSON {
  name: string;
  version: string;
}

export type MaybeNull<T> = T | null;

export interface DependenciesReport {
  core: {
    'discord-player': string;
    'discord-voip': string;
  };
  libopus: {
    mediaplex: MaybeNull<string>;
    '@discordjs/opus': MaybeNull<string>;
    '@evan/opus': MaybeNull<string>;
    opusscript: MaybeNull<string>;
    'node-opus': MaybeNull<string>;
  };
  libsodium: {
    'sodium-native': MaybeNull<string>;
    sodium: MaybeNull<string>;
    'libsodium-wrappers': MaybeNull<string>;
    'sodium-javascript': MaybeNull<string>;
    '@stablelib/xchacha20poly1305': MaybeNull<string>;
    '@nobel/ciphers': MaybeNull<string>;
  };
  ffmpeg: FFmpegReport;
}

export type FFmpegReport = Record<
  FFmpegLib,
  MaybeNull<{
    version: string;
    hasLibopus: boolean;
  }>
>;

/**
 * A utility to generate a report of the dependencies used by the discord-player module.
 */
export const DependencyReportGenerator = {
  /**
   * Finds the package.json file of a package.
   * @param dir - The directory to start searching from
   * @param packageName - The name of the package to find
   * @param depth - The maximum depth to search
   * @returns The package.json file, or null if not found
   */
  findPackageJSON(
    dir: string,
    packageName: string,
    depth: number,
  ): PackageJSON | null {
    if (depth === 0) return null;

    const target = resolve(dir, 'package.json');

    const next = () =>
      DependencyReportGenerator.findPackageJSON(
        resolve(dir, '..'),
        packageName,
        depth - 1,
      );

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkgJSON: PackageJSON = require(target);

      if (pkgJSON.name !== packageName) {
        return next();
      }

      return pkgJSON;
    } catch {
      return next();
    }
  },
  /**
   * Tries to find the version of a dependency.
   * @param name - The package to find the version of
   * @param maxLookupDepth - The maximum depth to search for the package.json file
   * @returns The version of the package, or null if not found
   */
  version(name: string, maxLookupDepth = 3): string | null {
    try {
      if (name === 'discord-player') {
        return version;
      }

      const pkg = DependencyReportGenerator.findPackageJSON(
        dirname(require.resolve(name)),
        name,
        maxLookupDepth,
      );
      return pkg?.version ?? null;
    } catch {
      return null;
    }
  },
  /**
   * Generates a report of the dependencies used by the discord-player module.
   * @returns The report object
   */
  generate(): DependenciesReport {
    const ffmpegReport = {} as FFmpegReport;

    for (const lib of FFmpeg.sources) {
      ffmpegReport[lib.name] = null;
    }

    const ffmpeg = FFmpeg.resolveSafe();

    if (ffmpeg) {
      ffmpegReport[ffmpeg.name] = {
        hasLibopus: ffmpeg.command.includes('--enable-libopus'),
        version: ffmpeg.version,
      };
    }

    return {
      core: {
        'discord-player': DependencyReportGenerator.version(
          'discord-player',
        ) as string,
        'discord-voip': DependencyReportGenerator.version(
          'discord-voip',
        ) as string,
      },
      libopus: {
        mediaplex: DependencyReportGenerator.version('mediaplex'),
        '@discordjs/opus': DependencyReportGenerator.version('@discordjs/opus'),
        '@evan/opus': DependencyReportGenerator.version('@evan/opus'),
        opusscript: DependencyReportGenerator.version('opusscript'),
        'node-opus': DependencyReportGenerator.version('node-opus'),
      },
      libsodium: {
        'sodium-native': DependencyReportGenerator.version('sodium-native'),
        sodium: DependencyReportGenerator.version('sodium'),
        'libsodium-wrappers':
          DependencyReportGenerator.version('libsodium-wrappers'),
        '@stablelib/xchacha20poly1305': DependencyReportGenerator.version(
          '@stablelib/xchacha20poly1305',
        ),
        'sodium-javascript':
          DependencyReportGenerator.version('sodium-javascript'),
        '@nobel/ciphers': DependencyReportGenerator.version('@nobel/ciphers'),
      },
      ffmpeg: ffmpegReport,
    };
  },
  /**
   * Generates a string representation of the dependencies report.
   * @returns The string representation
   */
  generateString(): string {
    const report = DependencyReportGenerator.generate();
    const line = '-'.repeat(50);

    const output: string[] = [];

    output.push('Dependencies Report');
    output.push(line);

    const keys = Object.keys(report) as (keyof DependenciesReport)[];

    for (const _key of keys) {
      const key = _key as keyof DependenciesReport;

      output.push(key);

      const subKeys = Object.keys(report[key]);

      for (const _subKey of subKeys) {
        const subKey = _subKey as keyof DependenciesReport[typeof key];
        const value = report[key][subKey] ?? 'N/A';

        output.push(
          `- ${subKey}: ${
            typeof value === 'object' ? JSON.stringify(value, null, 2) : value
          }`,
        );
      }

      output.push('');
    }

    output.push(line);

    return output.join('\n');
  },
};
