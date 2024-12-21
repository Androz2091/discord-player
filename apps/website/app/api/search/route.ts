import { createSearchAPI } from 'fumadocs-core/search/server';
import { apiSource } from '@/lib/api-source';
import { source } from '@/lib/source';

export const { GET } = createSearchAPI('advanced', {
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
