import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrReuseGithubRelease, GitHubReleaseError } from './github-release.mjs';

const owner = 'Androz2091';
const repository = 'discord-player';
const commitSha = 'a'.repeat(40);
const packages = ['discord-player', 'create-music-bot'];

function apiResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,

    async json() {
      return body;
    },
  };
}

function githubFixture({ tagSha = null, release = null } = {}) {
  const state = { tagSha, release, calls: [] };
  const fetchImpl = async (url, request) => {
    const parsed = new URL(url);
    const prefix = `/repos/${owner}/${repository}`;
    const path = parsed.pathname.slice(prefix.length);
    const method = request.method ?? 'GET';
    const body = request.body ? JSON.parse(request.body) : undefined;

    state.calls.push({ method, path, body });

    if (method === 'GET' && path.startsWith('/git/ref/tags/')) {
      return state.tagSha
        ? apiResponse(200, { object: { type: 'commit', sha: state.tagSha } })
        : apiResponse(404, { message: 'Not Found' });
    }

    if (method === 'POST' && path === '/git/refs') {
      if (state.tagSha) return apiResponse(422, { message: 'Reference already exists' });

      state.tagSha = body.sha;

      return apiResponse(201, { ref: body.ref, object: { type: 'commit', sha: body.sha } });
    }

    if (method === 'GET' && path.startsWith('/releases/tags/')) {
      return state.release ? apiResponse(200, state.release) : apiResponse(404, { message: 'Not Found' });
    }

    if (method === 'POST' && path === '/releases/generate-notes') {
      return apiResponse(200, { body: '## Changes\n\n- Added a feature.' });
    }

    if (method === 'POST' && path === '/releases') {
      if (state.release) return apiResponse(422, { message: 'Validation failed' });

      state.release = {
        id: 17,
        tag_name: body.tag_name,
        name: body.name,
        body: body.body,
        prerelease: body.prerelease,
        draft: body.draft,
        html_url: `https://github.com/${owner}/${repository}/releases/tag/${body.tag_name}`,
      };

      return apiResponse(201, state.release);
    }

    if (method === 'PATCH' && path === '/releases/17') {
      state.release = { ...state.release, ...body };

      return apiResponse(200, state.release);
    }

    return apiResponse(500, { message: `Unexpected ${method} ${path}` });
  };

  return { state, fetchImpl };
}

function run(fixture, options = {}) {
  return createOrReuseGithubRelease({
    owner,
    repository,
    version: '8.0.0',
    commitSha,
    packages,
    token: 'github-test-token',
    fetchImpl: fixture.fetchImpl,

    lookupVersion: async () => true,

    sleep: async () => {},

    log: () => {},

    ...options,
  });
}

test('creates a stable GitHub release with generated notes, package versions, and an immutable tag', async () => {
  const fixture = githubFixture();
  const result = await run(fixture);

  assert.deepEqual(result, {
    tag: 'v8.0.0',
    name: 'Discord Player v8.0.0',
    prerelease: false,
    url: 'https://github.com/Androz2091/discord-player/releases/tag/v8.0.0',
    created: true,
  });
  assert.equal(fixture.state.tagSha, commitSha);
  assert.equal(fixture.state.release.prerelease, false);
  assert.match(fixture.state.release.body, /## Changes/);
  assert.match(fixture.state.release.body, /- discord-player@8\.0\.0/);
  assert.match(fixture.state.release.body, /- create-music-bot@8\.0\.0/);
  assert.equal(fixture.state.calls.filter(({ method, path }) => method === 'POST' && path === '/releases').length, 1);
});

test('creates a GitHub prerelease for dev, beta, and rc versions', async () => {
  for (const version of ['8.0.0-dev.4', '8.0.0-beta.2', '8.0.0-rc.1']) {
    const fixture = githubFixture();
    const result = await run(fixture, { version });

    assert.equal(result.tag, `v${version}`);
    assert.equal(result.prerelease, true);
    assert.equal(fixture.state.release.prerelease, true);
  }
});

test('reuses an existing release for a correct tag and version without duplicate creation', async () => {
  const body =
    '## Changes\n\n- Existing notes.\n\n## Published packages\n\n- discord-player@8.0.0\n- create-music-bot@8.0.0';
  const fixture = githubFixture({
    tagSha: commitSha,
    release: {
      id: 17,
      tag_name: 'v8.0.0',
      name: 'Discord Player v8.0.0',
      body,
      prerelease: false,
      draft: false,
      html_url: 'https://github.com/Androz2091/discord-player/releases/tag/v8.0.0',
    },
  });
  const result = await run(fixture);

  assert.equal(result.created, false);
  assert.equal(
    fixture.state.calls.some(({ method, path }) => method === 'POST' && path === '/releases'),
    false,
  );
  assert.equal(
    fixture.state.calls.some(({ method, path }) => method === 'PATCH' && path === '/releases/17'),
    false,
  );
});

test('finalizes a matching existing draft after all npm packages are verified', async () => {
  const fixture = githubFixture({
    tagSha: commitSha,
    release: {
      id: 17,
      tag_name: 'v8.0.0',
      name: 'Discord Player v8.0.0',
      body: '## Changes\n\n- Existing notes.',
      prerelease: false,
      draft: true,
      html_url: 'https://github.com/Androz2091/discord-player/releases/tag/v8.0.0',
    },
  });

  await run(fixture);

  assert.equal(fixture.state.release.draft, false);
  assert.match(fixture.state.release.body, /create-music-bot@8\.0\.0/);
  assert.equal(
    fixture.state.calls.some(({ method, path }) => method === 'POST' && path === '/releases'),
    false,
  );
});

test('fails if an existing immutable tag points to another commit', async () => {
  const fixture = githubFixture({ tagSha: 'b'.repeat(40) });

  await assert.rejects(run(fixture), /refusing to move it/);

  assert.equal(
    fixture.state.calls.some(({ method, path }) => method === 'POST' && path === '/releases'),
    false,
  );
});

test('does not create a tag or release until every npm package is confirmed published', async () => {
  const fixture = githubFixture();

  await assert.rejects(
    run(fixture, {
      lookupVersion: async (name) => name === 'discord-player',
    }),
    /create-music-bot@8\.0\.0 is not published/,
  );

  assert.deepEqual(fixture.state.calls, []);
  assert.equal(fixture.state.tagSha, null);
  assert.equal(fixture.state.release, null);
});

test('rerunning after npm publication completes the release without creating duplicates', async () => {
  const fixture = githubFixture();

  await run(fixture);

  const callsAfterFirst = fixture.state.calls.filter(
    ({ method, path }) => method === 'POST' && path === '/releases',
  ).length;
  const second = await run(fixture);
  const callsAfterSecond = fixture.state.calls.filter(
    ({ method, path }) => method === 'POST' && path === '/releases',
  ).length;

  assert.equal(callsAfterFirst, 1);
  assert.equal(callsAfterSecond, 1);
  assert.equal(second.created, false);
});

test('rejects an incorrect owner, unsupported channel, or malformed triggering commit', async () => {
  const fixture = githubFixture();

  await assert.rejects(run(fixture, { owner: 'someone-else' }), /authorized only/);
  await assert.rejects(run(fixture, { version: '8.0.0-alpha.1' }), GitHubReleaseError);
  await assert.rejects(run(fixture, { commitSha: 'short-sha' }), /full triggering commit SHA/);

  assert.deepEqual(fixture.state.calls, []);
});
