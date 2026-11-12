import type { Folder, Node, Root } from 'fumadocs-core/page-tree';

/** URL prefix shared by the generated API reference. */
const API_PREFIX = '/docs/v8/api/';

/** Segments of `/docs/v8/api/<language>/<package>/`: folders at or below this depth are the large ones. */
const PACKAGE_SEGMENTS = 5;

function segmentCount(url: string): number {
  return url.split('/').filter(Boolean).length;
}

function prune(node: Node, currentUrl: string): Node {
  if (node.type !== 'folder') return node;

  const indexUrl = node.index?.url ? `${node.index.url.replace(/\/$/, '')}/` : undefined;

  if (!indexUrl?.startsWith(API_PREFIX) || segmentCount(indexUrl) < PACKAGE_SEGMENTS) {
    return {
      ...node,
      children: node.children.map((child) => prune(child, currentUrl)),
    } satisfies Folder;
  }

  // A package folder only keeps its symbols when the visitor is inside that package.
  const inside = currentUrl.startsWith(indexUrl);

  return {
    ...node,
    children: inside ? node.children.map((child) => prune(child, currentUrl)) : [],
  } satisfies Folder;
}

/**
 * Trim the sidebar tree so each page only carries the symbols of the API package it is in.
 *
 * The full API reference has hundreds of entries; serializing all of them into every page would
 * multiply the exported size. Other packages stay in the sidebar as links to their index pages.
 *
 * @param tree Full page tree from the Fumadocs loader.
 * @param currentUrl URL of the page being rendered, without a trailing slash requirement; empty
 *   for pages outside the API reference.
 * @returns A new tree; the input is not modified.
 */
export function pruneApiTree(tree: Root, currentUrl: string): Root {
  const normalized = currentUrl ? `${currentUrl.replace(/\/$/, '')}/` : '';

  return { ...tree, children: tree.children.map((child) => prune(child, normalized)) };
}
