import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { getSource } from '@/lib/source';
import { isDocsVersionId } from '@/lib/versions';

/**
 * The first segment under `/docs` is a documentation version. Any other value is a legacy unversioned URL that
 * renders a redirect without the documentation chrome.
 */
export default async function Layout({ children, params }: LayoutProps<'/docs/[version]'>) {
  const { version } = await params;

  if (!isDocsVersionId(version)) return children;

  return (
    <DocsLayout tree={getSource(version).getPageTree()} {...baseOptions(version)}>
      {children}
    </DocsLayout>
  );
}
