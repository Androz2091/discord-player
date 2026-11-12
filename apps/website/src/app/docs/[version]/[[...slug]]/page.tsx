import { ApiPageBody } from '@/components/api/api-page';
import { getManifestPage, isApiPath, loadApiPage } from '@/lib/api/store';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getMDXComponents } from '@/components/mdx';
import { RedirectPage } from '@/components/redirect-page';
import { VersionBadge } from '@/components/version-badge';
import { getPage, getPageSlugs, getSource } from '@/lib/source';
import { getUnversionedPaths, resolveUnversionedPath } from '@/lib/legacy-routes';
import { getPageImageUrl, getPageMarkdownUrl, getPageSourceUrl } from '@/lib/shared';
import { getDocsVersion, getDocsVersions, isDocsVersionId } from '@/lib/versions';

export const dynamicParams = false;

type Props = PageProps<'/docs/[version]/[[...slug]]'>;

export default async function Page(props: Props) {
  const { version, slug = [] } = await props.params;

  if (!isDocsVersionId(version)) {
    const target = resolveUnversionedPath([version, ...slug]);

    if (!target) notFound();

    return <RedirectPage href={target} />;
  }

  const page = getPage(version, slug);

  if (!page) notFound();

  const MDX = page.data.body;
  const manifestPage = version === 'v8' && isApiPath(page.path) ? getManifestPage(page.url) : undefined;
  const apiFile = manifestPage ? loadApiPage(manifestPage) : undefined;
  const markdownUrl = getPageMarkdownUrl({ version, slugs: page.slugs }).url;
  const { badge } = getDocsVersion(version);

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row flex-wrap gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={apiFile?.type === 'symbol' ? apiFile.page.sourceUrl : getPageSourceUrl(version, page.path)}
        />
        {badge ? (
          <span className="ms-auto inline-flex items-center gap-1.5 text-xs text-fd-muted-foreground">
            You are reading the {getDocsVersion(version).name} docs
            <VersionBadge badge={badge} />
          </span>
        ) : null}
      </div>
      <DocsBody>
        {apiFile ? (
          <ApiPageBody file={apiFile} />
        ) : (
          <MDX components={getMDXComponents({ a: createRelativeLink(getSource(version), page) })} />
        )}
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  const versioned = getDocsVersions().flatMap((version) =>
    getPageSlugs(version.id).map((slug) => ({ version: version.id, slug: slug === '' ? [] : slug.split('/') })),
  );

  const unversioned = getUnversionedPaths().map(([version, ...slug]) => ({ version: version as string, slug }));

  return [...versioned, ...unversioned];
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { version, slug = [] } = await props.params;

  if (!isDocsVersionId(version)) {
    const target = resolveUnversionedPath([version, ...slug]);

    return { title: 'Moved', alternates: target ? { canonical: target } : undefined };
  }

  const page = getPage(version, slug);

  if (!page) notFound();

  const image = getPageImageUrl({ version, slugs: page.slugs }).url;
  const { name } = getDocsVersion(version);

  return {
    title: page.data.title.includes(name) ? page.data.title : `${page.data.title} (${name})`,
    description: page.data.description,
    alternates: { canonical: page.url },
    openGraph: { images: image },
    twitter: { card: 'summary_large_image', images: image },
  };
}
