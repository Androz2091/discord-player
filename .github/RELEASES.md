# CI and npm releases

`.github/workflows/ci.yaml` runs on every branch push, pull request, and manual dispatch. It installs with the pnpm version declared in the root `packageManager`, then runs lint, formatting, typechecking, all workspace builds, all workspace tests, release-tool tests, and publishable entrypoint checks. The website deployment remains in `deploy-website.yml`.

## Release commits

Only complete HEAD subjects in this form are release candidates:

```text
chore: release 8.0.0
chore: release 8.0.0-dev.1
chore: release 8.0.0-beta.2
chore: release 8.0.0-rc.1
```

Publication is enabled only for pushes and manual reruns on `v8` or `master` in `Androz2091/discord-player`. Pull requests, forks, and other branches run checks only. The authorized branches are listed in `RELEASE_BRANCHES` in `scripts/release.mjs`.

`RELEASE_AUTHORITIES` permits only GitHub account IDs `46562212` (twlite) and `42497995` (Androz2091). Both the original workflow actor and the person starting the current attempt must be authorized. This checks the authenticated pusher or manual dispatcher, rather than editable Git commit author names/emails. Reruns by a different account resolve its numeric ID through the GitHub API and fail closed if it cannot be verified. Publish and GitHub release jobs check authority again so rerunning only a failed job cannot bypass detection. Unauthorized actors still receive normal CI validation.

The release inventory is `.github/release-packages.json`; it currently includes `discord-player` and `create-music-bot`. The release script compares that inventory to every non-private package under `packages/`, so a new public package must be deliberately added before a release can proceed. Apps and the root workspace keep their own versions. Synchronization is temporary to the workflow checkout and never commits version changes.

The npm tags are `latest` for stable versions and `dev`, `beta`, or `rc` for prereleases. Existing exact package versions are skipped without changing their dist-tags. Before publishing a missing version, the publisher checks that its target channel would not move backward. npm publication uses direct `npm publish` with provenance and GitHub Actions OIDC; it does not use an npm token or a separate `npm dist-tag` command.

## npm Trusted Publishing setup

Configure Trusted Publishing separately on npmjs.com for each package in `.github/release-packages.json`:

- Provider: GitHub Actions
- GitHub owner: `Androz2091`
- Repository: `discord-player`
- Workflow filename: `ci.yaml`
- GitHub environment: none (the workflow does not use an environment)
- Permission: allow direct package publishing with `npm publish`

The publisher job uses Node.js 24, npm 11.21.0, a GitHub-hosted Ubuntu runner, and `id-token: write`. npm's trusted publisher setup provides registry authentication through OIDC and provenance. No separate dist-tag permission is needed because each channel is selected on `npm publish` itself.

A package that has never been published may not yet appear in npm's Trusted Publisher settings. Bootstrap that package once through an authorized npm owner action outside CI, then configure its Trusted Publisher before the first automated release. Do not add npm credentials to GitHub Actions. OIDC or publisher-setting failures stop publication with the package and workflow configuration called out in the error.

The workflow first verifies every built tarball, then publishes or verifies every exact package version, and only then creates one GitHub release for `v<version>`. The GitHub release job verifies the npm package versions again, checks that an existing tag resolves to the triggering commit, and reuses an existing release instead of creating a duplicate.
