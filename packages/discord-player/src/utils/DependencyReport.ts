import { resolve, dirname } from 'node:path';
import { FFmpeg, FFmpegLib } from '@discord-player/ffmpeg';

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
        tweetnacl: MaybeNull<string>;
        'sodium-javascript': MaybeNull<string>;
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
export const DependencyReport = {
    /**
     * Finds the package.json file of a package.
     * @param dir - The directory to start searching from
     * @param packageName - The name of the package to find
     * @param depth - The maximum depth to search
     * @returns The package.json file, or null if not found
     */
    findPackageJSON(dir: string, packageName: string, depth: number): PackageJSON | null {
        if (depth === 0) return null;

        const target = resolve(dir, 'package.json');

        const next = () => DependencyReport.findPackageJSON(resolve(dir, '..'), packageName, depth - 1);

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
                return '[VI]{{inject}}[/VI]';
            }

            const pkg = DependencyReport.findPackageJSON(dirname(require.resolve(name)), name, maxLookupDepth);
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
                'discord-player': DependencyReport.version('discord-player') as string,
                'discord-voip': DependencyReport.version('discord-voip') as string,
            },
            libopus: {
                mediaplex: DependencyReport.version('mediaplex'),
                '@discordjs/opus': DependencyReport.version('@discordjs/opus'),
                '@evan/opus': DependencyReport.version('@evan/opus'),
                opusscript: DependencyReport.version('opusscript'),
                'node-opus': DependencyReport.version('node-opus'),
            },
            libsodium: {
                'sodium-native': DependencyReport.version('sodium-native'),
                sodium: DependencyReport.version('sodium'),
                'libsodium-wrappers': DependencyReport.version('libsodium-wrappers'),
                tweetnacl: DependencyReport.version('tweetnacl'),
                'sodium-javascript': DependencyReport.version('sodium-javascript'),
            },
            ffmpeg: ffmpegReport,
        };
    },
    /**
     * Generates a string representation of the dependencies report.
     * @returns The string representation
     */
    generateString(): string {
        const report = DependencyReport.generate();
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

                output.push(`- ${subKey}: ${report[key][subKey] ?? 'N/A'}`);
            }

            output.push('');
        }

        output.push(line);

        return output.join('\n');
    },
};
