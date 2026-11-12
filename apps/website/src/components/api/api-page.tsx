import { Link } from 'fumadocs-core/link';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Heading } from 'fumadocs-ui/components/heading';
import { ExternalLink } from 'lucide-react';
import type { ApiPage, ApiPageFile, OverviewPage, SymbolNode } from '@docs-scripts/model.ts';
import { isModuleLike, pageSections } from '@docs-scripts/sections.ts';
import { DeprecatedNotice, DocsDetails, DocsMarkdown } from './docs-view';
import { SectionsView } from './members-view';
import { CallableView, DeclarationCode, Provenance } from './signature-view';
import { Badge, KindBadge } from './ui';

const CALLABLE_PAGE_KINDS = new Set(['function']);

/** Header: kind and language badges, qualified path, source link and breadcrumbs. */
function PageHeader({ page }: { page: ApiPage }) {
  const symbol = page.symbol;

  return (
    <div className="not-prose mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge>{symbol.languageKind}</KindBadge>
        <Badge>{page.language === 'typescript' ? 'TypeScript' : 'Rust'}</Badge>
        <Badge>{page.package}</Badge>
        {symbol.docs.modifiers.map((modifier) => (
          <Badge key={modifier} tone="warning">
            {modifier}
          </Badge>
        ))}
        {symbol.docs.deprecated ? <Badge tone="warning">deprecated</Badge> : null}
        {symbol.ts?.generated ? <Badge>generated</Badge> : null}
      </div>
      <nav aria-label="API path" className="flex flex-wrap items-center gap-x-1.5 text-sm text-fd-muted-foreground">
        {page.breadcrumbs.map((crumb) => (
          <span key={crumb.url} className="inline-flex items-center gap-x-1.5">
            <Link href={crumb.url} className="hover:text-fd-foreground hover:underline">
              {crumb.title}
            </Link>
            <span aria-hidden="true">/</span>
          </span>
        ))}
        <code className="rounded bg-fd-muted/50 px-1.5 py-0.5 text-fd-foreground">{page.qualifiedName}</code>
      </nav>
      {page.sourceUrl ? (
        <a
          href={page.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-sm text-fd-muted-foreground hover:text-fd-foreground hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          View source
          {symbol.source ? (
            <span className="font-mono">
              {symbol.source.file}:{symbol.source.line}
            </span>
          ) : null}
        </a>
      ) : null}
    </div>
  );
}

async function SymbolBody({ symbol }: { symbol: SymbolNode }) {
  const callable = CALLABLE_PAGE_KINDS.has(symbol.kind) && symbol.signatures.length > 0;

  if (callable) {
    return (
      <>
        <Provenance symbol={symbol} />
        <CallableView symbol={symbol} idPrefix="signature" />
      </>
    );
  }

  return (
    <>
      <DeclarationCode symbol={symbol} />
      <DeprecatedNotice docs={symbol.docs} />
      {symbol.docs.summary ? <DocsMarkdown doc={symbol.docs.summary} /> : null}
      <DocsDetails docs={symbol.docs} />
    </>
  );
}

async function SymbolPage({ page }: { page: ApiPage }) {
  const symbol = page.symbol;
  const sections = pageSections(symbol, symbol.entries);

  return (
    <>
      <PageHeader page={page} />
      {isModuleLike(symbol) ? (
        <>
          {symbol.docs.summary ? <DocsMarkdown doc={symbol.docs.summary} /> : null}
          <DocsDetails docs={symbol.docs} />
        </>
      ) : (
        <SymbolBody symbol={symbol} />
      )}
      <SectionsView sections={sections} />
    </>
  );
}

function OverviewView({ page }: { page: OverviewPage }) {
  const languages = page.language ? [page.language] : (['typescript'] as const);

  return (
    <>
      <p>{page.description}</p>
      {languages.map((language) => {
        const packages = page.packages.filter((pkg) => pkg.language === language);

        return (
          <section key={language}>
            {page.language ? null : (
              <Heading as="h2" id={language}>
                {language === 'typescript' ? 'TypeScript packages' : 'Rust crates'}
              </Heading>
            )}
            <Cards className="not-prose">
              {packages.map((pkg) => (
                <Card
                  key={pkg.name}
                  href={pkg.url}
                  title={pkg.name}
                  id={pkg.name
                    .replace(/[^A-Za-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '')
                    .toLowerCase()}
                >
                  <p>{pkg.description}</p>
                  <p className="mt-2 text-xs text-fd-muted-foreground">
                    {pkg.symbols} documented symbols · v{pkg.version}
                  </p>
                  {pkg.entries.length > 0 ? (
                    <p className="mt-1 text-xs text-fd-muted-foreground">
                      Also: {pkg.entries.map((entry) => entry.title).join(', ')}
                    </p>
                  ) : null}
                </Card>
              ))}
            </Cards>
          </section>
        );
      })}
    </>
  );
}

/** Server-rendered body of a generated API page. */
export async function ApiPageBody({ file }: { file: ApiPageFile }) {
  return file.type === 'overview' ? <OverviewView page={file.page} /> : <SymbolPage page={file.page} />;
}
