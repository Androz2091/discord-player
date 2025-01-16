import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/app/layout.config';
import { apiSource } from '@/lib/api-source';

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <DocsLayout tree={apiSource.pageTree} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}
