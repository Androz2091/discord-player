import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute repository root. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Directory read by the Next.js docs app. Ignored by git. */
export const OUTPUT_DIR = join(REPO_ROOT, 'apps', 'website', '.generated', 'api');

/** Intermediate TypeDoc JSON, kept for debugging and for the normalizer. */
export const RAW_DIR = join(OUTPUT_DIR, 'raw');

/** GitHub repository used for pinned source links. */
export const GITHUB = { owner: 'Androz2091', repo: 'discord-player' } as const;

/** URL prefix of generated pages below the site root. */
export const API_ROUTE = ['docs', 'v8', 'api'] as const;

/** Content-relative directory of generated pages. */
export const API_CONTENT_DIR = 'api';

/**
 * Exact TypeDoc version. The JSON schema and ReflectionKind numbering are validated against it at
 * run time, so upgrading TypeDoc is a deliberate change in this file.
 */
export const TYPEDOC_VERSION = '0.28.20';

/** TypeDoc JSON `schemaVersion` the normalizer understands. */
export const TYPEDOC_SCHEMA_VERSION = '2.0';

/** One export subpath of a published npm package. */
export interface TypeScriptEntryConfig {
  /** Export subpath from package.json, or a descriptive subpath for generated declarations. */
  subpath: string;
  /** Source file relative to the package directory. */
  file: string;
  /** URL segment appended after the package slug; empty for the primary entry. */
  slug: string;
  title: string;
  description: string;
  /** True for generated declarations that are not a published export subpath. */
  generated?: boolean;
}

/** Public TypeScript package. */
export interface TypeScriptPackageConfig {
  name: string;
  slug: string;
  directory: string;
  entries: TypeScriptEntryConfig[];
}

/** Packages documented with TypeDoc. Entry points mirror the published packages. */
export const TYPESCRIPT_PACKAGES: TypeScriptPackageConfig[] = [
  {
    name: 'discord-player',
    slug: 'discord-player',
    directory: 'packages/discord-player',
    entries: [
      {
        subpath: '.',
        file: 'src/index.ts',
        slug: '',
        title: 'discord-player',
        description: 'Tracks, queues, search, plugins, and Discord playback orchestration.',
      },
    ],
  },
  {
    name: '@discord-player/plugin-host',
    slug: 'plugin-host',
    directory: 'packages/plugin-host',
    entries: [
      {
        subpath: '.',
        file: 'src/index.ts',
        slug: '',
        title: '@discord-player/plugin-host',
        description: 'Standalone source runtime and Remedia plugin protocol adapter.',
      },
    ],
  },
];
