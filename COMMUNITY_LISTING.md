# Community listing requirements

The community directory lists extractors, plugins, and music bots built for Discord Player.

By submitting a project for inclusion, you agree to these guidelines.

## Eligibility

- A public GitHub repository link is mandatory for every listing. Set `repositoryUrl` to the project's GitHub repository.
- The project's source code must be publicly accessible. Private projects and private repositories are not allowed.
- A project website, bot invitation, or npm package link does not replace the required public GitHub repository link.

## Submit a project

Open a pull request updating [apps/website/src/data/community.ts](apps/website/src/data/community.ts) and add your project to the appropriate collection:

- `extractors`: media source integrations. Both `repositoryUrl` and `npmUrl` are required; link to the public source repository and published npm package.
- `plugins`: functionality beyond media extraction, such as lyrics providers or queue behavior extensions, with a required `repositoryUrl` and optional `npmUrl`.
- `bots`: music bots, with the required public GitHub `repositoryUrl`, an optional `websiteUrl`, and the Discord Player `version` when known.

Include a clear `name` and short `description`. Optional metadata includes `author` and `deprecated`. Custom icons and image URLs are not accepted. Avatars are inferred automatically from supported repository hosts (currently GitHub); unsupported hosts and failed images use project initials. Mark deprecated projects with `deprecated: true` rather than changing their names.

Leave `PromotedList` and `featured` selections to the maintainers. Featured status does not indicate version compatibility. Maintainers review submissions before inclusion.

Listings are provided for discovery and do not imply official endorsement, maintenance, or support unless explicitly stated. Review the [Legal Notice](LEGAL.md) before integrating third-party resources.

## Responsibility and compliance

Project authors and users are responsible for their resources and how they are used, including compliance with the [Legal Notice](LEGAL.md), applicable laws, copyright and licensing requirements, and third-party Terms of Service. Submitting or listing a project does not grant permission to access or stream third-party content.

Discord Player does not guarantee that listed resources comply with these requirements. To the extent permitted by applicable law, Discord Player and its authors, contributors, and maintainers do not assume responsibility or liability for listed resources that violate the Legal Notice, infringe rights, breach third-party terms, or are otherwise used unlawfully. Nothing in these guidelines limits liability that cannot legally be excluded or overrides the project's applicable license.

## Review and removal

Maintainers may decline a submission or edit or remove a listing at their discretion, including when a project no longer meets these guidelines, raises security or compliance concerns, or is the subject of a removal request from its author, a rights holder, a service provider, or another affected party. Inclusion does not guarantee continued availability in the directory.

Send legal concerns and removal requests to the contacts in the [Legal Notice](LEGAL.md), identifying the listing and the reason for the request. Maintainers review requests and may remove a listing while a concern is being assessed. Removal does not by itself establish that a project has violated a law or third-party terms.
