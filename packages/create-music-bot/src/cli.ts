#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as prompts from '@clack/prompts';
import {
  TEMPLATES,
  detectPackageManager,
  findConflicts,
  getProjectCommands,
  renderProject,
  resolveDiscordPlayerVersion,
  resolveTarget,
  validateProjectName,
  writeProject,
  type PackageManager,
  type Template,
} from './scaffold.js';

const version = (createRequire(import.meta.url)('../package.json') as { version: string }).version;
const templatesDir = fileURLToPath(new URL('./templates', import.meta.url));
const DEFAULT_NAME = 'my-music-bot';
const FFMPEG_DOCS = 'https://discord-player.js.org/docs/v8/installation/ffmpeg';

const HELP = `create-music-bot ${version}

Create a Discord Player v8 music bot.

Usage
  npm create music-bot@dev [directory] [-- options]

Options
  -t, --template <ts|js>  Language of the project (default: ts when not asked)
      --install           Install dependencies after generating the project
      --no-install        Do not install dependencies (default when not asked)
      --overwrite         Replace existing files without asking
  -y, --yes               Never prompt. A directory argument is then required
  -h, --help              Show this help
  -v, --version           Show the version

Examples
  npm create music-bot@dev my-bot
  npm create music-bot@dev my-bot -- --template js --install
`;

class CancelledError extends Error {}

function isTemplate(value: string): value is Template {
  return (TEMPLATES as readonly string[]).includes(value);
}

function quote(path: string): string {
  return /\s/.test(path) ? JSON.stringify(path) : path;
}

function install(manager: PackageManager, directory: string): Promise<void> {
  const [command = manager, ...args] = getProjectCommands(manager).install.split(' ');

  return new Promise((resolve, reject) => {
    // A shell is needed on Windows, where package managers are .cmd files.
    const child = spawn(command, args, { cwd: directory, stdio: 'inherit', shell: process.platform === 'win32' });

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`"${command} ${args.join(' ')}" exited with code ${code}.`));
    });
  });
}

async function run(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    allowNegative: true,
    options: {
      template: { type: 'string', short: 't' },
      install: { type: 'boolean' },
      overwrite: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });

  if (values.help) return void console.log(HELP);

  if (values.version) return void console.log(version);

  if (positionals.length > 1) throw new Error(`Expected one directory but received ${positionals.length}.`);

  if (values.template !== undefined && !isTemplate(values.template)) {
    throw new Error(`Unknown template "${values.template}". Use one of: ${TEMPLATES.join(', ')}.`);
  }

  const discordPlayerVersion = resolveDiscordPlayerVersion(version);
  const interactive = !values.yes && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const manager = detectPackageManager(process.env.npm_config_user_agent);

  if (interactive) prompts.intro('Create Music Bot');

  let target = positionals[0];

  if (target === undefined) {
    if (!interactive) throw new Error('Pass a project directory, for example: npm create music-bot@dev my-bot');

    const input = await prompts.text({
      message: 'Project name',
      placeholder: DEFAULT_NAME,
      defaultValue: DEFAULT_NAME,
      validate: (value) => validateProjectName(resolveTarget(value || DEFAULT_NAME).name),
    });

    if (prompts.isCancel(input)) throw new CancelledError();

    target = input;
  }

  const { directory, name } = resolveTarget(target);
  const nameError = validateProjectName(name);

  if (nameError) throw new Error(`Invalid project name "${name}". ${nameError}`);

  let template: Template = 'ts';

  if (values.template !== undefined && isTemplate(values.template)) {
    template = values.template;
  } else if (interactive) {
    const choice = await prompts.select<Template>({
      message: 'Language',
      options: [
        { value: 'ts', label: 'TypeScript' },
        { value: 'js', label: 'JavaScript' },
      ],
    });

    if (prompts.isCancel(choice)) throw new CancelledError();

    template = choice;
  }

  const project = renderProject({ templatesDir, template, name, discordPlayerVersion, packageManager: manager });
  const conflicts = findConflicts(directory, project);

  if (conflicts.length > 0 && !values.overwrite) {
    if (!interactive) {
      throw new Error(
        `${directory} already contains ${conflicts.join(', ')}. Pass --overwrite to replace existing files.`,
      );
    }

    const shown = conflicts.slice(0, 5).join(', ') + (conflicts.length > 5 ? `, and ${conflicts.length - 5} more` : '');
    const confirmed = await prompts.confirm({
      message: `The directory already contains ${shown}. Replace ${conflicts.length === 1 ? 'it' : 'them'}?`,
      initialValue: false,
    });

    if (prompts.isCancel(confirmed) || !confirmed) throw new CancelledError();
  }

  let shouldInstall = values.install ?? false;

  if (values.install === undefined && interactive) {
    const choice = await prompts.confirm({ message: `Install dependencies with ${manager}?`, initialValue: true });

    if (prompts.isCancel(choice)) throw new CancelledError();

    shouldInstall = choice;
  }

  writeProject(directory, project, conflicts.length > 0);

  const commands = getProjectCommands(manager);
  const relativeDirectory = relative(process.cwd(), directory);
  const copy = process.platform === 'win32' ? 'copy' : 'cp';
  const steps = [
    ...(relativeDirectory ? [`cd ${quote(relativeDirectory)}`] : []),
    `${copy} .env.example .env   # then set DISCORD_TOKEN and ALLOWED_MEDIA_HOSTS`,
    ...(shouldInstall ? [] : [commands.install]),
    commands.dev,
  ];

  if (interactive) prompts.log.success(`Created ${name} in ${directory}`);
  else console.log(`Created ${name} in ${directory}`);

  if (shouldInstall) {
    try {
      await install(manager, directory);
    } catch (error) {
      throw new Error(
        `The project was created, but installing dependencies failed. Run "${commands.install}" in ${directory} to retry.`,
        { cause: error },
      );
    }
  }

  const ffmpeg = `Remedia needs the FFmpeg 9 shared libraries on this machine: ${FFMPEG_DOCS}`;

  if (interactive) {
    prompts.note(steps.join('\n'), 'Next steps');
    prompts.outro(ffmpeg);
  } else {
    console.log(`\nNext steps:\n${steps.map((step) => `  ${step}`).join('\n')}\n\n${ffmpeg}`);
  }
}

try {
  await run();
} catch (error) {
  if (error instanceof CancelledError) {
    prompts.cancel('Cancelled. No files were written.');
  } else {
    const message = error instanceof Error ? error.message : String(error);

    if (process.stdin.isTTY && process.stdout.isTTY) prompts.log.error(message);
    else console.error(`Error: ${message}`);

    if (error instanceof Error && error.cause instanceof Error) console.error(`Caused by: ${error.cause.message}`);
  }

  process.exitCode = 1;
}
