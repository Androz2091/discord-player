import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { isDocsVersionId } from '@/lib/versions';
import { getSource } from '@/lib/source';
import { pruneApiTree } from '@/lib/api/tree';

/** Expand only the generated API package being viewed. */
export default async function Layout({ children, params }: LayoutProps<'/docs/[version]/[[...slug]]'>) {
  const { version, slug = [] } = await params;

  if (!isDocsVersionId(version)) return children;

  return (
    <DocsLayout
      tree={pruneApiTree(getSource(version).getPageTree(), `/docs/${version}/${slug.join('/')}`)}
      {...baseOptions(version)}
    >
      {children}
    </DocsLayout>
  );
}
