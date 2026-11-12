import { Markdown } from 'fumadocs-core/content/md';
import { rehypeCode, remarkGfm } from 'fumadocs-core/mdx-plugins';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { ComponentProps, ReactNode } from 'react';
import type { DocText, Docs, SymbolNode } from '@docs-scripts/model.ts';
import { remarkApiLinks } from '@/lib/api/remark-api-links';
import { cn } from '@/lib/cn';

/** Documentation headings are demoted so they never compete with the page structure. */
function demoted(level: 4 | 5 | 6) {
  return function DocHeading({ className, ...props }: ComponentProps<'h4'>) {
    const Tag = `h${level}` as 'h4';

    return <Tag {...props} className={cn('mt-4 mb-1 text-sm font-semibold text-fd-foreground', className)} />;
  };
}

const components = {
  ...defaultMdxComponents,
  h1: demoted(4),
  h2: demoted(5),
  h3: demoted(6),
  h4: demoted(6),
  h5: demoted(6),
  h6: demoted(6),
};

/**
 * Render JSDoc/TSDoc or rustdoc Markdown on the server with the site's code blocks.
 *
 * Fenced code is highlighted with the same Shiki configuration as the authored guides. Raw HTML is
 * not interpreted, links come from the generator's resolved link table, and no client JavaScript
 * is required beyond the code block's copy button.
 */
export async function DocsMarkdown({ doc, className }: { doc: DocText; className?: string }): Promise<ReactNode> {
  if (!doc.markdown.trim()) return null;

  return (
    <div className={cn('api-docs prose-no-margin', className)}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkApiLinks(doc)]}
        rehypePlugins={[[rehypeCode, { themes: { light: 'github-light', dark: 'github-dark' } }]]}
        components={components}
      >
        {doc.markdown}
      </Markdown>
    </div>
  );
}

/** Heading plus Markdown for an optional documentation block. */
async function Block({ title, doc }: { title: string; doc: DocText | undefined }) {
  if (!doc?.markdown.trim()) return null;

  return (
    <div className="mt-4">
      <h4 className="mb-1 text-sm font-semibold text-fd-foreground">{title}</h4>
      <DocsMarkdown doc={doc} />
    </div>
  );
}

/**
 * Remarks, examples, thrown errors, references, and named sections of a documentation comment.
 *
 * The summary is rendered by the caller so it can sit directly under the signature.
 */
export async function DocsDetails({ docs }: { docs: Docs }) {
  return (
    <>
      <Block title="Remarks" doc={docs.remarks} />
      {docs.sections.map((section, index) => (
        <Block key={`${section.title}-${index}`} title={section.title} doc={section.body} />
      ))}
      {docs.throws.length > 0 ? (
        <div className="mt-4">
          <h4 className="mb-1 text-sm font-semibold text-fd-foreground">Throws</h4>
          <ul className="list-disc space-y-1 ps-5">
            {docs.throws.map((doc, index) => (
              <li key={index}>
                <DocsMarkdown doc={doc} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {docs.examples.map((example, index) => (
        <Block
          key={index}
          title={example.title ?? (docs.examples.length > 1 ? `Example ${index + 1}` : 'Example')}
          doc={example.body}
        />
      ))}
      {docs.see.length > 0 ? (
        <div className="mt-4">
          <h4 className="mb-1 text-sm font-semibold text-fd-foreground">See also</h4>
          <ul className="list-disc space-y-1 ps-5">
            {docs.see.map((doc, index) => (
              <li key={index}>
                <DocsMarkdown doc={doc} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/** Deprecation notice with the author's message. */
export async function DeprecatedNotice({ docs }: { docs: Docs }) {
  if (!docs.deprecated) return null;

  return (
    <div className="my-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <p className="font-semibold">Deprecated</p>
      {docs.deprecated.markdown.trim() ? <DocsMarkdown doc={docs.deprecated} /> : null}
    </div>
  );
}

/** Whether a symbol has documentation worth rendering beyond its signature. */
export function hasDocs(symbol: Pick<SymbolNode, 'docs'>): boolean {
  const docs = symbol.docs;

  return Boolean(docs.summary?.markdown.trim() || docs.remarks || docs.examples.length || docs.deprecated);
}
