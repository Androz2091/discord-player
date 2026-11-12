import type { StructuredData } from 'fumadocs-core/mdx-plugins';
import type { PageData, VirtualFile } from 'fumadocs-core/source';
import { getApiManifest } from './store';

/**
 * Virtual Fumadocs files for every generated API page and sidebar folder.
 *
 * Page data carries only what Fumadocs needs for navigation, the table of contents, and search. The
 * symbol content is loaded on demand by the page route.
 *
 * @returns Page and meta files with paths relative to the docs content root.
 */
export function createApiFiles(): VirtualFile[] {
  const manifest = getApiManifest();
  const files: VirtualFile[] = [];

  for (const folder of manifest.folders) {
    files.push({
      type: 'meta',
      path: `${folder.path}/meta.json`,
      data: {
        title: folder.title,
        pages: folder.pages,
        ...(folder.defaultOpen === undefined ? {} : { defaultOpen: folder.defaultOpen }),
      },
    });
  }

  for (const page of manifest.pages) {
    const structuredData: StructuredData = {
      headings: page.search.headings,
      contents: page.search.contents.map((content) => ({
        heading: content.heading || undefined,
        content: content.content,
      })),
    };

    files.push({
      type: 'page',
      path: page.path,
      // `toc` is read by the page route; Fumadocs ignores unknown page data fields.
      data: {
        title: page.title,
        description: page.description,
        toc: page.toc.map((item) => ({ title: item.title, url: item.url, depth: item.depth })),
        structuredData,
      } as PageData,
    });
  }

  return files;
}
