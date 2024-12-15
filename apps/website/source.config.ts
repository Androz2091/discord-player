import { defineDocs, defineConfig } from 'fumadocs-mdx/config';
import { remarkInstall } from 'fumadocs-docgen';
import { remarkAdmonition } from 'fumadocs-core/mdx-plugins';

export const { docs, meta } = defineDocs({
  dir: ['content/docs'],
});

export const { docs: apiDocs, meta: apiMeta } = defineDocs({
  dir: ['content/api'],
});

export default defineConfig({
  mdxOptions: {
    // @ts-expect-error type issue
    remarkPlugins: [remarkInstall, remarkAdmonition],
  },
});
