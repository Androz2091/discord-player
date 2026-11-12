import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix, resolve } from 'node:path';

/** Languages a project can be generated in. */
export const TEMPLATES = ['ts', 'js'] as const;

/** A language a project can be generated in. */
export type Template = (typeof TEMPLATES)[number];

/** Package managers whose commands the generated README and next steps can show. */
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;

/** A supported package manager. */
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/**
 * The `@remedia/node` release that Discord Player's Remedia client is built and tested against.
 * `@remedia/client` declares this exact version as its peer dependency, so update it with `@remedia/client`.
 */
export const REMEDIA_NODE_VERSION = '0.1.0-dev.7';

const DISCORD_JS_VERSION = '^14.28.1';
const NODE_TYPES_VERSION = '^22.20.5';
const TYPESCRIPT_VERSION = '^7.0.2';

/** Names that would collide with a dependency of the generated project. */
const RESERVED_NAMES = ['discord-player', 'discord.js', 'typescript'];

/** Files stored under another name because npm never publishes a file called `.gitignore`. */
const RENAMED_FILES: Record<string, string> = { _gitignore: '.gitignore' };

/** Shell commands a project uses, in the syntax of one package manager. */
export interface ProjectCommands {
  /** Installs dependencies. */
  install: string;

  /** Starts the bot and restarts it when files change. */
  dev: string;

  /** Starts the bot. */
  start: string;

  /** Type-checks the project. */
  typecheck: string;
}

/** A project that has been rendered in memory but not yet written. */
export interface ProjectFiles {
  /** File contents keyed by path relative to the project directory, using forward slashes. */
  files: Map<string, string>;
}

/**
 * Checks a project name.
 *
 * @param name Name that will become the `name` field in `package.json`.
 * @returns A message describing the problem, or `undefined` when the name is valid.
 */
export function validateProjectName(name: string): string | undefined {
  if (name.length === 0) return 'Enter a project name.';

  if (name.length > 214) return 'The name must be 214 characters or fewer.';

  if (!/^[a-z0-9][a-z0-9._~-]*$/.test(name)) {
    return 'Use lowercase letters, numbers, "-", "." and "_" only, starting with a letter or number.';
  }

  if (RESERVED_NAMES.includes(name)) return `"${name}" is the name of a dependency. Choose a different name.`;

  return undefined;
}

/**
 * Finds the package manager that started the generator.
 *
 * @param userAgent Value of `npm_config_user_agent`, which package managers set for `create` commands.
 * @returns The detected package manager, or `npm` when none can be identified.
 */
export function detectPackageManager(userAgent: string | undefined): PackageManager {
  const name = userAgent?.split(' ')[0]?.split('/')[0];

  return PACKAGE_MANAGERS.find((manager) => manager === name) ?? 'npm';
}

/**
 * Returns the commands for a package manager.
 *
 * @param manager Package manager to use.
 */
export function getProjectCommands(manager: PackageManager): ProjectCommands {
  switch (manager) {
    case 'npm':
      return { install: 'npm install', dev: 'npm run dev', start: 'npm start', typecheck: 'npm run typecheck' };
    case 'pnpm':
      return { install: 'pnpm install', dev: 'pnpm dev', start: 'pnpm start', typecheck: 'pnpm typecheck' };
    case 'yarn':
      return { install: 'yarn', dev: 'yarn dev', start: 'yarn start', typecheck: 'yarn typecheck' };
    case 'bun':
      return { install: 'bun install', dev: 'bun run dev', start: 'bun run start', typecheck: 'bun run typecheck' };
  }
}

/**
 * Validates the generator's own version and returns it as the Discord Player version to install.
 *
 * Generator and Discord Player releases share one version, so a prerelease generator installs the matching
 * prerelease. Installing an exact version also keeps npm from resolving the v7 `latest` tag.
 *
 * @param version Version from the generator's `package.json`.
 * @throws When the version is not a v8 or later release version.
 */
export function resolveDiscordPlayerVersion(version: string): string {
  const match = /^(\d+)\.\d+\.\d+(?:-(?:dev|beta|rc)\.\d+)?$/.exec(version);

  if (!match || Number(match[1]) < 8) {
    throw new Error(
      `create-music-bot ${version} is not a release build, so it cannot choose a Discord Player version. ` +
        'Install it from npm instead: npm create music-bot@dev',
    );
  }

  return version;
}

/**
 * Resolves the directory argument against the working directory.
 *
 * @param target Directory path or project name given by the user.
 * @param cwd Directory the generator was started from.
 * @returns The absolute directory and the project name, which is the directory's last path segment.
 */
export function resolveTarget(target: string, cwd: string = process.cwd()): { directory: string; name: string } {
  const directory = resolve(cwd, target);

  return { directory, name: basename(directory) };
}

/**
 * Renders a project in memory.
 *
 * @param options.templatesDir Directory that contains the `js` and `ts` template folders.
 * @param options.template Language to generate.
 * @param options.name Project name.
 * @param options.discordPlayerVersion Exact Discord Player version to depend on.
 * @param options.packageManager Package manager used in the README.
 */
export function renderProject(options: {
  templatesDir: string;
  template: Template;
  name: string;
  discordPlayerVersion: string;
  packageManager: PackageManager;
}): ProjectFiles {
  const { templatesDir, template, name, discordPlayerVersion, packageManager } = options;
  const commands = getProjectCommands(packageManager);
  const tokens: Record<string, string> = { name, ...commands };
  const files = new Map<string, string>();

  for (const path of listFiles(join(templatesDir, template))) {
    const contents = readFileSync(join(templatesDir, template, path), 'utf8');
    const fileName = posix.basename(path);
    const outputPath = posix.join(posix.dirname(path), RENAMED_FILES[fileName] ?? fileName);

    files.set(
      outputPath,
      path === 'README.md' ? contents.replace(/\{\{(\w+)\}\}/g, (_, token: string) => tokens[token] ?? '') : contents,
    );
  }

  files.set('package.json', renderPackageJson(template, name, discordPlayerVersion));

  return { files };
}

/**
 * Lists the files that already exist at the paths a project would write.
 *
 * @param directory Project directory.
 * @param project Rendered project.
 * @returns Relative paths that would be overwritten.
 * @throws When the directory path exists but is not a directory.
 */
export function findConflicts(directory: string, project: ProjectFiles): string[] {
  if (existsSync(directory) && !statSync(directory).isDirectory()) {
    throw new Error(`${directory} already exists and is not a directory.`);
  }

  return [...project.files.keys()].filter((path) => existsSync(join(directory, path))).sort();
}

/**
 * Writes a rendered project to disk.
 *
 * Existing files are replaced only when `overwrite` is true. Otherwise writing fails rather than replacing a file
 * that appeared after conflicts were checked.
 *
 * @param directory Project directory, created when missing.
 * @param project Rendered project.
 * @param overwrite Whether existing files may be replaced.
 * @returns Relative paths that were written.
 */
export function writeProject(directory: string, project: ProjectFiles, overwrite: boolean): string[] {
  if (existsSync(directory) && !statSync(directory).isDirectory()) {
    throw new Error(`${directory} already exists and is not a directory.`);
  }

  const written: string[] = [];

  for (const [path, contents] of project.files) {
    const target = join(directory, path);

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents, { flag: overwrite ? 'w' : 'wx' });
    written.push(path);
  }

  return written;
}

function renderPackageJson(template: Template, name: string, discordPlayerVersion: string): string {
  const entry = template === 'ts' ? 'src/index.ts' : 'src/index.js';
  const scripts: Record<string, string> = {
    start: `node --env-file-if-exists=.env ${entry}`,
    dev: `node --watch --env-file-if-exists=.env ${entry}`,
  };

  if (template === 'ts') scripts.typecheck = 'tsc --noEmit';

  const manifest = {
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts,
    engines: { node: '>=22.18.0' },
    dependencies: {
      '@remedia/node': REMEDIA_NODE_VERSION,
      'discord-player': discordPlayerVersion,
      'discord.js': DISCORD_JS_VERSION,
    },
    ...(template === 'ts'
      ? { devDependencies: { '@types/node': NODE_TYPES_VERSION, typescript: TYPESCRIPT_VERSION } }
      : {}),
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function listFiles(root: string, prefix = ''): string[] {
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;

      return entry.isDirectory() ? listFiles(root, path) : [path];
    })
    .sort();
}
