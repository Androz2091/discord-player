import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createGeneratorFixture, makeTempDir, packageRoot, runCli, writeFile } from './helpers.js';

let cli: string;

beforeAll(() => {
  if (!existsSync(join(packageRoot, 'dist', 'cli.js'))) throw new Error('Run "pnpm build" before the CLI tests.');

  cli = createGeneratorFixture('8.0.0-dev.3');
});

describe('create-music-bot CLI', () => {
  it('prints help and the version', async () => {
    const cwd = makeTempDir();
    const help = await runCli(cli, ['--help'], { cwd });
    const version = await runCli(cli, ['--version'], { cwd });

    expect(help.code).toBe(0);
    expect(help.stdout).toContain('npm create music-bot@dev');
    expect(help.stdout).toContain('--template');
    expect(version.stdout.trim()).toBe('8.0.0-dev.3');
    expect(readdirSync(cwd)).toEqual([]);
  });

  it.each([
    ['ts', 'src/index.ts', 'tsconfig.json'],
    ['js', 'src/index.js', undefined],
  ] as const)('generates the %s template without prompting', async (template, entry, tsconfig) => {
    const cwd = makeTempDir();
    const result = await runCli(cli, ['my-bot', '--template', template], { cwd });
    const project = join(cwd, 'my-bot');

    expect(result.code, result.stderr).toBe(0);
    expect(existsSync(join(project, entry))).toBe(true);
    expect(existsSync(join(project, 'tsconfig.json'))).toBe(tsconfig !== undefined);
    expect(JSON.parse(readFileSync(join(project, 'package.json'), 'utf8')).dependencies['discord-player']).toBe(
      '8.0.0-dev.3',
    );
    expect(result.stdout).toContain('cd my-bot');
    expect(result.stdout).toContain('npm run dev');
    expect(result.stdout).toContain('FFmpeg 9');
  });

  it('defaults to TypeScript and does not install unless asked', async () => {
    const cwd = makeTempDir();
    const result = await runCli(cli, ['my-bot'], { cwd });

    expect(result.code, result.stderr).toBe(0);
    expect(existsSync(join(cwd, 'my-bot', 'src', 'index.ts'))).toBe(true);
    expect(existsSync(join(cwd, 'my-bot', 'node_modules'))).toBe(false);
    expect(result.stdout).toContain('npm install');
  });

  it('shows the commands of the package manager that started it', async () => {
    const result = await runCli(cli, ['my-bot'], {
      cwd: makeTempDir(),
      env: { npm_config_user_agent: 'pnpm/10.0.0 npm/? node/v22.18.0' },
    });

    expect(result.stdout).toContain('pnpm install');
    expect(result.stdout).toContain('pnpm dev');
  });

  it('generates into the current directory when given "."', async () => {
    const cwd = join(makeTempDir(), 'current-bot');

    mkdirSync(cwd);

    const result = await runCli(cli, ['.', '-t', 'js'], { cwd });

    expect(result.code, result.stderr).toBe(0);
    expect(existsSync(join(cwd, 'package.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).name).toBe('current-bot');
    expect(result.stdout).not.toContain('cd ');
  });

  it.each([
    [['My Bot'], 'Invalid project name'],
    [['discord-player'], 'dependency'],
    [['my-bot', '--template', 'rust'], 'Unknown template'],
    [['one', 'two'], 'Expected one directory'],
    [['--unknown'], 'Unknown option'],
    [[], 'Pass a project directory'],
  ])('rejects %j without creating anything', async (args, message) => {
    const cwd = makeTempDir();
    const result = await runCli(cli, args, { cwd });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(message);
    expect(readdirSync(cwd)).toEqual([]);
  });

  it('refuses a destination that is a file', async () => {
    const cwd = makeTempDir();

    writeFile(join(cwd, 'my-bot'), 'not a directory');

    const result = await runCli(cli, ['my-bot'], { cwd });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('not a directory');
    expect(readFileSync(join(cwd, 'my-bot'), 'utf8')).toBe('not a directory');
  });

  it('refuses to replace existing files without --overwrite', async () => {
    const cwd = makeTempDir();

    writeFile(join(cwd, 'my-bot', 'package.json'), 'mine');
    writeFile(join(cwd, 'my-bot', 'src', 'index.ts'), 'mine too');
    writeFile(join(cwd, 'my-bot', 'notes.txt'), 'keep');

    const result = await runCli(cli, ['my-bot'], { cwd });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--overwrite');
    expect(result.stderr).toContain('package.json');
    expect(readFileSync(join(cwd, 'my-bot', 'package.json'), 'utf8')).toBe('mine');
    expect(readFileSync(join(cwd, 'my-bot', 'src', 'index.ts'), 'utf8')).toBe('mine too');
    expect(existsSync(join(cwd, 'my-bot', 'README.md'))).toBe(false);
  });

  it('replaces only the conflicting files with --overwrite', async () => {
    const cwd = makeTempDir();

    writeFile(join(cwd, 'my-bot', 'package.json'), 'mine');
    writeFile(join(cwd, 'my-bot', 'notes.txt'), 'keep');

    const result = await runCli(cli, ['my-bot', '--overwrite'], { cwd });

    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(cwd, 'my-bot', 'package.json'), 'utf8')).name).toBe('my-bot');
    expect(readFileSync(join(cwd, 'my-bot', 'notes.txt'), 'utf8')).toBe('keep');
  });

  it('writes into a non-empty directory when nothing would be replaced', async () => {
    const cwd = makeTempDir();

    writeFile(join(cwd, 'my-bot', 'notes.txt'), 'keep');

    const result = await runCli(cli, ['my-bot'], { cwd });

    expect(result.code, result.stderr).toBe(0);
    expect(readFileSync(join(cwd, 'my-bot', 'notes.txt'), 'utf8')).toBe('keep');
    expect(existsSync(join(cwd, 'my-bot', 'package.json'))).toBe(true);
  });

  it('refuses to run from a build that has no release version', async () => {
    const cwd = makeTempDir();
    // The workspace build keeps the placeholder version 0.0.0 until a release synchronizes it.
    const result = await runCli(join(packageRoot, 'dist', 'cli.js'), ['my-bot'], { cwd });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('not a release build');
    expect(readdirSync(cwd)).toEqual([]);
  });

  describe.skipIf(process.platform === 'win32')('installing dependencies', () => {
    /** Creates a stand-in `npm` that records where it ran and exits with the given code. */
    function fakeNpm(exitCode: number): { PATH: string } {
      const bin = makeTempDir('fake-npm-');
      const script = join(bin, 'npm');

      writeFile(script, `#!/bin/sh\npwd > install-ran.txt\necho "$@" >> install-ran.txt\nexit ${exitCode}\n`);
      chmodSync(script, 0o755);

      return { PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` };
    }

    it('runs the package manager inside the new project with --install', async () => {
      const cwd = makeTempDir();
      const result = await runCli(cli, ['my-bot', '--install'], { cwd, env: fakeNpm(0) });
      const marker = readFileSync(join(cwd, 'my-bot', 'install-ran.txt'), 'utf8');

      expect(result.code, result.stderr).toBe(0);
      expect(marker).toContain('my-bot');
      expect(marker).toContain('install');
      expect(result.stdout).not.toMatch(/^\s+npm install$/m);
    });

    it('keeps the project and exits non-zero when installing fails', async () => {
      const cwd = makeTempDir();
      const result = await runCli(cli, ['my-bot', '--install'], { cwd, env: fakeNpm(7) });

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('The project was created, but installing dependencies failed');
      expect(result.stderr).toContain('exited with code 7');
      expect(existsSync(join(cwd, 'my-bot', 'package.json'))).toBe(true);
    });

    it('does not install with --no-install', async () => {
      const cwd = makeTempDir();
      const result = await runCli(cli, ['my-bot', '--no-install'], { cwd, env: fakeNpm(7) });

      expect(result.code, result.stderr).toBe(0);
      expect(existsSync(join(cwd, 'my-bot', 'install-ran.txt'))).toBe(false);
    });
  });
});
