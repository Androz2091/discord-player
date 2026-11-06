import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverReleasePackages, parseSemver, verifyPublishedVersions } from './release.mjs';

const API_ROOT = 'https://api.github.com';
const expectedOwner = 'Androz2091';
const expectedRepository = 'discord-player';

export class GitHubReleaseError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'GitHubReleaseError';
  }
}

/**
 * Create or reuse a GitHub release after verifying the release package versions on npm.
 * @param {{owner: string, repository: string, version: string, commitSha: string, packages: string[], token: string, fetchImpl?: typeof fetch, lookupVersion?: Function, sleep?: Function, log?: Function}} options Release identity and injectable APIs.
 * @returns {Promise<{tag: string, name: string, prerelease: boolean, url: string | null, created: boolean}>} Verified GitHub release.
 */
export async function createOrReuseGithubRelease({
  owner,
  repository,
  version,
  commitSha,
  packages,
  token,
  fetchImpl = fetch,
  lookupVersion,
  sleep = delay,
  log = console.log,
}) {
  if (owner !== expectedOwner || repository !== expectedRepository) {
    throw new GitHubReleaseError(`GitHub releases are authorized only for ${expectedOwner}/${expectedRepository}.`);
  }
  const semver = parseSemver(version);
  if (!semver || semver.build || semver.prerelease.length > 2)
    throw new GitHubReleaseError(`Invalid release version ${JSON.stringify(version)}.`);
  const prerelease = semver.prerelease.length > 0;
  const channel = semver.prerelease[0];
  if (
    prerelease &&
    (!['dev', 'beta', 'rc'].includes(channel) || semver.prerelease.length !== 2 || !/^\d+$/.test(semver.prerelease[1]))
  ) {
    throw new GitHubReleaseError(`Unsupported release version ${JSON.stringify(version)}.`);
  }
  if (typeof commitSha !== 'string' || !/^[0-9a-f]{40}$/i.test(commitSha))
    throw new GitHubReleaseError('A full triggering commit SHA is required.');
  if (!Array.isArray(packages) || packages.length === 0 || packages.some((name) => typeof name !== 'string')) {
    throw new GitHubReleaseError('The required release package list is empty or invalid.');
  }
  if (typeof token !== 'string' || token.length === 0)
    throw new GitHubReleaseError('GITHUB_TOKEN is unavailable for GitHub release creation.');

  await verifyPublishedVersions({ packages, version, ...(lookupVersion ? { lookupVersion } : {}) });

  const tag = `v${version}`;
  const releaseName = `Discord Player ${tag}`;
  const client = createGithubClient({ owner, repository, token, fetchImpl, sleep });
  await ensureTag(client, tag, commitSha);

  let existing = await client.request(`/releases/tags/${encodeURIComponent(tag)}`, { allow404: true });
  if (existing) {
    verifyExistingRelease(existing, { tag, releaseName, prerelease });
    const expectedBody = updatePackageSection(existing.body ?? '', packages, version);
    if (expectedBody !== (existing.body ?? '') || existing.draft) {
      existing = await client.request(`/releases/${existing.id}`, {
        method: 'PATCH',
        body: { body: expectedBody, draft: false },
      });
      verifyExistingRelease(existing, { tag, releaseName, prerelease });
      log(`Finalized existing GitHub release ${tag}.`);
    } else {
      log(`Reusing existing GitHub release ${tag}.`);
    }
    return { tag, name: releaseName, prerelease, url: existing.html_url ?? null, created: false };
  }

  const generatedNotes = await client.request('/releases/generate-notes', {
    method: 'POST',
    body: { tag_name: tag, target_commitish: commitSha },
  });
  const body = updatePackageSection(generatedNotes.body ?? '', packages, version);
  try {
    const created = await client.request('/releases', {
      method: 'POST',
      body: {
        tag_name: tag,
        target_commitish: commitSha,
        name: releaseName,
        body,
        draft: false,
        prerelease,
      },
    });
    verifyExistingRelease(created, { tag, releaseName, prerelease });
    log(`Created GitHub ${prerelease ? 'prerelease' : 'release'} ${tag}.`);
    return { tag, name: releaseName, prerelease, url: created.html_url ?? null, created: true };
  } catch (error) {
    if (!(error instanceof GitHubReleaseError) || !error.message.includes('HTTP 422')) throw error;
    const raced = await client.request(`/releases/tags/${encodeURIComponent(tag)}`, { allow404: true });
    if (!raced) throw error;
    verifyExistingRelease(raced, { tag, releaseName, prerelease });
    const expectedBody = updatePackageSection(raced.body ?? '', packages, version);
    const reused =
      expectedBody !== (raced.body ?? '') || raced.draft
        ? await client.request(`/releases/${raced.id}`, { method: 'PATCH', body: { body: expectedBody, draft: false } })
        : raced;
    return { tag, name: releaseName, prerelease, url: reused.html_url ?? null, created: false };
  }
}

function createGithubClient({ owner, repository, token, fetchImpl, sleep }) {
  const base = `${API_ROOT}/repos/${owner}/${repository}`;
  return {
    async request(path, { method = 'GET', body, allow404 = false } = {}) {
      const url = path.startsWith('http') ? path : `${base}${path}`;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        let response;
        try {
          response = await fetchImpl(url, {
            method,
            headers: {
              accept: 'application/vnd.github+json',
              authorization: `Bearer ${token}`,
              'x-github-api-version': '2022-11-28',
              ...(body ? { 'content-type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
        } catch (error) {
          if (attempt === 4)
            throw new GitHubReleaseError(`GitHub API request failed for ${method} ${path}: ${error.message}`, {
              cause: error,
            });
          await sleep(attempt * 500);
          continue;
        }
        if (allow404 && response.status === 404) return null;
        if (response.status === 429 || response.status >= 500) {
          if (attempt === 4)
            throw new GitHubReleaseError(
              `GitHub API returned HTTP ${response.status} for ${method} ${path} after 4 attempts.`,
            );
          await sleep(attempt * 500);
          continue;
        }
        if (!response.ok) {
          let detail = '';
          try {
            detail = (await response.json()).message ?? '';
          } catch {}
          throw new GitHubReleaseError(
            `GitHub API returned HTTP ${response.status} for ${method} ${path}${detail ? `: ${detail}` : ''}.`,
          );
        }
        try {
          return await response.json();
        } catch (error) {
          throw new GitHubReleaseError(`GitHub API returned invalid JSON for ${method} ${path}.`, { cause: error });
        }
      }
      throw new GitHubReleaseError(`GitHub API request exhausted retries for ${method} ${path}.`);
    },
  };
}

async function ensureTag(client, tag, commitSha) {
  let existing = await getTagTarget(client, tag);
  if (existing !== null) {
    if (existing !== commitSha)
      throw new GitHubReleaseError(
        `Git tag ${tag} already points to ${existing}, expected ${commitSha}; refusing to move it.`,
      );
    return;
  }
  try {
    await client.request('/git/refs', { method: 'POST', body: { ref: `refs/tags/${tag}`, sha: commitSha } });
  } catch (error) {
    if (!(error instanceof GitHubReleaseError) || !error.message.includes('HTTP 422')) throw error;
  }
  existing = await getTagTarget(client, tag);
  if (existing !== commitSha)
    throw new GitHubReleaseError(`Git tag ${tag} could not be verified at the triggering commit ${commitSha}.`);
}

async function getTagTarget(client, tag) {
  const ref = await client.request(`/git/ref/tags/${encodeURIComponent(tag)}`, { allow404: true });
  if (!ref) return null;
  let object = ref.object;
  for (let depth = 0; depth < 5 && object?.type === 'tag'; depth += 1) {
    const annotated = await client.request(`/git/tags/${object.sha}`);
    object = annotated.object;
  }
  if (object?.type !== 'commit' || typeof object.sha !== 'string') {
    throw new GitHubReleaseError(`Git tag ${tag} does not resolve directly to a commit.`);
  }
  return object.sha;
}

function verifyExistingRelease(release, { tag, releaseName, prerelease }) {
  if (release.tag_name !== tag)
    throw new GitHubReleaseError(`GitHub release tag mismatch: expected ${tag}, found ${release.tag_name}.`);
  if (release.name !== releaseName)
    throw new GitHubReleaseError(`GitHub release ${tag} has unexpected title ${JSON.stringify(release.name)}.`);
  if (release.prerelease !== prerelease)
    throw new GitHubReleaseError(`GitHub release ${tag} has an incorrect prerelease setting.`);
}

function updatePackageSection(body, packages, version) {
  const lines = ['## Published packages', '', ...packages.map((name) => `- ${name}@${version}`)];
  const content = body.split('\n');
  const sectionStart = content.findIndex((line) => line.trim() === '## Published packages');
  if (sectionStart >= 0) {
    let sectionEnd = sectionStart + 1;
    while (sectionEnd < content.length && !/^#{1,6}\s/.test(content[sectionEnd])) sectionEnd += 1;
    content.splice(sectionStart, sectionEnd - sectionStart, ...lines);
    return content.join('\n').trimEnd();
  }
  return `${body.trimEnd()}${body.trim() ? '\n\n' : ''}${lines.join('\n')}`;
}

async function delay(milliseconds) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function main() {
  const [command, value] = process.argv.slice(2);
  if (command !== 'create')
    throw new GitHubReleaseError('Usage: node .github/scripts/github-release.mjs create [version].');
  const version = value ?? process.env.RELEASE_VERSION;
  const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  if (!version || !owner || !repository || !process.env.GITHUB_SHA || !process.env.GITHUB_TOKEN) {
    throw new GitHubReleaseError('Set RELEASE_VERSION, GITHUB_REPOSITORY, GITHUB_SHA, and GITHUB_TOKEN.');
  }
  const packages = discoverReleasePackages().map(({ name }) => name);
  const result = await createOrReuseGithubRelease({
    owner,
    repository,
    version,
    commitSha: process.env.GITHUB_SHA,
    packages,
    token: process.env.GITHUB_TOKEN,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `tag=${result.tag}\nurl=${result.url ?? ''}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.name}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
