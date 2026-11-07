# Discord Player documentation site

This Next.js and Fumadocs app contains Discord Player's user-facing documentation. Pages are grouped by
workspace module under `content/docs/`. The `meta.json` files define titles and navigation order.

From the repository root, run:

```sh
pnpm --filter docs dev
pnpm --filter docs build
pnpm --filter docs start
```

The landing page is `content/docs/index.mdx`. Shared layout and source configuration are under
`src/lib/`.
