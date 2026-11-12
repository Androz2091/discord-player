import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package root of the generator. */
export const packageRoot = fileURLToPath(new URL('..', import.meta.url));

/** Template directory in the source tree. */
export const templatesDir = join(packageRoot, 'templates');

/** Creates an empty directory that is removed by the operating system's temp cleanup. */
export function makeTempDir(prefix = 'create-music-bot-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Copies the built generator into a temp directory with an explicit version,
 * independently of whether release CI has synchronized the workspace version.
 *
 * @param version Version to give the copy.
 * @returns Path of the copy's CLI entry point.
 */
export function createGeneratorFixture(version: string): string {
  const root = makeTempDir('create-music-bot-fixture-');
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as Record<string, unknown>;

  cpSync(join(packageRoot, 'dist'), join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ ...manifest, version }));
  symlinkSync(join(packageRoot, 'node_modules'), join(root, 'node_modules'), 'dir');

  return join(root, 'dist', 'cli.js');
}

/** Output of a finished CLI run. */
export interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Runs the generator without a terminal.
 *
 * @param cli Path of the CLI entry point.
 * @param args Command-line arguments.
 * @param options.cwd Working directory.
 * @param options.env Extra environment variables.
 */
export function runCli(
  cli: string,
  args: string[],
  options: { cwd: string; env?: Record<string, string> },
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: options.cwd,
      env: { ...process.env, npm_config_user_agent: 'npm/11.0.0 node/v22.18.0', ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk));
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Writes a file, creating parent directories. */
export function writeFile(path: string, contents: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
}
