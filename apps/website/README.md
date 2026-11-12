# Discord Player documentation site

A Next.js and [Fumadocs](https://fumadocs.dev) app that is exported as a static site for GitHub Pages.

```sh
pnpm --filter @discord-player/website dev
pnpm --filter @discord-player/website build
pnpm --filter @discord-player/website start # serves the exported site from out/
```

## Documentation versions

Each major version lives in its own folder under `content/docs/` and is served from `/docs/<version>/`.

```
content/docs/
  v7/   → /docs/v7/…   (includes the API reference under v7/api)
  v8/   → /docs/v8/…
```

`src/lib/versions.ts` is the single place that controls versions:

| Setting            | Controls                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `docsVersions`     | Which versions exist, their order, display name, description, and badge                           |
| `badge`            | The label next to a version name. Change `text` and `tone` to turn `Dev` into `Release Candidate` |
| `defaultVersionId` | The "latest" version. `/docs`, `/api`, and old unversioned links redirect to it                   |
| `apiReference`     | Where a version's API reference lives, so `/api` can find it                                      |

To add a version, add an entry to `docsVersions` and create `content/docs/<id>/`. A folder in `content/docs/` that is not listed in `docsVersions` fails the build.

### Redirects

GitHub Pages cannot send HTTP redirects, so moved URLs are generated as small static pages that redirect in the browser (and keep the URL fragment):

- `/docs` goes to the default version.
- `/docs/<page>` goes to the default version's page, or to the first version that has it.
- `/api/<page>` goes to the default version's API reference, or to the version that has the page.
- `/showcase` goes to `/community`.

### Search and switching

Each version has its own search index at `/api/search/<version>`. The search dialog uses the version of the page being read, and the default version elsewhere.

The version selector opens the same page in another version when it exists. Otherwise it opens the closest parent section, then the version root.

## Content

Pages are MDX. `meta.json` files define titles and order. `v7` content is a snapshot of the released v7 documentation and is excluded from the formatter, so keep edits there minimal.

The Community page reads `src/data/community.ts`. Add a project by adding an entry to it.

## Generated routes

| Route                                                       | Purpose                            |
| ----------------------------------------------------------- | ---------------------------------- |
| `/llms.txt`, `/llms-full.txt`                               | Text export of the default version |
| `/llms/<version>/llms.txt`, `/llms/<version>/llms-full.txt` | Text export of one version         |
| `/llms.mdx/docs/<version>/<page>/content.md`                | Markdown of one page               |
| `/og/docs/<version>/<page>/image.png`                       | Social preview image               |
| `/sitemap.xml`                                              | Every page of every version        |
