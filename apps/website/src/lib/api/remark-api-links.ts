import type { DocLink, DocText } from '@docs-scripts/model.ts';
import { linkKeys } from '@docs-scripts/link-keys.ts';

/** Minimal mdast node shape used by the plugin, avoiding a dependency on `@types/mdast`. */
interface MdastNode {
  type: string;
  url?: string;
  label?: string | null;
  identifier?: string;
  children?: MdastNode[];
  referenceType?: string;
  title?: string | null;
}

function hrefOf(link: DocLink | undefined): string | undefined {
  return link?.href ?? link?.external;
}

/**
 * Remark plugin that turns structured documentation links into real links.
 *
 * TypeScript `{@link}` tags are written as `[text](ref:N)`; rustdoc intra-doc links are shortcut,
 * collapsed or full references (and inline destinations) whose written text keys the rustdoc `links`
 * table. Both resolve through the link table produced at generation time, never through name matching.
 *
 * @param doc Documentation text whose `links` table was resolved by the generator.
 * @returns A remark plugin.
 */
export function remarkApiLinks(doc: DocText) {
  const links = doc.links ?? {};

  return () => (tree: MdastNode) => {
    const visit = (node: MdastNode, parent?: MdastNode, index?: number) => {
      if (node.type === 'link' && node.url) {
        const href = hrefOf(links[node.url]);

        if (href) node.url = href;
      } else if (node.type === 'linkReference') {
        const key = linkKeys(node.label ?? node.identifier ?? '').find((candidate) => links[candidate]);
        const href = key ? hrefOf(links[key]) : undefined;

        if (href) {
          node.type = 'link';
          node.url = href;
          delete node.referenceType;
          delete node.identifier;
          delete node.label;
        } else if (parent && index !== undefined) {
          // An unresolved reference stays readable as its inner text.
          parent.children?.splice(index, 1, ...(node.children ?? []));

          return;
        }
      }

      node.children?.forEach((child, childIndex) => visit(child, node, childIndex));
    };

    visit(tree);
  };
}
