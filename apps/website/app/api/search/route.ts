import { createSearchAPI } from 'fumadocs-core/search/server';
import { apiSource } from '@/lib/api-source';
import { source } from '@/lib/source';

// Static export: emit the full search index at build time and serve it as a
// static file. The client (RootProvider search.type = 'static') downloads this
// once and runs Orama in the browser — no server needed.
export const revalidate = false;

export const { staticGET: GET } = createSearchAPI('advanced', {
  indexes: [
    ...source.getPages().map((page) => ({
      title: page.data.title,
      description: page.data.description,
      id: page.url,
      url: page.url,
      structuredData: page.data.structuredData,
      tag: 'guide',
    })),
    ...apiSource.getPages().map((page) => ({
      title: page.data.title,
      description: page.data.description,
      id: page.url,
      url: page.url,
      structuredData: page.data.structuredData,
      tag: 'api',
    })),
  ],
});
