import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ReleaseError,
  compareSemver,
  detectRelease,
  discoverReleasePackages,
  lookupNpmDistTag,
  lookupNpmVersion,
  orderPackagesByDependencies,
  packReleasePackages,
  parseReleaseSubject,
  publishMissingPackages,
  publishRelease,
  syncPackageVersions,
  validateTarball,
  verifyPublishedVersions,
} from './release.mjs';

const tempDirs = [];

test.after(() => {
  for (const directory of tempDirs) rmSync(directory, { recursive: true, force: true });
});

function tempDir() {
  const directory = mkdtempSync(join(tmpdir(), 'discord-player-release-test-'));
  tempDirs.push(directory);
  return directory;
}

function createWorkspace(packageNames = ['discord-player', 'create-music-bot']) {
  const root = tempDir();
  mkdirSync(join(root, '.github'), { recursive: true });
  mkdirSync(join(root, 'packages'), { recursive: true });
  mkdirSync(join(root, 'apps/music-bot'), { recursive: true });
  writeJson(join(root, '.github/release-packages.json'), { packages: packageNames });
  for (const name of packageNames) {
    const packageDir = join(root, 'packages', name);
    mkdirSync(join(packageDir, 'dist'), { recursive: true });
    writeJson(join(packageDir, 'package.json'), packageManifest(name, '0.0.0'));
    writeFileSync(join(packageDir, 'dist/index.js'), 'export {};\n');
    writeFileSync(join(packageDir, 'dist/index.d.ts'), 'export {};\n');
    writeFileSync(join(packageDir, 'README.md'), `# ${name}\n`);
  }
  writeJson(join(root, 'apps/music-bot/package.json'), { name: 'music-bot', version: '0.1.0', private: true });
  return root;
}

function packageManifest(name, version, extra = {}) {
  return {
    name,
    version,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    files: ['dist', 'README.md'],
    dependencies: {},
    ...extra,
  };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function makeTarball(directory, { name = 'discord-player', version = '8.0.0', manifest = {} } = {}) {
  const packageDir = join(directory, 'package');
  mkdirSync(join(packageDir, 'dist'), { recursive: true });
  writeJson(join(packageDir, 'package.json'), packageManifest(name, version, manifest));
  writeFileSync(join(packageDir, 'dist/index.js'), 'export {};\n');
  writeFileSync(join(packageDir, 'dist/index.d.ts'), 'export {};\n');
  writeFileSync(join(packageDir, 'README.md'), `# ${name}\n`);
  const tarball = join(directory, `${name.replace('/', '-')}-${version}.tgz`);
  execFileSync('tar', ['-czf', tarball, 'package'], { cwd: directory });
  rmSync(packageDir, { recursive: true, force: true });
  return tarball;
}

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return body;
    },
  };
}

const releaseContext = (overrides = {}) => ({
  subject: 'chore: release 8.0.0',
  eventName: 'push',
  branch: 'v8',
  repository: 'Androz2091/discord-player',
  ...overrides,
});

test('parses stable, dev, beta, and rc release subjects into the correct npm channels', () => {
  assert.deepEqual(parseReleaseSubject('chore: release 8.0.0'), {
    version: '8.0.0',
    channel: 'latest',
    distTag: 'latest',
    prerelease: false,
  });
  assert.equal(parseReleaseSubject('chore: release 8.0.0-dev.1').distTag, 'dev');
  assert.equal(parseReleaseSubject('chore: release 8.0.0-beta.2').distTag, 'beta');
  assert.equal(parseReleaseSubject('chore: release 8.0.0-rc.1').distTag, 'rc');
});

test('rejects malformed SemVer, missing versions, and invalid prerelease sequences', () => {
  for (const subject of [
    'chore: release 08.0.0',
    'chore: release 8.0',
    'chore: release',
    'chore: release 8.0.0-dev',
    'chore: release 8.0.0-dev.x',
    'chore: release 8.0.0-dev.01',
    'chore: release 8.0.0-alpha.1',
    'chore: release 8.0.0+build.1',
    'chore: release 8.0.0 ',
    'chore: release 8.0.0\n',
  ]) {
    assert.throws(() => parseReleaseSubject(subject), ReleaseError, subject);
  }
  assert.equal(parseReleaseSubject('fix: release 8.0.0'), null);
  assert.equal(parseReleaseSubject('chore: releasing 8.0.0'), null);
  assert.throws(() => parseReleaseSubject('chore: release 8.0.0 extra'), /Invalid release commit subject/);
});

test('suppresses release detection for pull requests, forks, and non-release branches', () => {
  assert.deepEqual(detectRelease(releaseContext({ eventName: 'pull_request' })), { release: false });
  assert.deepEqual(detectRelease(releaseContext({ subject: 'fix: handle source plugin cancellation' })), {
    release: false,
  });
  assert.deepEqual(detectRelease(releaseContext({ branch: 'feature/new-api' })), { release: false });
  assert.deepEqual(detectRelease(releaseContext({ repository: 'fork/discord-player' })), { release: false });
  assert.deepEqual(detectRelease(releaseContext({ eventName: 'workflow_dispatch', branch: 'master' })).release, true);
  assert.deepEqual(detectRelease(releaseContext({ eventName: 'workflow_dispatch', branch: 'feature/new-api' })), {
    release: false,
  });
  assert.deepEqual(detectRelease(releaseContext({ subject: 'chore: release no-version' })).malformed, true);
});

test('synchronizes every public packages/ package idempotently and leaves private app versions alone', () => {
  const root = createWorkspace();
  const beforeApp = readFileSync(join(root, 'apps/music-bot/package.json'), 'utf8');
  assert.deepEqual(
    discoverReleasePackages({ root }).map(({ name }) => name),
    ['discord-player', 'create-music-bot'],
  );
  assert.deepEqual(syncPackageVersions('8.0.0-dev.4', { root }), ['discord-player', 'create-music-bot']);
  const first = ['discord-player', 'create-music-bot'].map((name) =>
    readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'),
  );
  syncPackageVersions('8.0.0-dev.4', { root });
  const second = ['discord-player', 'create-music-bot'].map((name) =>
    readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'),
  );
  assert.deepEqual(second, first);
  assert.deepEqual(
    second.map((content) => JSON.parse(content).version),
    ['8.0.0-dev.4', '8.0.0-dev.4'],
  );
  assert.equal(readFileSync(join(root, 'apps/music-bot/package.json'), 'utf8'), beforeApp);
});

test('fails closed when a new public package is omitted from the release inventory', () => {
  const root = createWorkspace();
  mkdirSync(join(root, 'packages/forgotten-package'));
  writeJson(join(root, 'packages/forgotten-package/package.json'), { name: 'forgotten-package', version: '1.0.0' });
  assert.throws(() => discoverReleasePackages({ root }), /Release package inventory mismatch/);
});

test('validates entrypoints and packed manifests, including exact workspace dependency resolution', () => {
  const root = createWorkspace();
  syncPackageVersions('8.0.0', { root });
  const main = join(root, 'packages/discord-player');
  const bot = join(root, 'packages/create-music-bot');
  writeJson(join(bot, 'package.json'), packageManifest('create-music-bot', '8.0.0'));
  writeJson(
    join(main, 'package.json'),
    packageManifest('discord-player', '8.0.0', {
      dependencies: { 'create-music-bot': '8.0.0' },
    }),
  );
  assert.deepEqual(
    orderPackagesByDependencies([
      { name: 'discord-player', manifest: JSON.parse(readFileSync(join(main, 'package.json'), 'utf8')) },
      { name: 'create-music-bot', manifest: JSON.parse(readFileSync(join(bot, 'package.json'), 'utf8')) },
    ]).map(({ name }) => name),
    ['create-music-bot', 'discord-player'],
  );

  const artifactDir = join(root, 'artifacts');
  mkdirSync(artifactDir);
  const validTarball = makeTarball(artifactDir, {
    name: 'discord-player',
    version: '8.0.0',
    manifest: { dependencies: { 'create-music-bot': '8.0.0' } },
  });
  assert.equal(
    validateTarball(validTarball, { name: 'discord-player', version: '8.0.0', root }).manifest.dependencies[
      'create-music-bot'
    ],
    '8.0.0',
  );

  const invalidDir = join(root, 'invalid');
  mkdirSync(invalidDir);
  const workspaceTarball = makeTarball(invalidDir, {
    name: 'discord-player',
    version: '8.0.0',
    manifest: { dependencies: { 'create-music-bot': 'workspace:*' } },
  });
  assert.throws(
    () => validateTarball(workspaceTarball, { name: 'discord-player', version: '8.0.0', root }),
    /unresolved dependencies/,
  );
});

test('rejects missing or incomplete npm tarballs before publication', async () => {
  const root = tempDir();
  const missing = join(root, 'missing.tgz');
  assert.throws(() => validateTarball(missing, { name: 'discord-player', version: '8.0.0' }), /Missing npm tarball/);

  const incompleteDir = join(root, 'incomplete');
  mkdirSync(incompleteDir);
  const tarball = makeTarball(incompleteDir, { name: 'discord-player', version: '8.0.0' });
  const unpackDir = join(root, 'unpacked');
  mkdirSync(unpackDir);
  execFileSync('tar', ['-xzf', tarball, '-C', unpackDir]);
  rmSync(join(unpackDir, 'package/dist/index.d.ts'));
  const incomplete = join(root, 'incomplete.tgz');
  execFileSync('tar', ['-czf', incomplete, 'package'], { cwd: unpackDir });
  assert.throws(
    () => validateTarball(incomplete, { name: 'discord-player', version: '8.0.0' }),
    /missing declared entrypoint/,
  );
});

test('npm exact-version lookup accepts exact metadata and treats only HTTP 404 as unpublished', async () => {
  const exact = async () =>
    response(200, {
      name: 'discord-player',
      version: '8.0.0',
      dist: { tarball: 'https://registry.npmjs.org/discord-player/-/discord-player-8.0.0.tgz' },
    });
  assert.equal(await lookupNpmVersion('discord-player', '8.0.0', { fetchImpl: exact }), true);
  assert.equal(await lookupNpmVersion('discord-player', '8.0.0', { fetchImpl: async () => response(404, {}) }), false);
  await assert.rejects(
    lookupNpmVersion('discord-player', '8.0.0', { fetchImpl: async () => response(500, {}), attempts: 1 }),
    /HTTP 500/,
  );
  await assert.rejects(
    lookupNpmVersion('discord-player', '8.0.0', {
      fetchImpl: async () => {
        throw new Error('offline');
      },
      attempts: 1,
    }),
    /offline/,
  );
  await assert.rejects(
    lookupNpmVersion('discord-player', '8.0.0', {
      fetchImpl: async () => response(200, { name: 'wrong', version: '8.0.0' }),
    }),
    /invalid metadata/,
  );
  await assert.rejects(
    lookupNpmVersion('discord-player', '8.0.0', { fetchImpl: async () => response(200, null) }),
    /invalid metadata/,
  );
  await assert.rejects(
    lookupNpmVersion('discord-player', '8.0.0', {
      fetchImpl: async () => ({
        status: 200,
        ok: true,
        async json() {
          throw new Error('invalid');
        },
      }),
    }),
    /invalid JSON/,
  );
});

test('npm dist-tag lookup validates registry responses and absent tags', async () => {
  assert.equal(
    await lookupNpmDistTag('discord-player', 'latest', {
      fetchImpl: async () => response(200, { name: 'discord-player', 'dist-tags': { latest: '8.0.0' } }),
    }),
    '8.0.0',
  );
  assert.equal(
    await lookupNpmDistTag('discord-player', 'latest', {
      fetchImpl: async () => response(200, { name: 'discord-player', 'dist-tags': {} }),
    }),
    null,
  );
  await assert.rejects(
    lookupNpmDistTag('discord-player', 'latest', {
      fetchImpl: async () => response(200, { name: 'wrong', 'dist-tags': {} }),
    }),
    /invalid dist-tag metadata/,
  );
});

test('publishes every missing package in dependency order with stable or prerelease tags', async () => {
  const root = tempDir();
  const playerTarball = join(root, 'discord-player.tgz');
  const creatorTarball = join(root, 'create-music-bot.tgz');
  writeFileSync(playerTarball, 'verified player tarball');
  writeFileSync(creatorTarball, 'verified creator tarball');
  const packages = [
    { name: 'discord-player', version: '8.0.0', path: playerTarball, dependencies: { 'create-music-bot': '8.0.0' } },
    { name: 'create-music-bot', version: '8.0.0', path: creatorTarball, dependencies: {} },
  ];
  const calls = [];
  const visibleVersions = new Set();
  const summary = await publishMissingPackages({
    packages,
    distTag: 'latest',
    lookupVersion: async (name) => visibleVersions.has(name),
    lookupTag: async () => null,
    publish: async (path, options) => {
      calls.push({ path, ...options });
      visibleVersions.add(options.name);
    },
    sleep: async () => {},
    log: () => {},
  });
  assert.deepEqual(
    calls.map(({ name }) => name),
    ['create-music-bot', 'discord-player'],
  );
  assert.deepEqual(
    calls.map(({ distTag }) => distTag),
    ['latest', 'latest'],
  );
  assert.deepEqual(
    summary.packages.map(({ status }) => status),
    ['published', 'published'],
  );

  const prereleaseCalls = [];
  let prereleaseVisible = false;
  await publishMissingPackages({
    packages: [{ name: 'discord-player', version: '8.0.0-beta.2', path: playerTarball }],
    distTag: 'beta',
    lookupVersion: async () => prereleaseVisible,
    lookupTag: async () => null,
    publish: async (path, options) => {
      prereleaseCalls.push(options);
      prereleaseVisible = true;
    },
    sleep: async () => {},
    log: () => {},
  });
  assert.deepEqual(
    prereleaseCalls.map(({ distTag }) => distTag),
    ['beta'],
  );
});

test('waits through bounded npm propagation 404s after publication', async () => {
  const root = tempDir();
  const tarball = join(root, 'package.tgz');
  writeFileSync(tarball, 'tarball');
  let visible = false;
  let checks = 0;
  const result = await publishMissingPackages({
    packages: [{ name: 'discord-player', version: '8.0.0', path: tarball }],
    distTag: 'latest',
    lookupVersion: async () => {
      checks += 1;
      return visible;
    },
    lookupTag: async () => null,
    publish: async () => {
      visible = true;
    },
    verifyAttempts: 3,
    verifyDelayMs: 0,
    sleep: async () => {},
    log: () => {},
  });
  assert.equal(result.packages[0].status, 'published');
  assert.equal(checks, 2);
});

test('skips every existing version, resumes a partial publish, and leaves existing tags untouched', async () => {
  const root = tempDir();
  const first = join(root, 'player.tgz');
  const second = join(root, 'creator.tgz');
  writeFileSync(first, 'tarball');
  writeFileSync(second, 'tarball');
  const packages = [
    { name: 'discord-player', version: '8.0.0-dev.4', path: first },
    { name: 'create-music-bot', version: '8.0.0-dev.4', path: second },
  ];
  const existing = new Set(['discord-player']);
  const published = [];
  const firstRun = await publishMissingPackages({
    packages,
    distTag: 'dev',
    lookupVersion: async (name) => existing.has(name),
    lookupTag: async () => null,
    publish: async (path, options) => {
      published.push(options.name);
      existing.add(options.name);
    },
    log: () => {},
  });
  assert.deepEqual(
    firstRun.packages.map(({ status }) => status),
    ['skipped', 'published'],
  );
  assert.deepEqual(published, ['create-music-bot']);

  const secondRun = await publishMissingPackages({
    packages,
    distTag: 'dev',
    lookupVersion: async (name) => existing.has(name),
    lookupTag: async () => {
      throw new Error('Existing package dist-tags must not be changed.');
    },
    publish: async () => assert.fail('Rerun republished an existing package.'),
    log: () => {},
  });
  assert.deepEqual(
    secondRun.packages.map(({ status }) => status),
    ['skipped', 'skipped'],
  );
});

test('fails before a dependent publish when its missing dependency cannot publish', async () => {
  const root = tempDir();
  const dependency = join(root, 'dependency.tgz');
  const dependent = join(root, 'dependent.tgz');
  writeFileSync(dependency, 'tarball');
  writeFileSync(dependent, 'tarball');
  const calls = [];
  await assert.rejects(
    publishMissingPackages({
      packages: [
        { name: 'discord-player', version: '8.0.0', path: dependent, dependencies: { 'create-music-bot': '8.0.0' } },
        { name: 'create-music-bot', version: '8.0.0', path: dependency, dependencies: {} },
      ],
      distTag: 'latest',
      lookupVersion: async () => false,
      lookupTag: async () => null,
      publish: async (path, options) => {
        calls.push(options.name);
        throw new Error('publish failed');
      },
      log: () => {},
    }),
    /publish failed/,
  );
  assert.deepEqual(calls, ['create-music-bot']);
});

test('publication errors, registry errors, missing tarballs, and latest-tag downgrades fail closed', async () => {
  const root = tempDir();
  const tarball = join(root, 'package.tgz');
  writeFileSync(tarball, 'tarball');
  const pkg = [{ name: 'discord-player', version: '8.0.0', path: tarball }];
  await assert.rejects(
    publishMissingPackages({
      packages: pkg,
      distTag: 'latest',
      lookupVersion: async () => false,
      lookupTag: async () => null,
      publish: async () => {
        throw new Error('npm failed');
      },
      log: () => {},
    }),
    /npm failed/,
  );
  await assert.rejects(
    publishMissingPackages({
      packages: pkg,
      distTag: 'latest',
      lookupVersion: async () => false,
      lookupTag: async () => '8.1.0',
      publish: async () => assert.fail('Should refuse dist-tag regression.'),
      log: () => {},
    }),
    /backward/,
  );
  await assert.rejects(
    publishMissingPackages({
      packages: [{ ...pkg[0], path: join(root, 'absent.tgz') }],
      distTag: 'latest',
    }),
    /Missing npm tarball/,
  );
  await assert.rejects(
    verifyPublishedVersions({
      packages: ['discord-player', 'create-music-bot'],
      version: '8.0.0',
      lookupVersion: async (name) => name === 'discord-player',
    }),
    /create-music-bot@8.0.0 is not published/,
  );
});

test('retries transient registry failures but does not misread them as unpublished', async () => {
  let calls = 0;
  const found = await lookupNpmVersion('discord-player', '8.0.0', {
    attempts: 3,
    delayMs: 0,
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? response(503, {})
        : response(200, {
            name: 'discord-player',
            version: '8.0.0',
            dist: { tarball: 'https://registry.npmjs.org/x.tgz' },
          });
    },
  });
  assert.equal(found, true);
  assert.equal(calls, 2);
  assert.equal(compareSemver('8.0.0-rc.1', '8.0.0'), -1);
  assert.equal(compareSemver('8.1.0', '8.0.9'), 1);
});

test('validates package artifacts before contacting npm and supports simulated partial release runs', async () => {
  const root = createWorkspace();
  syncPackageVersions('8.0.0-dev.4', { root });
  const artifactDir = join(root, 'artifacts');
  mkdirSync(artifactDir);
  makeTarball(artifactDir, { name: 'discord-player', version: '8.0.0-dev.4' });
  makeTarball(artifactDir, { name: 'create-music-bot', version: '8.0.0-dev.4' });
  const seen = new Set(['discord-player']);
  const summary = await publishRelease({
    root,
    directory: artifactDir,
    version: '8.0.0-dev.4',
    lookupVersion: async (name) => seen.has(name),
    lookupTag: async () => null,
    publish: async (_path, { name }) => seen.add(name),
    log: () => {},
  });
  assert.deepEqual(
    summary.packages.map(({ status }) => status),
    ['skipped', 'published'],
  );
});

test('rejects unexpected release artifact files before any registry call', async () => {
  const root = createWorkspace();
  syncPackageVersions('8.0.0', { root });
  const artifactDir = join(root, 'artifacts');
  mkdirSync(artifactDir);
  makeTarball(artifactDir, { name: 'discord-player', version: '8.0.0' });
  makeTarball(artifactDir, { name: 'create-music-bot', version: '8.0.0' });
  writeFileSync(join(artifactDir, 'unreviewed.txt'), 'not a tarball');
  let registryCalls = 0;
  await assert.rejects(
    publishRelease({
      root,
      directory: artifactDir,
      version: '8.0.0',
      lookupVersion: async () => {
        registryCalls += 1;
        return false;
      },
    }),
    /Unexpected release artifact/,
  );
  assert.equal(registryCalls, 0);
});

test('pnpm packing inspects generated tarballs without rebuilding package sources', () => {
  const root = createWorkspace(['discord-player']);
  syncPackageVersions('8.0.0', { root });
  const destination = join(root, 'release-artifacts');
  const packed = packReleasePackages({
    root,
    destination,
    pack: (directory, output) => {
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
      const targetDir = join(output, 'fixture');
      mkdirSync(targetDir, { recursive: true });
      const tarball = makeTarball(targetDir, { name: manifest.name, version: manifest.version });
      writeFileSync(join(output, `${manifest.name}-${manifest.version}.tgz`), readFileSync(tarball));
    },
  });
  assert.deepEqual(
    packed.map(({ name, version }) => [name, version]),
    [['discord-player', '8.0.0']],
  );
});
