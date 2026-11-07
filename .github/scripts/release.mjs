import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_BRANCHES = Object.freeze(['v8', 'master']);
// GitHub account IDs remain stable when usernames change.
export const RELEASE_AUTHORITIES = Object.freeze(['46562212', '42497995']); // twlite, Androz2091
export const OFFICIAL_REPOSITORY = 'Androz2091/discord-player';
export const REGISTRY_URL = 'https://registry.npmjs.org';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RELEASE_SUBJECT_PREFIX = 'chore: release';
const RELEASE_SUBJECT_PATTERN =
  /^chore: release ((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:dev|beta|rc)\.(?:0|[1-9]\d*))?)$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const RELEASE_SUBJECT_HELP =
  'Expected exactly "chore: release X.Y.Z" or "chore: release X.Y.Z-(dev|beta|rc).N" with canonical SemVer.';

export class ReleaseError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ReleaseError';
  }
}

/**
 * Parse the supported release commit subject.
 * @param {string} subject Complete commit subject from HEAD.
 * @returns {{version: string, channel: string, distTag: string, prerelease: boolean} | null} Release metadata, or null for an unrelated subject.
 * @throws {ReleaseError} When a release-looking subject is malformed.
 */
export function parseReleaseSubject(subject) {
  if (typeof subject !== 'string') throw new ReleaseError('Release commit subject must be a string.');
  if (!subject.startsWith(RELEASE_SUBJECT_PREFIX)) return null;

  const match = RELEASE_SUBJECT_PATTERN.exec(subject);
  if (!match || match[0] !== subject)
    throw new ReleaseError(`Invalid release commit subject: ${JSON.stringify(subject)}. ${RELEASE_SUBJECT_HELP}`);

  const version = match[1];
  const semver = parseSemver(version);
  if (!semver || semver.build) {
    throw new ReleaseError(
      `Invalid release version in commit subject: ${JSON.stringify(subject)}. ${RELEASE_SUBJECT_HELP}`,
    );
  }

  const channel = semver.prerelease.length > 0 ? semver.prerelease[0] : 'latest';
  if (semver.prerelease.length > 0 && (semver.prerelease.length !== 2 || !['dev', 'beta', 'rc'].includes(channel))) {
    throw new ReleaseError(
      `Unsupported release channel in commit subject: ${JSON.stringify(subject)}. ${RELEASE_SUBJECT_HELP}`,
    );
  }

  return {
    version,
    channel,
    distTag: channel,
    prerelease: channel !== 'latest',
  };
}

/**
 * Decide whether a release subject may publish in this workflow context.
 * @param {{subject: string, eventName: string, branch: string, repository: string, actorId: string, triggeringActorId: string}} context GitHub event, actor IDs, and HEAD context.
 * @returns {{release: false, malformed?: boolean, error?: string} | ({release: true} & ReturnType<typeof parseReleaseSubject>)} Detection result.
 */
export function detectRelease(context) {
  const allowedEvent = context.eventName === 'push' || context.eventName === 'workflow_dispatch';
  const authorized =
    allowedEvent &&
    context.repository === OFFICIAL_REPOSITORY &&
    RELEASE_BRANCHES.includes(context.branch) &&
    RELEASE_AUTHORITIES.includes(context.actorId) &&
    RELEASE_AUTHORITIES.includes(context.triggeringActorId);

  if (!authorized) return { release: false };

  try {
    const release = parseReleaseSubject(context.subject);
    return release ? { release: true, ...release } : { release: false };
  } catch (error) {
    if (!(error instanceof ReleaseError)) throw error;
    return { release: false, malformed: true, error: error.message };
  }
}

/**
 * Resolve the account that starts this attempt, including workflow reruns.
 * @param {{actor: string, actorId: string, triggeringActor: string, fetchImpl?: typeof fetch}} context Runner-provided identities and injectable GitHub API.
 * @returns {Promise<string | null>} Numeric triggering account ID, or null when identity is missing.
 */
export async function resolveTriggeringActorId({ actor, actorId, triggeringActor, fetchImpl = fetch }) {
  if (!actor || !actorId || !triggeringActor) return null;
  if (actor === triggeringActor) return actorId;
  const response = await fetchImpl(`https://api.github.com/users/${encodeURIComponent(triggeringActor)}`, {
    headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new ReleaseError(`Cannot verify release triggering actor: GitHub returned HTTP ${response.status}.`);
  const user = await response.json();
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new ReleaseError('GitHub returned an invalid triggering actor ID.');
  }
  return String(user.id);
}

async function getReleaseActorContext() {
  const actorId = process.env.GITHUB_ACTOR_ID;
  // An unapproved original actor can never be authorized by a later rerun.
  if (!RELEASE_AUTHORITIES.includes(actorId)) return { actorId, triggeringActorId: null };
  const triggeringActorId = await resolveTriggeringActorId({
    actor: process.env.GITHUB_ACTOR,
    actorId,
    triggeringActor: process.env.GITHUB_TRIGGERING_ACTOR,
  });
  return { actorId, triggeringActorId };
}

/**
 * Parse a canonical SemVer version.
 * @param {string} version Version to parse.
 * @returns {{major: bigint, minor: bigint, patch: bigint, prerelease: string[], build: string | null} | null} Parsed components, or null for invalid SemVer.
 */
export function parseSemver(version) {
  if (typeof version !== 'string') return null;
  const match = SEMVER_PATTERN.exec(version);
  if (!match || match[0] !== version) return null;
  const prerelease = match[4] ? match[4].split('.') : [];
  if (
    prerelease.some((identifier) => /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))
  ) {
    return null;
  }

  return {
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    prerelease,
    build: match[5] ?? null,
  };
}

/**
 * Compare two SemVer versions using SemVer precedence rules.
 * @param {string} left First version.
 * @param {string} right Second version.
 * @returns {-1 | 0 | 1} Negative if left is lower, positive if higher.
 * @throws {ReleaseError} When either version is not canonical SemVer.
 */
export function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b)
    throw new ReleaseError(
      `Cannot compare invalid SemVer versions ${JSON.stringify(left)} and ${JSON.stringify(right)}.`,
    );

  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] < b[key]) return -1;
    if (a[key] > b[key]) return 1;
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    if (a.prerelease.length === b.prerelease.length) return 0;
    return a.prerelease.length === 0 ? 1 : -1;
  }

  const count = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    const leftIdentifier = a.prerelease[index];
    const rightIdentifier = b.prerelease[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      return leftIdentifier === rightIdentifier ? 0 : leftIdentifier === undefined ? -1 : 1;
    }
    if (leftIdentifier === rightIdentifier) continue;

    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) return BigInt(leftIdentifier) < BigInt(rightIdentifier) ? -1 : 1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
}

/**
 * Discover the exact public-package inventory declared by the release manifest.
 * @param {{root?: string}} options Workspace root override for tests.
 * @returns {Array<{name: string, directory: string, manifest: Record<string, any>}>} Packages in manifest order.
 * @throws {ReleaseError} If the manifest and public workspace packages disagree.
 */
export function discoverReleasePackages({ root = projectRoot } = {}) {
  const manifestPath = join(root, '.github/release-packages.json');
  const releaseManifest = readJson(manifestPath);
  if (!Array.isArray(releaseManifest.packages) || releaseManifest.packages.length === 0) {
    throw new ReleaseError('The release manifest must list at least one package.');
  }
  if (new Set(releaseManifest.packages).size !== releaseManifest.packages.length) {
    throw new ReleaseError('The release manifest contains duplicate package names.');
  }

  const packageRoot = join(root, 'packages');
  const discovered = readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(packageRoot, entry.name, 'package.json')))
    .map((entry) => {
      const directory = join(packageRoot, entry.name);
      return { directory, manifest: readJson(join(directory, 'package.json')) };
    });
  const publicNames = discovered
    .filter(({ manifest }) => manifest.private !== true)
    .map(({ manifest }) => manifest.name)
    .sort();
  const configuredNames = [...releaseManifest.packages].sort();
  if (JSON.stringify(publicNames) !== JSON.stringify(configuredNames)) {
    throw new ReleaseError(
      `Release package inventory mismatch. Manifest: ${configuredNames.join(', ')}. Public workspace packages: ${publicNames.join(', ') || '(none)'}.`,
    );
  }

  return releaseManifest.packages.map((name) => {
    const item = discovered.find(({ manifest }) => manifest.name === name);
    if (!item)
      throw new ReleaseError(`Release manifest package ${JSON.stringify(name)} was not found under packages/.`);
    if (item.manifest.private === true) throw new ReleaseError(`Release manifest package ${name} is private.`);
    if (item.manifest.name !== name) throw new ReleaseError(`Package directory metadata does not match ${name}.`);
    return { name, ...item };
  });
}

/**
 * Apply one version to all release packages without touching app versions or the lockfile.
 * @param {string} version Canonical release version.
 * @param {{root?: string}} options Workspace root override for tests.
 * @returns {string[]} Package names synchronized.
 */
export function syncPackageVersions(version, { root = projectRoot } = {}) {
  const parsed = parseSemver(version);
  if (
    !parsed ||
    parsed.build ||
    (!/^(?:dev|beta|rc)\.\d+$/.test(parsed.prerelease.join('.')) && parsed.prerelease.length > 0)
  ) {
    throw new ReleaseError(`Invalid release version ${JSON.stringify(version)}.`);
  }

  const packages = discoverReleasePackages({ root });
  for (const { directory, manifest } of packages) {
    manifest.version = version;
    writeFileSync(join(directory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return packages.map(({ name }) => name);
}

/**
 * Verify package build entrypoints before packing.
 * @param {{root?: string}} options Workspace root override for tests.
 * @returns {Array<{name: string, version: string, entrypoints: string[]}>} Verified build outputs.
 */
export function verifyBuiltPackages({ root = projectRoot } = {}) {
  return discoverReleasePackages({ root }).map(({ name, directory, manifest }) => {
    const targets = collectEntrypoints(manifest);
    if (targets.length === 0) throw new ReleaseError(`${name} does not declare a JS or type entrypoint.`);
    for (const target of targets) {
      if (!existsSync(join(directory, target)))
        throw new ReleaseError(`${name} is missing declared build entrypoint ${target}.`);
    }
    return { name, version: manifest.version, entrypoints: targets };
  });
}

/**
 * Order release packages so internal runtime dependencies publish first.
 * @param {Array<Record<string, any>>} packages Package records with name and manifest or packed metadata.
 * @returns {Array<Record<string, any>>} Dependency-first order.
 */
export function orderPackagesByDependencies(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];
  const visit = (pkg) => {
    if (visited.has(pkg.name)) return;
    if (visiting.has(pkg.name)) throw new ReleaseError(`Circular release package dependency involving ${pkg.name}.`);
    visiting.add(pkg.name);
    const manifest = pkg.manifest ?? pkg;
    const dependencies = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.optionalDependencies ?? {}),
      ...(manifest.peerDependencies ?? {}),
    };
    for (const name of Object.keys(dependencies)) {
      const dependency = byName.get(name);
      if (dependency) visit(dependency);
    }
    visiting.delete(pkg.name);
    visited.add(pkg.name);
    ordered.push(pkg);
  };
  for (const pkg of packages) visit(pkg);
  return ordered;
}

/**
 * Validate an npm tarball and its packed manifest.
 * @param {string} tarball Tarball path.
 * @param {{name: string, version: string, root?: string, expectedPackages?: string[]}} expected Expected package identity.
 * @returns {{name: string, version: string, path: string, manifest: Record<string, any>}} Validated artifact metadata.
 */
export function validateTarball(tarball, { name, version, root = projectRoot, expectedPackages } = {}) {
  if (!existsSync(tarball)) throw new ReleaseError(`Missing npm tarball for ${name ?? 'package'}: ${tarball}`);
  let files;
  let manifestText;
  try {
    files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    manifestText = execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' });
  } catch (error) {
    throw new ReleaseError(`Unable to inspect npm tarball ${tarball}.`, { cause: error });
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    throw new ReleaseError(`Tarball ${tarball} contains an invalid package.json.`, { cause: error });
  }
  if (manifest.name !== name)
    throw new ReleaseError(`Tarball package name mismatch: expected ${name}, found ${manifest.name}.`);
  if (manifest.version !== version) {
    throw new ReleaseError(`Tarball version mismatch for ${name}: expected ${version}, found ${manifest.version}.`);
  }
  if (manifest.private === true) throw new ReleaseError(`Tarball ${name}@${version} is marked private.`);

  const allowedPaths = files.map((entry) => entry.replace(/\/$/, '')).filter((entry) => entry !== 'package');
  for (const entry of allowedPaths) {
    if (!entry.startsWith('package/'))
      throw new ReleaseError(`Tarball ${name}@${version} contains an unexpected archive path ${entry}.`);
    const packagePath = entry.slice('package/'.length);
    if (packagePath === 'package.json' || packagePath === 'README.md' || /^LICENSE(?:\..*)?$/.test(packagePath))
      continue;
    if (packagePath !== 'dist' && !packagePath.startsWith('dist/'))
      throw new ReleaseError(`Tarball ${name}@${version} contains unexpected file ${packagePath}.`);
  }

  const fileSet = new Set(allowedPaths);
  const targets = collectEntrypoints(manifest);
  if (targets.length === 0) throw new ReleaseError(`${name}@${version} does not declare a JS or type entrypoint.`);
  for (const target of targets) {
    if (!fileSet.has(`package/${target}`))
      throw new ReleaseError(`${name}@${version} tarball is missing declared entrypoint ${target}.`);
  }

  const packageNames = expectedPackages ?? discoverReleasePackages({ root }).map((pkg) => pkg.name);
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [dependency, specifier] of Object.entries(manifest[field] ?? {})) {
      if (typeof specifier !== 'string' || /^(?:workspace:|catalog:)/.test(specifier)) {
        throw new ReleaseError(
          `${name}@${version} has unresolved ${field} entry ${dependency}: ${JSON.stringify(specifier)}.`,
        );
      }
      if (packageNames.includes(dependency) && specifier !== version) {
        throw new ReleaseError(
          `${name}@${version} must depend on release package ${dependency} at exact version ${version}; found ${specifier}.`,
        );
      }
    }
  }

  return { name, version, path: resolve(tarball), manifest };
}

/**
 * Create and validate release tarballs from already-built package outputs.
 * @param {{root?: string, destination: string, pack?: Function}} options Packing configuration and injectable pnpm pack function.
 * @returns {Array<{name: string, version: string, path: string, manifest: Record<string, any>}>} Validated tarballs in dependency order.
 */
export function packReleasePackages({ root = projectRoot, destination, pack = runPnpmPack } = {}) {
  if (!destination) throw new ReleaseError('A tarball destination directory is required.');
  mkdirSync(destination, { recursive: true });
  const packages = discoverReleasePackages({ root });
  const ordered = orderPackagesByDependencies(packages.map((pkg) => ({ ...pkg, manifest: pkg.manifest })));
  const tarballs = [];
  for (const pkg of ordered) {
    const tarball = join(destination, `${pkg.name.replace('/', '-')}-${pkg.manifest.version}.tgz`);
    if (existsSync(tarball))
      throw new ReleaseError(`Refusing to overwrite existing release tarball ${basename(tarball)}.`);
    pack(pkg.directory, destination);
    tarballs.push(validateTarball(tarball, { name: pkg.name, version: pkg.manifest.version, root }));
  }
  return tarballs;
}

/**
 * Look up one exact package version on the official npm registry.
 * @param {string} name Exact npm package name.
 * @param {string} version Exact package version.
 * @param {{fetchImpl?: typeof fetch, attempts?: number, delayMs?: number, sleep?: Function}} options Registry/retry injection for tests.
 * @returns {Promise<boolean>} True only when npm confirms this exact package version; false only for HTTP 404.
 */
export async function lookupNpmVersion(
  name,
  version,
  { fetchImpl = fetch, attempts = 4, delayMs = 1000, sleep = delay } = {},
) {
  const url = `${REGISTRY_URL}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, { headers: { accept: 'application/vnd.npm.install-v1+json' } });
    } catch (error) {
      if (attempt === attempts)
        throw new ReleaseError(`npm registry lookup failed for ${name}@${version}: ${error.message}`, { cause: error });
      await sleep(delayMs * attempt);
      continue;
    }
    if (response.status === 404) return false;
    if (response.status === 429 || response.status >= 500) {
      if (attempt === attempts)
        throw new ReleaseError(
          `npm registry returned HTTP ${response.status} for ${name}@${version} after ${attempts} attempts.`,
        );
      await sleep(delayMs * attempt);
      continue;
    }
    if (!response.ok) throw new ReleaseError(`npm registry returned HTTP ${response.status} for ${name}@${version}.`);

    const metadata = await parseRegistryJson(response, `${name}@${version}`);
    if (
      !metadata ||
      typeof metadata !== 'object' ||
      metadata.name !== name ||
      metadata.version !== version ||
      typeof metadata.dist?.tarball !== 'string' ||
      !metadata.dist.tarball.startsWith('https://')
    ) {
      throw new ReleaseError(`npm registry returned invalid metadata while checking ${name}@${version}.`);
    }
    return true;
  }
  throw new ReleaseError(`npm registry lookup exhausted retries for ${name}@${version}.`);
}

/**
 * Read one npm dist-tag without mutating it.
 * @param {string} name Exact npm package name.
 * @param {string} tag npm dist-tag.
 * @param {{fetchImpl?: typeof fetch, attempts?: number, delayMs?: number, sleep?: Function}} options Registry/retry injection for tests.
 * @returns {Promise<string | null>} Tag version, or null when the package/tag is absent.
 */
export async function lookupNpmDistTag(
  name,
  tag,
  { fetchImpl = fetch, attempts = 4, delayMs = 1000, sleep = delay } = {},
) {
  const url = `${REGISTRY_URL}/${encodeURIComponent(name)}`;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, { headers: { accept: 'application/vnd.npm.install-v1+json' } });
    } catch (error) {
      if (attempt === attempts)
        throw new ReleaseError(`npm registry lookup failed for ${name} dist-tag ${tag}: ${error.message}`, {
          cause: error,
        });
      await sleep(delayMs * attempt);
      continue;
    }
    if (response.status === 404) return null;
    if (response.status === 429 || response.status >= 500) {
      if (attempt === attempts)
        throw new ReleaseError(
          `npm registry returned HTTP ${response.status} for ${name} dist-tags after ${attempts} attempts.`,
        );
      await sleep(delayMs * attempt);
      continue;
    }
    if (!response.ok) throw new ReleaseError(`npm registry returned HTTP ${response.status} for ${name} dist-tags.`);
    const metadata = await parseRegistryJson(response, `${name} dist-tags`);
    if (
      !metadata ||
      typeof metadata !== 'object' ||
      metadata.name !== name ||
      (metadata['dist-tags'] !== undefined &&
        (typeof metadata['dist-tags'] !== 'object' ||
          metadata['dist-tags'] === null ||
          Array.isArray(metadata['dist-tags'])))
    ) {
      throw new ReleaseError(`npm registry returned invalid dist-tag metadata for ${name}.`);
    }
    const tagVersion = metadata['dist-tags']?.[tag];
    if (tagVersion === undefined) return null;
    if (typeof tagVersion !== 'string' || !parseSemver(tagVersion)) {
      throw new ReleaseError(`npm registry returned an invalid ${tag} dist-tag version for ${name}.`);
    }
    return tagVersion;
  }
  throw new ReleaseError(`npm registry lookup exhausted retries for ${name} dist-tag ${tag}.`);
}

/**
 * Publish all missing tarballs in dependency order and verify each exact version.
 * @param {{packages: Array<{name: string, version: string, path: string, manifest?: object}>, distTag: string, lookupVersion?: Function, lookupTag?: Function, publish?: Function, log?: Function}} options Publish inputs and injectable registry/npm operations.
 * @returns {Promise<{distTag: string, packages: Array<{name: string, version: string, status: string}>}>} Verified publication summary.
 */
export async function publishMissingPackages({
  packages,
  distTag,
  lookupVersion = lookupNpmVersion,
  lookupTag = lookupNpmDistTag,
  publish = publishTarball,
  log = console.log,
  verifyAttempts = 6,
  verifyDelayMs = 2000,
  sleep = delay,
}) {
  if (!['latest', 'dev', 'beta', 'rc'].includes(distTag))
    throw new ReleaseError(`Unsupported npm dist-tag ${JSON.stringify(distTag)}.`);
  for (const pkg of packages) {
    if (!existsSync(pkg.path))
      throw new ReleaseError(`Missing npm tarball for ${pkg.name}@${pkg.version}: ${pkg.path}`);
  }

  const ordered = orderPackagesByDependencies(packages);
  const published = [];
  for (const pkg of ordered) {
    if (await lookupVersion(pkg.name, pkg.version)) {
      log(`Skipping ${pkg.name}@${pkg.version}; the exact version already exists on npm.`);
      published.push({ name: pkg.name, version: pkg.version, status: 'skipped' });
      continue;
    }

    const currentTagVersion = await lookupTag(pkg.name, distTag);
    if (currentTagVersion && compareSemver(currentTagVersion, pkg.version) > 0) {
      throw new ReleaseError(
        `Refusing to move npm dist-tag ${distTag} for ${pkg.name} backward from ${currentTagVersion} to ${pkg.version}.`,
      );
    }

    log(`Publishing ${pkg.name}@${pkg.version} with npm dist-tag ${distTag}.`);
    await publish(pkg.path, { name: pkg.name, version: pkg.version, distTag });
    let visible = false;
    let verificationError;
    for (let attempt = 1; attempt <= verifyAttempts; attempt += 1) {
      try {
        visible = await lookupVersion(pkg.name, pkg.version);
      } catch (error) {
        verificationError = error;
      }
      if (visible) break;
      if (attempt < verifyAttempts) await sleep(verifyDelayMs * attempt);
    }
    if (!visible) {
      const message = `npm publish completed but ${pkg.name}@${pkg.version} could not be verified on the registry after ${verifyAttempts} attempts.`;
      throw new ReleaseError(message, verificationError ? { cause: verificationError } : undefined);
    }
    published.push({ name: pkg.name, version: pkg.version, status: 'published' });
  }
  return { distTag, packages: published };
}

/**
 * Validate tarballs and publish missing release package versions.
 * @param {{root?: string, directory: string, version: string, publish?: Function, lookupVersion?: Function, lookupTag?: Function, log?: Function}} options CLI/test inputs.
 * @returns {Promise<{version: string, distTag: string, packages: Array<{name: string, version: string, status: string}>}>} Release summary.
 */
export async function publishRelease({ root = projectRoot, directory, version, ...options }) {
  const parsedVersion = parseSemver(version);
  if (!parsedVersion || parsedVersion.build)
    throw new ReleaseError(`Invalid release version ${JSON.stringify(version)}.`);
  const distTag = parsedVersion.prerelease[0] ?? 'latest';
  if (!['latest', 'dev', 'beta', 'rc'].includes(distTag))
    throw new ReleaseError(`Unsupported release channel in ${version}.`);
  const expected = discoverReleasePackages({ root });
  const expectedTarballs = new Set(expected.map(({ name }) => `${name.replace('/', '-')}-${version}.tgz`));
  let artifactEntries;
  try {
    artifactEntries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    throw new ReleaseError(`Unable to read release artifact directory ${directory}.`, { cause: error });
  }
  for (const entry of artifactEntries) {
    if (!entry.isFile() || !expectedTarballs.has(entry.name)) {
      throw new ReleaseError(`Unexpected release artifact ${entry.name} in ${directory}.`);
    }
  }
  for (const expectedTarball of expectedTarballs) {
    if (!artifactEntries.some((entry) => entry.isFile() && entry.name === expectedTarball)) {
      throw new ReleaseError(`Missing expected release artifact ${expectedTarball}.`);
    }
  }
  const tarballs = expected.map(({ name }) => {
    const path = join(directory, `${name.replace('/', '-')}-${version}.tgz`);
    return validateTarball(path, { name, version, root });
  });
  const summary = await publishMissingPackages({ packages: tarballs, distTag, ...options });
  return { version, ...summary };
}

/**
 * Confirm release package versions are present on npm before creating a GitHub release.
 * @param {{packages: string[], version: string, lookupVersion?: Function}} options Registry check injection.
 * @returns {Promise<void>} Resolves when every required exact version is visible.
 */
export async function verifyPublishedVersions({ packages, version, lookupVersion = lookupNpmVersion }) {
  for (const name of packages) {
    if (!(await lookupVersion(name, version)))
      throw new ReleaseError(`Required npm package ${name}@${version} is not published.`);
  }
}

function collectEntrypoints(manifest) {
  const targets = new Set();
  for (const field of ['main', 'module', 'types', 'typings']) {
    if (typeof manifest[field] === 'string') targets.add(normalizeEntry(manifest[field]));
  }
  const visit = (exports) => {
    if (typeof exports === 'string' && exports.startsWith('.')) targets.add(normalizeEntry(exports));
    else if (exports && typeof exports === 'object') Object.values(exports).forEach(visit);
  };
  visit(manifest.exports);
  if (typeof manifest.bin === 'string') targets.add(normalizeEntry(manifest.bin));
  else if (manifest.bin && typeof manifest.bin === 'object')
    Object.values(manifest.bin).forEach((target) => targets.add(normalizeEntry(target)));
  return [...targets];
}

function normalizeEntry(target) {
  return target.replace(/^\.\//, '').replace(/^\//, '');
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new ReleaseError(`Unable to read JSON file ${path}.`, { cause: error });
  }
}

function runPnpmPack(directory, destination) {
  execFileSync('pnpm', ['pack', '--pack-destination', destination], { cwd: directory, stdio: 'inherit' });
}

async function parseRegistryJson(response, label) {
  try {
    return await response.json();
  } catch (error) {
    throw new ReleaseError(`npm registry returned invalid JSON for ${label}.`, { cause: error });
  }
}

async function delay(milliseconds) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function publishTarball(tarball, { name, version, distTag }) {
  try {
    execFileSync(
      'npm',
      ['publish', tarball, '--access', 'public', '--tag', distTag, '--provenance', '--registry', REGISTRY_URL],
      { cwd: projectRoot, stdio: 'inherit' },
    );
  } catch (error) {
    throw new ReleaseError(
      `npm publish failed for ${name}@${version}. Check that npm Trusted Publishing is configured for this repository and workflow.`,
      { cause: error },
    );
  }
}

function getHeadSubject() {
  return execFileSync('git', ['log', '-1', '--format=%s'], { cwd: projectRoot, encoding: 'utf8' }).replace(
    /\r?\n$/,
    '',
  );
}

function writeGithubOutputs(values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`, { flag: 'a' });
  else process.stdout.write(`${JSON.stringify(values)}\n`);
}

async function main() {
  const [command, value] = process.argv.slice(2);
  if (command === 'detect') {
    const context = {
      subject: value ?? getHeadSubject(),
      eventName: process.env.GITHUB_EVENT_NAME ?? 'push',
      branch: process.env.GITHUB_REF_NAME ?? 'v8',
      repository: process.env.GITHUB_REPOSITORY ?? OFFICIAL_REPOSITORY,
      actorId: process.env.GITHUB_ACTOR_ID,
    };
    let result = detectRelease({ ...context, triggeringActorId: context.actorId });
    if (result.release) result = detectRelease({ ...context, ...(await getReleaseActorContext()) });
    if (result.malformed) process.stderr.write(`::error title=Invalid release commit subject::${result.error}\n`);
    writeGithubOutputs({
      release: String(result.release),
      malformed: String(Boolean(result.malformed)),
      ...(result.release
        ? {
            version: result.version,
            channel: result.channel,
            dist_tag: result.distTag,
            prerelease: String(result.prerelease),
          }
        : {}),
    });
    return;
  }
  if (command === 'authorize') {
    const { actorId, triggeringActorId } = await getReleaseActorContext();
    if (!RELEASE_AUTHORITIES.includes(actorId) || !RELEASE_AUTHORITIES.includes(triggeringActorId)) {
      throw new ReleaseError(
        `Release requires an authorized GitHub actor and triggering actor (${RELEASE_AUTHORITIES.join(', ')}).`,
      );
    }
    return;
  }
  if (command === 'validate-subject') {
    const subject = value ?? getHeadSubject();
    parseReleaseSubject(subject);
    return;
  }
  if (command === 'sync') {
    const version = value ?? process.env.RELEASE_VERSION;
    if (!version) throw new ReleaseError('Provide a release version as an argument or in RELEASE_VERSION.');
    process.stdout.write(`${JSON.stringify({ version, packages: syncPackageVersions(version) })}\n`);
    return;
  }
  if (command === 'verify-build') {
    process.stdout.write(`${JSON.stringify(verifyBuiltPackages())}\n`);
    return;
  }
  if (command === 'pack') {
    const destination = value ?? process.env.RELEASE_TARBALL_DIR;
    if (!destination) throw new ReleaseError('Provide a tarball destination as an argument or in RELEASE_TARBALL_DIR.');
    process.stdout.write(`${JSON.stringify(packReleasePackages({ destination: resolve(destination) }))}\n`);
    return;
  }
  if (command === 'publish') {
    const directory = value ?? process.env.RELEASE_TARBALL_DIR;
    const version = process.env.RELEASE_VERSION;
    if (!directory || !version)
      throw new ReleaseError('Set RELEASE_TARBALL_DIR and RELEASE_VERSION before publishing.');
    const summary = await publishRelease({ directory: resolve(directory), version });
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    if (process.env.GITHUB_OUTPUT) {
      writeFileSync(
        process.env.GITHUB_OUTPUT,
        `packages=${JSON.stringify(summary.packages.map(({ name, version: pkgVersion }) => `${name}@${pkgVersion}`))}\n`,
        { flag: 'a' },
      );
    }
    return;
  }
  throw new ReleaseError(
    'Usage: node .github/scripts/release.mjs <detect|authorize|validate-subject|sync|verify-build|pack|publish> [value].',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.name}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
