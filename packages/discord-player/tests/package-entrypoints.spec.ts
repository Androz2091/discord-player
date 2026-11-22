import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readdir, realpath, rm, symlink, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const exec = promisify(execFile);
const repository = fileURLToPath(new URL('../../../', import.meta.url));

it('loads built and packed public packages through ESM and require without native initialization', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'discord-player-package-'));
  try {
    const modules = join(directory, 'node_modules');
    await mkdir(join(modules, '@discord-player'), { recursive: true });
    for (const [folder, name] of [
      ['plugin-host', '@discord-player/plugin-host'],
      ['discord-player', 'discord-player'],
    ]) {
      if (!folder || !name) throw new Error('Invalid fixture package');
      const root = join(repository, 'packages', folder);
      const destination = join(directory, folder);
      await mkdir(destination);
      if (!process.env.npm_execpath) throw new Error('Run package tests through pnpm');
      const pnpm = process.env.npm_execpath;
      const args = ['pack', '--pack-destination', destination];
      await exec(pnpm.endsWith('.exe') ? pnpm : process.execPath, pnpm.endsWith('.exe') ? args : [pnpm, ...args], {
        cwd: root,
      });
      const archive = (await readdir(destination)).find((file) => file.endsWith('.tgz'));
      if (!archive) throw new Error(`Missing packed ${name}`);
      await exec('tar', ['-xzf', join(destination, archive), '-C', destination]);
      await symlink(join(destination, 'package'), join(modules, name), 'dir');
      const manifest = JSON.parse(await readFile(join(destination, 'package/package.json'), 'utf8'));
      expect(manifest.exports['.']['module-sync']).toBe('./dist/index.js');
      if (folder === 'discord-player')
        expect(manifest.dependencies['@discord-player/plugin-host']).not.toContain('workspace:');
    }
    // Use installed third-party dependencies; both workspace libraries must come from the tarballs.
    for (const name of ['@remedia/client', '@remedia/plugin-host', '@discordjs/collection', 'zod']) {
      const target = join(modules, name);
      await mkdir(dirname(target), { recursive: true });
      await symlink(await realpath(join(repository, 'packages/plugin-host/node_modules', name)), target, 'dir');
    }
    const exercise = `
      assert.equal(api.Player, api.DiscordPlayer);
      assert.equal(api.Track, host.Track);
      assert.equal(api.SafeEventEmitter, host.SafeEventEmitter);
      for (const name of ['AsyncQueue', 'AsyncQueueLock', 'VoiceStateTracker', 'PluginRegistry', 'PluginError', 'SafeEventEmitter', 'serialize', 'deserialize', 'cloneJSONValue', 'GuildQueue', 'GuildQueuePlayerNode', 'QueueRepeatMode', 'BaseExtractor', 'createSourcePluginHost']) assert.ok(api[name], name);
      const player = new api.Player({ nodes: [], send() {} });
      const queue = await player.nodes.create('guild');
      let observed = false;
      await player.plugins.register(api.definePlugin({ id: 'packed', setup(ctx) {
        assert.equal(ctx.player, player);
        assert.equal(ctx.player.isPartial(), false);
        ctx.on('queue.beforeAdd', (_, context) => {
          assert.equal(context.queue, queue);
          assert.equal(context.guildId, 'guild');
          observed = true;
        }, { guildIds: ['guild'] });
      } })());
      queue.addTrack(new api.Track({ title: 'packed', url: 'https://fixture.test/audio' }));
      assert.equal(observed, true);
      await player.destroy();
      const partial = new host.SourcePluginRuntime();
      assert.equal(partial.isPartial(), true);
      await partial.destroy();
    `;
    for (const mode of ['esm', 'cjs']) {
      const file = join(directory, `load.${mode === 'esm' ? 'mjs' : 'cjs'}`);
      const imports =
        mode === 'esm'
          ? "import assert from 'node:assert/strict'; import * as api from 'discord-player'; import * as host from '@discord-player/plugin-host';"
          : "const assert = require('node:assert/strict'); const api = require('discord-player'); const host = require('@discord-player/plugin-host');";
      await writeFile(
        file,
        `${imports}\n(async () => {${exercise}})().catch(error => { console.error(error); process.exitCode = 1; });`,
      );
      for (const binary of [
        process.execPath,
        ...(process.env.NODE_COMPAT_BINARY ? [process.env.NODE_COMPAT_BINARY] : []),
      ]) {
        await exec(binary, [resolve(file)], { cwd: directory });
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
