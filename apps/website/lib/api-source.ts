import { apiDocs, apiMeta } from '@/.source';
import { createMDXSource } from 'fumadocs-mdx';
import { loader } from 'fumadocs-core/source';

export const apiSource = loader({
  baseUrl: '/api',
  source: createMDXSource(apiDocs, apiMeta),
});
