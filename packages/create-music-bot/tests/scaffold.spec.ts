import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REMEDIA_NODE_VERSION,
  TEMPLATES,
  detectPackageManager,
  findConflicts,
  getProjectCommands,
  renderProject,
  resolveDiscordPlayerVersion,
  resolveTarget,
  validateProjectName,
  writeProject,
} from '../src/scaffold.js';
import { makeTempDir, templatesDir } from './helpers.js';

function render(template: (typeof TEMPLATES)[number], packageManager: 'npm' | 'pnpm' = 'npm') {
  return renderProject({
    templatesDir,
    template,
    name: 'my-bot',
    discordPlayerVersion: '8.0.0-dev.3',
    packageManager,
  });
}

describe('validateProjectName', () => {
  it.each(['my-bot', 'bot', 'music.bot', 'bot_2', '3d-bot'])('accepts %s', (name) => {
    expect(validateProjectName(name)).toBeUndefined();
  });

  it.each([
    ['', 'Enter a project name.'],
    ['My Bot', 'lowercase'],
    ['MyBot', 'lowercase'],
    ['.hidden', 'lowercase'],
    ['_private', 'lowercase'],
    ['@scope/bot', 'lowercase'],
    ['bot/name', 'lowercase'],
    ['discord-player', 'dependency'],
    ['discord.js', 'dependency'],
    ['typescript', 'dependency'],
    ['a'.repeat(215), '214'],
  ])('rejects %j', (name, message) => {
    expect(validateProjectName(name)).toContain(message);
  });
});

describe('resolveDiscordPlayerVersion', () => {
  it.each(['8.0.0', '8.0.0-dev.2', '8.1.0-beta.1', '8.0.0-rc.4', '9.0.0'])('uses %s as-is', (version) => {
    expect(resolveDiscordPlayerVersion(version)).toBe(version);
  });

  it.each(['0.0.0', '7.2.0', '7.0.0-dev.1', 'latest', '8.0.0-alpha.1', '8.0.0-dev', ''])('rejects %j', (version) => {
    expect(() => resolveDiscordPlayerVersion(version)).toThrow('npm create music-bot@dev');
  });
});

describe('detectPackageManager', () => {
  it.each([
    ['npm/11.0.0 node/v22.18.0 linux x64', 'npm'],
    ['pnpm/10.2.0 npm/? node/v22.18.0 darwin arm64', 'pnpm'],
    ['yarn/4.1.0 npm/? node/v22.18.0', 'yarn'],
    ['bun/1.2.0 npm/? node/v22.18.0', 'bun'],
    ['deno/2.0.0', 'npm'],
    [undefined, 'npm'],
  ] as const)('reads %j as %s', (agent, expected) => {
    expect(detectPackageManager(agent)).toBe(expected);
  });

  it('gives each manager its own commands', () => {
    expect(getProjectCommands('pnpm').dev).toBe('pnpm dev');
    expect(getProjectCommands('yarn').install).toBe('yarn');
    expect(getProjectCommands('npm').dev).toBe('npm run dev');
  });
});

describe('resolveTarget', () => {
  it('names the project after the last path segment', () => {
    expect(resolveTarget('apps/my-bot', '/work')).toEqual({ directory: '/work/apps/my-bot', name: 'my-bot' });
    expect(resolveTarget('.', '/work/my-bot')).toEqual({ directory: '/work/my-bot', name: 'my-bot' });
  });
});

describe('generated package.json', () => {
  it.each(TEMPLATES)('%s pins released versions of every dependency', (template) => {
    const manifest = JSON.parse(render(template).files.get('package.json') ?? '');

    expect(manifest).toMatchObject({
      name: 'my-bot',
      private: true,
      type: 'module',
      engines: { node: '>=22.18.0' },
      dependencies: { 'discord-player': '8.0.0-dev.3', '@remedia/node': REMEDIA_NODE_VERSION },
    });

    for (const field of ['dependencies', 'devDependencies'] as const) {
      for (const [name, specifier] of Object.entries<string>(manifest[field] ?? {})) {
        expect(specifier, name).not.toMatch(/^(workspace|catalog|link|file):|^latest$|^\*$/);
      }
    }
  });

  it('adds TypeScript tooling only to the TypeScript project', () => {
    const ts = JSON.parse(render('ts').files.get('package.json') ?? '');
    const js = JSON.parse(render('js').files.get('package.json') ?? '');

    expect(ts.devDependencies).toHaveProperty('typescript');
    expect(ts.scripts).toMatchObject({
      start: 'node --env-file-if-exists=.env src/index.ts',
      typecheck: 'tsc --noEmit',
    });
    expect(js.devDependencies).toBeUndefined();
    expect(js.scripts).toEqual({
      start: 'node --env-file-if-exists=.env src/index.js',
      dev: 'node --watch --env-file-if-exists=.env src/index.js',
    });
  });

  it('pins @remedia/node to the version @remedia/client declares as its peer', () => {
    const client = JSON.parse(
      readFileSync(join(templatesDir, '../node_modules/@remedia/client/package.json'), 'utf8'),
    ) as { peerDependencies: Record<string, string> };

    expect(client.peerDependencies['@remedia/node']).toBe(REMEDIA_NODE_VERSION);
  });
});

describe('rendered files', () => {
  it('contains the expected project files', () => {
    expect([...render('ts').files.keys()].sort()).toEqual([
      '.env.example',
      '.gitignore',
      'README.md',
      'package.json',
      'src/bot.ts',
      'src/commands.ts',
      'src/config.ts',
      'src/events.ts',
      'src/index.ts',
      'src/media-source.ts',
      'tsconfig.json',
    ]);

    expect([...render('js').files.keys()].sort()).toEqual([
      '.env.example',
      '.gitignore',
      'README.md',
      'package.json',
      'src/bot.js',
      'src/commands.js',
      'src/config.js',
      'src/events.js',
      'src/index.js',
      'src/media-source.js',
    ]);
  });

  it.each(TEMPLATES)('%s keeps secrets out of version control', (template) => {
    const files = render(template).files;

    expect(files.get('.gitignore')).toContain('.env');
    expect(files.get('.gitignore')).toContain('node_modules');
    expect(files.get('.env.example')).toMatch(/^DISCORD_TOKEN=$/m);
    expect(files.has('_gitignore')).toBe(false);
  });

  it('fills the README with the project name and package manager commands', () => {
    const readme = render('ts', 'pnpm').files.get('README.md') ?? '';

    expect(readme).toContain('# my-bot');
    expect(readme).toContain('pnpm install\npnpm dev');
    expect(readme).toContain('pnpm typecheck');
    expect(readme).not.toContain('{{');
    expect(render('js').files.get('README.md')).not.toContain('typecheck');
  });

  it('keeps both templates equivalent', () => {
    const ts = render('ts').files;
    const js = render('js').files;
    const commandNames = (source: string) =>
      [...source.matchAll(/(?:simple\(\s*|data: \{\s*name: )'([a-z]+)'/g)].map((match) => match[1]).sort();
    const listeners = (source: string, receiver: string) =>
      [...source.matchAll(new RegExp(`${receiver}\\.on\\('(\\w+)'`, 'g'))].map((match) => match[1]);

    expect(commandNames(ts.get('src/commands.ts') ?? '')).toEqual(['pause', 'play', 'queue', 'resume', 'skip', 'stop']);
    expect(commandNames(js.get('src/commands.js') ?? '')).toEqual(commandNames(ts.get('src/commands.ts') ?? ''));
    expect(listeners(js.get('src/events.js') ?? '', 'player.events')).toEqual(
      listeners(ts.get('src/events.ts') ?? '', 'player.events'),
    );
    expect(listeners(js.get('src/media-source.js') ?? '', 'ctx')).toEqual(
      listeners(ts.get('src/media-source.ts') ?? '', 'ctx'),
    );
    expect(js.get('.env.example')).toBe(ts.get('.env.example'));
  });
});

describe('writing a project', () => {
  it('creates the directory and every file', () => {
    const directory = join(makeTempDir(), 'nested', 'my-bot');
    const project = render('ts');

    expect(findConflicts(directory, project)).toEqual([]);

    const written = writeProject(directory, project, false);

    expect(written).toHaveLength(project.files.size);
    expect(readFileSync(join(directory, 'src/index.ts'), 'utf8')).toBe(project.files.get('src/index.ts'));
  });

  it('refuses to replace existing files unless asked', () => {
    const directory = makeTempDir();
    const project = render('js');

    writeFileSync(join(directory, 'package.json'), 'mine');
    mkdirSync(join(directory, 'notes'));
    writeFileSync(join(directory, 'notes', 'todo.txt'), 'keep');

    expect(findConflicts(directory, project)).toEqual(['package.json']);
    expect(() => writeProject(directory, project, false)).toThrow(/EEXIST/);
    expect(readFileSync(join(directory, 'package.json'), 'utf8')).toBe('mine');
  });

  it('replaces only the conflicting files when overwriting', () => {
    const directory = makeTempDir();
    const project = render('js');

    writeFileSync(join(directory, 'package.json'), 'mine');
    writeFileSync(join(directory, 'unrelated.txt'), 'keep');

    writeProject(directory, project, true);

    expect(readFileSync(join(directory, 'package.json'), 'utf8')).toBe(project.files.get('package.json'));
    expect(readFileSync(join(directory, 'unrelated.txt'), 'utf8')).toBe('keep');
  });

  it('rejects a destination that is a file', () => {
    const file = join(makeTempDir(), 'file');

    writeFileSync(file, 'x');

    expect(() => findConflicts(file, render('js'))).toThrow('not a directory');
    expect(() => writeProject(file, render('js'), true)).toThrow('not a directory');
    expect(existsSync(join(file, 'package.json'))).toBe(false);
  });
});
